import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useVscode } from '../hooks/useVscode';
import { useAppState } from '../context/AppContext';
import type { AppAction } from '../context/AppContext';
import { sendMessage } from '../types/messages';
import type {
  DashboardData,
  ProjectSidebarData,
  SpecInfo,
  WebviewMessage,
} from '../types/messages';
import { Header } from './Header';
import { ChangesSection } from './ChangesSection';
import { SpecsSection } from './SpecsSection';
import { CliActivationDiagnosticCard } from './CliActivationDiagnosticCard';
import { ScopeBar } from './ScopeBar';
import { StoresAndWorksetsPanel } from './StoresAndWorksetsPanel';
import { WorksetsPage } from './WorksetsPage';
import { WorksetProjectPicker } from './WorksetProjectPicker';
import { formatOpenSpecRootLabel } from '../utils/scopeLabels';
import { t } from '../../i18n';
import {
  buildWorkflowCommand,
  type WorkflowAction,
} from '../../shared/workflowCommand';
import { buildChangeStatusCounts } from '../../shared/changeLifecycle';
import type { WorkflowLaunchConfigView } from '../utils/workflowLaunchLabels';
import type { CacheAction, CacheStatsView } from '../types/messages';
import {
  DEFAULT_CHANGES_VIEW_STATE,
  getChangesViewForRoot,
  getChangesViewRootKey,
  readPersistedDashboardState,
  resolveChangesViewScope,
  shouldClampChangesViewPage,
  upsertChangesViewForRoot,
  type ChangesViewState,
} from '../state/changesViewState';

type DashboardDispatch = React.Dispatch<AppAction>;
type DashboardPostMessage = (message: WebviewMessage) => void;

export function getDashboardActionScopeId(
  projectSidebar: ProjectSidebarData | null | undefined,
  selectedScopeId?: string,
): string | undefined {
  return projectSidebar ? undefined : selectedScopeId;
}

export function returnToCurrentProject(
  setProjectFirstView: (view: 'project') => void,
  postMessage: DashboardPostMessage,
): void {
  setProjectFirstView('project');
  postMessage(sendMessage.selectCurrentProject());
}

export function createScopeSelectHandler(
  dispatch: DashboardDispatch,
  postMessage: DashboardPostMessage,
) {
  return (scopeId: string) => {
    dispatch({ type: 'START_SCOPE_SWITCH', scopeId });
    postMessage(sendMessage.selectScope(scopeId));
  };
}

export function createStoreRegisterHandler(
  dispatch: DashboardDispatch,
  postMessage: DashboardPostMessage,
) {
  return () => {
    dispatch({ type: 'START_LOADING', reason: 'store-register' });
    postMessage(sendMessage.requestRegisterStore());
  };
}

export function createStoreSetupHandler(
  dispatch: DashboardDispatch,
  postMessage: DashboardPostMessage,
) {
  return () => {
    dispatch({ type: 'START_LOADING', reason: 'store-setup' });
    postMessage(sendMessage.requestSetupStore());
  };
}

export function requestInitialDashboardData(
  dispatch: DashboardDispatch,
  postMessage: DashboardPostMessage,
) {
  dispatch({ type: 'SET_LOADING', payload: true, reason: 'initial' });
  postMessage(sendMessage.getDashboardData());
  postMessage(sendMessage.getWorkflowLaunchConfig());
  postMessage(sendMessage.getCacheStats());
}

/**
 * A plain Local Root with no read-only references, no registered stores, and no
 * saved worksets stays lightweight: the Changes/Specs areas remain similar to
 * the original single-project dashboard instead of being dominated by an empty
 * management panel. Register Store stays reachable from the primary action rail.
 */
