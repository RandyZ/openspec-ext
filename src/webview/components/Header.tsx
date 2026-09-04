import React from 'react';
import { t } from '../../i18n';
import type {
  LoadingReason,
  OpenSpecRootBinding,
  OpenSpecScopeView,
  ProjectContext,
} from '../types/messages';
import type { DashboardActivity } from '../context/AppContext';
import { formatOpenSpecRootLabel } from '../utils/scopeLabels';

export interface HeaderProps {
  onRefresh: () => void;
  onNewChange?: () => void;
  loading: boolean;
  // Primary action rail also owns OpenSpec root context so users can choose the
  // planning root next to Refresh/New Change rather than in CLI/cache status.
  scope?: OpenSpecScopeView;
  scopes?: OpenSpecScopeView[];
  loadingReason?: LoadingReason;
  activity?: DashboardActivity;
  pendingScopeId?: string;
  onSelectScope?: (scopeId: string) => void;
  onRegisterStore?: () => void;
  onSetupStore?: () => void;
  project?: ProjectContext;
  binding?: OpenSpecRootBinding;
  onOpenChanges?: () => void;
  onOpenSpecs?: () => void;
  onOpenWorksets?: () => void;
  onOpenDashboard?: () => void;
  worksetCount?: number;
  /** Host capability fact; `false` explains the disabled tab with the upgrade copy. */
  worksetsCapabilityAvailable?: boolean;
  activeProjectTab?: 'changes' | 'specs' | 'worksets';
}

