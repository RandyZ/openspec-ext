import * as vscode from 'vscode';
import type { WorkflowAction } from '../../shared/workflowCommand';
import {
  buildWorkflowLaunchPayload,
  getWorkflowCommandTargetForAdapter,
  buildWorkflowCommand,
} from '../../shared/workflowCommand';
import {
  type AgentAutoSubmitMode,
  shouldAutoSubmitWorkflowAction,
} from '../../shared/agentAutoSubmit';
import {
  isCopyOnlyWorkflowMode,
  shouldForceCursorWorkflowRoute,
  toWorkflowLaunchConfigView,
} from '../../shared/workflowLaunchConfig';
import { getCurrentAdapter, getAdapterById } from '../adapters';
import { cursorAdapter } from '../adapters/cursor-adapter';
import { t } from '../../i18n';
import { getWorkflowLaunchConfig } from './workflowLaunchConfig';
import {
  launchAgentPanelPrompt,
  type AgentLaunchLayer,
  type AgentLaunchOutcome,
} from './agentPanelLauncher';
import { isCursorHost } from '../utils/isCursorHost';
import { notifyWorkflowCommandCopied } from './workflowClipboardNotify';

export type WorkflowAgentLaunchTarget =
  | 'clipboard'
  | 'agentPanel'
  | 'agentCli'
  | 'externalAdapter';

export interface WorkflowAgentLaunchRequest {
  action: WorkflowAction;
  changeName: string;
  workspaceRoot: string;
}

export interface WorkflowAgentLaunchResult {
  success: boolean;
  command: string;
  target: WorkflowAgentLaunchTarget;
  layer?: AgentLaunchLayer;
  outcome?: AgentLaunchOutcome;
  message?: string;
}

const PANEL_ADAPTER_IDS = new Set(['cursor', 'vscode-copilot', 'vscode-chat']);

function resolveLaunchTargetFromPayload(
  payload: ReturnType<typeof buildWorkflowLaunchPayload>,
  view: ReturnType<typeof toWorkflowLaunchConfigView>,
): WorkflowAgentLaunchTarget {
  if (view.cursorLaunchMode === 'agentCli') return 'agentCli';
  if (isCopyOnlyWorkflowMode(view) || payload.target === 'clipboard') return 'clipboard';
  if (payload.target === 'cursor') return 'agentPanel';
  return 'externalAdapter';
}

export function buildResolvedLaunchPayload(
  action: WorkflowAction,
  changeName: string,
): ReturnType<typeof buildWorkflowLaunchPayload> {
  const launchConfig = getWorkflowLaunchConfig();
  const launchConfigView = toWorkflowLaunchConfigView(launchConfig);
  if (isCopyOnlyWorkflowMode(launchConfigView)) {
    return buildWorkflowLaunchPayload({
      action,
      changeName,
      workflowLaunchMode: 'clipboard',
      adapterId: isCursorHost() ? 'cursor' : 'clipboard',
    });
  }
  return buildWorkflowLaunchPayload({
    action,
    changeName,
    workflowLaunchMode: 'adapter',
    adapterId: launchConfigView.effectiveAdapterId ?? launchConfig.preferredAgentAdapter,
  });
}

const LAUNCH_DEDUPE_MS = 2500;
let lastWorkflowLaunch: { key: string; at: number } | undefined;

function workflowLaunchDedupeKey(request: WorkflowAgentLaunchRequest): string {
  return `${request.workspaceRoot}\u0000${request.changeName}\u0000${request.action}`;
}

function readAgentAutoSubmitMode(): AgentAutoSubmitMode {
  const raw = vscode.workspace.getConfiguration('openspec').get<string>('agentAutoSubmit');
  if (raw === 'never' || raw === 'always' || raw === 'readOnly') {
    return raw;
  }
  return 'readOnly';
}

function notifyLaunchResult(
  result: WorkflowAgentLaunchResult,
  command: string,
): void {
  if (result.outcome === 'deduped') {
    void vscode.window.showInformationMessage(t('workflow.launchDeduped'));
    return;
  }
  if (result.target === 'clipboard' || result.outcome === 'copied') {
    notifyWorkflowCommandCopied(command);
    return;
  }
  if (result.layer === 'deeplink') {
    void vscode.window.showInformationMessage(t('agentLaunch.deeplinkPrefilled', { command }));
    return;
  }
  if (result.layer === 'vscodeChat' || result.target === 'externalAdapter') {
    void vscode.window.showInformationMessage(t('agentLaunch.prefilledChat', { command }));
    return;
  }
  void vscode.window.showInformationMessage(t('agentLaunch.openedPanel', { command }));
}

export async function notifyWorkflowLaunchFailure(
  reason: string,
  retry?: () => void | Promise<void>,
): Promise<void> {
  const retryLabel = t('workflow.retryLaunch');
  const settingsLabel = t('workflow.openSettings');
  const picked = await vscode.window.showErrorMessage(
    t('agentLaunch.failedWithReason', { reason }),
    retryLabel,
    settingsLabel,
  );
  if (picked === retryLabel && retry) {
    await retry();
  } else if (picked === settingsLabel) {
    void vscode.commands.executeCommand('workbench.action.openSettings', '@ext:randysss.openspec-workflow');
  }
}

