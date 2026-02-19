import * as vscode from 'vscode';
import * as path from 'path';
import { logger } from '../utils/logger';
import { DataManager } from '../services/dataManager';
import type { WebviewMessage } from '../../webview/types/messages';

/** Returns true if resolvedPath is under workspaceRoot (no .. escape). */
function isPathUnderWorkspace(resolvedPath: string, workspaceRoot: string): boolean {
  const normalized = path.normalize(resolvedPath);
  const rel = path.relative(workspaceRoot, normalized);
  return !rel.startsWith('..') && !path.isAbsolute(rel);
}

/**
 * Shared message handler for both sidebar webview and change detail panel.
 * Does NOT handle openChangeDetailInEditor (handled by provider/panel manager).
 */
export async function handleWebviewMessage(
  message: WebviewMessage,
  webview: vscode.Webview,
  dataManager: DataManager
): Promise<void> {
  if (message == null || typeof message !== 'object' || !('type' in message)) {
    logger.warn('Invalid webview message: missing or invalid object with type');
    return;
  }
  logger.debug(`Received message: ${message.type}`);

  const getDebug = () => vscode.workspace.getConfiguration('openspec').get<boolean>('debug') ?? false;

  switch (message.type) {
    case 'getDashboardData': {
      const data = await dataManager.getDashboardData();
      webview.postMessage({ type: 'dashboardData', data, debug: getDebug() });
      break;
    }

    case 'refresh': {
      const refreshedData = await dataManager.refresh();
      webview.postMessage({ type: 'dashboardData', data: refreshedData, debug: getDebug() });
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
        webview.postMessage({ type: 'dashboardData', data: newData, debug: getDebug() });
      }
      break;
    }

    case 'toggleTask': {
      const changeName = message.changeName;
      const taskIndex = message.taskIndex;
      const tasks = await dataManager.readTasks(changeName);
      const task = tasks[taskIndex];
      const isMarkingDone = task && !task.done;
      if (isMarkingDone) {
        const confirm = await vscode.window.showWarningMessage(
          '确定将此任务标记为已完成？（跳过）',
          { modal: true },
          '确定跳过',
          '取消'
        );
        if (confirm !== '确定跳过') break;
      } else if (task?.done) {
        const confirm = await vscode.window.showWarningMessage(
          '确定要取消完成该任务？',
          { modal: true },
          '确定',
          '取消'
        );
        if (confirm !== '确定') break;
      }
      await dataManager.toggleTask(changeName, taskIndex);
      const [data, tasksContent] = await Promise.all([
        dataManager.getDashboardData(),
        dataManager.readArtifact(changeName, 'tasks').catch(() => null),
      ]);
      webview.postMessage({ type: 'dashboardData', data, debug: getDebug() });
      if (tasksContent != null) {
        webview.postMessage({
          type: 'artifactContent',
          changeName,
          artifactType: 'tasks',
          content: tasksContent,
        });
      }
      break;
    }

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
      const workspaceRoot = folder.uri.fsPath;
      const specPath = path.isAbsolute(message.path)
        ? path.normalize(message.path)
        : path.normalize(path.join(workspaceRoot, message.path));
      if (!isPathUnderWorkspace(specPath, workspaceRoot)) {
        vscode.window.showErrorMessage(`不允许打开工作区外的文件: ${message.path}`);
        break;
      }
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
      const workspaceRoot = folder.uri.fsPath;
      const changesBase = path.normalize(
        message.changeName.startsWith('archive:')
          ? path.join(workspaceRoot, 'openspec', 'changes', 'archive', message.changeName.slice(8))
          : path.join(workspaceRoot, 'openspec', 'changes', message.changeName)
      );
      const artifactPath = path.normalize(path.join(changesBase, `${message.artifactType}.md`));
      if (!isPathUnderWorkspace(changesBase, workspaceRoot) || !isPathUnderWorkspace(artifactPath, workspaceRoot)) {
        vscode.window.showErrorMessage(`不允许打开工作区外的文件。`);
        break;
      }
      try {
        const doc = await vscode.workspace.openTextDocument(artifactPath);
        await vscode.window.showTextDocument(doc);
      } catch (err) {
        logger.error(`Failed to open artifact: ${artifactPath}`, err as Error);
        vscode.window.showErrorMessage(`无法打开文件: ${message.artifactType}.md`);
      }
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
        webview.postMessage({ type: 'dashboardData', data: afterArchive, debug: getDebug() });
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

    case 'getArchivedChanges': {
      try {
        const items = await dataManager.listArchivedChanges();
        webview.postMessage({ type: 'archivedChanges', items });
      } catch (err) {
        logger.error('Failed to list archived changes', err as Error);
        webview.postMessage({ type: 'archivedChanges', items: [] });
      }
      break;
    }

    case 'executeTask': {
      const { changeName, taskIndex, taskText } = message;
      if (!changeName || typeof taskIndex !== 'number' || !taskText) break;
      let success = false;
      try {
        const result = await dataManager.executeTaskRequest(changeName, taskIndex, taskText);
        success = result.success;
        await dataManager.setTaskExecutionState(changeName, taskIndex, success);
      } catch (err) {
        logger.error('executeTask failed', err as Error);
        vscode.window.showErrorMessage((err as Error).message || '执行任务失败');
      }
      try {
        const executionState = await dataManager.getTaskExecutionState(changeName);
        webview.postMessage({ type: 'taskExecutionFinished', changeName, taskIndex, success, executionState });
      } catch (e) {
        const msg = (e as Error).message ?? String(e);
        if (msg.includes('disposed') || msg.includes('Disposed')) {
          logger.debug('executeTask: webview already disposed, skip postMessage');
        } else {
          throw e;
        }
      }
      break;
    }

    case 'getTaskExecutionState': {
      const changeName = message.changeName;
      if (!changeName) break;
      try {
        const executionState = await dataManager.getTaskExecutionState(changeName);
        webview.postMessage({ type: 'taskExecutionState', changeName, executionState });
      } catch (err) {
        logger.error('getTaskExecutionState failed', err as Error);
        webview.postMessage({ type: 'taskExecutionState', changeName, executionState: {} });
      }
      break;
    }

    case 'getAgentAdapters': {
      try {
        const info = await dataManager.getAgentAdaptersInfo();
        webview.postMessage({ type: 'agentAdapters', ...info });
      } catch (err) {
        logger.error('getAgentAdapters failed', err as Error);
        webview.postMessage({
          type: 'agentAdapters',
          available: [],
          currentId: null,
        });
      }
      break;
    }

    case 'setPreferredAgentAdapter': {
      const adapterId = message.adapterId;
      if (typeof adapterId !== 'string') break;
      try {
        const config = vscode.workspace.getConfiguration('openspec');
        await config.update('preferredAgentAdapter', adapterId, vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage(`已切换执行者: ${adapterId}`);
      } catch (err) {
        logger.error('setPreferredAgentAdapter failed', err as Error);
        vscode.window.showErrorMessage('保存设置失败');
      }
      break;
    }

    case 'requestCreateArtifact': {
      const changeName = message.changeName;
      const artifactType = message.artifactType;
      if (typeof changeName === 'string' && typeof artifactType === 'string') {
        await vscode.commands.executeCommand('openspec.continueArtifact', changeName, artifactType);
      }
      break;
    }

    /**
     * Verify tab: run an IDE command for debugging. Only commands in the allowlist
     * are executed. For development/debug use only.
     */
    case 'runCommand': {
      const commandId = message.commandId;
      const argsJson = message.argsJson;
      if (typeof commandId !== 'string' || !commandId.trim()) {
        webview.postMessage({ type: 'runCommandResult', success: false, message: 'Command ID 不能为空' });
        break;
      }
      const ALLOWED_VERIFY_COMMAND_IDS = new Set<string>([
        'composer.newAgentChat',
      ]);
      if (!ALLOWED_VERIFY_COMMAND_IDS.has(commandId.trim())) {
        webview.postMessage({
          type: 'runCommandResult',
          success: false,
          message: '该命令不在 Verify 白名单中，仅允许执行预定义命令用于调试。',
        });
        break;
      }
      let args: unknown[] = [];
      if (typeof argsJson === 'string' && argsJson.trim()) {
        try {
          const parsed = JSON.parse(argsJson) as unknown;
          args = Array.isArray(parsed) ? parsed : [parsed];
        } catch {
          webview.postMessage({ type: 'runCommandResult', success: false, message: '参数不是合法 JSON' });
          break;
        }
      }
      try {
        await vscode.commands.executeCommand(commandId, ...args);
        webview.postMessage({ type: 'runCommandResult', success: true });
      } catch (err) {
        const msg = (err as Error).message ?? String(err);
        logger.error('runCommand failed', err as Error);
        webview.postMessage({ type: 'runCommandResult', success: false, message: msg });
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
