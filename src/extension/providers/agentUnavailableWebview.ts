import * as vscode from 'vscode';
import * as path from 'path';
import { logger } from '../utils/logger';
import { getPrimaryWorkspacePath } from '../services/openspecRootGate';
import {
  getWebviewContent,
  handleAgentUnavailableMessage,
  postAgentUnavailableContext,
} from './webviewMessageHandler';

const wiredAgentUnavailableWebviews = new WeakSet<vscode.Webview>();

function ensureAgentUnavailableMessageHandler(
  webview: vscode.Webview,
  workspacePath?: string,
): void {
  if (wiredAgentUnavailableWebviews.has(webview)) return;
  wiredAgentUnavailableWebviews.add(webview);
  webview.onDidReceiveMessage(async (message) => {
    try {
      await handleAgentUnavailableMessage(webview, message, workspacePath ?? getPrimaryWorkspacePath());
    } catch (error) {
      logger.error('Agent unavailable webview message failed', error as Error);
    }
  });
}

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
  ensureAgentUnavailableMessageHandler(webview, resolvedWorkspacePath);
  webview.html = getWebviewContent(webview, extensionPath, {
    view: 'agentUnavailable',
    ...(resolvedWorkspacePath ? { workspacePath: resolvedWorkspacePath } : {}),
  });
  postAgentUnavailableContext(webview, resolvedWorkspacePath);
}
