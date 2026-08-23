import React from 'react';
import { useAppState } from '../context/AppContext';
import { t, type LocaleKey } from '../../i18n';
import type { ChangeInfo, ProjectSidebarData } from '../types/messages';

export type ProjectDashboardLifecycle =
  | 'planning'
  | 'ready-to-apply'
  | 'applying'
  | 'ready-to-verify'
  | 'archived';

export interface ProjectDashboardSummary {
  totalChanges: number;
  activeChanges: number;
  readyToVerify: number;
  archived: number;
  activeTasks: number;
  activeTaskCompletionRate: number | null;
  lifecycle: Record<ProjectDashboardLifecycle, number>;
  artifactReadiness: Array<{ id: string; done: number; declared: number }>;
  recentUpdates: Array<Pick<ChangeInfo, 'name' | 'lastModified'>>;
}

const LIFECYCLE_STATUSES: readonly ProjectDashboardLifecycle[] = [
  'planning',
  'ready-to-apply',
  'applying',
  'ready-to-verify',
  'archived',
];

function emptyLifecycle(): Record<ProjectDashboardLifecycle, number> {
  return Object.fromEntries(LIFECYCLE_STATUSES.map((status) => [status, 0])) as Record<ProjectDashboardLifecycle, number>;
}

export function deriveProjectDashboardSummary(
  data: ProjectSidebarData,
  recentLimit = 5,
): ProjectDashboardSummary {
  const activeChanges = data.changes.filter((change) => (
    (change as { lifecycleStatus?: string }).lifecycleStatus !== 'archived'
  ));
  const archivedFromChanges = data.changes.length - activeChanges.length;
  const archived = (data.archivedChanges?.length ?? 0) + archivedFromChanges;
  const lifecycle = emptyLifecycle();
  const artifactById = new Map<string, { done: number; declared: number }>();

  for (const change of activeChanges) {
    lifecycle[change.lifecycleStatus] += 1;
    for (const artifact of change.artifacts ?? []) {
      const readiness = artifactById.get(artifact.id) ?? { done: 0, declared: 0 };
      readiness.declared += 1;
      if (artifact.status === 'done') readiness.done += 1;
      artifactById.set(artifact.id, readiness);
    }
  }
  lifecycle.archived = archived;

  const activeTasks = activeChanges.reduce((total, change) => total + Math.max(0, change.totalTasks), 0);
  const completedTasks = activeChanges.reduce((total, change) => total + Math.max(0, change.completedTasks), 0);
  const recentUpdates = [...activeChanges]
    .filter((change) => Number.isFinite(Date.parse(change.lastModified)))
    .sort((left, right) => Date.parse(right.lastModified) - Date.parse(left.lastModified))
    .slice(0, Math.max(0, recentLimit))
    .map(({ name, lastModified }) => ({ name, lastModified }));

  return {
    totalChanges: activeChanges.length + archived,
    activeChanges: activeChanges.length,
    readyToVerify: activeChanges.filter((change) => change.lifecycleStatus === 'ready-to-verify').length,
    archived,
    activeTasks,
    activeTaskCompletionRate: activeTasks > 0 ? completedTasks / activeTasks : null,
    lifecycle,
    artifactReadiness: [...artifactById].map(([id, readiness]) => ({ id, ...readiness })),
    recentUpdates,
  };
}

const lifecycleLabels: Record<ProjectDashboardLifecycle, LocaleKey> = {
  planning: 'dashboard.lifecyclePlanning',
  'ready-to-apply': 'dashboard.lifecycleReadyToApply',
  applying: 'dashboard.lifecycleApplying',
  'ready-to-verify': 'dashboard.lifecycleReadyToVerify',
  archived: 'dashboard.lifecycleArchived',
};

