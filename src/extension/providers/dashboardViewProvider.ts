import * as vscode from 'vscode';
import * as path from 'path';
import { logger } from '../utils/logger';
import { DataManager, type CachedDashboardData, type DashboardData } from '../services/dataManager';
import { InteractiveAgentTerminalManager } from '../services/interactiveAgentTerminalManager';
import { ChangeDetailPanelManager } from './changeDetailPanelManager';
import type { ChangeDetailTabId, InteractiveWorkflowAction } from '../../shared/interactiveWorkflow';
import type { CliActivationDiagnosticView } from '../../webview/types/messages';
import {
  handleWebviewMessage,
  getWebviewContent,
  getWorkflowLaunchConfigMessage,
} from './webviewMessageHandler';

export class DashboardViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'openspec.dashboard';
  private static readonly initialDataPostDelayMs = 100;
  private static readonly scopedPanelKeySeparator = '\u0000';
  private _view?: vscode.WebviewView;
  private dashboardPanel?: vscode.WebviewPanel;
  private specPanels = new Map<string, vscode.WebviewPanel>();
  private refreshSubscription?: vscode.Disposable;

  constructor(
    private dataManager: DataManager,
    private extensionPath: string,
    private panelManager?: ChangeDetailPanelManager,
    private interactiveTerminalManager?: InteractiveAgentTerminalManager
  ) {
    this.refreshSubscription = this.dataManager.onRefresh((data) => {
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
    this.postInitialDashboardData(webviewView.webview);
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
      this.postInitialDashboardData(this.dashboardPanel.webview);
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
    this.postInitialDashboardData(panel.webview);
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
    options?: { initialTab?: ChangeDetailTabId; interactiveAction?: InteractiveWorkflowAction }
  ): void {
    if (!this.panelManager) return;
    this.panelManager.open(changeName, options);
  }

  /**
   * Setup message handler for webview communication
   */
  private setupMessageHandler(webview: vscode.Webview): void {
    webview.onDidReceiveMessage(
      async (message) => {
        try {
          await this.handleMessage(message, webview);
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
  private async handleMessage(message: any, webview: vscode.Webview): Promise<void> {
    if (message.type === 'openChangeDetailInEditor' && message.changeName && this.panelManager) {
      this.panelManager.open(message.changeName, {
        initialTab: message.initialTab,
        interactiveAction: message.interactiveAction,
        scopeId: message.scopeId,
      });
      return;
    }
    if (message.type === 'openSpecInEditor' && message.specId) {
      this.openSpecPanel(message.specId, message.requirementIndex, message.scopeId);
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
        webview.postMessage({ type: 'dashboardData', data, debug: vscode.workspace.getConfiguration('openspec').get<boolean>('debug') ?? false });
        this.postCliActivationDiagnostic(webview, 'warning');
      } catch (err) {
        logger.error('Retry CLI detection failed', err as Error);
        this.postCliActivationDiagnostic(webview, 'blocking');
      }
      return;
    }

    await handleWebviewMessage(
      message,
      webview,
      this.dataManager,
      this.interactiveTerminalManager
    );
  }

  private async openSpecPanel(specId: string, _requirementIndex?: number, scopeId?: string): Promise<void> {
    // Resolve the scope (store root) so the spec is read from the same root it was
    // listed from, not the workspace local root.
    const scope = this.dataManager.resolveScope(scopeId);
    const key = `${scope?.id ?? scopeId ?? 'default'}${DashboardViewProvider.scopedPanelKeySeparator}${specId}`;
    const existing = this.specPanels.get(key);
    if (existing) {
      existing.reveal(vscode.ViewColumn.One);
      const content = await this.dataManager.readSpec(specId, scope);
      existing.webview.postMessage({ type: 'specContent', specId, content });
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
      panel.webview.html = getWebviewContent(panel.webview, this.extensionPath);
      setTimeout(() => {
        panel.webview.postMessage({ type: 'specContent', specId, content });
      }, 200);
      panel.webview.onDidReceiveMessage(async (msg) => {
        await handleWebviewMessage(msg, panel.webview, this.dataManager);
      });
      panel.onDidDispose(() => {
        this.specPanels.delete(key);
      });
    } catch (err) {
      vscode.window.showErrorMessage(`Failed to open spec: ${specId}`);
    }
  }
}
