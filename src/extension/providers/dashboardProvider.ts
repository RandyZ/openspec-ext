import * as vscode from 'vscode';
import * as path from 'path';
import { logger } from '../utils/logger';
import { DataManager } from '../services/dataManager';

export class DashboardProvider {
  private static currentPanel: vscode.WebviewPanel | undefined;

  constructor(
    private dataManager: DataManager,
    private extensionPath: string
  ) {}

  /**
   * Show dashboard webview
   */
  public show(): void {
    // If panel already exists, reveal it
    if (DashboardProvider.currentPanel) {
      DashboardProvider.currentPanel.reveal(vscode.ViewColumn.One);
      return;
    }

    // Create new webview panel
    const panel = vscode.window.createWebviewPanel(
      'openspecDashboard',
      'OpenSpec Dashboard',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.file(path.join(this.extensionPath, 'dist')),
        ],
      }
    );

    DashboardProvider.currentPanel = panel;

    // Set webview HTML content
    panel.webview.html = this.getWebviewContent(panel.webview);

    // Setup message handler
    this.setupMessageHandler(panel);

    // Handle panel disposal
    panel.onDidDispose(() => {
      DashboardProvider.currentPanel = undefined;
    });

    logger.info('Dashboard webview opened');
  }

  /**
   * Setup message handler for webview communication
   */
  private setupMessageHandler(panel: vscode.WebviewPanel): void {
    panel.webview.onDidReceiveMessage(
      async (message) => {
        try {
          await this.handleMessage(message, panel.webview);
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
        // TODO: Open artifact in editor
        vscode.window.showInformationMessage(
          `Opening artifact: ${message.changeName}/${message.artifactType}`
        );
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
      padding: 20px;
    }
    h1 {
      color: var(--vscode-textLink-foreground);
    }
    button {
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      padding: 8px 16px;
      cursor: pointer;
      margin-right: 8px;
      margin-bottom: 8px;
    }
    button:hover {
      background-color: var(--vscode-button-hoverBackground);
    }
    #data {
      margin-top: 20px;
      white-space: pre-wrap;
      font-family: monospace;
      background: var(--vscode-textCodeBlock-background);
      padding: 12px;
      border-radius: 4px;
    }
  </style>
</head>
<body>
  <h1>OpenSpec Dashboard</h1>
  <p>Backend services initialized successfully! ✅</p>
  
  <div>
    <button onclick="loadData()">Load Dashboard Data</button>
    <button onclick="refresh()">Refresh</button>
  </div>

  <div id="data"></div>

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
    loadData();
  </script>
</body>
</html>`;
  }
}
