import * as vscode from 'vscode';
import type {
  CursorLaunchMode,
  PreferredAgentAdapter,
  WorkflowLaunchConfig,
  WorkflowLaunchMode,
} from '../../shared/workflowLaunchConfig';
export type {
  CursorLaunchMode,
  PreferredAgentAdapter,
  WorkflowLaunchConfig,
  WorkflowLaunchMode,
} from '../../shared/workflowLaunchConfig';

const WORKFLOW_LAUNCH_MODES = new Set<WorkflowLaunchMode>(['clipboard', 'adapter']);
const CURSOR_LAUNCH_MODES = new Set<CursorLaunchMode>([
  'deeplink',
  'chatCommand',
  'clipboard',
  'agentCli',
]);
const PREFERRED_AGENT_ADAPTERS = new Set<PreferredAgentAdapter>([
  'clipboard',
  'cursor',
  'vscode-copilot',
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

export function getWorkflowLaunchConfig(): WorkflowLaunchConfig {
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
    cursorLaunchMode: CURSOR_LAUNCH_MODES.has(cursorLaunchMode as CursorLaunchMode)
      ? (cursorLaunchMode as CursorLaunchMode)
      : 'clipboard',
    cursorAgentModel: getCursorAgentModel(),
    cursorLaunchModeExplicit: hasExplicitConfigValue('cursorLaunchMode'),
  };
}
