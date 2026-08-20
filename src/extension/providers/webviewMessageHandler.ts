import * as vscode from 'vscode';
import * as path from 'path';
import { logger } from '../utils/logger';
import { DataManager } from '../services/dataManager';
import { getChangesBasePath } from '../utils/workspaceRoot';
import { isPathUnderRoot } from '../utils/pathSafety';
import { getAdapterById, getCurrentAdapter } from '../adapters';
import type { CacheStatsView, WebviewMessage } from '../../webview/types/messages';
import { t } from '../../i18n';
import { buildWorkflowLaunchPayload } from '../../shared/workflowCommand';
import { getWorkflowLaunchConfig } from '../services/workflowLaunchConfig';
import {
  InteractiveAgentTerminalManager,
} from '../services/interactiveAgentTerminalManager';
import { confirmDirectArchive } from '../commands/archiveConfirm';
import { formatBytes } from '../utils/formatBytes';
import {
  getEffectiveWorkflowAdapterId,
  shouldForceCursorWorkflowRoute,
  toWorkflowLaunchConfigView,
} from '../../shared/workflowLaunchConfig';
import type {
  InteractiveWorkflowAction,
  InteractiveWorkflowState,
} from '../../shared/interactiveWorkflow';
import type { OpenSpecScope } from '../services/openspecScope';

/**
 * Resolve the effective root path for a message, honoring a panel-bound scopeId.
 * Falls back to the workspace root when no scope / local scope is selected, or when
 * the scope manager is unavailable (defensive: never throws on a minimal dataManager).
 */
function resolveScopeRoot(
  dataManager: DataManager,
  scopeId?: string,
  boundScope?: OpenSpecScope
): { rootPath: string; scope: OpenSpecScope | undefined } {
  if (boundScope) {
    return { rootPath: boundScope.rootPath, scope: boundScope };
  }
  const scopedDataManager = dataManager as DataManager & {
    resolveScope?: (id?: string) => OpenSpecScope | undefined;
  };
  const scope = typeof scopedDataManager.resolveScope === 'function'
    ? scopedDataManager.resolveScope(scopeId)
    : undefined;
  return { rootPath: scope?.rootPath ?? dataManager.getWorkspaceRoot(), scope };
}

/** Returns true if resolvedPath is under rootPath (no .. escape). */
function isPathUnderWorkspace(resolvedPath: string, workspaceRoot: string): boolean {
  const normalized = path.normalize(resolvedPath);
  const rel = path.relative(workspaceRoot, normalized);
  return !rel.startsWith('..') && !path.isAbsolute(rel);
}

function toCacheStatsView(
  stats: Awaited<ReturnType<DataManager['getCacheStats']>>,
  fallbackRootPath = '',
  error?: string
): CacheStatsView {
  const base = stats ?? {
    rootPath: fallbackRootPath,
    totalBytes: 0,
    fileCount: 0,
    calculatedAt: Date.now(),
    isCalculating: false,
  };

  return {
    rootPath: base.rootPath,
    totalBytes: base.totalBytes,
    formattedSize: formatBytes(base.totalBytes),
    fileCount: base.fileCount,
    calculatedAt: base.calculatedAt,
    isCalculating: base.isCalculating,
    ...(error ? { error } : {}),
  };
}

async function postCacheStats(
  webview: vscode.Webview,
  dataManager: DataManager,
  force = false
): Promise<void> {
  const cacheRootPath = dataManager.getCacheRootPath?.() ?? '';
  try {
    const stats = await dataManager.getCacheStats?.({ force });
    webview.postMessage({
      type: 'cacheStats',
      stats: toCacheStatsView(
        stats,
        cacheRootPath,
        stats ? undefined : t('cache.statsUnavailable')
      ),
    });
  } catch (error) {
    logger.warn('Failed to post cache stats', error as Error);
    webview.postMessage({
      type: 'cacheStats',
      stats: toCacheStatsView(
        undefined,
        cacheRootPath,
        (error as Error).message || t('cache.statsUnavailable')
      ),
    });
  }
}