export function isLightweightLocalRoot(data: DashboardData | null | undefined): boolean {
  if (!data) return false;
  if (!data.scope || data.scope.source !== 'local') return false;
  const hasStores = (data.scopes ?? []).some((s) => s.source === 'store');
  const hasReferences = (data.relationships?.references ?? []).length > 0;
  const hasWorksets = (data.worksets ?? []).length > 0;
  return !hasStores && !hasReferences && !hasWorksets;
}

export const Dashboard: React.FC = () => {
  const { postMessage, onMessage, getState, setState } = useVscode();
  const { state, dispatch } = useAppState();
  const [dashboardView, setDashboardView] = useState<'overview' | 'worksets'>('overview');
  const [projectFirstView, setProjectFirstView] = useState<'project' | 'workset'>('project');
  const [specRequirements, setSpecRequirements] = useState<Record<string, string[]>>({});
  const [cacheStats, setCacheStats] = useState<CacheStatsView | null>(null);
  const [cacheActionMessage, setCacheActionMessage] = useState<string | null>(null);
  const [pendingCacheAction, setPendingCacheAction] = useState<CacheAction | null>(null);
  // Tracks the scope the current requirements cache was loaded under; reset on change.
  const lastScopeIdRef = useRef<string | undefined>(undefined);
  // Ref mirror of the current scope id, so the onMessage callback (created once per
  // effect run) can read the latest scope without closing over stale state.
  const scopeIdRef = useRef<string | undefined>(undefined);
  const [workflowLaunchConfig, setWorkflowLaunchConfig] = useState<WorkflowLaunchConfigView | null>(null);

  const { data, loading, loadingReason, pendingScopeId, activity, error } = state;
  const projectSidebar = state.projectSidebar;
  const projectFirst = state.projectFirst === true || state.projectSidebar !== undefined;
  const projectDiagnostic = state.cliDiagnostic
    ?? (projectSidebar?.cliDiagnostic
      ? { diagnostic: projectSidebar.cliDiagnostic, mode: 'warning' as const }
      : null);

  useEffect(() => {
    setProjectFirstView('project');
  }, [projectSidebar?.project.id, projectSidebar?.binding.rootPath]);

  const viewScope = resolveChangesViewScope(data, pendingScopeId);
  const viewRootKey = viewScope ? getChangesViewRootKey(viewScope) : null;

  const [changesViewRootKey, setChangesViewRootKey] = useState<string | null>(() => viewRootKey);
  const [changesViewState, setChangesViewState] = useState<ChangesViewState>(() => {
    if (!viewRootKey) {
      return { ...DEFAULT_CHANGES_VIEW_STATE };
    }
    return getChangesViewForRoot(readPersistedDashboardState(getState()), viewRootKey);
  });

  // Restore the target Root's Changes view when the selected Root changes.
  // Leave-state is already written on every view-state update via setState.
  if (viewRootKey !== changesViewRootKey) {
    setChangesViewRootKey(viewRootKey);
    if (viewRootKey) {
      setChangesViewState(
        getChangesViewForRoot(readPersistedDashboardState(getState()), viewRootKey)
      );
    } else {
      setChangesViewState({ ...DEFAULT_CHANGES_VIEW_STATE });
    }
  }

  const persistChangesViewState = useCallback(
    (next: ChangesViewState) => {
      setChangesViewState(next);
      if (!viewRootKey) {
        return;
      }
      const raw = getState();
      const base =
        raw && typeof raw === 'object' && !Array.isArray(raw)
          ? (raw as Record<string, unknown>)
          : {};
      const persisted = readPersistedDashboardState(base);
      setState({
        ...base,
        ...upsertChangesViewForRoot(persisted, viewRootKey, next),
      });
    },
    [getState, setState, viewRootKey]
  );

  const allowPageClamp = shouldClampChangesViewPage(data?.scope, viewScope);

  useEffect(() => {
    // Listen for messages from extension
    const cleanup = onMessage((event: MessageEvent) => {
      const message = event.data;

      if (message.type === 'setContext' && message.view === 'sidebar') {
        dispatch({ type: 'SET_PROJECT_SIDEBAR', payload: message.data });
        if (message.data.workflowLaunchConfig) {
          setWorkflowLaunchConfig(message.data.workflowLaunchConfig);
        }
      } else if (message.type === 'dashboardData' && !projectFirst) {
        dispatch({ type: 'SET_DATA', payload: message.data, cache: message.cache });
        if (message.debug !== undefined) {
          dispatch({ type: 'SET_DEBUG', payload: message.debug });
        }
        // Prefetch spec requirements scoped to the current root so store-scope specs
        // don't read requirements from the local workspace root.
        const scopeId = message.data?.scope?.id;
        if (message.data?.specs) {
          for (const spec of message.data.specs) {
            postMessage(sendMessage.getSpecRequirements(spec.id, scopeId));
          }
        }
        // When the scope changes, drop requirements cached for the previous scope.
        if (lastScopeIdRef.current !== undefined && lastScopeIdRef.current !== scopeId) {
          setSpecRequirements({});
        }
        lastScopeIdRef.current = scopeId;
        scopeIdRef.current = scopeId;
      } else if (message.type === 'error') {
        dispatch({ type: 'SET_ERROR', payload: message.message });
      } else if (message.type === 'cliActivationDiagnostic') {
        dispatch({
          type: 'SET_CLI_DIAGNOSTIC',
          payload: { diagnostic: message.diagnostic, mode: message.mode },
        });
      } else if (message.type === 'specRequirements') {
        setSpecRequirements((prev) => ({
          ...prev,
          [message.specId]: message.requirements ?? [],
        }));
      } else if (message.type === 'workflowLaunchConfig') {
        setWorkflowLaunchConfig(message.config ?? null);
      } else if (message.type === 'cacheStats') {
        setCacheStats(message.stats ?? null);
      } else if (message.type === 'cacheActionResult') {
        setPendingCacheAction(null);
        setCacheActionMessage(message.message ?? (message.success ? t('cache.menuLabel') : t('cache.unavailable')));
        if (message.success) {
          postMessage(sendMessage.getCacheStats(true));
        }
      }
    });

    // Request initial data
    if (projectFirst) {
      dispatch({ type: 'SET_LOADING', payload: true, reason: 'initial' });
      postMessage(sendMessage.getProjectSidebarData());
      postMessage(sendMessage.getWorkflowLaunchConfig());
    } else {
      requestInitialDashboardData(dispatch, postMessage);
    }

    return cleanup;
  }, [postMessage, onMessage, dispatch, projectFirst]);

  const handleSelectScope = useCallback(
    createScopeSelectHandler(dispatch, postMessage),
    [dispatch, postMessage],
  );

  const handleRegisterStore = useCallback(
    createStoreRegisterHandler(dispatch, postMessage),
    [dispatch, postMessage],
  );

  const handleSetupStore = useCallback(
    createStoreSetupHandler(dispatch, postMessage),
    [dispatch, postMessage],
  );

  const handleOpenArchivedChange = (directoryName: string) => {
    postMessage(sendMessage.openChangeDetailInEditor(`archive:${directoryName}`, undefined, undefined, state.data?.scope?.id));
  };
  const projectChanges = projectSidebar?.changes.filter((change) => (
    (change as { lifecycleStatus?: string }).lifecycleStatus !== 'archived'
      && !change.name.startsWith('archive:')
  )) ?? [];

  const handleRefresh = () => {
    dispatch({ type: 'SET_LOADING', payload: true, reason: 'refresh' });
    postMessage(sendMessage.refresh());
    postMessage(sendMessage.getWorkflowLaunchConfig());
    postMessage(sendMessage.getCacheStats(true));
  };

  const handleCacheAction = useCallback((action: CacheAction) => {
    setCacheActionMessage(null);
    setPendingCacheAction(action);
    postMessage(sendMessage.cacheAction(action));
  }, [postMessage]);

  const handleOpenChange = (changeName: string) => {
    postMessage(
      projectSidebar
        ? sendMessage.openChangeDetailInEditor(
          changeName,
          undefined,
          undefined,
          undefined,
          projectSidebar.project,
          projectSidebar.binding,
        )
        : sendMessage.openChangeDetailInEditor(changeName, undefined, undefined, state.data?.scope?.id)
    );
  };

  const handleRequestNewChange = () => {
    postMessage(sendMessage.requestNewChange(
      getDashboardActionScopeId(projectSidebar, state.data?.scope?.id),
    ));
  };

  const handleCopyFf = (changeName: string) => {
    postMessage(sendMessage.copyToClipboard(buildWorkflowCommand({ action: 'ff', changeName, target: 'clipboard' })));
  };

  const handleCopyApply = (changeName: string) => {
    postMessage(sendMessage.copyToClipboard(buildWorkflowCommand({ action: 'apply', changeName, target: 'clipboard' })));
  };

  const handleLaunchWorkflow = (action: WorkflowAction, changeName: string) => {
    if (action === 'verify' || action === 'archive') {
      postMessage(
        projectSidebar
          ? sendMessage.openChangeDetailInEditor(
            changeName,
            'verifyArchive',
            action,
            undefined,
            projectSidebar.project,
            projectSidebar.binding,
          )
          : sendMessage.openChangeDetailInEditor(changeName, 'verifyArchive', action, state.data?.scope?.id)
      );
      return;
    }
    postMessage(sendMessage.launchWorkflowAction(
      action,
      changeName,
      getDashboardActionScopeId(projectSidebar, state.data?.scope?.id),
    ));
  };

  const handleOpenChangesExplorer = () => {
    if (!projectSidebar) return;
    postMessage(sendMessage.openChangesExplorer(projectSidebar.project, projectSidebar.binding));
  };

  const handleOpenSpecsExplorer = () => {
    if (!projectSidebar) return;
    postMessage(sendMessage.openSpecsExplorer(projectSidebar.project, projectSidebar.binding));
  };

  const handleOpenSpec = (spec: SpecInfo) => {
    const scopeId = state.data?.scope?.id;
    postMessage(sendMessage.openSpecInEditor(spec.id, undefined, scopeId));
    if (!specRequirements[spec.id]) {
      postMessage(sendMessage.getSpecRequirements(spec.id, scopeId));
    }
  };

  const handleRequirementClick = (spec: SpecInfo, requirementIndex: number) => {
    const scopeId = state.data?.scope?.id;
    postMessage(sendMessage.openSpecInEditor(spec.id, requirementIndex, scopeId));
  };

  const handleCliDiagnosticAction = (action: string) => {
    if (action === 'open-settings') postMessage(sendMessage.openCliPathSettings());
    if (action === 'retry') postMessage(sendMessage.retryCliDetection());
    if (action === 'copy-diagnostics') postMessage(sendMessage.copyCliDiagnostic());
    if (action === 'open-docs') postMessage(sendMessage.openCliInstallDocs());
  };

  // Root-scoped empty states name the selected root (e.g. "Store: team-plans") so it is
  // clear that local root content does not leak into a store root, and vice versa.
  const selectedRootLabel = data?.scope ? formatOpenSpecRootLabel(data.scope) : undefined;

  return (
    <div className="min-h-screen" style={{ 
      background: 'var(--vscode-editor-background)',
      color: 'var(--vscode-foreground)'
    }}>
      <div className="p-3">
        <Header
          onRefresh={handleRefresh}
          onNewChange={handleRequestNewChange}
          loading={loading}
          scope={data?.scope}
          scopes={data?.scopes}
          loadingReason={loadingReason}
          activity={activity}
          pendingScopeId={pendingScopeId}
          onSelectScope={data?.scope ? handleSelectScope : undefined}
          onRegisterStore={data?.scope?.capabilities?.stores ? handleRegisterStore : undefined}
          onSetupStore={data?.scope?.capabilities?.stores ? handleSetupStore : undefined}
          project={projectSidebar?.project}
          binding={projectSidebar?.binding}
          onOpenChanges={projectSidebar ? handleOpenChangesExplorer : undefined}
          onOpenSpecs={projectSidebar ? handleOpenSpecsExplorer : undefined}
          onOpenWorksets={projectSidebar?.worksetNavigation?.worksets.length && projectFirstView === 'project'
            ? () => setProjectFirstView('workset')
            : undefined}
        />

        {error && (
          <div
            className="mb-4 p-2 rounded text-xs"
            style={{
              background: 'var(--vscode-inputValidation-errorBackground)',
              color: 'var(--vscode-errorForeground)',
            }}
          >
            ⚠️ {error}
          </div>
        )}

        {projectDiagnostic && (
          <CliActivationDiagnosticCard
            diagnostic={projectDiagnostic.diagnostic}
            mode={projectDiagnostic.mode}
            onAction={handleCliDiagnosticAction}
          />
        )}

        {projectSidebar ? (
          <>
            {(projectSidebar.cache?.stale || state.stale || loading) && (
              <div
                role="status"
                className="mb-3 text-xs"
                style={{ color: 'var(--vscode-descriptionForeground)' }}
              >
                {t('dashboard.staleData')}
              </div>
            )}
            {projectFirstView === 'workset' && projectSidebar.worksetNavigation ? (
              <WorksetProjectPicker
                navigation={projectSidebar.worksetNavigation}
                onSelectProject={(worksetName, memberPath) => {
                  postMessage(sendMessage.selectWorksetProject(worksetName, memberPath));
                }}
                onBackToCurrentProject={() => returnToCurrentProject(setProjectFirstView, postMessage)}
              />
            ) : (
              <ChangesSection
                changes={[...projectChanges]}
                changeStatusCounts={buildChangeStatusCounts(projectChanges, [])}
                onOpenChange={handleOpenChange}
                onLaunchWorkflow={handleLaunchWorkflow}
                workflowLaunchConfig={projectSidebar.workflowLaunchConfig ?? workflowLaunchConfig}
                compact
              />
            )}
          </>
        ) : data ? (
          <>
            {/* CLI / cache status row. Root selection now lives in the Header
                action rail above; this bar is operational status only. */}
            <ScopeBar
              scope={data.scope}
              scopes={data.scopes}
              health={
                data.relationships?.health?.root
                  ? {
                      status: data.relationships.health.root.healthy ? ('ok' as const) : ('warning' as const),
                      label: data.relationships.health.root.healthy ? 'Healthy' : 'Issues',
                    }
                  : undefined
              }
              loading={loading}
              loadingReason={loadingReason}
              pendingScopeId={pendingScopeId}
              activity={activity}
              cacheStats={cacheStats}
              cacheActionMessage={cacheActionMessage}
              pendingCacheAction={pendingCacheAction}
              onCacheAction={handleCacheAction}
            />

            {state.stale && activity.kind !== 'cached-refresh' && (
              <div
                role="status"
                className="mb-3 text-xs"
                style={{ color: 'var(--vscode-descriptionForeground)' }}
              >
                {t('dashboard.staleData')}
              </div>
            )}

            {/* OpenSpec 1.5 feature gating notice. Stores and worksets are gated
                independently; the concise upgrade message appears whenever either
                is explicitly unsupported. It never blocks Local Root Changes or
                Specs (rendered below), which stay fully usable. */}
            {(data.scope?.capabilities?.stores === false ||
              data.scope?.capabilities?.worksets === false) && (
              <div
                role="status"
                className="mb-3 text-xs leading-snug"
                style={{ color: 'var(--vscode-descriptionForeground)' }}
              >
                {t('scope.featureGated.upgradeNotice')}
              </div>
            )}

            {dashboardView === 'worksets' ? (
              // Worksets workspace page. ScopeBar stays visible above so the
              // current OpenSpec root remains selectable/recoverable. Opening a
              // workset launches an editor workspace view only; it does NOT call
              // onSelectScope or change the dashboard's selected root. Removing
              // a workset posts a confirmed removeWorkset message (the host
              // shows the modal confirmation and refreshes dashboard data).
              <WorksetsPage
                worksets={data.worksets ?? []}
                onOpenWorkset={(name) => {
                  postMessage(sendMessage.openWorkset(name));
                }}
                onRemoveWorkset={(name) => {
                  postMessage(sendMessage.removeWorkset(name));
                }}
                onBack={() => setDashboardView('overview')}
                currentRootLabel={selectedRootLabel}
                worksetsSupported={data.scope?.capabilities?.worksets}
                storeRootPaths={(data.scopes ?? [])
                  .filter((s) => s.source === 'store')
                  .map((s) => s.rootPath)}
              />
            ) : (
              <>
                {/* Stores & Worksets maintenance panel.
                    For a plain Local Root with no stores, references, or
                    worksets, stay lightweight (render nothing) so the
                    Changes/Specs areas keep the original single-project shape.
                    Register Store stays reachable from the Header action rail. */}
                <StoresAndWorksetsPanel
                  scopes={data.scopes ?? []}
                  currentScopeId={data.scope?.id}
                  references={data.relationships?.references ?? []}
                  worksets={data.worksets ?? []}
                  pending={loadingReason === 'store-register' || loadingReason === 'store-setup'}
                  capabilities={{
                    stores: data.scope?.capabilities?.stores,
                    worksets: data.scope?.capabilities?.worksets,
                  }}
                  lightweight={isLightweightLocalRoot(data)}
                  onSelectStore={handleSelectScope}
                  onRegisterStore={handleRegisterStore}
                  onSetupStore={handleSetupStore}
                  onOpenWorkset={(name) => {
                    postMessage(sendMessage.openWorkset(name));
                  }}
                  onOpenWorksetsPage={
                    data.scope?.capabilities?.worksets === false
                      ? undefined
                      : () => setDashboardView('worksets')
                  }
                  onCopyFetch={(text) => {
                    navigator.clipboard.writeText(text).catch(() => {});
                  }}
                />

                <ChangesSection
                  changes={data.changes}
                  changeStatusCounts={data.changeStatusCounts}
                  onOpenChange={handleOpenChange}
                  onRequestNewChange={handleRequestNewChange}
                  onCopyFf={handleCopyFf}
                  onCopyApply={handleCopyApply}
                  onLaunchWorkflow={handleLaunchWorkflow}
                  archivedItems={pendingScopeId ? [] : (data.archivedChanges ?? [])}
                  onOpenArchivedChange={handleOpenArchivedChange}
                  workflowLaunchConfig={workflowLaunchConfig}
                  rootLabel={selectedRootLabel}
                  viewState={changesViewState}
                  onViewStateChange={persistChangesViewState}
                  allowPageClamp={allowPageClamp}
                />
                <SpecsSection
                  specs={data.specs}
                  specRequirements={specRequirements}
                  onOpenSpec={handleOpenSpec}
                  onRequirementClick={handleRequirementClick}
                  rootLabel={selectedRootLabel}
                />
              </>
            )}
          </>
        ) : projectDiagnostic ? null : loading ? (
          <div className="text-xs py-4" style={{ 
            color: 'var(--vscode-descriptionForeground)' 
          }}>
            {t('dashboard.loading')}
          </div>
        ) : (
          <div className="text-xs py-4" style={{ 
            color: 'var(--vscode-errorForeground)' 
          }}>
            {t('dashboard.loadFailed')}
          </div>
        )}
      </div>
    </div>
  );
};
