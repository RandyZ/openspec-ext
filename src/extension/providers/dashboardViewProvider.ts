import * as vscode from 'vscode';
import * as path from 'path';
import { logger } from '../utils/logger';
import { DataManager, type CachedDashboardData, type DashboardData } from '../services/dataManager';
import { ProjectDataGateway } from '../services/projectDataGateway';
import type { OpenSpecCacheService, ProjectPageCacheKey } from '../services/openSpecCacheService';
import type { OpenSpecRootBinding, ProjectContext } from '../services/types';
import { InteractiveAgentTerminalManager } from '../services/interactiveAgentTerminalManager';
import {
  ChangeDetailPanelManager,
  createProjectBoundScope,
  type ChangeDetailPanelOptions,
} from './changeDetailPanelManager';
import type {
  CliActivationDiagnosticView,
  ExtensionMessage,
  ProjectChangesExplorerData,
  ProjectSidebarData,
  ProjectSpecsExplorerData,
} from '../../webview/types/messages';
import {
  handleWebviewMessage,
  getWebviewContent,
  getWorkflowLaunchConfigMessage,
} from './webviewMessageHandler';

type ProjectPageCache = Pick<OpenSpecCacheService, 'readProjectPage' | 'writeProjectPage'>;
type PendingExplorerContext = { message: ExtensionMessage; sent: boolean };
type ProjectSurface = 'sidebar' | 'dashboard';

