import * as vscode from 'vscode';
import type {
  AgentAutoSubmitMode,
  CursorLaunchMode,
  PreferredAgentAdapter,
  WorkflowLaunchConfig,
  WorkflowLaunchConfigView,
  WorkflowLaunchConfigWithExplicit,
  WorkflowLaunchMode,
} from '../../shared/workflowLaunchConfig';
import { resolveWorkflowLaunchConfig, toWorkflowLaunchConfigView } from '../../shared/workflowLaunchConfig';
import { isCursorHost } from '../utils/isCursorHost';
export type {
  CursorLaunchMode,
  PreferredAgentAdapter,
  WorkflowLaunchConfig,
  WorkflowLaunchMode,
} from '../../shared/workflowLaunchConfig';

const WORKFLOW_LAUNCH_MODES = new Set<WorkflowLaunchMode>(['clipboard', 'adapter']);
const CURSOR_LAUNCH_MODES = new Set<CursorLaunchMode>([
  'agentPanel',
  'deeplink',
  'chatCommand',
  'clipboard',
  'agentCli',
]);

function normalizeCursorLaunchMode(value: string | undefined): CursorLaunchMode {
  if (!value) return 'clipboard';
  if (value === 'deeplink' || value === 'chatCommand') {
    return 'agentPanel';
  }
  return CURSOR_LAUNCH_MODES.has(value as CursorLaunchMode)
    ? (value as CursorLaunchMode)
    : 'clipboard';
}
const PREFERRED_AGENT_ADAPTERS = new Set<PreferredAgentAdapter>([
  'clipboard',
  'cursor',
  'vscode-copilot',
  'vscode-chat',
  'claude-code',
  'opencode',
]);

function readString(key: string): string | undefined {
  const raw = vscode.workspace.getConfiguration('openspec').get<string>(key);
  return typeof raw === 'string' ? raw.trim() : undefined;
}

function hasExplicitConfigValue(key: string): boolean {
  const configuration = vscode.workspace.getConfiguration('openspec');
  const inspect =
    typeof configuration.inspect === 'function'
      ? configuration.inspect<unknown>(key)
      : undefined;
  if (!inspect) return false;

  return [
    inspect.globalValue,
    inspect.workspaceValue,
    inspect.workspaceFolderValue,
    inspect.globalLanguageValue,
    inspect.workspaceLanguageValue,
    inspect.workspaceFolderLanguageValue,
  ].some((value) => value !== undefined);
}

export function getCursorAgentModel(): string {
  const cursorModel = readString('cursorAgentModel');
  if (cursorModel) return cursorModel;

  const legacyModel = readString('agentModel');
  return legacyModel || 'auto';
}

function readRawWorkflowLaunchConfig(): WorkflowLaunchConfigWithExplicit {
  const workflowLaunchMode = readString('workflowLaunchMode');
  const preferredAgentAdapter = readString('preferredAgentAdapter');
  const cursorLaunchMode = readString('cursorLaunchMode');

  return {
    workflowLaunchMode: WORKFLOW_LAUNCH_MODES.has(workflowLaunchMode as WorkflowLaunchMode)
      ? (workflowLaunchMode as WorkflowLaunchMode)
      : 'clipboard',
    preferredAgentAdapter: PREFERRED_AGENT_ADAPTERS.has(preferredAgentAdapter as PreferredAgentAdapter)
      ? (preferredAgentAdapter as PreferredAgentAdapter)
      : 'clipboard',
    cursorLaunchMode: normalizeCursorLaunchMode(cursorLaunchMode),
    cursorAgentModel: getCursorAgentModel(),
    cursorLaunchModeExplicit: hasExplicitConfigValue('cursorLaunchMode'),
    workflowLaunchModeExplicit: hasExplicitConfigValue('workflowLaunchMode'),
    preferredAgentAdapterExplicit: hasExplicitConfigValue('preferredAgentAdapter'),
  };
}

export function getWorkflowLaunchConfig(): WorkflowLaunchConfig {
  return resolveWorkflowLaunchConfig(readRawWorkflowLaunchConfig(), {
    isCursorHost: isCursorHost(),
  });
}

/** Effective `openspec.agentAutoSubmit` (workspace folder → workspace → user → default). */
export function getAgentAutoSubmitMode(resource?: vscode.Uri): AgentAutoSubmitMode {
  const raw = vscode.workspace.getConfiguration('openspec', resource).get<string>('agentAutoSubmit');
  if (raw === 'never' || raw === 'always' || raw === 'readOnly') {
    return raw;
  }
  return 'readOnly';
}

/** Launch config pushed to webviews; includes the same auto-submit mode the host uses to launch. */
export function getWorkflowLaunchConfigViewForUi(resource?: vscode.Uri): WorkflowLaunchConfigView {
  return {
    ...toWorkflowLaunchConfigView(getWorkflowLaunchConfig()),
    agentAutoSubmit: getAgentAutoSubmitMode(resource),
  };
}
