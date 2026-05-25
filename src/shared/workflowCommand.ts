export type WorkflowAction =
  | 'explore'
  | 'continue'
  | 'ff'
  | 'apply'
  | 'verify'
  | 'archive'
  | 'sync';

export type WorkflowCommandTarget =
  | 'cursor'
  | 'opencode'
  | 'copilot'
  | 'clipboard'
  | 'generic'
  | 'unknown';

export interface WorkflowCommandRequest {
  action: WorkflowAction;
  changeName?: string;
  target: WorkflowCommandTarget;
}

export type WorkflowLaunchMode = 'clipboard' | 'adapter';

export interface WorkflowLaunchPayloadRequest {
  action: WorkflowAction;
  changeName?: string;
  workflowLaunchMode: WorkflowLaunchMode;
  adapterId?: string | null;
}

export interface WorkflowLaunchPayload {
  action: WorkflowAction;
  changeName?: string;
  workflowLaunchMode: WorkflowLaunchMode;
  target: WorkflowCommandTarget;
  command: string;
}

const HYPHEN_TARGETS = new Set<WorkflowCommandTarget>(['cursor', 'opencode']);

export function buildWorkflowCommand(request: WorkflowCommandRequest): string {
  const prefix = HYPHEN_TARGETS.has(request.target)
    ? `/opsx-${request.action}`
    : `/opsx:${request.action}`;
  const changeName = request.changeName?.trim();
  return changeName ? `${prefix} ${changeName}` : prefix;
}

export function getWorkflowCommandTargetForAdapter(
  adapterId: string | null | undefined
): WorkflowCommandTarget {
  switch (adapterId) {
    case 'cursor':
      return 'cursor';
    case 'opencode':
      return 'opencode';
    case 'vscode-copilot':
      return 'copilot';
    case 'clipboard':
      return 'clipboard';
    case 'claude-code':
      return 'generic';
    default:
      return 'unknown';
  }
}

export function buildWorkflowLaunchPayload(
  request: WorkflowLaunchPayloadRequest
): WorkflowLaunchPayload {
  const target =
    request.workflowLaunchMode === 'clipboard'
      ? 'clipboard'
      : getWorkflowCommandTargetForAdapter(request.adapterId);
  const command = buildWorkflowCommand({
    action: request.action,
    changeName: request.changeName,
    target,
  });

  return {
    action: request.action,
    changeName: request.changeName,
    workflowLaunchMode: request.workflowLaunchMode,
    target,
    command,
  };
}
