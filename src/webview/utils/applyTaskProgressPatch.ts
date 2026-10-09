import type { ChangeInfo } from '../types/messages';
import type { ChangeTaskProgressPatch } from '../../shared/changeTaskProgressPatch';

export function applyTaskProgressPatchToChange(
  change: ChangeInfo,
  patch: ChangeTaskProgressPatch,
): ChangeInfo {
  if (change.name !== patch.changeName) return change;
  const status = patch.totalTasks === 0
    ? 'draft'
    : patch.completedTasks === patch.totalTasks
      ? 'complete'
      : 'in-progress';
  return {
    ...change,
    completedTasks: patch.completedTasks,
    totalTasks: patch.totalTasks,
    status,
  };
}

export function applyTaskProgressPatchToChanges(
  changes: ChangeInfo[],
  patch: ChangeTaskProgressPatch,
): ChangeInfo[] {
  return changes.map((change) => applyTaskProgressPatchToChange(change, patch));
}