export class DashboardViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'openspec.dashboard';
  private static readonly initialDataPostDelayMs = 100;
  private static readonly scopedPanelKeySeparator = '\u0000';
  private _view?: vscode.WebviewView;
  private dashboardPanel?: vscode.WebviewPanel;
  private specPanels = new Map<string, vscode.WebviewPanel>();
  private explorerPanels = new Map<string, vscode.WebviewPanel>();
  private pendingExplorerContexts = new Map<vscode.Webview, PendingExplorerContext>();
  private refreshSubscription?: vscode.Disposable;
  private currentProjectBinding?: OpenSpecRootBinding;
  private readonly originProjectContext?: ProjectContext;
  private cachedProjectSidebarData?: ProjectSidebarData;
  private readonly projectPageCache?: ProjectPageCache;
  private projectRequestGeneration = 0;
  private skipNextProjectRefreshCallback = false;

  constructor(
    private dataManager: DataManager,
    private extensionPath: string,
    private panelManager?: ChangeDetailPanelManager,
    private interactiveTerminalManager?: InteractiveAgentTerminalManager,
    private projectContext?: ProjectContext,
    private projectDataGateway?: ProjectDataGateway,
    projectPageCache?: ProjectPageCache
  ) {
    this.originProjectContext = projectContext;
    // DataManager remains the owner of the existing cache service; the optional
    // argument keeps this provider testable without adding a second cache.
    this.projectPageCache = projectPageCache
      ?? (dataManager as unknown as { cacheService?: ProjectPageCache }).cacheService;
    this.refreshSubscription = this.dataManager.onRefresh((data) => {
      if (this.isProjectFirst()) {
        if (this.skipNextProjectRefreshCallback) {
          this.skipNextProjectRefreshCallback = false;
          return;
        }
        void this.reloadProjectSidebarData();
        return;
      }
      this.postDashboardData(data);
    });
  }

  /**
   * Called when the view is first opened or becomes visible
   */
  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void | Thenable<void> {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.file(path.join(this.extensionPath, 'dist'))],
    };

    webviewView.webview.html = getWebviewContent(webviewView.webview, this.extensionPath);

    // Setup message handler
    this.setupMessageHandler(webviewView.webview);

    // Handle view disposal
    webviewView.onDidDispose(() => {
      this._view = undefined;
    });

    logger.info('Dashboard view resolved');
    if (this.isProjectFirst()) {
      this.postInitialProjectSidebarData(webviewView.webview);
    } else {
      this.postInitialDashboardData(webviewView.webview);
    }
  }

  dispose(): void {
    this.refreshSubscription?.dispose();
    this.refreshSubscription = undefined;
  }

  private postDashboardData(
    data: DashboardData,
    targetWebview?: vscode.Webview,
    cache?: {
      source: CachedDashboardData['source'] | 'fresh';
      stale: boolean;
      generatedAt?: number;
    }
  ): void {
    const webview = targetWebview ?? this._view?.webview;
    if (!webview) return;
    const debug = vscode.workspace.getConfiguration('openspec').get<boolean>('debug') ?? false;
    const message = {
      type: 'dashboardData' as const,
      data,
      debug,
      ...(cache ? { cache } : {}),
    };
    if (cache?.source === 'fresh') {
      this.postCliActivationDiagnostic(webview, 'warning');
      this.postWorkflowLaunchConfig(webview);
      webview.postMessage(message);
      return;
    }
    webview.postMessage(message);
    this.postCliActivationDiagnostic(webview, 'warning');
    this.postWorkflowLaunchConfig(webview);
  }

  private isProjectFirst(): boolean {
    return this.projectContext !== undefined && this.projectDataGateway !== undefined;
  }

  private projectSidebarBoundScope(): ReturnType<typeof createProjectBoundScope> | undefined {
    if (!this.isProjectFirst() || !this.currentProjectBinding) return undefined;
    return createProjectBoundScope(this.currentProjectBinding, this.projectContext?.label);
  }

  private sameProject(left: ProjectContext, right: ProjectContext): boolean {
    return left.id === right.id && left.projectPath === right.projectPath;
  }

  private sameBinding(left: OpenSpecRootBinding, right: OpenSpecRootBinding): boolean {
    return left.projectId === right.projectId
      && left.commandCwd === right.commandCwd
      && left.rootPath === right.rootPath
      && left.rootSource === right.rootSource
      && left.storeId === right.storeId;
  }

  private toCliDiagnosticView(): CliActivationDiagnosticView | undefined {
    const diagnostic = this.dataManager.getCliDiagnostic?.();
    if (!diagnostic) return undefined;
    return {
      category: diagnostic.category,
      message: diagnostic.message,
      recoveryActions: diagnostic.recoveryActions,
      safeDetails: diagnostic.safeDetails,
      copyText: diagnostic.copyText,
      canRetry: diagnostic.canRetry,
      normalizedMessage: diagnostic.normalizedMessage,
    };
  }

  private postProjectData(
    data: ProjectSidebarData,
    view: ProjectSurface,
    targetWebview?: vscode.Webview,
    cache: ProjectSidebarData['cache'] = { source: 'fresh', stale: false }
  ): void {
    const webview = targetWebview ?? this._view?.webview;
    if (!webview) return;
    webview.postMessage({
      type: 'setContext',
      view,
      data: { ...data, cache },
    });
    this.postWorkflowLaunchConfig(webview);
  }

  private isCompleteProjectSnapshot(value: unknown): value is ProjectSidebarData {
    if (!value || typeof value !== 'object') return false;
    const data = value as Partial<ProjectSidebarData>;
    const lifecycleStatuses = [
      'planning',
      'ready-to-apply',
      'applying',
      'ready-to-verify',
      'archived',
    ] as const;
    const hasLifecycleStatuses = (items: unknown): boolean => Array.isArray(items)
      && items.every((item) => {
        if (!item || typeof item !== 'object') return false;
        const status = (item as { lifecycleStatus?: unknown }).lifecycleStatus;
        return lifecycleStatuses.includes(status as (typeof lifecycleStatuses)[number]);
      });
    const hasOptionalLifecycleStatuses = (items: unknown): boolean => Array.isArray(items)
      && items.every((item) => {
        if (!item || typeof item !== 'object') return false;
        const status = (item as { lifecycleStatus?: unknown }).lifecycleStatus;
        return status === undefined
          || lifecycleStatuses.includes(status as (typeof lifecycleStatuses)[number]);
      });
    return Boolean(data.project && data.binding)
      && Array.isArray(data.changes)
      && Array.isArray(data.archivedChanges)
      && Array.isArray(data.projectSpecs)
      && Array.isArray(data.referencedStoreSpecs)
      && hasLifecycleStatuses(data.changes)
      && hasOptionalLifecycleStatuses(data.archivedChanges);
  }

  private publishProjectSnapshot(
    data: ProjectSidebarData,
    targetWebview: vscode.Webview | undefined,
    targetSurface: ProjectSurface,
    cache: ProjectSidebarData['cache'],
    publishDashboard = true,
  ): void {
    const posted = new Set<vscode.Webview>();
    const post = (webview: vscode.Webview | undefined, view: ProjectSurface) => {
      if (!webview || posted.has(webview)) return;
      posted.add(webview);
      this.postProjectData(data, view, webview, cache);
    };

    post(targetWebview, targetSurface);
    post(this._view?.webview, 'sidebar');
    if (publishDashboard) post(this.dashboardPanel?.webview, 'dashboard');
  }

  private postProjectLoadFailure(
    targetWebview: vscode.Webview,
    error: unknown,
    targetSurface: ProjectSurface,
    publishDashboard = true,
  ): void {
    const diagnostic = this.toCliDiagnosticView();
    const cached = this.cachedProjectSidebarData;
    if (
      cached
      && this.currentProjectBinding
      && this.sameBinding(cached.binding, this.currentProjectBinding)
      && this.projectContext
      && this.sameProject(cached.project, this.projectContext)
    ) {
      this.publishProjectSnapshot(
        {
          ...cached,
          ...(diagnostic ? { cliDiagnostic: diagnostic } : {}),
        },
        targetWebview,
        targetSurface,
        { source: 'memory', stale: true, generatedAt: cached.lastRefresh },
        publishDashboard,
      );
      if (diagnostic) {
        targetWebview.postMessage({ type: 'cliActivationDiagnostic', diagnostic, mode: 'warning' });
      } else {
        targetWebview.postMessage({
          type: 'error',
          message: `Project data may be stale: ${this.errorMessage(error)}`,
        });
      }
      return;
    }

    if (diagnostic) {
      targetWebview.postMessage({ type: 'cliActivationDiagnostic', diagnostic, mode: 'blocking' });
      return;
    }

    const phase = typeof error === 'object' && error !== null && 'phase' in error
      ? (error as { phase?: unknown }).phase
      : undefined;
    const message = phase === 'resolve'
      ? `OpenSpec workspace is not initialized for this project: ${this.errorMessage(error)}`
      : this.errorMessage(error);
    targetWebview.postMessage({ type: 'error', message });
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error
      ? error.message
      : typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message?: unknown }).message ?? 'Project data load failed')
        : 'Project data load failed';
  }

  private async reloadProjectSidebarData(
    targetWebview?: vscode.Webview,
    targetSurface: ProjectSurface = 'sidebar',
    publishDashboard = true,
  ): Promise<void> {
    if (!this.projectContext || !this.projectDataGateway) return;
    const generation = ++this.projectRequestGeneration;
    try {
      const project = this.projectContext;
      const sidebarLoader = this.projectDataGateway.loadProjectSidebarData;
      let result: Awaited<ReturnType<ProjectDataGateway['loadProjectSidebarData']>>;
      let worksetNavigation: Awaited<ReturnType<ProjectDataGateway['loadWorksetNavigation']>> | undefined;
      if (typeof sidebarLoader === 'function') {
        result = await sidebarLoader.call(this.projectDataGateway, project);
      } else {
        const navigationLoader = this.projectDataGateway.loadWorksetNavigation;
        const legacyResult = await Promise.all([
          this.projectDataGateway.loadChanges(project),
          typeof navigationLoader === 'function'
            ? navigationLoader.call(this.projectDataGateway, project).catch((error: unknown) => {
              logger.warn('Failed to load Project Workset navigation', error as Error);
              return undefined;
            })
            : Promise.resolve(undefined),
        ]);
        result = legacyResult[0];
        worksetNavigation = legacyResult[1];
      }
      if (
        generation !== this.projectRequestGeneration
        || !this.sameProject(result.project, project)
        || result.binding.projectId !== project.id
      ) {
        return;
      }
      const changes = result.changes.filter((change) => (
        (change as { lifecycleStatus?: string }).lifecycleStatus !== 'archived'
        && !change.name.startsWith('archive:')
      ));
      const data: ProjectSidebarData = {
        project: result.project,
        binding: result.binding,
        changes,
        archivedChanges: result.archivedChanges ?? [],
        projectSpecs: result.projectSpecs ?? [],
        referencedStoreSpecs: result.referencedStoreSpecs ?? [],
        ...(result.worksetNavigation?.worksets.length
          ? { worksetNavigation: result.worksetNavigation }
          : worksetNavigation?.worksets.length ? { worksetNavigation } : {}),
        workflowLaunchConfig: getWorkflowLaunchConfigMessage().config,
        lastRefresh: Date.now(),
      };
      this.currentProjectBinding = result.binding;
      this.cachedProjectSidebarData = data;
      this.publishProjectSnapshot(
        data,
        targetWebview,
        targetSurface,
        { source: 'fresh', stale: false },
        publishDashboard,
      );
      await this.writeProjectSidebarCache(data);
    } catch (error) {
      if (generation !== this.projectRequestGeneration) return;
      const webview = targetWebview ?? this._view?.webview;
      if (!webview) return;
      logger.error('Failed to load current Project Sidebar data', error as Error);
      this.postProjectLoadFailure(webview, error, targetSurface, publishDashboard);
    }
  }

  private postInitialProjectSidebarData(
    targetWebview: vscode.Webview,
    targetSurface: ProjectSurface = 'sidebar',
  ): void {
    setTimeout(() => {
      void (async () => {
        const cacheSource = await this.postCachedProjectSidebarData(targetWebview, targetSurface);
        if (targetSurface === 'dashboard' && cacheSource === 'memory') return;
        await this.reloadProjectSidebarData(targetWebview, targetSurface);
      })();
    }, DashboardViewProvider.initialDataPostDelayMs);
  }

  private projectSidebarCacheKey(binding: OpenSpecRootBinding): ProjectPageCacheKey {
    return {
      pageKind: 'sidebar',
      projectId: binding.projectId,
      rootPath: binding.rootPath,
      rootSource: binding.rootSource,
      ...(binding.storeId ? { storeId: binding.storeId } : {}),
    };
  }

  private async postCachedProjectSidebarData(
    targetWebview: vscode.Webview,
    targetSurface: ProjectSurface = 'sidebar',
  ): Promise<'memory' | 'disk' | undefined> {
    if (!this.projectContext) return undefined;
    const cached = this.cachedProjectSidebarData;
    if (
      cached
      && this.currentProjectBinding
      && this.sameBinding(cached.binding, this.currentProjectBinding)
      && this.sameProject(cached.project, this.projectContext)
    ) {
      this.postProjectData(
        cached,
        targetSurface,
        targetWebview,
        { source: 'memory', stale: true, generatedAt: cached.lastRefresh },
      );
      return 'memory';
    }

    if (!this.projectPageCache || !this.projectDataGateway) return undefined;
    let binding = this.currentProjectBinding;
    if (!binding) {
      try {
        binding = await this.projectDataGateway.resolveBinding(this.projectContext);
      } catch {
        return undefined;
      }
    }
    if (
      binding.projectId !== this.projectContext.id
      || binding.commandCwd !== this.projectContext.projectPath
    ) return undefined;

    const cachedPage = await this.projectPageCache.readProjectPage<ProjectSidebarData>(
      this.projectSidebarCacheKey(binding),
    );
    if (!cachedPage) return undefined;
    const data = cachedPage.payload;
    if (
      !this.isCompleteProjectSnapshot(data)
      || !this.sameProject(data.project, this.projectContext)
      || !this.sameBinding(data.binding, binding)
    ) return undefined;

    this.currentProjectBinding = binding;
    this.cachedProjectSidebarData = data;
    this.postProjectData(
      data,
      targetSurface,
      targetWebview,
      { source: 'disk', stale: true, generatedAt: cachedPage.metadata.generatedAt },
    );
    return 'disk';
  }

  private async writeProjectSidebarCache(data: ProjectSidebarData): Promise<void> {
    if (!this.projectPageCache) return;
    try {
      await this.projectPageCache.writeProjectPage(this.projectSidebarCacheKey(data.binding), data);
    } catch (error) {
      logger.warn('Failed to write Project Sidebar cache', error as Error);
    }
  }

  private postCliActivationDiagnostic(targetWebview: vscode.Webview, mode: 'blocking' | 'warning'): void {
    const diagnostic = this.dataManager.getCliDiagnostic?.();
    if (!diagnostic) return;
    const viewDiagnostic: CliActivationDiagnosticView = {
      category: diagnostic.category,
      message: diagnostic.message,
      recoveryActions: diagnostic.recoveryActions,
      safeDetails: diagnostic.safeDetails,
      copyText: diagnostic.copyText,
      canRetry: diagnostic.canRetry,
      normalizedMessage: diagnostic.normalizedMessage,
    };
    targetWebview.postMessage({ type: 'cliActivationDiagnostic', diagnostic: viewDiagnostic, mode });
  }

  public postWorkflowLaunchConfig(targetWebview?: vscode.Webview): void {
    const webview = targetWebview ?? this._view?.webview;
    if (!webview) return;
    webview.postMessage(getWorkflowLaunchConfigMessage());
  }

  public openInEditor(): void {
    if (this.dashboardPanel) {
      this.dashboardPanel.reveal(vscode.ViewColumn.One);
      if (this.isProjectFirst()) {
        this.postInitialProjectSidebarData(this.dashboardPanel.webview, 'dashboard');
      } else {
        this.postInitialDashboardData(this.dashboardPanel.webview);
      }
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'openspecDashboard',
      'OpenSpec Dashboard',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.file(path.join(this.extensionPath, 'dist'))],
      }
    );
    this.dashboardPanel = panel;
    panel.webview.html = getWebviewContent(panel.webview, this.extensionPath);
    this.setupMessageHandler(panel.webview);
    panel.onDidDispose(() => {
      this.dashboardPanel = undefined;
    });
    logger.info('Dashboard editor panel opened');
    if (this.isProjectFirst()) {
      this.postInitialProjectSidebarData(panel.webview, 'dashboard');
    } else {
      this.postInitialDashboardData(panel.webview);
    }
  }

  private postInitialDashboardData(targetWebview?: vscode.Webview): void {
    setTimeout(() => {
      if (!targetWebview) return;
      (async () => {
        const cached = await this.dataManager.getCachedDashboardData?.();
        if (cached) {
          this.postDashboardData(cached.payload, targetWebview, {
            source: cached.source,
            stale: true,
            generatedAt: cached.metadata.generatedAt,
          });
        }
        const data = await this.dataManager.refresh();
        return data;
      })()
        .then((data) => {
          logger.info('Posting initial dashboard data to webview');
          this.postDashboardData(data, targetWebview, { source: 'fresh', stale: false });
        })
        .catch((err) => {
          logger.error('Failed to post initial dashboard data', err as Error);
          const diagnostic = this.dataManager.getCliDiagnostic?.();
          if (diagnostic) {
            this.postCliActivationDiagnostic(targetWebview, 'blocking');
            return;
          }
          targetWebview.postMessage({
            type: 'error',
            message: (err as Error).message || 'Failed to load dashboard data',
          });
        });
    }, DashboardViewProvider.initialDataPostDelayMs);
  }

  /**
   * Reveal the view (make it visible if hidden)
   */
  public reveal(): void {
    logger.debug('OpenSpec sidebar reveal called');
    void vscode.commands.executeCommand('workbench.view.extension.openspec');
    if (this._view) {
      this._view.show?.(false);
    }
  }

  /**
   * Open the Change Detail editor for a change, optionally at a specific tab
   * and with an interactive workflow action to auto-start (e.g. verify).
   * Used by direct-archive verify-first guidance and command-palette entry.
   */
  public openChangeDetail(
    changeName: string,
    options?: ChangeDetailPanelOptions
  ): void {
    if (!this.panelManager) return;
    this.panelManager.open(changeName, options);
  }

  /**
   * Setup message handler for webview communication
   */
  private setupMessageHandler(
    webview: vscode.Webview,
    boundScope?: ReturnType<typeof createProjectBoundScope>,
    suppressProjectSidebar = false,
    onProjectSidebarReady?: () => void,
  ): void {
    webview.onDidReceiveMessage(
      async (message) => {
        try {
          await this.handleMessage(
            message,
            webview,
            boundScope,
            suppressProjectSidebar,
            onProjectSidebarReady,
          );
        } catch (error) {
          logger.error('Error handling webview message', error as Error);
        }
      },
      undefined,
      []
    );
  }

  /**
   * Handle messages from webview (sidebar). openChangeDetailInEditor is handled here.
   */
  private postPendingExplorerContext(webview: vscode.Webview): boolean {
    const pending = this.pendingExplorerContexts.get(webview);
    if (!pending) return false;
    webview.postMessage(pending.message);
    pending.sent = true;
    return true;
  }

  private async handleMessage(
    message: any,
    webview: vscode.Webview,
    boundScope?: ReturnType<typeof createProjectBoundScope>,
    suppressProjectSidebar = false,
    onProjectSidebarReady?: () => void,
  ): Promise<void> {
    if (suppressProjectSidebar && message.type === 'getProjectSidebarData') {
      onProjectSidebarReady?.();
      return;
    }
    const explorerContextConsumed = message.type === 'getProjectSidebarData'
      && this.postPendingExplorerContext(webview);

    if (message.type === 'selectWorksetProject' && this.isProjectFirst()) {
      await this.selectWorksetProject(message.worksetName, message.memberPath, webview);
      return;
    }
    if (message.type === 'selectCurrentProject' && this.isProjectFirst()) {
      await this.selectCurrentProject(webview);
      return;
    }
    if (message.type === 'openProjectDashboard' && this.isProjectFirst()) {
      this.openInEditor();
      return;
    }

    const projectSidebarScope = boundScope ?? this.projectSidebarBoundScope();
    if (
      this.isProjectFirst()
      && !boundScope
      && !projectSidebarScope
      && (message.type === 'requestNewChange' || message.type === 'launchWorkflowAction')
    ) {
      logger.warn('Rejected Project Sidebar action before its Project binding was resolved');
      return;
    }

    if (message.type === 'getProjectSidebarData' && this.isProjectFirst()) {
      if (explorerContextConsumed) return;
      const surface = webview === this.dashboardPanel?.webview ? 'dashboard' : 'sidebar';
      await this.postCachedProjectSidebarData(webview, surface);
      await this.reloadProjectSidebarData(webview, surface);
      return;
    }
    if (message.type === 'refresh' && this.isProjectFirst()) {
      this.skipNextProjectRefreshCallback = true;
      try {
        await this.dataManager.refresh();
      } catch (error) {
        logger.error('Project Sidebar refresh failed', error as Error);
      } finally {
        this.skipNextProjectRefreshCallback = false;
      }
      const surface = webview === this.dashboardPanel?.webview ? 'dashboard' : 'sidebar';
      await this.reloadProjectSidebarData(webview, surface);
      return;
    }
    if (message.type === 'openChangesExplorer' && this.isProjectFirst()) {
      await this.openChangesExplorer(message.project, message.binding);
      return;
    }
    if (message.type === 'openSpecsExplorer' && this.isProjectFirst()) {
      await this.openSpecsExplorer(message.project, message.binding);
      return;
    }
    if (
      this.isProjectFirst()
      && (message.type === 'openChangeDetailInEditor' || message.type === 'openSpecInEditor')
      && (!message.project || !message.binding)
    ) {
      logger.warn(`Rejected unbound Project-first ${message.type} request`);
      return;
    }
    if (message.type === 'openChangeDetailInEditor' && message.changeName && this.panelManager) {
      if (message.project || message.binding) {
        const binding = await this.verifyProjectBinding(message.project, message.binding);
        if (!binding) return;
        this.panelManager.open(message.changeName, {
          initialTab: message.initialTab,
          interactiveAction: message.interactiveAction,
          project: this.projectContext,
          binding,
        });
        return;
      }
      this.panelManager.open(message.changeName, {
        initialTab: message.initialTab,
        interactiveAction: message.interactiveAction,
        scopeId: message.scopeId,
      });
      return;
    }
    if (message.type === 'openSpecInEditor' && message.specId) {
      if (message.project || message.binding) {
        const binding = await this.verifyProjectBinding(message.project, message.binding);
        if (!binding) return;
        await this.openSpecPanel(
          message.specId,
          message.requirementIndex,
          undefined,
          this.projectContext,
          binding
        );
        return;
      }
      await this.openSpecPanel(message.specId, message.requirementIndex, message.scopeId);
      return;
    }

    // CLI activation diagnostic recovery actions
    if (message.type === 'openCliPathSettings') {
      await vscode.commands.executeCommand('workbench.action.openSettings', 'openspec.cliPath');
      return;
    }
    if (message.type === 'openCliInstallDocs') {
      await vscode.env.openExternal(vscode.Uri.parse('https://github.com/Fission-AI/OpenSpec#quick-start'));
      return;
    }
    if (message.type === 'copyCliDiagnostic') {
      const diagnostic = this.dataManager.getCliDiagnostic();
      if (diagnostic) {
        await vscode.env.clipboard.writeText(diagnostic.copyText);
      }
      return;
    }
    if (message.type === 'retryCliDetection') {
      try {
        const data = await this.dataManager.refresh();
        if (this.isProjectFirst()) {
          await this.reloadProjectSidebarData(webview);
        } else {
          webview.postMessage({ type: 'dashboardData', data, debug: vscode.workspace.getConfiguration('openspec').get<boolean>('debug') ?? false });
          this.postCliActivationDiagnostic(webview, 'warning');
        }
      } catch (err) {
        logger.error('Retry CLI detection failed', err as Error);
        if (this.isProjectFirst()) {
          await this.reloadProjectSidebarData(webview);
        } else {
          this.postCliActivationDiagnostic(webview, 'blocking');
        }
      }
      return;
    }

    await handleWebviewMessage(
      message,
      webview,
      this.dataManager,
      this.interactiveTerminalManager,
      projectSidebarScope
    );
  }

  private async verifyProjectBinding(
    project: unknown,
    binding: unknown
  ): Promise<OpenSpecRootBinding | undefined> {
    if (!this.projectContext || !this.projectDataGateway) return undefined;
    if (!project || typeof project !== 'object' || !binding || typeof binding !== 'object') return undefined;
    const requestedProject = project as Partial<ProjectContext>;
    const requestedBinding = binding as Partial<OpenSpecRootBinding>;
    if (
      requestedProject.id !== this.projectContext.id
      || requestedProject.projectPath !== this.projectContext.projectPath
      || requestedBinding.projectId !== this.projectContext.id
      || requestedBinding.commandCwd !== this.projectContext.projectPath
      || typeof requestedBinding.rootPath !== 'string'
      || typeof requestedBinding.rootSource !== 'string'
    ) {
      return undefined;
    }

    if (
      this.currentProjectBinding
      && this.sameBinding(this.currentProjectBinding, requestedBinding as OpenSpecRootBinding)
    ) {
      return this.currentProjectBinding;
    }

    try {
      const resolved = await this.projectDataGateway.resolveBinding(
        this.projectContext,
        requestedBinding.storeId
      );
      return this.sameBinding(resolved, requestedBinding as OpenSpecRootBinding)
        ? resolved
        : undefined;
    } catch (error) {
      logger.warn('Rejected Project binding request', error as Error);
      return undefined;
    }
  }

  private explorerPanelKey(
    pageKind: 'changesExplorer' | 'specsExplorer',
    binding: OpenSpecRootBinding
  ): string {
    return [
      pageKind,
      binding.projectId,
      binding.rootPath,
      binding.rootSource,
      binding.storeId ?? '',
    ].join(DashboardViewProvider.scopedPanelKeySeparator);
  }

  private async openChangesExplorer(project: unknown, binding: unknown): Promise<void> {
    const verifiedBinding = await this.verifyProjectBinding(project, binding);
    if (!verifiedBinding || !this.projectContext || !this.projectDataGateway) return;
    try {
      const [changes, archived] = await Promise.all([
        this.projectDataGateway.loadChanges(this.projectContext, verifiedBinding.storeId),
        this.projectDataGateway.loadArchivedChanges(this.projectContext, verifiedBinding.storeId),
      ]);
      if (
        !this.sameBinding(changes.binding, verifiedBinding)
        || !this.sameBinding(archived.binding, verifiedBinding)
      ) {
        return;
      }
      const data: ProjectChangesExplorerData = {
        project: this.projectContext,
        binding: verifiedBinding,
        changes: changes.changes,
        archivedChanges: archived.archivedChanges,
      };
      await this.openExplorerPanel('changesExplorer', verifiedBinding, {
        type: 'setContext',
        view: 'changesExplorer',
        data,
      });
    } catch (error) {
      logger.error('Failed to open Changes Explorer', error as Error);
    }
  }

  private async selectWorksetProject(
    worksetName: unknown,
    memberPath: unknown,
    targetWebview: vscode.Webview
  ): Promise<void> {
    if (!this.projectContext || !this.projectDataGateway
      || typeof worksetName !== 'string' || typeof memberPath !== 'string') return;
    const resolveMember = this.projectDataGateway.resolveWorksetProject;
    if (typeof resolveMember !== 'function') return;

    try {
      const currentProject = this.projectContext;
      const nextProject = await resolveMember.call(
        this.projectDataGateway,
        currentProject,
        worksetName,
        memberPath,
      );
      if (!nextProject || this.sameProject(nextProject, currentProject)) return;
      const nextBinding = await this.projectDataGateway.resolveBinding(nextProject);
      if (
        nextBinding.projectId !== nextProject.id
        || nextBinding.commandCwd !== nextProject.projectPath
      ) return;

      this.dataManager.setWatchedProjectRoot?.(nextProject.projectPath);
      this.projectContext = nextProject;
      this.currentProjectBinding = nextBinding;
      this.cachedProjectSidebarData = undefined;
      await this.reloadProjectSidebarData(targetWebview, 'sidebar', false);
    } catch (error) {
      logger.warn('Rejected Workset Project selection', error as Error);
    }
  }

  private async selectCurrentProject(targetWebview: vscode.Webview): Promise<void> {
    if (!this.projectContext || !this.projectDataGateway || !this.originProjectContext) return;
    if (this.sameProject(this.projectContext, this.originProjectContext)) return;
    try {
      const nextBinding = await this.projectDataGateway.resolveBinding(this.originProjectContext);
      if (
        nextBinding.projectId !== this.originProjectContext.id
        || nextBinding.commandCwd !== this.originProjectContext.projectPath
      ) return;
      this.dataManager.setWatchedProjectRoot?.(this.originProjectContext.projectPath);
      this.projectContext = this.originProjectContext;
      this.currentProjectBinding = nextBinding;
      this.cachedProjectSidebarData = undefined;
      await this.reloadProjectSidebarData(targetWebview);
    } catch (error) {
      logger.warn('Failed to restore Current Project', error as Error);
    }
  }

  private async openSpecsExplorer(project: unknown, binding: unknown): Promise<void> {
    const verifiedBinding = await this.verifyProjectBinding(project, binding);
    if (!verifiedBinding || !this.projectContext || !this.projectDataGateway) return;
    try {
      const [projectSpecs, referencedStoreSpecs] = await Promise.all([
        this.projectDataGateway.loadCanonicalSpecs(this.projectContext, verifiedBinding.storeId),
        this.projectDataGateway.loadReferencedStoreSpecs(this.projectContext),
      ]);
      if (
        !this.sameBinding(projectSpecs.binding, verifiedBinding)
        || !this.sameBinding(referencedStoreSpecs.binding, verifiedBinding)
      ) {
        return;
      }
      const data: ProjectSpecsExplorerData = {
        project: this.projectContext,
        binding: verifiedBinding,
        projectSpecs: projectSpecs.specs,
        referencedStoreSpecs: referencedStoreSpecs.groups,
      };
      await this.openExplorerPanel('specsExplorer', verifiedBinding, {
        type: 'setContext',
        view: 'specsExplorer',
        data,
      });
    } catch (error) {
      logger.error('Failed to open Specs Explorer', error as Error);
    }
  }

  private async openExplorerPanel(
    pageKind: 'changesExplorer' | 'specsExplorer',
    binding: OpenSpecRootBinding,
    contextMessage: ExtensionMessage
  ): Promise<void> {
    const key = this.explorerPanelKey(pageKind, binding);
    const existing = this.explorerPanels.get(key);
    if (existing) {
      existing.reveal(vscode.ViewColumn.One);
      if (this.explorerPanels.get(key) === existing) {
        existing.webview.postMessage(contextMessage);
      }
      return;
    }

    const title = pageKind === 'changesExplorer' ? 'OpenSpec Changes' : 'OpenSpec Specs';
    const viewType = pageKind === 'changesExplorer'
      ? 'openspecChangesExplorer'
      : 'openspecSpecsExplorer';
    const panel = vscode.window.createWebviewPanel(
      viewType,
      title,
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.file(path.join(this.extensionPath, 'dist'))],
      }
    );
    let disposed = false;
    this.explorerPanels.set(key, panel);
    this.pendingExplorerContexts.set(panel.webview, { message: contextMessage, sent: false });
    panel.webview.html = getWebviewContent(panel.webview, this.extensionPath);
    const boundScope = createProjectBoundScope(binding, this.projectContext?.label);
    this.setupMessageHandler(panel.webview, boundScope);
    panel.onDidDispose(() => {
      disposed = true;
      this.explorerPanels.delete(key);
      this.pendingExplorerContexts.delete(panel.webview);
    });
    setTimeout(() => {
      if (disposed || this.explorerPanels.get(key) !== panel) return;
      const pending = this.pendingExplorerContexts.get(panel.webview);
      if (pending && !pending.sent) {
        pending.sent = true;
        panel.webview.postMessage(pending.message);
      }
    }, DashboardViewProvider.initialDataPostDelayMs);
  }

  private async openSpecPanel(
    specId: string,
    _requirementIndex?: number,
    scopeId?: string,
    project?: ProjectContext,
    binding?: OpenSpecRootBinding
  ): Promise<void> {
    // Resolve the scope (store root) so the spec is read from the same root it was
    // listed from, not the workspace local root.
    const scope = binding
      ? createProjectBoundScope(binding, project?.label)
      : this.dataManager.resolveScope(scopeId);
    const key = binding
      ? `${this.explorerPanelKey('specsExplorer', binding)}${DashboardViewProvider.scopedPanelKeySeparator}${binding.storeId ?? 'project'}${DashboardViewProvider.scopedPanelKeySeparator}${specId}`
      : `${scope?.id ?? scopeId ?? 'default'}${DashboardViewProvider.scopedPanelKeySeparator}${specId}`;
    const existing = this.specPanels.get(key);
    if (existing) {
      existing.reveal(vscode.ViewColumn.One);
      const content = await this.dataManager.readSpec(specId, scope);
      if (this.specPanels.get(key) === existing) {
        existing.webview.postMessage({ type: 'specContent', specId, content });
      }
      return;
    }

    try {
      const content = await this.dataManager.readSpec(specId, scope);
      const panel = vscode.window.createWebviewPanel(
        'openspecSpecPreview',
        `Spec: ${specId}`,
        vscode.ViewColumn.One,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
          localResourceRoots: [vscode.Uri.file(path.join(this.extensionPath, 'dist'))],
        }
      );
      this.specPanels.set(key, panel);
      let disposed = false;
      panel.webview.html = getWebviewContent(panel.webview, this.extensionPath);
      panel.onDidDispose(() => {
        disposed = true;
        this.specPanels.delete(key);
      });
      let projectSidebarReady = false;
      const postSpecContent = () => {
        panel.webview.postMessage({ type: 'specContent', specId, content });
      };
      this.setupMessageHandler(
        panel.webview,
        binding ? scope : undefined,
        true,
        () => {
          projectSidebarReady = true;
          postSpecContent();
        },
      );
      setTimeout(() => {
        if (disposed || this.specPanels.get(key) !== panel || projectSidebarReady) return;
        postSpecContent();
      }, 200);
    } catch (err) {
      vscode.window.showErrorMessage(`Failed to open spec: ${specId}`);
    }
  }
}
