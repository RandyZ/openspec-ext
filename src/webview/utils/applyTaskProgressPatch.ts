import type { ChangeInfo } from '../types/messages';
import type { ChangeTaskProgressPatch } from '../../shared/changeTaskProgressPatch';
import { enrichChangeWithLifecycle } from '../../shared/changeLifecycle';

type ChangeTaskProgressRow = Pick<
  ChangeInfo,
  | 'name'
  | 'completedTasks'
  | 'totalTasks'
  | 'status'
  | 'lastModified'
  | 'artifacts'
  | 'lifecycleStatus'
  | 'attention'
>;

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
  const merged: T = {
    ...change,
    completedTasks: patch.completedTasks,
    totalTasks: patch.totalTasks,
    status,
    ...(patch.lifecycleStatus ? { lifecycleStatus: patch.lifecycleStatus } : {}),
    ...(patch.attention !== undefined ? { attention: patch.attention } : {}),
  };
  if (patch.lifecycleStatus) {
    return merged;
  }
  if (change.artifacts && change.artifacts.length > 0) {
    return enrichChangeWithLifecycle({
      ...change,
      completedTasks: patch.completedTasks,
      totalTasks: patch.totalTasks,
      status,
    }) as T;
  }
  return merged;
}

export function applyTaskProgressPatchToChanges<T extends ChangeTaskProgressRow>(
  changes: readonly T[],
  patch: ChangeTaskProgressPatch,
): T[] {
  return changes.map((change) => applyTaskProgressPatchToChange(change, patch));
}