function Kpi({ label, value }: { label: string; value: string | number }) {
  return (
    <section
      className="rounded border p-3"
      aria-label={label}
      style={{ borderColor: 'var(--vscode-panel-border)', background: 'var(--vscode-editor-inactiveSelectionBackground)' }}
    >
      <div className="text-xs" style={{ color: 'var(--vscode-descriptionForeground)' }}>{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </section>
  );
}

export const ProjectDashboard: React.FC = () => {
  const { state } = useAppState();
  const data = state.projectSidebar;

  if (!data && state.loading) {
    return <main data-page="projectDashboard" role="status" aria-label={t('projectDashboard.loading')} className="min-h-screen p-4">{t('projectDashboard.loading')}</main>;
  }

  if (!data) {
    return (
      <main data-page="projectDashboard" className="min-h-screen p-4">
        {state.error ? (
          <p role="alert">{state.error}</p>
        ) : (
          <p role="status">{t('projectDashboard.empty')}</p>
        )}
      </main>
    );
  }

  const summary = deriveProjectDashboardSummary(data);
  const completionRate = summary.activeTaskCompletionRate === null
    ? '—'
    : `${Math.round(summary.activeTaskCompletionRate * 100)}%`;
  const stale = state.stale || state.loading || data.cache?.stale;
  const maxLifecycle = Math.max(1, ...Object.values(summary.lifecycle));

  return (
    <main data-page="projectDashboard" className="min-h-screen p-4" style={{ color: 'var(--vscode-foreground)' }}>
      <header className="mb-5">
        <h1 className="text-xl font-semibold">{t('projectDashboard.title')}</h1>
        <p className="text-sm" style={{ color: 'var(--vscode-descriptionForeground)' }}>{data.project.label}</p>
      </header>

      {stale && (
        <p role="status" className="mb-4 text-sm" style={{ color: 'var(--vscode-descriptionForeground)' }}>
          {t('projectDashboard.stale')}
        </p>
      )}
      {state.error && (
        <p role="alert" className="mb-4 text-sm" style={{ color: 'var(--vscode-errorForeground)' }}>
          {state.error}
        </p>
      )}
      <section aria-labelledby="project-dashboard-kpi-title" className="mb-6">
        <h2 id="project-dashboard-kpi-title" className="sr-only">{t('projectDashboard.summary')}</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <Kpi label={t('projectDashboard.totalChanges')} value={summary.totalChanges} />
          <Kpi label={t('projectDashboard.activeChanges')} value={summary.activeChanges} />
          <Kpi label={t('projectDashboard.readyToVerify')} value={summary.readyToVerify} />
          <Kpi label={t('projectDashboard.archived')} value={summary.archived} />
          <Kpi label={t('projectDashboard.activeTasks')} value={summary.activeTasks} />
          <Kpi label={t('projectDashboard.completionRate')} value={completionRate} />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="project-dashboard-lifecycle-title">
          <h2 id="project-dashboard-lifecycle-title" className="mb-3 text-base font-semibold">{t('projectDashboard.lifecycle')}</h2>
          <div className="space-y-3" aria-label={t('projectDashboard.lifecycleDistribution')}>
            {LIFECYCLE_STATUSES.map((status) => (
              <div key={status}>
                <div className="mb-1 flex justify-between gap-3 text-sm">
                  <span>{t(lifecycleLabels[status])}</span>
                  <span>{summary.lifecycle[status]}</span>
                </div>
                <div className="h-2 rounded" style={{ background: 'var(--vscode-textBlockQuote-background)' }}>
                  <div
                    className="h-2 rounded"
                    aria-hidden="true"
                    style={{ width: `${(summary.lifecycle[status] / maxLifecycle) * 100}%`, background: 'var(--vscode-textLink-foreground)' }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="project-dashboard-artifact-title">
          <h2 id="project-dashboard-artifact-title" className="mb-3 text-base font-semibold">{t('projectDashboard.artifactReadiness')}</h2>
          {summary.artifactReadiness.length === 0 ? (
            <p role="status" className="text-sm">{t('projectDashboard.noArtifacts')}</p>
          ) : (
            <ul className="space-y-2" aria-label={t('projectDashboard.artifactReadiness')}>
              {summary.artifactReadiness.map((artifact) => (
                <li key={artifact.id} className="flex justify-between gap-3 text-sm">
                  <span className="truncate" title={artifact.id}>{artifact.id}</span>
                  <span>{artifact.done}/{artifact.declared}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section aria-labelledby="project-dashboard-recent-title" className="mt-6">
        <h2 id="project-dashboard-recent-title" className="mb-3 text-base font-semibold">{t('projectDashboard.recentUpdates')}</h2>
        {summary.recentUpdates.length === 0 ? (
          <p role="status" className="text-sm">{t('projectDashboard.noRecentUpdates')}</p>
        ) : (
          <ul className="space-y-2">
            {summary.recentUpdates.map((update) => (
              <li key={`${update.name}:${update.lastModified}`} className="flex flex-wrap justify-between gap-2 text-sm">
                <span className="truncate" title={update.name}>{update.name}</span>
                <time dateTime={update.lastModified} style={{ color: 'var(--vscode-descriptionForeground)' }}>{update.lastModified}</time>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
};
