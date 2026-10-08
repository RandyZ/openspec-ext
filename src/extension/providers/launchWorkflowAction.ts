import * as vscode from 'vscode';
import { logger } from '../utils/logger';
import { DataManager } from '../services/dataManager';
import { t } from '../../i18n';
import { buildWorkflowLaunchPayload } from '../../shared/workflowCommand';
import type { WorkflowAction } from '../../shared/workflowCommand';
import { getWorkflowLaunchConfig } from '../services/workflowLaunchConfig';
import {
  launchWorkflowAgentCommand,
  notifyWorkflowLaunchFailure,
} from '../services/workflowAgentLaunch';
import { toWorkflowLaunchConfigView } from '../../shared/workflowLaunchConfig';
import { isPathInWorkspaceFolders } from '../utils/workspaceFolders';
import { broadcastWorkflowActionReceipt } from '../services/workflowWebviewRegistry';
import type { OpenSpecScope } from '../services/openspecScope';
import {
  createWorkflowRequestId,
  getWorkflowBindingKey,
  type ChangeWorkflowSnapshot,
  type WorkflowActionReceipt,
  type WorkflowBindingIdentity,
} from '../../shared/changeWorkflow';

export const WORKFLOW_LAUNCHING_MIN_VISIBLE_MS = 400;

function postWorkflowReceipt(webview: vscode.Webview, receipt: WorkflowActionReceipt): void {
  try {
    webview.postMessage({ type: 'workflowActionReceipt', ...receipt });
  } catch {
    // Originating webview may be disposed.
  }
  broadcastWorkflowActionReceipt(receipt, webview);
}

export async function disposeLaunchStatusBarAfterMinimum(
  disposable: vscode.Disposable | undefined,
  launchStartedAt: number,
): Promise<void> {
  if (!disposable) return;
  const elapsed = Date.now() - launchStartedAt;
  const remaining = WORKFLOW_LAUNCHING_MIN_VISIBLE_MS - elapsed;
  if (remaining > 0) {
    await new Promise((resolve) => setTimeout(resolve, remaining));
  }
  disposable.dispose();
}

function parseWorkflowBindingFromKey(bindingKey: string): WorkflowBindingIdentity | undefined {
  try {
    const parsed: unknown = JSON.parse(bindingKey);
    if (!Array.isArray(parsed) || parsed.length < 4) return undefined;
    const [projectId, commandCwd, rootPath, rootSource, storeId] = parsed;
    if (
      typeof projectId !== 'string'
      || typeof commandCwd !== 'string'
      || typeof rootPath !== 'string'
      || typeof rootSource !== 'string'
    ) {
      return undefined;
    }
    return {
      projectId,
      commandCwd,
      rootPath,
      rootSource,
      ...(typeof storeId === 'string' && storeId.length > 0 ? { storeId } : {}),
    };
  } catch {
    return undefined;
  }
}

function resolveWorkflowBindingForLaunch(
  scope: OpenSpecScope | undefined,
  bindingKey?: string,
): WorkflowBindingIdentity | undefined {
  if (scope?.workflowBinding) {
    return scope.workflowBinding;
  }
  if (typeof bindingKey === 'string' && bindingKey.trim()) {
    return parseWorkflowBindingFromKey(bindingKey);
  }
  return undefined;
}

function resolveScopeRoot(
  dataManager: DataManager,
  scopeId?: string,
  boundScope?: OpenSpecScope,
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
  const rootPath = scope?.rootPath ?? dataManager.getWorkspaceRoot();
  return { rootPath, scope };
}

function postLaunchValidationFailure(
  webview: vscode.Webview,
  receipt: WorkflowActionReceipt,
  logMessage: string,
  userMessage: string,
): void {
  logger.warn(logMessage);
  void vscode.window.showWarningMessage(userMessage);
  postWorkflowReceipt(webview, { ...receipt, suppressPriorityAttention: true });
}

export interface LaunchWorkflowActionRequest {
  webview: vscode.Webview;
  dataManager: DataManager;
  boundScope?: OpenSpecScope;
  action: WorkflowAction;
  changeName: string;
  requestId?: string;
  bindingKey?: string;
  scopeId?: string;
}

