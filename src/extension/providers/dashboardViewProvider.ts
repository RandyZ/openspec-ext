import * as vscode from 'vscode';
import * as path from 'path';
import { realpath } from 'fs/promises';
import { logger } from '../utils/logger';
import { t } from '../../i18n';
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

/**
 * Terminal outcome of a Project Sidebar reload. `superseded` means a newer
 * generation's reload took ownership: this reload published nothing and the
 * caller must consult the newer reload's snapshot before judging results.
 */
type ProjectReloadOutcome = 'published' | 'superseded' | 'failed';

/** Reload-path options; `suppressFailurePosts` keeps failure reporting to the
 * owning flow (e.g. Workset creation posts its own single recoverable result). */
type ProjectReloadOptions = { suppressFailurePosts?: boolean };

/**
 * A Project Planning-root selection in flight. `requestedStoreId` is the
 * selector for this request only (`undefined` forces a selector-free load);
 * `expectedCanonicalRoot` is the canonical root of the freshly validated Store
 * member the accepted binding must match; `onAccepted` runs after every
 * acceptance check passes and before any Provider state is replaced.
 */
type ProjectStoreSelectionRequest = {
  readonly requestedStoreId?: string;
  readonly expectedCanonicalRoot?: string;
  readonly onAccepted?: (binding: OpenSpecRootBinding) => void;
};

