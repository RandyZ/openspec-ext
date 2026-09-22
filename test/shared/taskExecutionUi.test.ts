import { describe, expect, it } from 'vitest';
import {
  getIncompletePrecedingTasks,
  getRecommendedTaskIndex,
  isTaskActionable,
  isTaskBlockedByDependencies,
  type TaskLike,
} from '../../src/shared/taskExecutionUi';

function tasks(lines: Array<[boolean, string, number?, boolean?]>): TaskLike[] {
  return lines.map(([done, text, indent = 0, inProgress = false], taskIndex) => ({
    taskIndex,
    done,
    text,
    indent,
    inProgress,
  }));
}

describe('taskExecutionUi', () => {
  it('treats the first incomplete task as recommended when no dependencies block it', () => {
    const parsed = tasks([
      [false, 'First task'],
      [false, 'Second task'],
    ]);
    expect(getRecommendedTaskIndex(parsed)).toBe(0);
  });

  it('blocks a leaf task until preceding siblings are complete', () => {
    const parsed = tasks([
      [false, 'First task'],
      [false, 'Second task'],
    ]);
    expect(isTaskBlockedByDependencies(parsed, 1, 'block')).toBe(true);
    expect(getRecommendedTaskIndex(parsed, 'block')).toBe(0);
  });

  it('blocks parent tasks from Next until descendants complete unless marked in-progress', () => {
    const parsed = tasks([
      [false, 'Parent', 0],
      [false, 'Child', 2],
    ]);
    expect(isTaskActionable(parsed, 0)).toBe(false);
    expect(isTaskBlockedByDependencies(parsed, 0, 'block')).toBe(true);
    expect(getRecommendedTaskIndex(parsed, 'block')).toBe(1);

    const explicitParent = tasks([
      [false, 'Parent', 0, true],
      [false, 'Child', 2],
    ]);
    expect(isTaskActionable(explicitParent, 0)).toBe(true);
    expect(getRecommendedTaskIndex(explicitParent, 'block')).toBe(0);
  });

  it('excludes the direct parent from incomplete preceding checks', () => {
    const parsed = tasks([
      [false, 'Parent', 0],
      [false, 'Child', 2],
    ]);
    expect(getIncompletePrecedingTasks(parsed, 1).map((task) => task.text)).toEqual([]);
    expect(isTaskBlockedByDependencies(parsed, 1, 'block')).toBe(false);
  });

  it('does not mark tasks blocked when dependency policy is warn', () => {
    const parsed = tasks([
      [false, 'First task'],
      [false, 'Second task'],
    ]);
    expect(isTaskBlockedByDependencies(parsed, 1, 'warn')).toBe(false);
  });
});
