import * as vscode from 'vscode';
import * as path from 'path';
import { logger } from '../utils/logger';
import { DataManager } from '../services/dataManager';
import { ChangeDetailPanelManager } from './changeDetailPanelManager';
import { handleWebviewMessage, getWebviewContent } from './webviewMessageHandler';

export class DashboardViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'openspec.dashboardView';
  private _view?: vscode.WebviewView;

  constructor(
    private dataManager: DataManager,
    private extensionPath: string,
    private panelManager?: ChangeDetailPanelManager
  ) {}

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
    this.setupMessageHandler(webviewView);

    // Handle view disposal
    webviewView.onDidDispose(() => {
      this._view = undefined;
    });

    logger.info('Dashboard view resolved');
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
   * Setup message handler for webview communication
   */
  private setupMessageHandler(webviewView: vscode.WebviewView): void {
    webviewView.webview.onDidReceiveMessage(
      async (message) => {
        try {
          await this.handleMessage(message, webviewView.webview);
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
      this.panelManager.open(message.changeName);
      return;
    }
    if (message.type === 'openSpecInEditor' && message.specId) {
      this.openSpecPanel(message.specId, message.requirementIndex);
      return;
    }
    await handleWebviewMessage(message, webview, this.dataManager);
  }

  private async openSpecPanel(specId: string, _requirementIndex?: number): Promise<void> {
    try {
      const content = await this.dataManager.readSpec(specId);
      const panel = vscode.window.createWebviewPanel(
        'openspecSpecPreview',
        `Spec: ${specId}`,
        vscode.ViewColumn.One,
        { enableScripts: true, localResourceRoots: [vscode.Uri.file(path.join(this.extensionPath, 'dist'))] }
      );
      panel.webview.html = getWebviewContent(panel.webview, this.extensionPath);
      setTimeout(() => {
        panel.webview.postMessage({ type: 'specContent', specId, content });
      }, 200);
      panel.webview.onDidReceiveMessage(async (msg) => {
        await handleWebviewMessage(msg, panel.webview, this.dataManager);
      });
    } catch (err) {
      vscode.window.showErrorMessage(`Failed to open spec: ${specId}`);
    }
  }
}
