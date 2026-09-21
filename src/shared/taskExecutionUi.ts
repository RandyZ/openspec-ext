export interface TaskLike {
  taskIndex: number;
  indent: number;
  done: boolean;
  text: string;
}

export type TaskDependencyPolicy = 'block' | 'warn';

/** Matches FileManagerService.getDirectChildIndices (all nested descendants). */
export function getDescendantTaskIndices(tasks: readonly TaskLike[], taskIndex: number): number[] {
  if (taskIndex < 0 || taskIndex >= tasks.length) return [];
  const parentIndent = tasks[taskIndex].indent;
  const childIndices: number[] = [];
  for (let j = taskIndex + 1; j < tasks.length; j++) {
    if (tasks[j].indent <= parentIndent) break;
    childIndices.push(j);
  }
  return childIndices;
}

export function getParentTaskIndex(tasks: readonly TaskLike[], taskIndex: number): number {
  const currentIndent = tasks[taskIndex]?.indent;
  if (currentIndent == null) return -1;
  for (let j = taskIndex - 1; j >= 0; j--) {
    if (tasks[j].indent < currentIndent) return j;
  }
  return -1;
}

/** Incomplete preceding tasks excluding the direct parent (matches TaskExecutorService). */
export function getIncompletePrecedingTasks(
  tasks: readonly TaskLike[],
  taskIndex: number,
): TaskLike[] {
  const parentIndex = getParentTaskIndex(tasks, taskIndex);
  return tasks
    .slice(0, taskIndex)
    .filter((task) => !task.done && task.taskIndex !== parentIndex);
}

export function isTaskBlockedByDependencies(
  tasks: readonly TaskLike[],
  taskIndex: number,
  policy: TaskDependencyPolicy = 'block',
): boolean {
  if (policy !== 'block') return false;
  const descendants = getDescendantTaskIndices(tasks, taskIndex);
  if (descendants.some((index) => !tasks[index].done)) {
    return false;
  }
  return getIncompletePrecedingTasks(tasks, taskIndex).length > 0;
}

/** First incomplete leaf-or-parent task that is not dependency-blocked. */
export function getRecommendedTaskIndex(
  tasks: readonly TaskLike[],
  policy: TaskDependencyPolicy = 'block',
): number | null {
  for (const task of tasks) {
    if (task.done) continue;
    if (isTaskBlockedByDependencies(tasks, task.taskIndex, policy)) continue;
    return task.taskIndex;
  }
  return null;
}

export function getPrimaryBlockingDependency(
  tasks: readonly TaskLike[],
  taskIndex: number,
): TaskLike | null {
  return getIncompletePrecedingTasks(tasks, taskIndex)[0] ?? null;
}
