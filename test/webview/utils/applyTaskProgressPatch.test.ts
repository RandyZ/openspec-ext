import { describe, expect, it } from 'vitest';
import { applyTaskProgressPatchToChanges } from '../../../src/webview/utils/applyTaskProgressPatch';
import type { ChangeInfo } from '../../../src/webview/types/messages';

describe('applyTaskProgressPatch', () => {
  it('updates matching change task counts', () => {
    const changes = [{
      name: 'demo',
      completedTasks: 0,
      totalTasks: 2,
      lastModified: '2026-01-01',
      status: 'in-progress',
      lifecycleStatus: 'applying',
      artifacts: [{ id: 'tasks', outputPath: 'tasks.md', status: 'done' }],
    } as ChangeInfo];
    const next = applyTaskProgressPatchToChanges(changes, {
      type: 'changeTaskProgressPatch',
      changeName: 'demo',
      completedTasks: 2,
      totalTasks: 2,
      revisedAt: 1,
    });
    expect(next[0].completedTasks).toBe(2);
    expect(next[0].status).toBe('complete');
    expect(next[0].lifecycleStatus).toBe('ready-to-verify');
  });

  it('applies host lifecycle fields from the patch when provided', () => {
    const changes = [{
      name: 'demo',
      completedTasks: 0,
      totalTasks: 3,
      lastModified: '2026-01-01',
      status: 'in-progress',
      lifecycleStatus: 'ready-to-apply',
      artifacts: [{ id: 'tasks', outputPath: 'tasks.md', status: 'done' }],
    } as ChangeInfo];
    const next = applyTaskProgressPatchToChanges(changes, {
      type: 'changeTaskProgressPatch',
      changeName: 'demo',
      completedTasks: 3,
      totalTasks: 3,
      lifecycleStatus: 'ready-to-verify',
      revisedAt: 1,
    });
    expect(next[0].lifecycleStatus).toBe('ready-to-verify');
  });
});