export function resetWorkflowLaunchDedupeForTests(): void {
  lastWorkflowLaunch = undefined;
}

export async function launchWorkflowAgentCommand(
  request: WorkflowAgentLaunchRequest,
): Promise<WorkflowAgentLaunchResult> {
  const dedupeKey = workflowLaunchDedupeKey(request);
  const now = Date.now();
  if (
    lastWorkflowLaunch
    && lastWorkflowLaunch.key === dedupeKey
    && now - lastWorkflowLaunch.at < LAUNCH_DEDUPE_MS
  ) {
    const payload = buildResolvedLaunchPayload(request.action, request.changeName);
    const view = toWorkflowLaunchConfigView(getWorkflowLaunchConfig());
    const deduped: WorkflowAgentLaunchResult = {
      success: true,
      command: payload.command,
      target: resolveLaunchTargetFromPayload(payload, view),
      layer: undefined,
      outcome: 'deduped',
      message: t('workflow.launchDeduped'),
    };
    notifyLaunchResult(deduped, payload.command);
    return deduped;
  }
  lastWorkflowLaunch = { key: dedupeKey, at: now };

  const launchConfig = getWorkflowLaunchConfig();
  const launchConfigView = toWorkflowLaunchConfigView(launchConfig);
  const autoSubmit = shouldAutoSubmitWorkflowAction(request.action, readAgentAutoSubmitMode());

  const clipboardPayload = buildResolvedLaunchPayload(request.action, request.changeName);

  if (isCopyOnlyWorkflowMode(launchConfigView)) {
    await vscode.env.clipboard.writeText(clipboardPayload.command);
    const result: WorkflowAgentLaunchResult = {
      success: true,
      command: clipboardPayload.command,
      target: 'clipboard',
      layer: 'clipboard',
      outcome: 'copied',
    };
    notifyLaunchResult(result, clipboardPayload.command);
    return result;
  }

  const adapter = shouldForceCursorWorkflowRoute(launchConfig)
    && launchConfig.preferredAgentAdapter !== 'clipboard'
    ? await getAdapterById('cursor')
    : await getCurrentAdapter();

  const adapterId = adapter?.id ?? launchConfig.preferredAgentAdapter;
  const payload = buildWorkflowLaunchPayload({
    action: request.action,
    changeName: request.changeName,
    workflowLaunchMode: 'adapter',
    adapterId,
  });

  if (launchConfig.cursorLaunchMode === 'agentCli') {
    const cliAdapter = adapter?.id === 'cursor' ? adapter : await getAdapterById('cursor');
    if (cliAdapter?.id === 'cursor') {
      const cliResult = await cursorAdapter.executeTask({
        changeName: request.changeName,
        taskIndex: -1,
        taskText: '',
        contextFiles: [],
        workspaceRoot: request.workspaceRoot,
        promptOverride: payload.command,
      });
      const result: WorkflowAgentLaunchResult = {
        success: cliResult.success,
        command: payload.command,
        target: 'agentCli',
        message: cliResult.message,
      };
      if (cliResult.success) {
        void vscode.window.showInformationMessage(t('agentLaunch.agentCliStarted', { command: payload.command }));
      }
      return result;
    }
  }

  if (adapter?.id === 'cursor' && launchConfig.cursorLaunchMode === 'clipboard') {
    await vscode.env.clipboard.writeText(payload.command);
    const result: WorkflowAgentLaunchResult = {
      success: true,
      command: payload.command,
      target: 'clipboard',
      layer: 'clipboard',
      outcome: 'copied',
    };
    notifyLaunchResult(result, payload.command);
    return result;
  }

  if (adapter && PANEL_ADAPTER_IDS.has(adapter.id)) {
    await vscode.env.clipboard.writeText(payload.command);
    const panelResult = await launchAgentPanelPrompt({
      text: payload.command,
      autoSubmit,
    });
    const result: WorkflowAgentLaunchResult = {
      success: panelResult.success,
      command: payload.command,
      target: 'agentPanel',
      layer: panelResult.layer,
      outcome: panelResult.outcome,
      message: panelResult.message,
    };
    notifyLaunchResult(result, payload.command);
    return result;
  }

  if (adapter) {
    const target = getWorkflowCommandTargetForAdapter(adapter.id);
    const command = buildWorkflowCommand({
      action: request.action,
      changeName: request.changeName,
      target,
    });
    const external = await adapter.fillChat({
      changeName: request.changeName,
      taskIndex: -1,
      taskText: '',
      contextFiles: [],
      workspaceRoot: request.workspaceRoot,
      promptOverride: command,
    });
    return {
      success: external.success,
      command,
      target: 'externalAdapter',
      message: external.message,
    };
  }

  await vscode.env.clipboard.writeText(clipboardPayload.command);
  notifyWorkflowCommandCopied(clipboardPayload.command);
  return {
    success: true,
    command: clipboardPayload.command,
    target: 'clipboard',
    layer: 'clipboard',
    outcome: 'copied',
  };
}
