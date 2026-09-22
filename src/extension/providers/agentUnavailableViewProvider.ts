import * as vscode from 'vscode';
import * as path from 'path';
import { logger } from '../utils/logger';
import { getCurrentAdapter } from '../adapters';
import { buildAgentInitPrompt, OPENSPEC_INIT_COMMAND } from '../../shared/agentInit';
import {
  getWebviewContent,
  getWorkflowLaunchConfigMessage,
  handleAgentUnavailableMessage,
} from './webviewMessageHandler';

export class AgentUnavailableViewProvider implements vscode.WebviewViewProvider {
  constructor(
    private readonly extensionPath: string,
    private readonly workspacePath?: string,
  ) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    const { webview } = webviewView;
    webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.file(path.join(this.extensionPath, 'dist'))],
    };
    webview.html = getWebviewContent(webview, this.extensionPath);

    webview.onDidReceiveMessage(async (message) => {
      try {
        await handleAgentUnavailableMessage(webview, message, this.workspacePath);
      } catch (error) {
        logger.error('Agent unavailable webview message failed', error as Error);
      }
    });

    void this.postInitialContext(webview);
    logger.info('Agent unavailable dashboard view resolved');
  }

  private async postInitialContext(webview: vscode.Webview): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 100));
    webview.postMessage({
      type: 'setContext',
      view: 'agentUnavailable',
      ...(this.workspacePath ? { workspacePath: this.workspacePath } : {}),
    });
    webview.postMessage(getWorkflowLaunchConfigMessage());
  }
}

export { launchAgentInit, copyInitCommand } from './agentUnavailableActions';
