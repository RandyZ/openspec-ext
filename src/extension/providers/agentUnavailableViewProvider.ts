import * as vscode from 'vscode';
import { logger } from '../utils/logger';
import { configureAgentUnavailableWebview } from './agentUnavailableWebview';

export class AgentUnavailableViewProvider implements vscode.WebviewViewProvider {
  constructor(
    private readonly extensionPath: string,
    private readonly workspacePath?: string,
  ) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    configureAgentUnavailableWebview(webviewView.webview, this.extensionPath, this.workspacePath);
    logger.info('Agent unavailable dashboard view resolved');
  }
}

export { launchAgentInit, copyInitCommand } from './agentUnavailableActions';