function requireCacheRootPath(dataManager: DataManager): string {
  const rootPath = dataManager.getCacheRootPath?.();
  if (!rootPath) {
    throw new Error(t('cache.unavailable'));
  }
  return rootPath;
}

/**
 * Shared message handler for both sidebar webview and change detail panel.
 * Does NOT handle openChangeDetailInEditor (handled by provider/panel manager).
 */
export async function handleWebviewMessage(
  message: WebviewMessage,
  webview: vscode.Webview,
  dataManager: DataManager,
  interactiveTerminalManager?: InteractiveAgentTerminalManager,
  boundScope?: OpenSpecScope
): Promise<void> {
  if (message == null || typeof message !== 'object' || !('type' in message)) {
    logger.warn('Invalid webview message: missing or invalid object with type');
    return;
  }
  logger.debug(`Received message: ${message.type}`);

  const getDebug = () => vscode.workspace.getConfiguration('openspec').get<boolean>('debug') ?? false;
  const postCurrentDashboardData = async () => {
    const data = await dataManager.getDashboardData();
    webview.postMessage({ type: 'dashboardData', data, debug: getDebug() });
  };
  const postError = (error: unknown, fallbackMessage: string) => {
    webview.postMessage({
      type: 'error',
      message: (error as Error).message || fallbackMessage,
    });
  };

  switch (message.type) {
    case 'getDashboardData': {
      const data = await dataManager.getDashboardData();
      webview.postMessage({ type: 'dashboardData', data, debug: getDebug() });
      break;
    }

    case 'refresh': {
      try {
        const refreshedData = await dataManager.refresh();
        webview.postMessage({ type: 'dashboardData', data: refreshedData, debug: getDebug() });
      } catch (error) {
        logger.error('refresh message failed', error as Error);
        postError(error, t('command.refreshFailed'));
      }
      break;
    }

    case 'getCacheStats': {
      await postCacheStats(webview, dataManager, message.force === true);
      break;
    }

    case 'cacheAction': {
      const action = message.action;
      try {
        if (action === 'openFolder') {
          const rootPath = requireCacheRootPath(dataManager);
          const uri = vscode.Uri.file(rootPath);
          await vscode.workspace.fs.createDirectory(uri);
          await vscode.commands.executeCommand('revealFileInOS', uri);
          webview.postMessage({
            type: 'cacheActionResult',
            action,
            success: true,
            message: t('cache.openFolder'),
          });
          break;
        }

        if (action === 'copyPath') {
          const rootPath = requireCacheRootPath(dataManager);
          await vscode.env.clipboard.writeText(rootPath);
          const resultMessage = t('cache.pathCopied');
          vscode.window.showInformationMessage(resultMessage);
          webview.postMessage({
            type: 'cacheActionResult',
            action,
            success: true,
            message: resultMessage,
          });
          break;
        }

        if (action === 'clear') {
          const clearLabel = t('cache.clear');
          const confirmChoice = await vscode.window.showWarningMessage(
            t('cache.clearConfirm'),
            { modal: true },
            clearLabel,
          );
          if (confirmChoice !== clearLabel) {
            webview.postMessage({
              type: 'cacheActionResult',
              action,
              success: false,
              message: t('cache.cancelled'),
            });
            break;
          }
          await dataManager.clearCache();
          const refreshedData = await dataManager.refresh();
          const resultMessage = t('cache.cleared');
          vscode.window.showInformationMessage(resultMessage);
          webview.postMessage({
            type: 'cacheActionResult',
            action,
            success: true,
            message: resultMessage,
          });
          webview.postMessage({ type: 'dashboardData', data: refreshedData, debug: getDebug() });
          await postCacheStats(webview, dataManager, true);
          break;
        }

        if (action === 'showDetails') {
          const stats = await dataManager.getCacheStats?.({ force: true });
          if (!stats) {
            throw new Error(t('cache.statsUnavailable'));
          }
          const resultMessage = stats.isCalculating
            ? t('cache.statsCalculating')
            : `${t('cache.details')}: ${t('cache.summary', {
                size: formatBytes(stats.totalBytes),
                files: stats.fileCount,
              })}\n${stats.rootPath}`;
          vscode.window.showInformationMessage(resultMessage);
          webview.postMessage({
            type: 'cacheActionResult',
            action,
            success: true,
            message: resultMessage,
          });
          await postCacheStats(webview, dataManager, false);
          break;
        }

        throw new Error(`Unsupported cache action: ${String(action)}`);
      } catch (error) {
        logger.error(`cacheAction ${action} failed`, error as Error);
        const resultMessage = (error as Error).message || t('cache.unavailable');
        webview.postMessage({
          type: 'cacheActionResult',
          action,
          success: false,
          message: resultMessage,
        });
      }
      break;
    }

    case 'requestNewChange': {
      const { scope } = resolveScopeRoot(dataManager, message.scopeId, boundScope);
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
        await dataManager.createChange(name, scope);
        vscode.window.showInformationMessage(t('command.created', { name }));
        const newData = await dataManager.getDashboardData();
        webview.postMessage({ type: 'dashboardData', data: newData, debug: getDebug() });
      }
      break;
    }

    case 'requestRegisterStore': {
      try {
        const selected = await vscode.window.showOpenDialog({
          canSelectFiles: false,
          canSelectFolders: true,
          canSelectMany: false,
          title: t('store.register.pickFolder'),
          openLabel: t('scope.action.registerStore'),
        });
        const folder = selected?.[0]?.fsPath;
        if (!folder) {
          await postCurrentDashboardData();
          break;
        }

        const data = await dataManager.registerStore(folder);
        vscode.window.showInformationMessage(t('store.register.success'));
        webview.postMessage({ type: 'dashboardData', data, debug: getDebug() });
      } catch (error) {
        logger.error('requestRegisterStore failed', error as Error);
        vscode.window.showErrorMessage(t('store.actionFailed', { error: (error as Error).message }));
        postError(error, t('store.actionFailed', { error: (error as Error).message }));
      }
      break;
    }

    case 'requestSetupStore': {
      try {
        const id = await vscode.window.showInputBox({
          prompt: t('store.setup.idPrompt'),
          placeHolder: t('store.setup.idPlaceholder'),
          validateInput: (value) => {
            const normalized = value.trim();
            if (!normalized) return t('store.idRequired');
            if (!/^[a-z0-9][a-z0-9-]*$/.test(normalized)) return t('store.idInvalid');
            return null;
          },
        });
        const storeId = id?.trim();
        if (!storeId) {
          await postCurrentDashboardData();
          break;
        }

        const selected = await vscode.window.showOpenDialog({
          canSelectFiles: false,
          canSelectFolders: true,
          canSelectMany: false,
          title: t('store.setup.pickParentFolder'),
          openLabel: t('scope.action.setupStore'),
        });
        const parentFolder = selected?.[0]?.fsPath;
        if (!parentFolder) {
          await postCurrentDashboardData();
          break;
        }

        const targetPath = path.join(parentFolder, storeId);
        const data = await dataManager.setupStore(storeId, targetPath);
        vscode.window.showInformationMessage(t('store.setup.success', { id: storeId }));
        webview.postMessage({ type: 'dashboardData', data, debug: getDebug() });
      } catch (error) {
        logger.error('requestSetupStore failed', error as Error);
        vscode.window.showErrorMessage(t('store.actionFailed', { error: (error as Error).message }));
        postError(error, t('store.actionFailed', { error: (error as Error).message }));
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
      const { scope } = resolveScopeRoot(dataManager, message.scopeId, boundScope);
      await dataManager.toggleTask(changeName, taskIndex, scope);
      const [data, tasksContent] = await Promise.all([
        dataManager.getDashboardData(),
        dataManager.readArtifact(changeName, 'tasks', scope).catch(() => null),
      ]);
      webview.postMessage({ type: 'dashboardData', data, debug: getDebug() });
      if (tasksContent != null) {
        await dataManager.writeArtifactContentCache?.({
          changeName,
          artifactType: 'tasks',
          scope,
          content: tasksContent,
        });
        webview.postMessage({
          type: 'artifactContent',
          changeName,
          artifactType: 'tasks',
          content: tasksContent,
          cache: { source: 'fresh', stale: false },
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
      const { rootPath } = resolveScopeRoot(dataManager, message.scopeId, boundScope);
      const changesBase = getChangesBasePath(rootPath, changeName);
      const absPath = path.normalize(path.join(changesBase, 'specs', specId, 'spec.md'));
      if (!isPathUnderRoot(absPath, rootPath)) {
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
      const { rootPath } = resolveScopeRoot(dataManager, message.scopeId, boundScope);
      const changesBase = path.normalize(getChangesBasePath(rootPath, message.changeName));
      const artifactPath = path.normalize(path.join(changesBase, `${message.artifactType}.md`));
      logger.info(`[archived] openArtifact: changeName=${message.changeName}, artifactType=${message.artifactType}, root=${rootPath}, artifactPath=${artifactPath}`);
      // Gate against the resolved scope root (which may be a store root outside the
      // workspace) rather than the workspace root, so store artifacts can be opened.
      if (!isPathUnderRoot(changesBase, rootPath) || !isPathUnderRoot(artifactPath, rootPath)) {
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
      const { scope } = resolveScopeRoot(dataManager, message.scopeId, boundScope);
      const confirm = await confirmDirectArchive(name);
      if (confirm === 'verifyFirst') {
        // Route into the interactive Verify & Archive tab (recommended path).
        await vscode.commands.executeCommand(
          'openspec.openChangeDetail',
          name,
          'verifyArchive',
          'verify'
        );
        break;
      }
      if (confirm === 'archive') {
        await dataManager.archiveChange(name, scope);
        vscode.window.showInformationMessage(t('command.archived', { name }));
        const afterArchive = await dataManager.getDashboardData();
        webview.postMessage({ type: 'dashboardData', data: afterArchive, debug: getDebug() });
      }
      break;
    }

    case 'getArtifactContent': {
      const { changeName, artifactType } = message;
      if (!changeName || !artifactType) break;
      const { scope } = resolveScopeRoot(dataManager, message.scopeId, boundScope);
      logger.info(`[archived] getArtifactContent: changeName=${changeName}, artifactType=${artifactType}, scopeId=${message.scopeId ?? '<none>'}`);
      const cached = await dataManager.getCachedArtifactContent?.({
        changeName,
        artifactType,
        scope,
      });
      if (cached) {
        webview.postMessage({
          type: 'artifactContent',
          changeName,
          artifactType,
          content: cached.content,
          cache: { source: cached.source, stale: true, generatedAt: cached.generatedAt },
        });
      }
      const exists = await dataManager.artifactExists(changeName, artifactType, scope);
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
        const content = await dataManager.readArtifact(changeName, artifactType, scope);
        await dataManager.writeArtifactContentCache?.({
          changeName,
          artifactType,
          scope,
          content,
        });
        logger.info(`[archived] getArtifactContent: readArtifact ok, sending content`);
        webview.postMessage({
          type: 'artifactContent',
          changeName,
          artifactType,
          content,
          cache: { source: 'fresh', stale: false },
        });
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
      const { scope } = resolveScopeRoot(dataManager, message.scopeId, boundScope);
      try {
        const specIds = await dataManager.listDeltaSpecIds(changeName, scope);
        webview.postMessage({ type: 'deltaSpecList', changeName, specIds });
      } catch (err) {
        webview.postMessage({ type: 'deltaSpecList', changeName, specIds: [] });
      }
      break;
    }

    case 'getDeltaSpecContent': {
      const { changeName, specId } = message;
      if (!changeName || !specId) break;
      const { scope } = resolveScopeRoot(dataManager, message.scopeId, boundScope);
      try {
        const cached = await dataManager.getCachedArtifactContent?.({
          changeName,
          artifactType: 'specs',
          specId,
          scope,
        });
        if (cached) {
          webview.postMessage({
            type: 'deltaSpecContent',
            changeName,
            specId,
            content: cached.content,
            cache: { source: cached.source, stale: true, generatedAt: cached.generatedAt },
          });
        }
        const content = await dataManager.readDeltaSpec(changeName, specId, scope);
        const freshContent = content ?? '';
        await dataManager.writeArtifactContentCache?.({
          changeName,
          artifactType: 'specs',
          specId,
          scope,
          content: freshContent,
        });
        webview.postMessage({
          type: 'deltaSpecContent',
          changeName,
          specId,
          content: freshContent,
          cache: { source: 'fresh', stale: false },
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
      const { scope } = resolveScopeRoot(dataManager, message.scopeId, boundScope);
      try {
        const items = await dataManager.listArchivedChanges(scope);
        webview.postMessage({ type: 'archivedChanges', items, scopeId: scope?.id });
      } catch (err) {
        logger.error('Failed to list archived changes', err as Error);
        webview.postMessage({ type: 'archivedChanges', items: [], scopeId: scope?.id });
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
      const { scope } = resolveScopeRoot(dataManager, message.scopeId, boundScope);
      let success = false;
      try {
        const result = await dataManager.executeTaskRequest(changeName, taskIndex, taskText, scope);
        success = result.success;
        await dataManager.setTaskExecutionState(changeName, taskIndex, success, scope);
      } catch (err) {
        logger.error('executeTask failed', err as Error);
        vscode.window.showErrorMessage((err as Error).message || t('task.executionFailed'));
      }
      try {
        const executionState = await dataManager.getTaskExecutionState(changeName, scope);
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
      const { scope } = resolveScopeRoot(dataManager, message.scopeId, boundScope);
      try {
        const executionState = await dataManager.getTaskExecutionState(changeName, scope);
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

    case 'getWorkflowLaunchConfig': {
      webview.postMessage(getWorkflowLaunchConfigMessage());
      break;
    }

    case 'setPreferredAgentAdapter': {
      const adapterId = message.adapterId;
      if (typeof adapterId !== 'string') break;
      try {
        const config = vscode.workspace.getConfiguration('openspec');
        await config.update('preferredAgentAdapter', adapterId, vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage(t('adapter.switched', { name: adapterId }));
        webview.postMessage(getWorkflowLaunchConfigMessage());
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
        const { scope } = resolveScopeRoot(dataManager, message.scopeId, boundScope);
        // Keep mutations on the visible Root (same-name isolation across Local/Store).
        if (message.scopeId && scope && dataManager.getSelectedScope()?.id !== scope.id) {
          await dataManager.selectScope(scope.id);
        }
        await vscode.commands.executeCommand('openspec.continueArtifact', changeName, artifactType);
      }
      break;
    }

    case 'getSpecRequirements': {
      const specId = message.specId;
      if (typeof specId !== 'string' || !specId.trim()) break;
      const { scope } = resolveScopeRoot(dataManager, message.scopeId, boundScope);
      try {
        const requirements = await dataManager.getSpecRequirements(specId, scope);
        webview.postMessage({ type: 'specRequirements', specId, requirements });
      } catch (err) {
        webview.postMessage({ type: 'specRequirements', specId, requirements: [] });
      }
      break;
    }

    case 'getSpecContent': {
      const specId = message.specId;
      if (typeof specId !== 'string' || !specId.trim()) break;
      const { scope } = resolveScopeRoot(dataManager, message.scopeId, boundScope);
      try {
        const cached = await dataManager.getCachedArtifactContent?.({
          changeName: '__main-spec__',
          artifactType: 'spec',
          specId,
          scope,
        });
        if (cached) {
          webview.postMessage({
            type: 'specContent',
            specId,
            content: cached.content,
            cache: { source: cached.source, stale: true, generatedAt: cached.generatedAt },
          });
        }
        const content = await dataManager.readSpec(specId, scope);
        await dataManager.writeArtifactContentCache?.({
          changeName: '__main-spec__',
          artifactType: 'spec',
          specId,
          scope,
          content,
        });
        webview.postMessage({
          type: 'specContent',
          specId,
          content,
          cache: { source: 'fresh', stale: false },
        });
      } catch (err) {
        webview.postMessage({
          type: 'specContentError',
          specId,
          message: (err as Error).message || 'Failed to read spec',
        });
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

    case 'launchWorkflowAction': {
      const action = message.action;
      const changeName = message.changeName;
      if (typeof changeName !== 'string' || !changeName.trim()) break;

      // Resolve the effective root (scope-aware) so store-scoped workflows run against
      // the store root, not the workspace root.
      const { rootPath: scopeRootPath } = resolveScopeRoot(dataManager, message.scopeId, boundScope);

      const launchConfig = getWorkflowLaunchConfig();
      const effectiveAdapterId = getEffectiveWorkflowAdapterId(launchConfig);
      logger.info(
        `[workflow] launchWorkflowAction: action=${action}, changeName=${changeName}, ` +
          `scopeId=${message.scopeId ?? '<none>'}, scopeRoot=${scopeRootPath}, ` +
          `workflowLaunchMode=${launchConfig.workflowLaunchMode}, ` +
          `preferredAgentAdapter=${launchConfig.preferredAgentAdapter}, ` +
          `cursorLaunchMode=${launchConfig.cursorLaunchMode}, ` +
          `cursorLaunchModeExplicit=${launchConfig.cursorLaunchModeExplicit}, ` +
          `effectiveAdapterId=${effectiveAdapterId ?? 'none'}`
      );

      if (!effectiveAdapterId) {
        const payload = buildWorkflowLaunchPayload({
          action,
          changeName,
          workflowLaunchMode: 'clipboard',
        });
        logger.debug(`[workflow] copy-only route: command=${payload.command}`);
        await vscode.env.clipboard.writeText(payload.command);
        vscode.window.showInformationMessage(t('workflow.copiedCommand', { command: payload.command }));
        break;
      }

      const adapter = shouldForceCursorWorkflowRoute(launchConfig)
        ? await getAdapterById('cursor')
        : await getCurrentAdapter();
      if (!adapter) {
        const payload = buildWorkflowLaunchPayload({
          action,
          changeName,
          workflowLaunchMode: 'clipboard',
        });
        logger.warn(`[workflow] no available adapter for effectiveAdapterId=${effectiveAdapterId}; copied fallback command=${payload.command}`);
        await vscode.env.clipboard.writeText(payload.command);
        vscode.window.showInformationMessage(t('workflow.noAdapterCopied', { command: payload.command }));
        break;
      }

      const payload = buildWorkflowLaunchPayload({
        action,
        changeName,
        workflowLaunchMode: 'adapter',
        adapterId: adapter.id,
      });
      logger.info(`[workflow] launching via adapter: id=${adapter.id}, displayName=${adapter.displayName}, command=${payload.command}`);
      const result = await adapter.fillChat({
        changeName,
        taskIndex: -1,
        taskText: '',
        contextFiles: [],
        workspaceRoot: scopeRootPath,
        promptOverride: payload.command,
      });
      logger.info(
        `[workflow] adapter result: id=${result.adapterId}, success=${result.success}, message=${result.message ?? ''}`
      );
      break;
    }

    case 'runInteractiveWorkflow': {
      const { changeName, action } = message;
      if (typeof changeName !== 'string' || !changeName.trim()) break;
      const { rootPath: scopeRootPath, scope } = resolveScopeRoot(dataManager, message.scopeId, boundScope);
      postInteractiveWorkflowState(
        webview,
        changeName,
        await handleInteractiveWorkflowAction({
          kind: 'run',
          changeName,
          action,
          workspaceRoot: scopeRootPath,
          scope,
          interactiveTerminalManager,
        })
      );
      break;
    }

    case 'revealInteractiveWorkflow': {
      const { changeName, action } = message;
      if (typeof changeName !== 'string' || !changeName.trim()) break;
      const { rootPath: scopeRootPath, scope } = resolveScopeRoot(dataManager, message.scopeId, boundScope);
      postInteractiveWorkflowState(
        webview,
        changeName,
        await handleInteractiveWorkflowAction({
          kind: 'reveal',
          changeName,
          action,
          workspaceRoot: scopeRootPath,
          scope,
          interactiveTerminalManager,
        })
      );
      break;
    }

    case 'stopInteractiveWorkflow': {
      const { changeName, action } = message;
      if (typeof changeName !== 'string' || !changeName.trim()) break;
      const { rootPath: scopeRootPath, scope } = resolveScopeRoot(dataManager, message.scopeId, boundScope);
      postInteractiveWorkflowState(
        webview,
        changeName,
        await handleInteractiveWorkflowAction({
          kind: 'stop',
          changeName,
          action,
          workspaceRoot: scopeRootPath,
          scope,
          interactiveTerminalManager,
        })
      );
      break;
    }

    case 'clearInteractiveWorkflow': {
      const { changeName, action } = message;
      if (typeof changeName !== 'string' || !changeName.trim()) break;
      const { rootPath: scopeRootPath, scope } = resolveScopeRoot(dataManager, message.scopeId, boundScope);
      postInteractiveWorkflowState(
        webview,
        changeName,
        await handleInteractiveWorkflowAction({
          kind: 'clear',
          changeName,
          action,
          workspaceRoot: scopeRootPath,
          scope,
          interactiveTerminalManager,
        })
      );
      break;
    }

    case 'getInteractiveWorkflowState': {
      const { changeName } = message;
      if (typeof changeName !== 'string' || !changeName.trim()) break;
      const { rootPath: scopeRootPath, scope } = resolveScopeRoot(dataManager, message.scopeId, boundScope);
      const state = interactiveTerminalManager
        ? interactiveTerminalManager.getState(scopeRootPath, changeName, scope)
        : buildInteractiveWorkflowErrorState(
          changeName,
          'verify',
          t('verifyArchive.managerUnavailable')
        );
      postInteractiveWorkflowState(webview, changeName, state);
      break;
    }

    case 'retryCliDetection': {
      try {
        const data = await dataManager.refresh();
        webview.postMessage({ type: 'dashboardData', data, debug: getDebug() });
      } catch (err) {
        const diagnostic = dataManager.getCliDiagnostic();
        if (diagnostic) {
          webview.postMessage({
            type: 'cliActivationDiagnostic',
            diagnostic: {
              category: diagnostic.category,
              message: diagnostic.message,
              recoveryActions: diagnostic.recoveryActions,
              safeDetails: diagnostic.safeDetails,
              copyText: diagnostic.copyText,
              canRetry: diagnostic.canRetry,
              normalizedMessage: diagnostic.normalizedMessage,
            },
            mode: 'blocking',
          });
        } else {
          webview.postMessage({
            type: 'error',
            message: (err as Error).message || 'Failed to refresh dashboard data',
          });
        }
      }
      break;
    }

    case 'openCliPathSettings': {
      await vscode.commands.executeCommand('workbench.action.openSettings', 'openspec.cliPath');
      break;
    }

    case 'copyCliDiagnostic': {
      const diagnostic = dataManager.getCliDiagnostic();
      if (diagnostic) {
        await vscode.env.clipboard.writeText(diagnostic.copyText);
      }
      break;
    }

    case 'openCliInstallDocs': {
      await vscode.env.openExternal(vscode.Uri.parse('https://github.com/Fission-AI/OpenSpec#quick-start'));
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

    case 'selectScope': {
      try {
        // INVARIANT: every `dashboardData` post during a scope switch MUST carry
        // an explicit `cache` field. The webview drives its stale-indicator off
        // this field; omitting it would prematurely clear the stale state while
        // a fresh refresh for the newly selected scope is still in flight.
        await dataManager.selectScope(message.scopeId);
        const scopeAwareDataManager = dataManager as DataManager & {
          resolveScope?: (id?: string) => OpenSpecScope | undefined;
        };
        const selectedScope = scopeAwareDataManager.resolveScope?.(message.scopeId);
        const cached = await dataManager.getCachedDashboardData?.(selectedScope);
        if (cached) {
          webview.postMessage({
            type: 'dashboardData',
            data: cached.payload,
            debug: getDebug(),
            cache: {
              source: cached.source,
              stale: true,
              generatedAt: cached.metadata.generatedAt,
            },
          });
        }
        const refreshedData = await dataManager.refresh();
        webview.postMessage({
          type: 'dashboardData',
          data: refreshedData,
          debug: getDebug(),
          cache: { source: 'fresh', stale: false },
        });
      } catch (error) {
        logger.error('selectScope message failed', error as Error);
        postError(error, t('command.refreshFailed'));
      }
      break;
    }

    case 'openWorkset': {
      await dataManager.openWorkset(message.name);
      break;
    }

    case 'removeWorkset': {
      // Non-destructive: removal deletes ONLY the saved workset record. Member
      // folders, repos, and stores are never touched. Confirm via a modal so
      // the user understands what is (and isn't) deleted before proceeding.
      const confirmLabel = t('worksetsPage.removeConfirm');
      const messageText = `${t('worksetsPage.removeConfirmTitle', { name: message.name })}\n${t('worksetsPage.removeConfirmMessage')}`;
      const choice = await vscode.window.showWarningMessage(
        messageText,
        { modal: true },
        confirmLabel,
      );
      if (choice !== confirmLabel) {
        // Cancelled (dismiss / Escape): keep the workset, do nothing.
        break;
      }
      try {
        const data = await dataManager.removeWorkset(message.name);
        webview.postMessage({ type: 'dashboardData', data });
      } catch (error) {
        logger.error('removeWorkset failed', error as Error);
        vscode.window.showErrorMessage(
          t('worksetsPage.removeFailed', { name: message.name }),
        );
      }
      break;
    }

    default:
      logger.warn(`Unknown message type: ${message.type}`);
  }
}

export function getWorkflowLaunchConfigMessage() {
  const config = getWorkflowLaunchConfig();
  return {
    type: 'workflowLaunchConfig' as const,
    config: toWorkflowLaunchConfigView(config),
  };
}

function postInteractiveWorkflowState(
  webview: vscode.Webview,
  changeName: string,
  state: InteractiveWorkflowState
): void {
  webview.postMessage({
    type: 'interactiveWorkflowState',
    changeName,
    state,
  });
}

function isInteractiveWorkflowAction(value: unknown): value is InteractiveWorkflowAction {
  return value === 'verify' || value === 'archive';
}

function buildInteractiveWorkflowErrorState(
  changeName: string,
  action: InteractiveWorkflowAction,
  message: string
): InteractiveWorkflowState {
  return {
    changeName,
    sessions: {
      [action]: {
        action,
        status: 'error',
        message,
      },
    },
  };
}

async function handleInteractiveWorkflowAction(params: {
  kind: 'run' | 'reveal' | 'stop' | 'clear';
  changeName: string;
  action: unknown;
  workspaceRoot: string;
  scope?: { id?: string; rootPath: string; storeId?: string; label?: string };
  interactiveTerminalManager?: InteractiveAgentTerminalManager;
}): Promise<InteractiveWorkflowState> {
  if (!isInteractiveWorkflowAction(params.action)) {
    return buildInteractiveWorkflowErrorState(
      params.changeName,
      'verify',
      `Invalid interactive workflow action: ${String(params.action)}`
    );
  }
  if (!params.interactiveTerminalManager) {
    return buildInteractiveWorkflowErrorState(
      params.changeName,
      params.action,
      t('verifyArchive.managerUnavailable')
    );
  }
  if (params.changeName.startsWith('archive:') && params.action === 'archive') {
    return buildInteractiveWorkflowErrorState(
      params.changeName,
      'archive',
      t('verifyArchive.archivedArchiveRejected')
    );
  }

  switch (params.kind) {
    case 'run':
      return params.interactiveTerminalManager.start({
        workspaceRoot: params.workspaceRoot,
        changeName: params.changeName,
        action: params.action,
        scope: params.scope,
      });
    case 'reveal':
      return params.interactiveTerminalManager.reveal(
        params.workspaceRoot,
        params.changeName,
        params.action,
        params.scope
      );
    case 'stop':
      return params.interactiveTerminalManager.stop(
        params.workspaceRoot,
        params.changeName,
        params.action,
        params.scope
      );
    case 'clear':
      return params.interactiveTerminalManager.clear(
        params.workspaceRoot,
        params.changeName,
        params.action,
        params.scope
      );
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
  const lang = vscode.env.language || 'en';

  return `<!DOCTYPE html>
<html lang="${lang}">
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
