import { countTaskProgress } from '../../shared/taskMarkdown';
import { enrichChangeWithLifecycle } from '../../shared/changeLifecycle';
import type { IOpenSpecContentAccess } from './contentAccess';
import type { ChangeInfo } from './types';

export function taskProgressFromTasksMarkdown(content: string): {
  completedTasks: number;
  totalTasks: number;
  status: ChangeInfo['status'];
} {
  const { completed, total } = countTaskProgress(content);
  const status: ChangeInfo['status'] = total === 0
    ? 'draft'
    : completed === total
      ? 'complete'
      : 'in-progress';
  return { completedTasks: completed, totalTasks: total, status };
}

export function applyTaskProgressToChange(
  change: ChangeInfo,
  progress: { completedTasks: number; totalTasks: number; status: ChangeInfo['status'] },
): ChangeInfo {
  return enrichChangeWithLifecycle({
    ...change,
    completedTasks: progress.completedTasks,
    totalTasks: progress.totalTasks,
    status: progress.status,
  });
}

/** Overlay CLI-reported task counts with tasks.md parsing (P0-A aligned with shared/taskMarkdown). */
export async function overlayChangeTaskProgressFromFiles(
  changes: ChangeInfo[],
  contentAccess: IOpenSpecContentAccess,
): Promise<ChangeInfo[]> {
  return Promise.all(changes.map(async (change) => {
    try {
      const content = await contentAccess.readArtifact(change.name, 'tasks');
      if (!content.trim()) {
        return change;
      }
      const progress = taskProgressFromTasksMarkdown(content);
      if (
        progress.totalTasks === 0
        && change.totalTasks > 0
        && (content.includes('[') || content.includes('- '))
      ) {
        return change;
      }
      return applyTaskProgressToChange(change, progress);
    } catch {
      return change;
    }
  }));
}
