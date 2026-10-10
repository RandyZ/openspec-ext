export interface TaskProgressCounts {
  completedTasks: number;
  totalTasks: number;
}

/** True when tasks.md-derived counts may change derived lifecycle (needs one status reconcile). */
export function taskProgressCrossesLifecycleBoundary(
  before: TaskProgressCounts | undefined,
  after: TaskProgressCounts,
): boolean {
  const prev = before ?? { completedTasks: 0, totalTasks: 0 };

  if ((prev.totalTasks === 0) !== (after.totalTasks === 0)) {
    return true;
  }

  const prevAllDone = prev.totalTasks > 0 && prev.completedTasks === prev.totalTasks;
  const nextAllDone = after.totalTasks > 0 && after.completedTasks === after.totalTasks;
  if (prevAllDone !== nextAllDone) {
    return true;
  }

  const prevSomeDone = prev.completedTasks > 0;
  const nextSomeDone = after.completedTasks > 0;
  if (prevSomeDone !== nextSomeDone) {
    return true;
  }

  return false;
}
