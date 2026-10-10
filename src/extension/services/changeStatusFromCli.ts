import { enrichChangeWithLifecycle } from '../../shared/changeLifecycle';
import type { ChangeInfo } from './types';
import type { OpenSpecScope } from './openspecScope';
import type { OpenSpecCliService } from './openspecCli';

function mapCliArtifacts(raw: unknown): ChangeInfo['artifacts'] {
  if (!Array.isArray(raw)) return [];
  return raw.map((entry) => {
    const artifact = entry as Record<string, unknown>;
    const statusRaw = typeof artifact.status === 'string' ? artifact.status : '';
    const status = statusRaw === 'complete'
      ? 'done'
      : (statusRaw === 'done' || statusRaw === 'ready' || statusRaw === 'blocked'
        ? statusRaw
        : 'blocked');
    return {
      id: typeof artifact.id === 'string' ? artifact.id : '',
      outputPath: typeof artifact.outputPath === 'string'
        ? artifact.outputPath
        : typeof artifact.path === 'string'
          ? artifact.path
          : '',
      status,
    };
  });
}

/**
 * Refresh artifact graph for one change via `openspec status --change` (no list/doctor/context/workset).
 */
export async function reconcileChangeLifecycleFromCli(params: {
  changeName: string;
  scope: OpenSpecScope | undefined;
  cli: OpenSpecCliService;
  existing: ChangeInfo | undefined;
  fileProgress: { completedTasks: number; totalTasks: number; status: ChangeInfo['status'] };
}): Promise<ChangeInfo | null> {
  try {
    const status = await params.cli.getChangeStatus(params.changeName, params.scope);
    const artifacts = mapCliArtifacts(status.artifacts);
    const base: ChangeInfo = {
      name: params.changeName,
      completedTasks: params.fileProgress.completedTasks,
      totalTasks: params.fileProgress.totalTasks,
      status: params.fileProgress.status,
      lastModified: params.existing?.lastModified ?? new Date().toISOString(),
      createdAt: params.existing?.createdAt,
      artifacts,
      workflowSnapshot: params.existing?.workflowSnapshot,
      proposalWhySummary: params.existing?.proposalWhySummary,
      proposalWhyFullText: params.existing?.proposalWhyFullText,
      searchText: params.existing?.searchText,
      lifecycleStatus: params.existing?.lifecycleStatus ?? 'planning',
    };
    return enrichChangeWithLifecycle(base);
  } catch {
    return null;
  }
}
