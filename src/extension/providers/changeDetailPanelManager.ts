import * as vscode from 'vscode';
import * as path from 'path';
import { logger } from '../utils/logger';
import { DataManager } from '../services/dataManager';
import { handleWebviewMessage, getWebviewContent } from './webviewMessageHandler';

/**
 * Manages WebviewPanels for Change Detail view in the editor area.
 * One panel per change; reuses panel when opening the same change again.
 */
export class ChangeDetailPanelManager {
  private panels = new Map<string, vscode.WebviewPanel>();
  private pendingSetContext = new Map<vscode.Webview, string>();

  constructor(
    private dataManager: DataManager,
    private extensionPath: string
  ) {}

  public open(changeName: string): void {
    const existing = this.panels.get(changeName);
    if (existing) {
      existing.reveal(vscode.ViewColumn.One);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'openspecChangeDetail',
      `OpenSpec: ${changeName}`,
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.file(path.join(this.extensionPath, 'dist')),
        ],
      }
    );

    this.panels.set(changeName, panel);
    this.pendingSetContext.set(panel.webview, changeName);

    panel.webview.html = getWebviewContent(panel.webview, this.extensionPath);

    panel.webview.onDidReceiveMessage(
      async (message) => {
        const changeNameForContext = this.pendingSetContext.get(panel.webview);
        if (changeNameForContext !== undefined) {
          this.pendingSetContext.delete(panel.webview);
          panel.webview.postMessage({
            type: 'setContext',
            view: 'changeDetail',
            changeName: changeNameForContext,
          });
        }
        try {
          await handleWebviewMessage(message, panel.webview, this.dataManager);
        } catch (error) {
          logger.error('Error handling panel webview message', error as Error);
        }
      },
      undefined,
      []
    );

    panel.onDidDispose(() => {
      this.panels.delete(changeName);
      this.pendingSetContext.delete(panel.webview);
    });

    logger.info(`Change detail panel opened: ${changeName}`);
  }
}
