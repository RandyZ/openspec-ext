import type { WorkflowResolutionContext } from '../../shared/changeWorkflow';
import type { ChangeInfo } from '../types/messages';

/** Active dashboard/sidebar lists only include non-archived changes. */
export function changeWorkflowResolutionContext(
  change: Pick<ChangeInfo, 'completedTasks' | 'totalTasks'>,
): WorkflowResolutionContext {
  return {
    completedTasks: change.completedTasks,
    totalTasks: change.totalTasks,
    isArchived: false,
  };
}
