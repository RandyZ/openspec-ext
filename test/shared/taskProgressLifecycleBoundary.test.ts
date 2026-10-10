import { describe, expect, it } from 'vitest';
import { taskProgressCrossesLifecycleBoundary } from '../../src/shared/taskProgressLifecycleBoundary';

describe('taskProgressCrossesLifecycleBoundary', () => {
  it('detects all-done transitions', () => {
    expect(taskProgressCrossesLifecycleBoundary(
      { completedTasks: 2, totalTasks: 3 },
      { completedTasks: 3, totalTasks: 3 },
    )).toBe(true);
  });

  it('detects empty file transitions', () => {
    expect(taskProgressCrossesLifecycleBoundary(
      { completedTasks: 3, totalTasks: 3 },
      { completedTasks: 0, totalTasks: 0 },
    )).toBe(true);
  });

  it('does not flag ordinary in-progress checkbox toggles', () => {
    expect(taskProgressCrossesLifecycleBoundary(
      { completedTasks: 1, totalTasks: 3 },
      { completedTasks: 2, totalTasks: 3 },
    )).toBe(false);
  });
});
