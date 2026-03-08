import * as vscode from 'vscode';
import * as path from 'path';
import { logger } from '../utils/logger';
import { DataManager } from '../services/dataManager';
import { getChangesBasePath } from '../utils/workspaceRoot';
import { getCurrentAdapter } from '../adapters';
import type { WebviewMessage } from '../../webview/types/messages';
import { t } from '../../i18n';

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
        vscode.window.showInformationMessage(t('command.created', { name }));
        const newData = await dataManager.getDashboardData();
        webview.postMessage({ type: 'dashboardData', data: newData, debug: getDebug() });
      }
      break;
    }

    case 'toggleTask': {
      const changeName = message.changeName;
      if (changeName.startsWith('archive:')) {
        vscode.window.showInformationMessage(t('archive.readOnly'));
        break;
      }
      const taskIndex = message.taskIndex;
      const tasks = await dataManager.readTasks(changeName);
      const task = tasks[taskIndex];
      const isMarkingDone = task && !task.done;
      if (isMarkingDone) {
        const confirm = await vscode.window.showWarningMessage(
          t('confirm.markDone'),
          { modal: true },
          t('confirm.markDoneBtn'),
          t('confirm.cancel')
        );
        if (confirm !== t('confirm.markDoneBtn')) break;
      } else if (task?.done) {
        const confirm = await vscode.window.showWarningMessage(
          t('confirm.markUndone'),
          { modal: true },
          t('confirm.ok'),
          t('confirm.cancel')
        );
        if (confirm !== t('confirm.ok')) break;
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
      const workspaceRoot = dataManager.getWorkspaceRoot();
      const changeDir = getChangesBasePath(workspaceRoot, message.changeName);
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
      const workspaceRoot = dataManager.getWorkspaceRoot();
      const specPath = path.isAbsolute(message.path)
        ? path.normalize(message.path)
        : path.normalize(path.join(workspaceRoot, message.path));
      if (!isPathUnderWorkspace(specPath, workspaceRoot)) {
        vscode.window.showErrorMessage(t('file.outsideWorkspace', { path: message.path }));
        break;
      }
      try {
        const doc = await vscode.workspace.openTextDocument(specPath);
        await vscode.window.showTextDocument(doc);
      } catch (err) {
        logger.error(`Failed to open spec: ${message.path}`, err as Error);
        vscode.window.showErrorMessage(t('file.cannotOpenSpec', { id: message.path }));
      }
      break;
    }

    case 'openDeltaSpec': {
      const { changeName, specId } = message;
      if (!changeName || !specId) break;
      const workspaceRoot = dataManager.getWorkspaceRoot();
      const changesBase = getChangesBasePath(workspaceRoot, changeName);
      const absPath = path.normalize(path.join(changesBase, 'specs', specId, 'spec.md'));
      if (!isPathUnderWorkspace(absPath, workspaceRoot)) {
        vscode.window.showErrorMessage(t('file.outsideWorkspaceShort'));
        break;
      }
      try {
        const doc = await vscode.workspace.openTextDocument(absPath);
        await vscode.window.showTextDocument(doc);
      } catch (err) {
        logger.error(`Failed to open delta spec: ${changeName}/specs/${specId}`, err as Error);
        vscode.window.showErrorMessage(t('file.cannotOpenSpec', { id: specId }));
      }
      break;
    }

    case 'openArtifact': {
      const workspaceRoot = dataManager.getWorkspaceRoot();
      const changesBase = path.normalize(getChangesBasePath(workspaceRoot, message.changeName));
      const artifactPath = path.normalize(path.join(changesBase, `${message.artifactType}.md`));
      logger.info(`[archived] openArtifact: changeName=${message.changeName}, artifactType=${message.artifactType}, workspaceRoot=${workspaceRoot}, artifactPath=${artifactPath}`);
      if (!isPathUnderWorkspace(changesBase, workspaceRoot) || !isPathUnderWorkspace(artifactPath, workspaceRoot)) {
        vscode.window.showErrorMessage(t('file.outsideWorkspaceShort'));
        break;
      }
      try {
        const doc = await vscode.workspace.openTextDocument(artifactPath);
        await vscode.window.showTextDocument(doc);
        logger.info(`[archived] openArtifact: opened OK`);
      } catch (err) {
        logger.error(`Failed to open artifact: ${artifactPath}`, err as Error);
        vscode.window.showErrorMessage(t('file.cannotOpen', { name: message.artifactType }));
      }
      break;
    }

    case 'copyToClipboard':
      if (typeof message.text === 'string') {
        await vscode.env.clipboard.writeText(message.text);
        vscode.window.showInformationMessage(t('clipboard.copiedGeneral'));
      }
      break;

    case 'archiveChange': {
      const name = message.name;
      if (!name) break;
      const confirm = await vscode.window.showWarningMessage(
        t('command.archiveConfirm', { name }),
        { modal: true },
        t('command.archive')
      );
      if (confirm === t('command.archive')) {
        await dataManager.archiveChange(name);
        vscode.window.showInformationMessage(t('command.archived', { name }));
        const afterArchive = await dataManager.getDashboardData();
        webview.postMessage({ type: 'dashboardData', data: afterArchive, debug: getDebug() });
      }
      break;
    }

    case 'getArtifactContent': {
      const { changeName, artifactType } = message;
      if (!changeName || !artifactType) break;
      const workspaceRoot = dataManager.getWorkspaceRoot();
      logger.info(`[archived] getArtifactContent: changeName=${changeName}, artifactType=${artifactType}, workspaceRoot=${workspaceRoot}`);
      const exists = await dataManager.artifactExists(changeName, artifactType);
      if (!exists) {
        logger.info(`[archived] getArtifactContent: artifactExists=false -> ARTIFACT_MISSING`);
        webview.postMessage({
          type: 'artifactContentError',
          changeName,
          artifactType,
          message: t('artifact.missingShort'),
          code: 'ARTIFACT_MISSING',
        });
        break;
      }
      try {
        const content = await dataManager.readArtifact(changeName, artifactType);
        logger.info(`[archived] getArtifactContent: readArtifact ok, sending content`);
        webview.postMessage({ type: 'artifactContent', changeName, artifactType, content });
      } catch (err) {
        logger.info(`[archived] getArtifactContent: readArtifact threw -> ARTIFACT_READ_ERROR`);
        webview.postMessage({
          type: 'artifactContentError',
          changeName,
          artifactType,
          message: t('artifact.readError'),
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
      if (changeName.startsWith('archive:')) {
        vscode.window.showInformationMessage(t('archive.readOnly'));
        break;
      }
      let success = false;
      try {
        const result = await dataManager.executeTaskRequest(changeName, taskIndex, taskText);
        success = result.success;
        await dataManager.setTaskExecutionState(changeName, taskIndex, success);
      } catch (err) {
        logger.error('executeTask failed', err as Error);
        vscode.window.showErrorMessage((err as Error).message || t('task.executionFailed'));
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
        vscode.window.showInformationMessage(t('adapter.switched', { name: adapterId }));
      } catch (err) {
        logger.error('setPreferredAgentAdapter failed', err as Error);
        vscode.window.showErrorMessage(t('adapter.saveFailed'));
      }
      break;
    }

    case 'requestCreateArtifact': {
      const changeName = message.changeName;
      const artifactType = message.artifactType;
      if (typeof changeName === 'string' && changeName.startsWith('archive:')) {
        vscode.window.showInformationMessage(t('archive.readOnly'));
        break;
      }
      if (typeof changeName === 'string' && typeof artifactType === 'string') {
        await vscode.commands.executeCommand('openspec.continueArtifact', changeName, artifactType);
      }
      break;
    }

    case 'fillChat': {
      const prompt = message.prompt;
      if (typeof prompt !== 'string' || !prompt.trim()) break;
      logger.info(`fillChat: ${prompt}`);
      try {
        const adapter = await getCurrentAdapter();
        if (adapter) {
          await adapter.fillChat({
            changeName: '',
            taskIndex: -1,
            taskText: '',
            contextFiles: [],
            workspaceRoot: dataManager['workspaceRoot'] ?? '',
            promptOverride: prompt,
          });
        } else {
          await vscode.env.clipboard.writeText(prompt);
          vscode.window.showInformationMessage(t('clipboard.copiedChat'));
        }
      } catch (err) {
        logger.error('fillChat failed', err as Error);
        vscode.window.showErrorMessage(t('fillChat.failed', { error: (err as Error).message }));
      }
      break;
    }

    /**
     * Verify tab: run an IDE command for debugging. Only commands in the allowlist
     * are executed. For development/debug use only.
     */
    case 'runCommand': {
      const changeName = message.changeName;
      if (typeof changeName === 'string' && changeName.startsWith('archive:')) {
        vscode.window.showInformationMessage(t('archive.readOnly'));
        break;
      }
      const commandId = message.commandId;
      const argsJson = message.argsJson;
      if (typeof commandId !== 'string' || !commandId.trim()) {
        webview.postMessage({ type: 'runCommandResult', success: false, message: t('verify.commandIdEmpty') });
        break;
      }
      const ALLOWED_VERIFY_COMMAND_IDS = new Set<string>([
        'composer.newAgentChat',
      ]);
      if (!ALLOWED_VERIFY_COMMAND_IDS.has(commandId.trim())) {
        webview.postMessage({
          type: 'runCommandResult',
          success: false,
          message: t('verify.notInAllowlist'),
        });
        break;
      }
      let args: unknown[] = [];
      if (typeof argsJson === 'string' && argsJson.trim()) {
        try {
          const parsed = JSON.parse(argsJson) as unknown;
          args = Array.isArray(parsed) ? parsed : [parsed];
        } catch {
          webview.postMessage({ type: 'runCommandResult', success: false, message: t('verify.invalidJson') });
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
