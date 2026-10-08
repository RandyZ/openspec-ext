import type { WorkflowAction } from './workflowCommand';

export type AgentAutoSubmitMode = 'never' | 'readOnly' | 'always';

/**
 * Workflow actions that only inspect or report and do not intentionally modify
 * workspace artifacts as their primary outcome.
 */
export const READ_ONLY_WORKFLOW_ACTIONS = new Set<WorkflowAction>([
  'explore',
  'verify',
]);

export function isReadOnlyWorkflowAction(action: WorkflowAction): boolean {
  return READ_ONLY_WORKFLOW_ACTIONS.has(action);
}

export function shouldAutoSubmitWorkflowAction(
  action: WorkflowAction,
  mode: AgentAutoSubmitMode,
): boolean {
  if (mode === 'never') return false;
  if (mode === 'always') return true;
  return isReadOnlyWorkflowAction(action);
}
