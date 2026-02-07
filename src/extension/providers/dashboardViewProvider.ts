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
    // For now, return a simple placeholder
    // Will be replaced with actual React app later
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OpenSpec Dashboard</title>
  <style>
    body {
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      background-color: var(--vscode-editor-background);
      padding: 12px;
      margin: 0;
    }
    h2 {
      color: var(--vscode-textLink-foreground);
      font-size: 16px;
      margin: 0 0 12px 0;
    }
    button {
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      padding: 6px 12px;
      cursor: pointer;
      margin-right: 6px;
      margin-bottom: 8px;
      font-size: 12px;
    }
    button:hover {
      background-color: var(--vscode-button-hoverBackground);
    }
    #data {
      margin-top: 12px;
      white-space: pre-wrap;
      font-family: monospace;
      font-size: 11px;
      background: var(--vscode-textCodeBlock-background);
      padding: 8px;
      border-radius: 4px;
      max-height: 70vh;
      overflow-y: auto;
    }
    .status {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 8px;
    }
  </style>
</head>
<body>
  <h2>OpenSpec Dashboard</h2>
  <div class="status">✅ Backend services active</div>
  
  <div>
    <button onclick="loadData()">Load Data</button>
    <button onclick="refresh()">Refresh</button>
  </div>

  <div id="data">Click "Load Data" to start...</div>

  <script>
    const vscode = acquireVsCodeApi();

    window.addEventListener('message', event => {
      const message = event.data;
      
      if (message.type === 'dashboardData') {
        document.getElementById('data').textContent = 
          JSON.stringify(message.data, null, 2);
      }
    });

    function loadData() {
      vscode.postMessage({ type: 'getDashboardData' });
    }

    function refresh() {
      vscode.postMessage({ type: 'refresh' });
    }

    // Auto-load on startup
    setTimeout(() => loadData(), 100);
  </script>
</body>
</html>`;
  }
}
