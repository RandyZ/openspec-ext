import * as vscode from 'vscode';
import * as path from 'path';
import { logger } from '../utils/logger';
import { DataManager } from '../services/dataManager';

/**
 * Shared message handler for both sidebar webview and change detail panel.
 * Does NOT handle openChangeDetailInEditor (handled by provider/panel manager).
 */
export async function handleWebviewMessage(
  message: any,
  webview: vscode.Webview,
  dataManager: DataManager
): Promise<void> {
  logger.debug(`Received message: ${message.type}`);

  switch (message.type) {
    case 'getDashboardData': {
      const data = await dataManager.getDashboardData();
      webview.postMessage({ type: 'dashboardData', data });
      break;
    }

    case 'refresh': {
      const refreshedData = await dataManager.refresh();
      webview.postMessage({ type: 'dashboardData', data: refreshedData });
      break;
    }

    case 'requestNewChange': {
      const name = await vscode.window.showInputBox({
        prompt: 'Enter change name',
        placeHolder: 'e.g., add-authentication',
        validateInput: (value) => {
          if (!value) return 'Change name is required';
          if (!/^[a-z0-9-]+$/.test(value)) {
            return 'Use lowercase letters, numbers, and hyphens only';
          }
          return null;
        },
      });
      if (name) {
        await dataManager.createChange(name);
        vscode.window.showInformationMessage(`Change "${name}" created`);
        const newData = await dataManager.getDashboardData();
        webview.postMessage({ type: 'dashboardData', data: newData });
      }
      break;
    }

    case 'toggleTask':
      await dataManager.toggleTask(message.changeName, message.taskIndex);
      await dataManager.getDashboardData().then((data) => {
        webview.postMessage({ type: 'dashboardData', data });
      });
      break;

    case 'openChange': {
      const folder = vscode.workspace.workspaceFolders?.[0];
      if (!folder) break;
      const changeDir = path.join(folder.uri.fsPath, 'openspec', 'changes', message.changeName);
      const tasksPath = path.join(changeDir, 'tasks.md');
      const proposalPath = path.join(changeDir, 'proposal.md');
      const fs = await import('fs');
      const toOpen = fs.existsSync(tasksPath) ? tasksPath : proposalPath;
      if (fs.existsSync(toOpen)) {
        const doc = await vscode.workspace.openTextDocument(toOpen);
        await vscode.window.showTextDocument(doc);
        await vscode.commands.executeCommand('revealInExplorer', doc.uri);
      }
      break;
    }

    case 'openSpec': {
      if (!message.path) break;
      const folder = vscode.workspace.workspaceFolders?.[0];
      if (!folder) break;
      const specPath = path.isAbsolute(message.path)
        ? message.path
        : path.join(folder.uri.fsPath, message.path);
      try {
        const doc = await vscode.workspace.openTextDocument(specPath);
        await vscode.window.showTextDocument(doc);
      } catch (err) {
        logger.error(`Failed to open spec: ${message.path}`, err as Error);
        vscode.window.showErrorMessage(`Could not open spec file: ${message.path}`);
      }
      break;
    }

    case 'openArtifact': {
      const folder = vscode.workspace.workspaceFolders?.[0];
      if (!folder) break;
      const artifactPath = path.join(
        folder.uri.fsPath,
        'openspec',
        'changes',
        message.changeName,
        `${message.artifactType}.md`
      );
      const doc = await vscode.workspace.openTextDocument(artifactPath);
      await vscode.window.showTextDocument(doc);
      break;
    }

    case 'copyToClipboard':
      if (typeof message.text === 'string') {
        await vscode.env.clipboard.writeText(message.text);
        vscode.window.showInformationMessage('Copied to clipboard');
      }
      break;

    case 'archiveChange': {
      const name = message.name;
      if (!name) break;
      const confirm = await vscode.window.showWarningMessage(
        `Archive change "${name}"?`,
        { modal: true },
        'Archive'
      );
      if (confirm === 'Archive') {
        await dataManager.archiveChange(name);
        vscode.window.showInformationMessage(`Change "${name}" archived`);
        const afterArchive = await dataManager.getDashboardData();
        webview.postMessage({ type: 'dashboardData', data: afterArchive });
      }
      break;
    }

    case 'getArtifactContent': {
      const { changeName, artifactType } = message;
      if (!changeName || !artifactType) break;
      const exists = await dataManager.artifactExists(changeName, artifactType);
      if (!exists) {
        webview.postMessage({
          type: 'artifactContentError',
          changeName,
          artifactType,
          message: '该内容尚未创建或文件已丢失。',
          code: 'ARTIFACT_MISSING',
        });
        break;
      }
      try {
        const content = await dataManager.readArtifact(changeName, artifactType);
        webview.postMessage({ type: 'artifactContent', changeName, artifactType, content });
      } catch (err) {
        webview.postMessage({
          type: 'artifactContentError',
          changeName,
          artifactType,
          message: '读取文件失败，请检查权限或文件编码。',
          code: 'ARTIFACT_READ_ERROR',
        });
      }
      break;
    }

    case 'listDeltaSpecs': {
      const changeName = message.changeName;
      if (!changeName) break;
      try {
        const specIds = await dataManager.listDeltaSpecIds(changeName);
        webview.postMessage({ type: 'deltaSpecList', changeName, specIds });
      } catch (err) {
        webview.postMessage({ type: 'deltaSpecList', changeName, specIds: [] });
      }
      break;
    }

    case 'getDeltaSpecContent': {
      const { changeName, specId } = message;
      if (!changeName || !specId) break;
      try {
        const content = await dataManager.readDeltaSpec(changeName, specId);
        webview.postMessage({
          type: 'deltaSpecContent',
          changeName,
          specId,
          content: content ?? '',
        });
      } catch (err) {
        webview.postMessage({
          type: 'deltaSpecContentError',
          changeName,
          specId,
          message: (err as Error).message,
        });
      }
      break;
    }

    default:
      logger.warn(`Unknown message type: ${message.type}`);
  }
}

/**
 * Generate HTML content for webview (shared by sidebar and panel).
 */
export function getWebviewContent(webview: vscode.Webview, extensionPath: string): string {
  const scriptUri = webview.asWebviewUri(
    vscode.Uri.file(path.join(extensionPath, 'dist', 'webview', 'index.js'))
  );
  const styleUri = webview.asWebviewUri(
    vscode.Uri.file(path.join(extensionPath, 'dist', 'webview', 'index.css'))
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
