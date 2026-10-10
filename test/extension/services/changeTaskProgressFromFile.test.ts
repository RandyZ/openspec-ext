import { describe, expect, it } from 'vitest';
import {
  overlayChangeTaskProgressFromFiles,
  taskProgressFromTasksMarkdown,
} from '@extension/services/changeTaskProgressFromFile';
import type { ChangeInfo } from '@extension/services/types';

describe('changeTaskProgressFromFile', () => {
  it('counts tasks the same way as shared taskMarkdown', () => {
    const content = `- [ ] one\n- [x] two\n- [~] three\n`;
    expect(taskProgressFromTasksMarkdown(content)).toEqual({
      completedTasks: 1,
      totalTasks: 3,
      status: 'in-progress',
    });
  });

  it('overlays CLI change rows from tasks.md content', async () => {
    const cliChange: ChangeInfo = {
      name: 'demo',
      completedTasks: 0,
      totalTasks: 99,
      lastModified: '2026-01-01',
      status: 'draft',
    };
    const contentAccess = {
      readArtifact: async () => `- [x] done\n- [ ] todo\n`,
    };
    const [updated] = await overlayChangeTaskProgressFromFiles([cliChange], contentAccess);
    expect(updated.completedTasks).toBe(1);
    expect(updated.totalTasks).toBe(2);
  });
});
