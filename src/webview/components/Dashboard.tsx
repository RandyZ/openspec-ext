import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useVscode } from '../hooks/useVscode';
import { useAppState } from '../context/AppContext';
import type { AppAction } from '../context/AppContext';
import { sendMessage } from '../types/messages';
import type { ArchivedChangeInfo, SpecInfo, WebviewMessage } from '../types/messages';
import { Header } from './Header';
import { ChangesSection } from './ChangesSection';
import { SpecsSection } from './SpecsSection';
import { CliActivationDiagnosticCard } from './CliActivationDiagnosticCard';
import { ScopeBar } from './ScopeBar';
import { StoresAndWorksetsPanel } from './StoresAndWorksetsPanel';
import { formatOpenSpecRootLabel } from '../utils/scopeLabels';
import { t } from '../../i18n';
import {
  buildWorkflowCommand,
  type WorkflowAction,
} from '../../shared/workflowCommand';
import type { WorkflowLaunchConfigView } from '../utils/workflowLaunchLabels';
import type { CacheAction, CacheStatsView } from '../types/messages';

type DashboardDispatch = React.Dispatch<AppAction>;
type DashboardPostMessage = (message: WebviewMessage) => void;

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

export const Dashboard: React.FC = () => {
  const { postMessage, onMessage } = useVscode();
  const { state, dispatch } = useAppState();
  const [archivedExpanded, setArchivedExpanded] = useState(false);
  const [archivedItems, setArchivedItems] = useState<ArchivedChangeInfo[]>([]);
  const [archivedLoading, setArchivedLoading] = useState(false);
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

  useEffect(() => {
    // Listen for messages from extension
    const cleanup = onMessage((event: MessageEvent) => {
      const message = event.data;

      if (message.type === 'dashboardData') {
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
          setArchivedItems([]);
          setArchivedLoading(false);
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
      } else if (message.type === 'archivedChanges') {
        const currentScopeId = scopeIdRef.current;
        if (
          message.scopeId !== undefined &&
          currentScopeId !== undefined &&
          message.scopeId !== currentScopeId
        ) {
          // Stale response from a previous root; ignore so cross-root archives
          // don't leak into the currently selected scope.
        } else {
          setArchivedItems(message.items ?? []);
          setArchivedLoading(false);
        }
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
    requestInitialDashboardData(dispatch, postMessage);

    return cleanup;
  }, [postMessage, onMessage, dispatch]);

  const handleArchivedToggle = () => {
    const next = !archivedExpanded;
    setArchivedExpanded(next);
    if (next) {
      setArchivedLoading(true);
      postMessage(sendMessage.getArchivedChanges(state.data?.scope?.id));
    }
  };

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
    postMessage(sendMessage.openChangeDetailInEditor(changeName, undefined, undefined, state.data?.scope?.id));
  };

  const handleRequestNewChange = () => {
    postMessage(sendMessage.requestNewChange());
  };

  const handleCopyFf = (changeName: string) => {
    postMessage(sendMessage.copyToClipboard(buildWorkflowCommand({ action: 'ff', changeName, target: 'clipboard' })));
  };

  const handleCopyApply = (changeName: string) => {
    postMessage(sendMessage.copyToClipboard(buildWorkflowCommand({ action: 'apply', changeName, target: 'clipboard' })));
  };

  const handleLaunchWorkflow = (action: WorkflowAction, changeName: string) => {
    if (action === 'verify' || action === 'archive') {
      postMessage(sendMessage.openChangeDetailInEditor(changeName, 'verifyArchive', action, state.data?.scope?.id));
      return;
    }
    postMessage(sendMessage.launchWorkflowAction(action, changeName, state.data?.scope?.id));
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

  const { data, loading, loadingReason, pendingScopeId, activity, error } = state;

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

        {state.cliDiagnostic && (
          <CliActivationDiagnosticCard
            diagnostic={state.cliDiagnostic.diagnostic}
            mode={state.cliDiagnostic.mode}
            onAction={handleCliDiagnosticAction}
          />
        )}

        {data ? (
          <>
            {/* Scope Bar */}
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
              onSelectScope={handleSelectScope}
              onRegisterStore={handleRegisterStore}
              onSetupStore={handleSetupStore}
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

            {/* Stores & Worksets maintenance panel */}
            <StoresAndWorksetsPanel
              scopes={data.scopes ?? []}
              currentScopeId={data.scope?.id}
              references={data.relationships?.references ?? []}
              worksets={data.worksets ?? []}
              pending={loadingReason === 'store-register' || loadingReason === 'store-setup'}
              onSelectStore={handleSelectScope}
              onRegisterStore={handleRegisterStore}
              onSetupStore={handleSetupStore}
              onOpenWorkset={(name) => {
                postMessage(sendMessage.openWorkset(name));
              }}
              onCopyFetch={(text) => {
                navigator.clipboard.writeText(text).catch(() => {});
              }}
            />

            <ChangesSection
              changes={data.changes}
              onOpenChange={handleOpenChange}
              onRequestNewChange={handleRequestNewChange}
              onCopyFf={handleCopyFf}
              onCopyApply={handleCopyApply}
              onLaunchWorkflow={handleLaunchWorkflow}
              archivedExpanded={archivedExpanded}
              onArchivedToggle={handleArchivedToggle}
              archivedItems={archivedItems}
              archivedLoading={archivedLoading}
              onOpenArchivedChange={handleOpenArchivedChange}
              workflowLaunchConfig={workflowLaunchConfig}
              rootLabel={selectedRootLabel}
            />
            <SpecsSection
              specs={data.specs}
              specRequirements={specRequirements}
              onOpenSpec={handleOpenSpec}
              onRequirementClick={handleRequirementClick}
              rootLabel={selectedRootLabel}
            />
          </>
        ) : loading ? (
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
