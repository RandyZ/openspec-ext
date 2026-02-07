import * as vscode from 'vscode';
import * as path from 'path';
import { logger } from '../utils/logger';
import { DataManager } from '../services/dataManager';

export class DashboardViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'openspec.dashboardView';
  private _view?: vscode.WebviewView;

  constructor(
    private dataManager: DataManager,
    private extensionPath: string
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

    webviewView.webview.html = this.getWebviewContent(webviewView.webview);

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
    if (this._view) {
      this._view.show?.(true);
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
   * Handle messages from webview
   */
  private async handleMessage(message: any, webview: vscode.Webview): Promise<void> {
    logger.debug(`Received message: ${message.type}`);

    switch (message.type) {
      case 'getDashboardData':
        const data = await this.dataManager.getDashboardData();
        webview.postMessage({
          type: 'dashboardData',
          data,
        });
        break;

      case 'refresh':
        const refreshedData = await this.dataManager.refresh();
        webview.postMessage({
          type: 'dashboardData',
          data: refreshedData,
        });
        break;

      case 'toggleTask':
        await this.dataManager.toggleTask(message.changeName, message.taskIndex);
        const updatedData = await this.dataManager.getDashboardData();
        webview.postMessage({
          type: 'dashboardData',
          data: updatedData,
        });
        break;

      case 'openArtifact':
        // Open artifact in editor
        const artifactPath = path.join(
          vscode.workspace.workspaceFolders![0].uri.fsPath,
          'openspec',
          'changes',
          message.changeName,
          `${message.artifactType}.md`
        );
        const doc = await vscode.workspace.openTextDocument(artifactPath);
        await vscode.window.showTextDocument(doc);
        break;

      default:
        logger.warn(`Unknown message type: ${message.type}`);
    }
  }

  /**
   * Generate HTML content for webview
   */
  private getWebviewContent(webview: vscode.Webview): string {
    // Get URIs for the built React app
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.file(path.join(this.extensionPath, 'dist', 'webview', 'index.js'))
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.file(path.join(this.extensionPath, 'dist', 'webview', 'index.css'))
    );

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource};">
  <title>OpenSpec Dashboard</title>
  <link rel="stylesheet" href="${styleUri}">
</head>
<body>
  <div id="root"></div>
  <script type="module" src="${scriptUri}"></script>
</body>
</html>`;
  }
}
