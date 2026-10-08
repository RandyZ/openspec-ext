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

function buildResolvedLaunchPayload(
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
  if (result.target === 'clipboard' || result.outcome === 'copied') {
    vscode.window.showInformationMessage(t('agentLaunch.copied', { command }));
    return;
  }
  if (result.outcome === 'started') {
    vscode.window.showInformationMessage(t('agentLaunch.started', { command }));
    return;
  }
  if (result.layer === 'deeplink') {
    vscode.window.showInformationMessage(t('agentLaunch.deeplinkPrefilled', { command }));
    return;
  }
  vscode.window.showInformationMessage(t('agentLaunch.prefilled', { command }));
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
    return {
      success: true,
      command: payload.command,
      target: resolveLaunchTargetFromPayload(payload, view),
      outcome: 'prefilled',
      message: t('workflow.launchDeduped'),
    };
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
        vscode.window.showInformationMessage(t('agentLaunch.agentCliStarted', { command: payload.command }));
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
  vscode.window.showInformationMessage(t('workflow.adapterFallback'));
  return {
    success: true,
    command: clipboardPayload.command,
    target: 'clipboard',
    layer: 'clipboard',
    outcome: 'copied',
  };
}
