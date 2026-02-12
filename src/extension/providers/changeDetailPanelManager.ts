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
    private extensionPath: string,
    private onAfterOpen?: () => void,
    private onRevealSidebar?: () => void
  ) {}

  private async buildSetContextPayload(changeName: string): Promise<{
    type: 'setContext';
    view: 'changeDetail';
    changeName: string;
    existingArtifactIds?: string[];
  }> {
    try {
      const data = await this.dataManager.getDashboardData();
      const change = data.changes.find((c) => c.name === changeName);
      const existingArtifactIds =
        change?.artifacts?.filter((a) => a.status === 'done').map((a) => a.id) ?? [];
      return { type: 'setContext', view: 'changeDetail', changeName, existingArtifactIds };
    } catch {
      return { type: 'setContext', view: 'changeDetail', changeName };
    }
  }

  public open(changeName: string): void {
    const existing = this.panels.get(changeName);
    if (existing) {
      existing.reveal(vscode.ViewColumn.One);
      this.buildSetContextPayload(changeName).then((payload) =>
        existing.webview.postMessage(payload)
      );
      if (this.onAfterOpen) {
        this.onAfterOpen();
      }
      return;
    }

    const panelTitle = changeName.startsWith('archive:')
      ? `OpenSpec: ${changeName.slice(8)} (archived)`
      : `OpenSpec: ${changeName}`;
    const panel = vscode.window.createWebviewPanel(
      'openspecChangeDetail',
      panelTitle,
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

    // Proactively send setContext so webview can show ChangeDetail without waiting for first message
    setTimeout(() => {
      this.buildSetContextPayload(changeName).then((payload) =>
        panel.webview.postMessage(payload)
      );
    }, 150);

    panel.webview.onDidReceiveMessage(
      async (message) => {
        if (message?.type === 'revealSidebar') {
          logger.debug('Panel received revealSidebar');
          this.onRevealSidebar?.();
          return;
        }
        const changeNameForContext = this.pendingSetContext.get(panel.webview);
        if (changeNameForContext !== undefined) {
          this.pendingSetContext.delete(panel.webview);
          this.buildSetContextPayload(changeNameForContext).then((payload) =>
            panel.webview.postMessage(payload)
          );
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

    panel.onDidChangeViewState((e) => {
      if (e.webviewPanel.visible && this.onAfterOpen) {
        logger.debug('Change detail panel became visible, calling onAfterOpen');
        this.onAfterOpen();
      }
    });

    panel.onDidDispose(() => {
      this.panels.delete(changeName);
      this.pendingSetContext.delete(panel.webview);
    });

    if (this.onAfterOpen) {
      this.onAfterOpen();
    }

    logger.info(`Change detail panel opened: ${changeName}`);
  }
}
