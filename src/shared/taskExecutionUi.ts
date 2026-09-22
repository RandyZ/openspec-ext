export interface TaskLike {
  taskIndex: number;
  indent: number;
  done: boolean;
  inProgress?: boolean;
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
  const currentIndent = tasks[taskIndex]?.indent;
  const immediatePredecessorIndex = taskIndex > 0 ? taskIndex - 1 : -1;
  return tasks
    .slice(0, taskIndex)
    .filter((task) => {
      if (task.done) return false;
      if (task.taskIndex === parentIndex) return false;
      if (
        task.taskIndex === immediatePredecessorIndex
        && task.inProgress
        && currentIndent != null
        && task.indent === currentIndent
      ) {
        return false;
      }
      return true;
    });
}

function hasIncompleteSameIndentFollowers(
  tasks: readonly TaskLike[],
  taskIndex: number,
): boolean {
  const indent = tasks[taskIndex]?.indent;
  if (indent == null) return false;
  for (let j = taskIndex + 1; j < tasks.length; j++) {
    if (tasks[j].indent < indent) break;
    if (tasks[j].indent === indent && !tasks[j].done) return true;
  }
  return false;
}

/** CLI-actionable nodes: leaf tasks, or parents whose descendants are all complete. */
export function isTaskActionable(tasks: readonly TaskLike[], taskIndex: number): boolean {
  const task = tasks[taskIndex];
  if (!task || task.done) return false;
  const descendants = getDescendantTaskIndices(tasks, taskIndex);
  if (descendants.length > 0) {
    return !descendants.some((index) => !tasks[index].done);
  }
  if (task.inProgress && hasIncompleteSameIndentFollowers(tasks, taskIndex)) {
    return false;
  }
  return true;
}

export function isTaskBlockedByDependencies(
  tasks: readonly TaskLike[],
  taskIndex: number,
  policy: TaskDependencyPolicy = 'block',
): boolean {
  if (policy !== 'block') return false;
  if (!isTaskActionable(tasks, taskIndex)) return true;
  return getIncompletePrecedingTasks(tasks, taskIndex).length > 0;
}

/** First incomplete leaf-or-parent task that is not dependency-blocked. */
export function getRecommendedTaskIndex(
  tasks: readonly TaskLike[],
  policy: TaskDependencyPolicy = 'block',
): number | null {
  for (const task of tasks) {
    if (task.done) continue;
    if (!isTaskActionable(tasks, task.taskIndex)) continue;
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