export class DashboardViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'openspec.dashboard';
  private static readonly initialDataPostDelayMs = 100;
  private static readonly scopedPanelKeySeparator = '\u0000';
  /** Bound on following superseded reloads so continuous refreshes cannot loop forever. */
  private static readonly maxSupersededReloadFollows = 20;
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
  /** Newest in-flight (or settled) Project Sidebar reload; lets a superseded caller follow the chain. */
  private latestProjectReload?: Promise<ProjectReloadOutcome>;
  private skipNextProjectRefreshCallback = false;
  /** Ephemeral, process-local explicit Planning Store selector for the current Project. */
  private explicitProjectStoreId?: string;
  /** Single-flight lock: at most one Workset creation may run at a time. */
  private worksetCreateInFlight = false;

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

  /**
   * One recoverable `error` message for a failed Planning-root selection, on
   * the same channel project-load and `openWorkset` failures use. State stays
   * fail-closed: no snapshot is published and nothing else is replaced.
   */
  private postSelectionError(targetWebview: vscode.Webview | undefined, error: unknown): void {
    if (!targetWebview) return;
    targetWebview.postMessage({
      type: 'error',
      message: (error as Error | undefined)?.message
        || t('worksetNavigation.planningRootSelectFailed'),
    });
  }

  /**
   * Reload and publish Project Sidebar data. The returned outcome tells the
   * caller what happened: `superseded` reloads published nothing (a newer
   * generation owns the result), `failed` reloads posted their own failure (or
   * suppressed it via options), `published` refreshed the cached snapshot.
   */
  private async reloadProjectSidebarData(
    targetWebview?: vscode.Webview,
    targetSurface: ProjectSurface = 'sidebar',
    publishDashboard = true,
    storeSelection?: ProjectStoreSelectionRequest,
    options?: ProjectReloadOptions,
  ): Promise<ProjectReloadOutcome> {
    const reload = this.runProjectSidebarReload(
      targetWebview,
      targetSurface,
      publishDashboard,
      storeSelection,
      options,
    );
    // Recorded synchronously (the body's generation bump runs synchronously
    // too, with no await in between) so superseded callers can always find the
    // newest reload promise.
    this.latestProjectReload = reload;
    return reload;
  }

  private async runProjectSidebarReload(
    targetWebview: vscode.Webview | undefined,
    targetSurface: ProjectSurface,
    publishDashboard: boolean,
    storeSelection: ProjectStoreSelectionRequest | undefined,
    options: ProjectReloadOptions | undefined,
  ): Promise<ProjectReloadOutcome> {
    if (!this.projectContext || !this.projectDataGateway) return 'failed';
    const generation = ++this.projectRequestGeneration;
    // Capture the selector at request time; a selection-driven reload may
    // override it, including forcing a selector-free load.
    const requestedStoreId = storeSelection ? storeSelection.requestedStoreId : this.explicitProjectStoreId;
    try {
      const project = this.projectContext;
      const sidebarLoader = this.projectDataGateway.loadProjectSidebarData;
      let result: Awaited<ReturnType<ProjectDataGateway['loadProjectSidebarData']>>;
      let worksetNavigation: Awaited<ReturnType<ProjectDataGateway['loadWorksetNavigation']>> | undefined;
      if (typeof sidebarLoader === 'function') {
        result = await sidebarLoader.call(this.projectDataGateway, project, requestedStoreId);
      } else {
        const navigationLoader = this.projectDataGateway.loadWorksetNavigation;
        const legacyResult = await Promise.all([
          this.projectDataGateway.loadChanges(project, requestedStoreId),
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
        || result.binding.commandCwd !== project.projectPath
        || (requestedStoreId !== undefined && result.binding.storeId !== requestedStoreId)
        || (storeSelection?.expectedCanonicalRoot !== undefined
          && result.binding.rootPath !== storeSelection.expectedCanonicalRoot)
      ) {
        // A dropped refresh is permanently silent in the UI: log the expected
        // versus actual context so the mismatch is diagnosable afterwards.
        logger.warn(
          `Project Sidebar refresh dropped by the acceptance gate: `
          + `generation ${generation} (current ${this.projectRequestGeneration}), `
          + `project ${result.project.id}@${result.binding.commandCwd} `
          + `(expected ${project.id}@${project.projectPath}), `
          + `storeId ${result.binding.storeId ?? 'none'} (requested ${requestedStoreId ?? 'none'}), `
          + `root ${result.binding.rootPath} `
          + `(expected ${storeSelection?.expectedCanonicalRoot ?? 'any'})`
        );
        return 'superseded';
      }
      const changes = result.changes.filter((change) => (
        (change as { lifecycleStatus?: string }).lifecycleStatus !== 'archived'
        && !change.name.startsWith('archive:')
      ));
      // Authoritative Workset-capability fact from the DataManager's CLI
      // feature detection — the Gateway's navigation can be present-but-empty
      // when the runtime lacks the capability, so emptiness is not a signal.
      const worksetCapabilityAvailable = this.dataManager.getCapabilities?.()?.worksets === true;
      const navigation = result.worksetNavigation ?? worksetNavigation;
      const data: ProjectSidebarData = {
        project: result.project,
        binding: result.binding,
        // Authoritative explicit-selector fact from the Gateway; the fallback
        // covers legacy gateway shapes that only receive the selector argument.
        explicitStoreSelector: result.explicitStoreSelector ?? requestedStoreId !== undefined,
        changes,
        archivedChanges: result.archivedChanges ?? [],
        projectSpecs: result.projectSpecs ?? [],
        referencedStoreSpecs: result.referencedStoreSpecs ?? [],
        // Navigation publishes even when empty: an empty list with the Create
        // entry is the primary first-Workset creation surface.
        ...(navigation ? { worksetNavigation: navigation } : {}),
        worksetCapabilityAvailable,
        workflowLaunchConfig: getWorkflowLaunchConfigMessage().config,
        lastRefresh: Date.now(),
      };
      storeSelection?.onAccepted?.(result.binding);
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
      return 'published';
    } catch (error) {
      if (generation !== this.projectRequestGeneration) return 'superseded';
      if (options?.suppressFailurePosts) {
        // The owning flow (Workset creation) reports this failure itself as
        // its single recoverable result; no generic error is posted here.
        logger.warn('Suppressed Project Sidebar reload failure post', error as Error);
        return 'failed';
      }
      if (storeSelection) {
        // A rejected Planning-root selection is fail-closed: the previous
        // Project, binding, watcher, explicit selector, and visible snapshot
        // stay untouched and no snapshot is published — but the user still
        // gets one recoverable error instead of a silent no-op.
        logger.warn('Rejected Project Planning-root selection', error as Error);
        this.postSelectionError(targetWebview ?? this._view?.webview, error);
        return 'failed';
      }
      const webview = targetWebview ?? this._view?.webview;
      if (!webview) return 'failed';
      logger.error('Failed to load current Project Sidebar data', error as Error);
      this.postProjectLoadFailure(webview, error, targetSurface, publishDashboard);
      return 'failed';
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
        binding = await this.projectDataGateway.resolveBinding(
          this.projectContext,
          this.explicitProjectStoreId
        );
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
    if (message.type === 'selectWorksetStore' && this.isProjectFirst()) {
      await this.selectWorksetStore(message.worksetName, message.memberPath, webview);
      return;
    }
    if (message.type === 'selectProjectDefaultRoot' && this.isProjectFirst()) {
      await this.selectProjectDefaultRoot(webview);
      return;
    }
    if (message.type === 'selectCurrentProject' && this.isProjectFirst()) {
      await this.selectCurrentProject(webview);
      return;
    }
    if (message.type === 'pickWorksetMembers' && this.isProjectFirst()) {
      await this.pickWorksetMembers(webview);
      return;
    }
    if (message.type === 'createWorkset' && this.isProjectFirst()) {
      await this.submitWorksetCreation(message, webview);
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

    // Capture the request generation before any await: a superseded selection
    // must not replace state or start a reload after a newer request committed.
    const selectionGeneration = this.projectRequestGeneration;
    try {
      const currentProject = this.projectContext;
      const nextProject = await resolveMember.call(
        this.projectDataGateway,
        currentProject,
        worksetName,
        memberPath,
      );
      if (selectionGeneration !== this.projectRequestGeneration) {
        logger.warn('Discarded superseded Workset Project selection');
        return;
      }
      if (!nextProject || this.sameProject(nextProject, currentProject)) return;
      // An explicit Planning Store selector stays active across Project members.
      const nextBinding = await this.projectDataGateway.resolveBinding(
        nextProject,
        this.explicitProjectStoreId
      );
      if (selectionGeneration !== this.projectRequestGeneration) {
        logger.warn('Discarded superseded Workset Project selection');
        return;
      }
      if (
        nextBinding.projectId !== nextProject.id
        || nextBinding.commandCwd !== nextProject.projectPath
        || (this.explicitProjectStoreId !== undefined
          && nextBinding.storeId !== this.explicitProjectStoreId)
      ) return;

      // While an explicit Store selector stays active, the displayed data comes
      // from the store binding root: the watcher must follow that root, not the
      // Project path, or store-root edits would never auto-refresh.
      this.dataManager.setWatchedProjectRoot?.(
        nextBinding.storeId !== undefined ? nextBinding.rootPath : nextProject.projectPath
      );
      this.projectContext = nextProject;
      this.currentProjectBinding = nextBinding;
      this.cachedProjectSidebarData = undefined;
      await this.reloadProjectSidebarData(targetWebview, 'sidebar', false);
    } catch (error) {
      logger.warn('Rejected Workset Project selection', error as Error);
    }
  }

  /**
   * Activate a Workset Planning Store as the explicit Planning root of the
   * current Project. The submitted Workset name and member path are untrusted:
   * the Gateway must re-validate them against fresh official inventories, and
   * the selector, binding, and snapshot are replaced in one shot only when the
   * returned binding matches the requested Project/Store context.
   */
  private async selectWorksetStore(
    worksetName: unknown,
    memberPath: unknown,
    targetWebview: vscode.Webview
  ): Promise<void> {
    if (!this.projectContext || !this.projectDataGateway
      || typeof worksetName !== 'string' || typeof memberPath !== 'string') return;
    const resolveStore = this.projectDataGateway.resolveWorksetStore;
    if (typeof resolveStore !== 'function') return;

    // Capture the request generation BEFORE the fresh-inventory resolve: a
    // slow resolve must not outrun a newer user action into the acceptance
    // gate, otherwise an earlier click would override a later committed one.
    const selectionGeneration = this.projectRequestGeneration;
    try {
      const validated = await resolveStore.call(
        this.projectDataGateway,
        this.projectContext,
        worksetName,
        memberPath,
      );
      if (selectionGeneration !== this.projectRequestGeneration) {
        logger.warn('Discarded superseded Workset Planning Store selection');
        return;
      }
      await this.reloadProjectSidebarData(targetWebview, 'sidebar', true, {
        requestedStoreId: validated.storeId,
        expectedCanonicalRoot: validated.canonicalRoot,
        onAccepted: (binding) => {
          this.explicitProjectStoreId = validated.storeId;
          // The watcher follows the accepted Planning root in the same
          // one-shot commit as the selector, binding, and snapshot.
          this.dataManager.setWatchedProjectRoot?.(binding.rootPath);
        },
      });
    } catch (error) {
      // Fail-closed (no state replaced) but never silent: the row keeps its
      // `Use as planning root` action, so the rejection needs a visible reason.
      logger.warn('Rejected Workset Planning Store selection', error as Error);
      // A resolve that rejects only after a newer request superseded it must
      // stay silent: the newer request already owns the outcome, and a late
      // error here would be spurious (though its text would be accurate).
      if (selectionGeneration !== this.projectRequestGeneration) return;
      this.postSelectionError(targetWebview, error);
    }
  }

  /**
   * Open the native VS Code folder picker for the active creation form. The
   * Host owns cross-platform canonicalization: every returned entry is
   * realpath-resolved to its canonical absolute form (collapsing symlinks and
   * duplicate picks of the same canonical root) before it is handed back to
   * the webview. A dismissed picker stays silent. Entries whose realpath fails
   * are reported in `droppedPaths` so the create form can explain the missing
   * members recoverably — including when every pick was unresolvable.
   */
  private async pickWorksetMembers(targetWebview: vscode.Webview): Promise<void> {
    let picks: readonly vscode.Uri[] | undefined;
    try {
      picks = await vscode.window.showOpenDialog({
        canSelectFolders: true,
        canSelectMany: true,
      });
    } catch (error) {
      // showOpenDialog returns a Throwing Thenable: a rejected picker must
      // surface as one recoverable error, never a silent no-op.
      logger.warn('Native folder picker failed', error as Error);
      targetWebview.postMessage({ type: 'error', message: t('worksetCreate.pickFailed') });
      return;
    }
    if (!picks || picks.length === 0) return;
    const canonicalPaths: string[] = [];
    const droppedPaths: string[] = [];
    for (const pick of picks) {
      const rawPath = pick && typeof pick.fsPath === 'string' ? pick.fsPath : '';
      if (!rawPath) continue;
      const canonicalPath = await this.canonicalizeWorksetMemberPath(rawPath);
      if (canonicalPath) {
        if (!canonicalPaths.includes(canonicalPath)) canonicalPaths.push(canonicalPath);
      } else {
        droppedPaths.push(rawPath);
      }
    }
    if (canonicalPaths.length === 0 && droppedPaths.length === 0) return;
    targetWebview.postMessage({
      type: 'worksetMembersPicked',
      paths: canonicalPaths,
      ...(droppedPaths.length ? { droppedPaths } : {}),
    });
  }

  /**
   * Canonicalize a folder path with the Node realpath idiom already used by
   * the ProjectDataGateway: resolves symlinks and normalizes casing/segment
   * separators per platform. Unresolvable paths return undefined so callers
   * can reject them without ever guessing at an alternative location.
   */
  private async canonicalizeWorksetMemberPath(rawPath: string): Promise<string | undefined> {
    try {
      const canonicalPath = await realpath(rawPath);
      return canonicalPath || undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * Handle a `createWorkset` message. The payload is untrusted: primitive
   * types, a non-empty trimmed name, absolute members, and a string tool are
   * all verified BEFORE any CLI call, and flag-shaped values (`--…`) are
   * rejected so nothing can smuggle extra argv into the official command. The
   * Workset capability is verified against the DataManager's CLI feature
   * detection (a present-but-empty navigation is NOT a capability signal).
   * The Workset is created exclusively through the selector-free DataManager
   * method; success changes the UI only after a generation-guarded Project
   * Sidebar reload produced a fresh navigation that contains the new name —
   * following newer in-flight reloads when this one was superseded, so a
   * successful creation is never misreported. Every failure keeps the webview
   * draft (nothing optimistic is published) and returns exactly one
   * recoverable result message per submitted request.
   */
  private async submitWorksetCreation(message: unknown, targetWebview: vscode.Webview): Promise<void> {
    const request = (message ?? {}) as Record<string, unknown>;
    const echoName = typeof request.name === 'string' ? request.name.trim() : '';

    // Capability gate: the authoritative signal is the DataManager's cached
    // CLI feature detection. The Gateway's navigation may be present-but-empty
    // when the runtime lacks the capability (CLI errors are swallowed into an
    // empty list), so navigation shape alone cannot gate creation. A missing
    // trusted navigation still fails closed the same way.
    const worksetsSupported = this.dataManager.getCapabilities?.()?.worksets === true;
    if (!worksetsSupported || !this.cachedProjectSidebarData?.worksetNavigation) {
      logger.warn('Rejected Workset creation: Workset capability is unavailable');
      targetWebview.postMessage({
        type: 'worksetCreateResult',
        success: false,
        name: echoName,
        message: t('worksetCreate.capabilityUnavailable'),
      });
      return;
    }

    // Single-flight lock: check and set without an await in between, so a
    // duplicate submission racing this handler can never create twice. The
    // duplicate still receives exactly one recoverable result.
    if (this.worksetCreateInFlight) {
      logger.warn('Rejected duplicate Workset creation while one is already in flight');
      targetWebview.postMessage({
        type: 'worksetCreateResult',
        success: false,
        name: echoName,
        message: t('worksetCreate.inProgress'),
      });
      return;
    }
    this.worksetCreateInFlight = true;
    try {
      const name = typeof request.name === 'string' ? request.name.trim() : '';
      if (!name || name.startsWith('-')) {
        this.postWorksetCreateRejection(targetWebview, echoName);
        return;
      }
      if (!Array.isArray(request.members) || request.members.length === 0) {
        this.postWorksetCreateRejection(targetWebview, echoName);
        return;
      }
      let tool: string | undefined;
      if (request.tool !== undefined) {
        if (typeof request.tool !== 'string') {
          this.postWorksetCreateRejection(targetWebview, echoName);
          return;
        }
        tool = request.tool.trim();
        if (tool.startsWith('-')) {
          this.postWorksetCreateRejection(targetWebview, echoName);
          return;
        }
        // Empty after trim: treated as absent.
        if (!tool) tool = undefined;
      }

      // Members must be absolute paths; canonicalization happens host-side
      // right before submission so the CLI receives canonical paths in the
      // submitted (Primary-first) order, one entry per canonical path.
      const canonicalMembers: string[] = [];
      for (const rawMember of request.members) {
        if (typeof rawMember !== 'string' || !path.isAbsolute(rawMember)) {
          this.postWorksetCreateRejection(targetWebview, echoName);
          return;
        }
        const canonicalMember = await this.canonicalizeWorksetMemberPath(rawMember);
        if (!canonicalMember) {
          this.postWorksetCreateRejection(targetWebview, echoName);
          return;
        }
        if (!canonicalMembers.includes(canonicalMember)) canonicalMembers.push(canonicalMember);
      }
      if (canonicalMembers.length === 0) {
        this.postWorksetCreateRejection(targetWebview, echoName);
        return;
      }

      await this.dataManager.createWorkset(name, canonicalMembers, tool);

      // Official refresh through the existing generation-guarded reload path.
      // Its failure posts are suppressed: this flow reports the reload failure
      // itself as the single recoverable createResult.
      const surface = targetWebview === this.dashboardPanel?.webview ? 'dashboard' : 'sidebar';
      let reloadOutcome = await this.reloadProjectSidebarData(
        targetWebview,
        surface,
        true,
        undefined,
        { suppressFailurePosts: true },
      );
      // A superseded reload published nothing (e.g. the user hit Refresh or
      // another surface reloaded). Follow the newest in-flight/queued reload —
      // bounded, chained while that one is superseded too — and judge the name
      // against the finally-published snapshot instead of the stale cache. An
      // exhausted chain means no snapshot was ever confirmed for this create:
      // fail recoverably instead of guessing on a stale cache.
      let follows = 0;
      while (
        reloadOutcome === 'superseded'
        && follows < DashboardViewProvider.maxSupersededReloadFollows
      ) {
        follows += 1;
        const latest = this.latestProjectReload;
        reloadOutcome = latest ? await latest : 'failed';
      }
      if (reloadOutcome !== 'published') {
        logger.warn(`Created Workset ${name} could not be confirmed: the Project refresh failed`);
        targetWebview.postMessage({
          type: 'worksetCreateResult',
          success: false,
          name,
          message: t('worksetCreate.refreshFailed', { name }),
        });
        return;
      }

      const fresh = this.cachedProjectSidebarData;
      const listed = fresh?.worksetNavigation?.worksets.some(
        (workset) => workset.name === name,
      );
      if (fresh && listed) {
        targetWebview.postMessage({ type: 'worksetCreateResult', success: true, name });
        return;
      }
      // The CLI succeeded but the fresh snapshot does not contain the new
      // Workset (e.g. the current Project is not one of its members): never
      // fabricate a detail view. The draft stays with a recoverable message.
      logger.warn(`Created Workset ${name} is missing from the refreshed Project navigation`);
      targetWebview.postMessage({
        type: 'worksetCreateResult',
        success: false,
        name,
        message: t('worksetCreate.refreshMissing', { name }),
      });
    } catch (error) {
      logger.warn('Workset creation failed', error as Error);
      targetWebview.postMessage({
        type: 'worksetCreateResult',
        success: false,
        name: echoName,
        message: this.worksetCreateFailureMessage(error),
      });
    } finally {
      this.worksetCreateInFlight = false;
    }
  }

  /**
   * CLI failure copy: the error message plus a sanitized single-line excerpt
   * of the official CLI stderr (OpenSpecCliError carries it). Whitespace is
   * collapsed and the excerpt truncated (~200 chars) so a multi-line CLI dump
   * cannot flood the recoverable notice; only CLI-printed text is echoed.
   */
  private worksetCreateFailureMessage(error: unknown): string {
    const base = this.errorMessage(error) || t('worksetCreate.createFailedDefault');
    const stderr = typeof error === 'object' && error !== null
      ? (error as { stderr?: unknown }).stderr
      : undefined;
    if (typeof stderr !== 'string') return base;
    const excerpt = stderr.replace(/\s+/g, ' ').trim().slice(0, 200);
    return excerpt ? `${base}: ${excerpt}` : base;
  }

  private postWorksetCreateRejection(targetWebview: vscode.Webview, echoName: string): void {
    targetWebview.postMessage({
      type: 'worksetCreateResult',
      success: false,
      name: echoName,
      message: t('worksetCreate.rejectedInput'),
    });
  }

  /**
   * Return to the Project-resolved Planning root. The ephemeral selector is
   * cleared only after a fresh selector-free binding for the same Project
   * resolves and validates; failures keep the previous root and data.
   */
  private async selectProjectDefaultRoot(targetWebview: vscode.Webview): Promise<void> {
    if (!this.projectContext || !this.projectDataGateway) return;
    if (this.explicitProjectStoreId === undefined) return;
    const project = this.projectContext;
    await this.reloadProjectSidebarData(targetWebview, 'sidebar', true, {
      requestedStoreId: undefined,
      onAccepted: (binding) => {
        this.explicitProjectStoreId = undefined;
        // Same selector rule as the other selections: when the selector-free
        // default still resolves to a Store root (CLI root.store_id), the
        // watcher must follow the restored binding root, not the Project path.
        this.dataManager.setWatchedProjectRoot?.(
          binding.storeId !== undefined ? binding.rootPath : project.projectPath
        );
      },
    });
  }

  private async selectCurrentProject(targetWebview: vscode.Webview): Promise<void> {
    if (!this.projectContext || !this.projectDataGateway || !this.originProjectContext) return;
    if (this.sameProject(this.projectContext, this.originProjectContext)) return;
    // Capture the request generation before the await so a superseded restore
    // cannot replace state or start a reload after a newer request committed.
    const selectionGeneration = this.projectRequestGeneration;
    try {
      const nextBinding = await this.projectDataGateway.resolveBinding(
        this.originProjectContext,
        this.explicitProjectStoreId
      );
      if (selectionGeneration !== this.projectRequestGeneration) {
        logger.warn('Discarded superseded Current Project restore');
        return;
      }
      if (
        nextBinding.projectId !== this.originProjectContext.id
        || nextBinding.commandCwd !== this.originProjectContext.projectPath
        || (this.explicitProjectStoreId !== undefined
          && nextBinding.storeId !== this.explicitProjectStoreId)
      ) return;
      // Same selector rule as Workset Project selection: with an explicit Store
      // selector active, the watcher follows the accepted binding root.
      this.dataManager.setWatchedProjectRoot?.(
        nextBinding.storeId !== undefined ? nextBinding.rootPath : this.originProjectContext.projectPath
      );
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