export async function processLaunchWorkflowAction(
  request: LaunchWorkflowActionRequest,
): Promise<void> {
  const {
    webview,
    dataManager,
    boundScope,
    action,
    changeName,
    scopeId,
  } = request;

  const launchStartedAt = Date.now();
  const logWorkflowTiming = (phase: string, detail?: string) => {
    logger.info(
      `[workflow-timing] ${phase} +${Date.now() - launchStartedAt}ms`
      + (detail ? ` ${detail}` : ''),
    );
  };

  const { rootPath: scopeRootPath, scope } = resolveScopeRoot(dataManager, scopeId, boundScope);
  const correlated = request.requestId !== undefined || request.bindingKey !== undefined;
  const requestId = request.requestId ?? createWorkflowRequestId('legacy');
  const workflowBinding = resolveWorkflowBindingForLaunch(scope, request.bindingKey);
  let receiptBindingKeyForPost = request.bindingKey ?? 'legacy';
  const postReceipt = (
    target: WorkflowActionReceipt['target'],
    status: WorkflowActionReceipt['status'],
    receiptMessage?: string,
    suppressPriorityAttention?: boolean,
  ) => postWorkflowReceipt(webview, {
    requestId,
    changeName,
    bindingKey: receiptBindingKeyForPost,
    action,
    target,
    status,
    ...(receiptMessage ? { message: receiptMessage } : {}),
    ...(suppressPriorityAttention ? { suppressPriorityAttention: true } : {}),
  });

  const retryParams: LaunchWorkflowActionRequest = {
    ...request,
    requestId,
    bindingKey: receiptBindingKeyForPost,
  };

  let launchStatusDisposable: vscode.Disposable | undefined;
  try {
    if (correlated) {
      postReceipt('unknown', 'running');
      launchStatusDisposable = vscode.window.setStatusBarMessage?.(t('workflow.launching'));
    }
    logWorkflowTiming('received', `action=${action} change=${changeName}`);

    if (!isPathInWorkspaceFolders(scopeRootPath)) {
      if (correlated) {
        postLaunchValidationFailure(
          webview,
          {
            requestId,
            changeName,
            bindingKey: request.bindingKey ?? 'unknown',
            action,
            target: 'unknown',
            status: 'failed',
            message: t('workflow.workspaceRootStale'),
          },
          `Workflow launch blocked: scope root not in workspace folders (${scopeRootPath})`,
          t('workflow.workspaceRootStale'),
        );
      } else {
        void vscode.window.showWarningMessage(t('workflow.workspaceRootStale'));
      }
      return;
    }

    const snapshotReader = dataManager as DataManager & {
      getChangeWorkflowSnapshot?: (
        name: string,
        scope?: OpenSpecScope,
        binding?: WorkflowBindingIdentity
      ) => Promise<ChangeWorkflowSnapshot | undefined>;
    };
    let expectedBindingKey: string | undefined;
    if (workflowBinding && request.bindingKey) {
      const identityKey = getWorkflowBindingKey(workflowBinding);
      if (identityKey === request.bindingKey) {
        expectedBindingKey = identityKey;
      }
    }
    if (
      expectedBindingKey === undefined
      && typeof snapshotReader.getChangeWorkflowSnapshot === 'function'
    ) {
      try {
        expectedBindingKey = (
          await snapshotReader.getChangeWorkflowSnapshot(changeName, scope, workflowBinding)
        )?.bindingKey;
      } catch (error) {
        logger.warn('Failed to validate workflow action binding', error as Error);
        if (correlated) {
          postLaunchValidationFailure(
            webview,
            {
              requestId,
              changeName,
              bindingKey: request.bindingKey ?? 'unknown',
              action,
              target: 'unknown',
              status: 'failed',
              message: t('workflow.bindingValidationFailed'),
            },
            `Workflow binding validation error for ${changeName}: ${(error as Error).message}`,
            t('workflow.bindingValidationFailed'),
          );
          return;
        }
      }
    }
    receiptBindingKeyForPost = request.bindingKey ?? expectedBindingKey ?? 'legacy';
    retryParams.bindingKey = receiptBindingKeyForPost;

    if (correlated && (!request.requestId || !request.bindingKey)) {
      postLaunchValidationFailure(
        webview,
        {
          requestId,
          changeName,
          bindingKey: receiptBindingKeyForPost,
          action,
          target: 'unknown',
          status: 'failed',
          message: t('workflow.bindingRequestIncomplete'),
        },
        `Workflow launch rejected for ${changeName}: missing requestId or bindingKey`,
        t('workflow.bindingRequestIncomplete'),
      );
      return;
    }
    if (request.bindingKey && expectedBindingKey && request.bindingKey !== expectedBindingKey) {
      postLaunchValidationFailure(
        webview,
        {
          requestId,
          changeName,
          bindingKey: request.bindingKey,
          action,
          target: 'unknown',
          status: 'failed',
          message: t('workflow.bindingMismatch'),
        },
        `Workflow binding mismatch for ${changeName}: expected=${expectedBindingKey}, received=${request.bindingKey}`,
        t('workflow.bindingMismatch'),
      );
      return;
    }

    logWorkflowTiming('validated', `bindingKey=${receiptBindingKeyForPost}`);

    const launchConfig = getWorkflowLaunchConfig();
    const launchConfigView = toWorkflowLaunchConfigView(launchConfig);
    const effectiveAdapterId = launchConfigView.effectiveAdapterId;
    logger.info(
      `[workflow] launchWorkflowAction: action=${action}, changeName=${changeName}, ` +
        `scopeId=${scopeId ?? '<none>'}, scopeRoot=${scopeRootPath}, ` +
        `workflowLaunchMode=${launchConfig.workflowLaunchMode}, ` +
        `preferredAgentAdapter=${launchConfig.preferredAgentAdapter}, ` +
        `cursorLaunchMode=${launchConfig.cursorLaunchMode}, ` +
        `cursorLaunchModeExplicit=${launchConfig.cursorLaunchModeExplicit}, ` +
        `effectiveAdapterId=${effectiveAdapterId ?? 'none'}`
    );

    logWorkflowTiming('launcher-start');
    const launchResult = await launchWorkflowAgentCommand({
      action,
      changeName,
      workspaceRoot: scopeRootPath,
    });
    const timingOutcome = launchResult.outcome === 'deduped'
      ? 'deduped'
      : (launchResult.outcome ?? 'n/a');
    logWorkflowTiming(
      `layer-${launchResult.layer ?? 'none'}-done`,
      `target=${launchResult.target} outcome=${timingOutcome} command=${launchResult.command}`,
    );
    logger.info(
      `[workflow] agent launch: target=${launchResult.target}, layer=${launchResult.layer ?? 'n/a'}, ` +
        `outcome=${launchResult.outcome ?? 'n/a'}, command=${launchResult.command}`
    );
    const receiptTarget = launchResult.target === 'agentPanel'
      ? 'cursor'
      : launchResult.target === 'agentCli'
        ? 'cursor'
        : launchResult.target === 'externalAdapter'
          ? buildWorkflowLaunchPayload({
            action,
            changeName,
            workflowLaunchMode: 'adapter',
            adapterId: effectiveAdapterId ?? undefined,
          }).target
          : 'clipboard';
    if (launchResult.outcome === 'deduped') {
      return;
    }
    if (launchResult.success) {
      const status = launchResult.outcome === 'copied' ? 'copied' : 'delivered';
      postReceipt(receiptTarget, status, launchResult.message);
    } else {
      const reason = launchResult.message ?? t('agentLaunch.failed');
      postReceipt(receiptTarget, 'failed', reason, true);
      void notifyWorkflowLaunchFailure(reason, () => processLaunchWorkflowAction(retryParams));
    }
  } catch (error) {
    logger.error('launchWorkflowAction failed', error as Error);
    const reason = (error as Error).message;
    postReceipt('unknown', 'failed', reason, true);
    void notifyWorkflowLaunchFailure(reason, () => processLaunchWorkflowAction(retryParams));
  } finally {
    void disposeLaunchStatusBarAfterMinimum(launchStatusDisposable, launchStartedAt);
  }
}
