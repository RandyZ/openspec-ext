import * as vscode from 'vscode';
import { logger } from '../utils/logger';
import { getPrimaryWorkspacePath } from '../services/openspecRootGate';
import { configureAgentUnavailableWebview } from './agentUnavailableWebview';

export class AgentUnavailableViewProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;

  constructor(
    private readonly extensionPath: string,
    private readonly workspacePath?: string,
  ) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    this.renderUnavailable(webviewView.webview);
    webviewView.onDidDispose(() => {
      this.view = undefined;
    });
    logger.info('Agent unavailable dashboard view resolved');
  }

  refreshForWorkspaceChange(): void {
    if (!this.view) return;
    this.renderUnavailable(this.view.webview);
  }

  private renderUnavailable(webview: vscode.Webview): void {
    configureAgentUnavailableWebview(
      webview,
      this.extensionPath,
      this.workspacePath ?? getPrimaryWorkspacePath(),
    );
  }
}

export { launchAgentInit, copyInitCommand } from './agentUnavailableActions';