export const Header: React.FC<HeaderProps> = ({
  onRefresh,
  onNewChange,
  loading,
  scope,
  scopes = [],
  loadingReason,
  activity,
  onSelectScope,
  onRegisterStore,
  onSetupStore,
  project,
  binding,
  onOpenChanges,
  onOpenSpecs,
  onOpenWorksets,
  onOpenDashboard,
  worksetCount,
  worksetsCapabilityAvailable,
  activeProjectTab,
}) => {
  const showSelector = scope && scopes.length > 1 && onSelectScope;
  const projectScopes = scopes.filter((s) => s.source === 'local' || s.source === 'declared');
  const storeScopes = scopes.filter((s) => s.source === 'store');
  const storeFeaturesAvailable = scope?.capabilities?.stores === true;
  // The tab's availability is decided upstream (navigation + Workset capability,
  // never the workset count — zero worksets is the first-creation case). Here
  // it only reflects whether an open handler was provided.
  const worksetsAvailable = Boolean(onOpenWorksets);
  // Disabled reason copy: a runtime without the Workset capability gets the
  // existing upgrade explanation; a missing trusted navigation keeps the
  // membership-unavailable explanation.
  const worksetsDisabledCopy = worksetsCapabilityAvailable === false
    ? t('scope.featureGated.upgradeNotice')
    : t('projectSidebar.worksetsUnavailable');
  const worksetsAccessibleName = `${t('projectSidebar.worksets')}${worksetCount !== undefined ? ` (${worksetCount})` : ''}`;
  const dashboardAccessibleName = `${t('projectSidebar.dashboard')} · ${t('action.openInEditor')}`;
  const worksetsUnavailableId = 'project-worksets-unavailable';

  // Disable root actions during any in-flight scope/store operation so the
  // selector reflects the pending state (preserved from the old ScopeBar logic).
  // The textual status indicator itself stays in the CLI/cache status bar to
  // avoid duplicating it across both the rail and the status row.
  const disableScopeActions =
    activity?.kind === 'scope-switch' ||
    activity?.kind === 'scope-action' ||
    loadingReason === 'scope-switch' ||
    loadingReason === 'store-register' ||
    loadingReason === 'store-setup' ||
    (loading && !activity && !loadingReason);

  return (
    <div className="mb-4 pb-3 border-b" style={{
      borderColor: 'var(--vscode-panel-border)'
    }}>
      <h1 className="text-xl font-bold mb-2" style={{
        color: 'var(--vscode-textLink-foreground)'
      }}>
        OpenSpec
      </h1>
      {project && (
        <div className="space-y-3" data-project-first-header>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={onRefresh}
              disabled={loading}
              className="px-3 py-1 text-xs rounded"
              style={{
                background: 'var(--vscode-button-background)',
                color: 'var(--vscode-button-foreground)',
                opacity: loading ? 0.6 : 1,
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? `⟳ ${t('header.loading')}` : `⟳ ${t('header.refresh')}`}
            </button>
            {onNewChange && (
              <button
                onClick={onNewChange}
                className="px-3 py-1 text-xs rounded"
                style={{
                  background: 'var(--vscode-button-secondaryBackground)',
                  color: 'var(--vscode-button-secondaryForeground)',
                  cursor: 'pointer',
                }}
              >
                {t('header.newChange')}
              </button>
            )}
          </div>

          <div
            className="min-w-0 space-y-1"
            aria-label={t('projectSidebar.currentProject')}
            data-project-identity
            title={project.projectPath}
          >
            <div
              className="text-[10px] font-semibold uppercase tracking-wide"
              style={{ color: 'var(--vscode-descriptionForeground)' }}
            >
              {t('projectSidebar.currentProject')}
            </div>
            <div className="min-w-0 text-sm font-semibold truncate">{project.label}</div>
            {binding && (
              <div
                className="min-w-0 text-xs truncate"
                style={{ color: 'var(--vscode-descriptionForeground)' }}
                title={binding.rootPath}
              >
                {binding.rootSource}: {binding.rootPath}
              </div>
            )}
          </div>

          <nav
            className="flex flex-col gap-1"
            aria-label={t('projectSidebar.navigationLabel')}
            data-project-navigation
          >
            <div className="grid grid-cols-2 gap-1" data-project-action-grid>
              <button
                type="button"
                onClick={onOpenChanges}
                data-project-action="changes"
                aria-pressed={activeProjectTab === 'changes'}
                aria-label={t('projectSidebar.allChanges')}
                title={t('projectSidebar.allChanges')}
                className="group min-w-0 overflow-hidden rounded border px-2 py-2 text-left text-xs hover:brightness-110 focus:outline-none focus-visible:ring-1"
                style={{
                  borderColor: 'var(--vscode-panel-border)',
                  background: activeProjectTab === 'changes'
                    ? 'var(--vscode-list-activeSelectionBackground)'
                    : 'var(--vscode-sideBar-background)',
                  color: activeProjectTab === 'changes'
                    ? 'var(--vscode-list-activeSelectionForeground)'
                    : 'var(--vscode-foreground)',
                  outlineColor: 'var(--vscode-focusBorder)',
                }}
              >
                <span className="flex min-w-0 items-start gap-2">
                  <span className="codicon codicon-files mt-0.5 shrink-0" aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{t('projectSidebar.allChanges')}</span>
                    <span data-project-action-supporting className="block truncate text-[10px]" style={{ color: 'var(--vscode-descriptionForeground)' }}>
                      {t('projectSidebar.cardChangesSupporting')}
                    </span>
                  </span>
                </span>
              </button>
              <button
                type="button"
                onClick={onOpenSpecs}
                data-project-action="specs"
                aria-pressed={activeProjectTab === 'specs'}
                aria-label={t('projectSidebar.specs')}
                title={t('projectSidebar.specs')}
                className="group min-w-0 overflow-hidden rounded border px-2 py-2 text-left text-xs hover:brightness-110 focus:outline-none focus-visible:ring-1"
                style={{
                  borderColor: 'var(--vscode-panel-border)',
                  background: activeProjectTab === 'specs'
                    ? 'var(--vscode-list-activeSelectionBackground)'
                    : 'var(--vscode-sideBar-background)',
                  color: activeProjectTab === 'specs'
                    ? 'var(--vscode-list-activeSelectionForeground)'
                    : 'var(--vscode-foreground)',
                  outlineColor: 'var(--vscode-focusBorder)',
                }}
              >
                <span className="flex min-w-0 items-start gap-2">
                  <span className="codicon codicon-book mt-0.5 shrink-0" aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{t('projectSidebar.specs')}</span>
                    <span data-project-action-supporting className="block truncate text-[10px]" style={{ color: 'var(--vscode-descriptionForeground)' }}>
                      {t('projectSidebar.cardSpecsSupporting')}
                    </span>
                  </span>
                </span>
              </button>
              <button
                type="button"
                onClick={worksetsAvailable ? onOpenWorksets : undefined}
                disabled={!worksetsAvailable}
                data-project-action="worksets"
                aria-pressed={activeProjectTab === 'worksets'}
                aria-describedby={!worksetsAvailable ? worksetsUnavailableId : undefined}
                aria-label={worksetsAccessibleName}
                title={worksetsAvailable
                  ? t('projectSidebar.worksets')
                  : worksetsDisabledCopy}
                className="group min-w-0 overflow-hidden rounded border px-2 py-2 text-left text-xs hover:brightness-110 focus:outline-none focus-visible:ring-1 disabled:cursor-not-allowed disabled:opacity-60"
                style={{
                  borderColor: 'var(--vscode-panel-border)',
                  background: 'var(--vscode-sideBar-background)',
                  color: 'var(--vscode-foreground)',
                  outlineColor: 'var(--vscode-focusBorder)',
                }}
              >
                <span className="flex min-w-0 items-start gap-2">
                  <span className="codicon codicon-repo-clone mt-0.5 shrink-0" aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">
                      {t('projectSidebar.worksets')}{worksetCount ? ` (${worksetCount})` : ''}
                    </span>
                    <span
                      id={!worksetsAvailable ? worksetsUnavailableId : undefined}
                      data-project-action-supporting
                      className="block truncate text-[10px]"
                      style={{ color: 'var(--vscode-descriptionForeground)' }}
                    >
                      {worksetsAvailable
                        ? t('projectSidebar.cardWorksetsSupporting')
                        : worksetsDisabledCopy}
                    </span>
                  </span>
                </span>
              </button>
              <button
                type="button"
                onClick={onOpenDashboard}
                data-project-action="dashboard"
                aria-label={dashboardAccessibleName}
                title={dashboardAccessibleName}
                className="group min-w-0 overflow-hidden rounded border px-2 py-2 text-left text-xs hover:brightness-110 focus:outline-none focus-visible:ring-1"
                style={{
                  borderColor: 'var(--vscode-panel-border)',
                  background: 'var(--vscode-sideBar-background)',
                  color: 'var(--vscode-foreground)',
                  outlineColor: 'var(--vscode-focusBorder)',
                }}
              >
                <span className="flex min-w-0 items-start gap-2">
                  <span className="codicon codicon-dashboard mt-0.5 shrink-0" aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{t('projectSidebar.dashboard')}</span>
                    <span data-project-action-supporting className="block truncate text-[10px]" style={{ color: 'var(--vscode-descriptionForeground)' }}>
                      {t('projectSidebar.cardDashboardSupporting')}
                    </span>
                  </span>
                </span>
              </button>
            </div>
          </nav>
        </div>
      )}
      {!project && (
        <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={onRefresh}
          disabled={loading}
          className="px-3 py-1 text-xs rounded"
          style={{
            background: 'var(--vscode-button-background)',
            color: 'var(--vscode-button-foreground)',
            opacity: loading ? 0.6 : 1,
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? `⟳ ${t('header.loading')}` : `⟳ ${t('header.refresh')}`}
        </button>
        {onNewChange && (
          <button
            onClick={onNewChange}
            className="px-3 py-1 text-xs rounded"
            style={{
              background: 'var(--vscode-button-secondaryBackground)',
              color: 'var(--vscode-button-secondaryForeground)',
              cursor: 'pointer',
            }}
          >
            {t('header.newChange')}
          </button>
        )}

        {/* Root selector: visually grouped with Refresh/New Change, not cache status.
            On narrow sidebar widths, this wraps to a second row. */}
        {scope && (
          <div className="flex min-w-0 flex-wrap items-center gap-2" aria-label={t('projectSidebar.rootContextLabel')}>
            {showSelector ? (
              <select
                disabled={disableScopeActions}
                value={scope.id}
                onChange={(event) => onSelectScope?.(event.currentTarget.value)}
                aria-label={t('scope.root.selectorLabel')}
                className="min-w-0 max-w-[60%] truncate rounded border px-1 py-0.5 text-xs"
                style={{
                  borderColor: 'var(--vscode-dropdown-border)',
                  background: 'var(--vscode-dropdown-background)',
                  color: 'var(--vscode-dropdown-foreground)',
                }}
              >
                {projectScopes.length > 0 && (
                  <optgroup label={t('scope.group.projects')}>
                    {projectScopes.map((item) => (
                      <option key={item.id} value={item.id}>
                        {formatOpenSpecRootLabel(item)}
                      </option>
                    ))}
                  </optgroup>
                )}
                {storeScopes.length > 0 && (
                  <optgroup label={t('scope.group.stores')}>
                    {storeScopes.map((item) => (
                      <option key={item.id} value={item.id}>
                        {formatOpenSpecRootLabel(item)}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            ) : (
              <strong className="min-w-0 truncate text-xs">{formatOpenSpecRootLabel(scope)}</strong>
            )}

            {/* Lightweight Register/Create store actions live in the action rail
                so Local Root users can connect to store planning without first
                discovering the lower maintenance panel. */}
            {storeFeaturesAvailable && onRegisterStore && (
              <button
                type="button"
                onClick={onRegisterStore}
                disabled={disableScopeActions}
                className="rounded px-2 py-0.5 text-xs"
                style={{
                  background: 'var(--vscode-button-secondaryBackground)',
                  color: 'var(--vscode-button-secondaryForeground)',
                  opacity: disableScopeActions ? 0.6 : 1,
                  cursor: disableScopeActions ? 'not-allowed' : 'pointer',
                }}
              >
                {t('scope.action.registerStore')}
              </button>
            )}
            {storeFeaturesAvailable && onSetupStore && (
              <button
                type="button"
                onClick={onSetupStore}
                disabled={disableScopeActions}
                className="rounded px-2 py-0.5 text-xs"
                style={{
                  background: 'var(--vscode-button-secondaryBackground)',
                  color: 'var(--vscode-button-secondaryForeground)',
                  opacity: disableScopeActions ? 0.6 : 1,
                  cursor: disableScopeActions ? 'not-allowed' : 'pointer',
                }}
              >
                {t('scope.action.setupStore')}
              </button>
            )}
          </div>
        )}
        </div>
      )}
    </div>
  );
};
