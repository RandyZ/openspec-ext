import type { ChangeInfo } from '../types/messages';
import type { ChangeTaskProgressPatch } from '../../shared/changeTaskProgressPatch';

type ChangeTaskProgressRow = Pick<ChangeInfo, 'name' | 'completedTasks' | 'totalTasks' | 'status'>;

export function applyTaskProgressPatchToChange<T extends ChangeTaskProgressRow>(
  change: T,
  patch: ChangeTaskProgressPatch,
): T {
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

export function applyTaskProgressPatchToChanges<T extends ChangeTaskProgressRow>(
  changes: readonly T[],
  patch: ChangeTaskProgressPatch,
): T[] {
  return changes.map((change) => applyTaskProgressPatchToChange(change, patch));
}
