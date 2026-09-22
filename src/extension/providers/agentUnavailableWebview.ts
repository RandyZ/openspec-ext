import * as vscode from 'vscode';
import * as path from 'path';
import { logger } from '../utils/logger';
import { getPrimaryWorkspacePath } from '../services/openspecRootGate';
import {
  getWebviewContent,
  handleAgentUnavailableMessage,
  postAgentUnavailableContext,
} from './webviewMessageHandler';

export function configureAgentUnavailableWebview(
  webview: vscode.Webview,
  extensionPath: string,
  workspacePath?: string,
): void {
  const resolvedWorkspacePath = workspacePath ?? getPrimaryWorkspacePath();
  webview.options = {
    enableScripts: true,
    localResourceRoots: [vscode.Uri.file(path.join(extensionPath, 'dist'))],
  };
  webview.html = getWebviewContent(webview, extensionPath, {
    view: 'agentUnavailable',
    ...(resolvedWorkspacePath ? { workspacePath: resolvedWorkspacePath } : {}),
  });
  webview.onDidReceiveMessage(async (message) => {
    try {
      await handleAgentUnavailableMessage(webview, message, resolvedWorkspacePath);
    } catch (error) {
      logger.error('Agent unavailable webview message failed', error as Error);
    }
  });
  postAgentUnavailableContext(webview, resolvedWorkspacePath);
}
