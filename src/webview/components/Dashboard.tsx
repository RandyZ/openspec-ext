import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useVscode } from '../hooks/useVscode';
import { useAppState } from '../context/AppContext';
import type { AppAction } from '../context/AppContext';
import { sendMessage } from '../types/messages';
import type {
  DashboardData,
  ChangeInfo,
  OpenSpecRootBinding,
  ProjectContext,
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
import {
  createWorkflowRequestId,
  resolveWorkflowActions,
  type WorkflowActionReceipt,
} from '../../shared/changeWorkflow';
import {
  getWorkflowActionButtonLabel,
  type WorkflowLaunchConfigView,
} from '../utils/workflowLaunchLabels';
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
export type DashboardPostMessage = (message: WebviewMessage) => void;
export type ProjectFirstTab = 'changes' | 'specs' | 'worksets';

export function selectProjectFirstTab(
  setTab: (tab: ProjectFirstTab) => void,
  tab: ProjectFirstTab,
): void {
  setTab(tab);
}

export function sendProjectSidebarSpecDetail(
  postMessage: DashboardPostMessage,
  project: ProjectContext,
  binding: OpenSpecRootBinding,
  specId: string,
  requirementIndex?: number,
): void {
  postMessage(sendMessage.openSpecInEditor(
    specId,
    requirementIndex,
    undefined,
    project,
    binding,
  ));
}

export function getDashboardActionScopeId(
  projectSidebar: ProjectSidebarData | null | undefined,
  selectedScopeId?: string,
): string | undefined {
  return projectSidebar ? undefined : selectedScopeId;
}

export function getDashboardPriorityChanges(
  changes: readonly ChangeInfo[],
  receipts: readonly WorkflowActionReceipt[] = [],
): {
  needsAttention: ChangeInfo[];
  readyToVerify: ChangeInfo[];
  recommended: ChangeInfo[];
} {
  const latestReceipts = new Map<string, WorkflowActionReceipt>();
  for (const receipt of receipts) {
    latestReceipts.set(`${receipt.changeName}\u0000${receipt.bindingKey}`, receipt);
  }
  const readyToVerify: ChangeInfo[] = [];
  const needsAttention: ChangeInfo[] = [];
  const recommended: ChangeInfo[] = [];
  for (const change of changes) {
    const snapshot = change.workflowSnapshot;
    const resolved = snapshot
      ? resolveWorkflowActions(snapshot, {
        completedTasks: change.completedTasks,
        totalTasks: change.totalTasks,
        isArchived: change.lifecycleStatus === 'archived',
      })
      : undefined;
    const receipt = snapshot
      ? latestReceipts.get(`${change.name}\u0000${snapshot.bindingKey}`)
      : undefined;
    const hasReceiptAttention = receipt?.status === 'failed' || receipt?.status === 'fallback';
    const hasResolverAttention = resolved !== undefined && resolved.attentionReasons.length > 0;
    if (change.attention?.required === true || hasReceiptAttention || hasResolverAttention) {
      needsAttention.push(change);
      continue;
    }
    if (resolved?.recommended?.action === 'verify') readyToVerify.push(change);
    else if (resolved?.recommended) recommended.push(change);
  }
  return { needsAttention, readyToVerify, recommended };
}

type DashboardPriorityGroupKey = 'needs-attention' | 'ready-to-verify' | 'recommended';

export function routeDashboardPriorityAction(
  change: ChangeInfo,
  groupKey: DashboardPriorityGroupKey,
  handlers: {
    onOpenChange: (changeName: string) => void;
    onLaunchWorkflow: (action: WorkflowAction, changeName: string, bindingKey?: string) => void;
  },
): void {
  const bindingKey = change.workflowSnapshot?.bindingKey;
  if (groupKey === 'needs-attention') {
    handlers.onOpenChange(change.name);
    return;
  }
  if (groupKey === 'ready-to-verify') {
    handlers.onLaunchWorkflow('verify', change.name, bindingKey);
    return;
  }

  const snapshot = change.workflowSnapshot;
  if (!snapshot) return;
  const recommended = resolveWorkflowActions(snapshot, {
    completedTasks: change.completedTasks,
    totalTasks: change.totalTasks,
    isArchived: change.lifecycleStatus === 'archived',
  }).recommended;
  if (!recommended) return;
  if (recommended.highImpact || recommended.action === 'archive') {
    if (recommended.action === 'verify') {
      handlers.onLaunchWorkflow('verify', change.name, bindingKey);
    } else {
      handlers.onOpenChange(change.name);
    }
    return;
  }
  handlers.onLaunchWorkflow(recommended.action, change.name, bindingKey);
}

export function returnToCurrentProject(
  setProjectFirstView: (view: ProjectFirstTab) => void,
  postMessage: DashboardPostMessage,
): void {
  setProjectFirstView('changes');
  postMessage(sendMessage.selectCurrentProject());
}

/**
 * Active Planning-root Store id for the Worksets surface, derived only from
 * the trusted Host binding (binding.storeId). `undefined` means the Project
 * default root is active; the webview never re-classifies member paths.
 */
export function getWorksetPickerActiveStoreId(
  projectSidebar: ProjectSidebarData | null | undefined,
): string | undefined {
  return projectSidebar?.binding?.storeId;
}

/**
 * Authoritative "explicit Planning Store selector active" fact for the
 * Worksets surface, read only from the Host-returned flag. A selector-free
 * default binding may still carry `binding.storeId` when the CLI's
 * root.store_id is set, so selector-dependent recovery must key on this flag.
 */
export function getWorksetPickerExplicitStoreSelector(
  projectSidebar: ProjectSidebarData | null | undefined,
): boolean {
  return projectSidebar?.explicitStoreSelector === true;
}

/**
 * Whether the Worksets tab is reachable: a trusted navigation must exist AND
 * the Host-resolved Workset capability must not be explicitly unavailable.
 * Zero worksets is NOT a blocker — the empty list with its Create entry is the
 * primary first-creation surface. `undefined` capability (legacy cached
 * payloads) keeps the tab available.
 */
export function getWorksetsTabAvailable(
  projectSidebar: ProjectSidebarData | null | undefined,
): boolean {
  return projectSidebar?.worksetNavigation !== undefined
    && projectSidebar?.worksetCapabilityAvailable !== false;
}

/**
 * Whether the create flow may be offered inside the Worksets surface. Derived
 * only from the Host capability flag; `undefined` capability (legacy payloads)
 * is treated as available, `false` hides/disables Create with the upgrade
 * explanation. Without a sidebar at all, nothing is available.
 */
export function getWorksetCreateAvailable(
  projectSidebar: ProjectSidebarData | null | undefined,
): boolean {
  return projectSidebar != null && projectSidebar.worksetCapabilityAvailable !== false;
}

/**
 * Untrusted `worksetMembersPicked` payload → picker-response state. Paths
 * default to an empty add; only a string-array `droppedPaths` is forwarded.
 */
export function toWorksetPickedMembersState(
  message: { paths?: unknown; droppedPaths?: unknown },
): { paths: unknown[]; droppedPaths?: string[] } {
  const droppedPaths = Array.isArray(message.droppedPaths)
    && message.droppedPaths.every((value) => typeof value === 'string')
    ? message.droppedPaths as string[]
    : undefined;
  return {
    paths: Array.isArray(message.paths) ? message.paths : [],
    ...(droppedPaths && droppedPaths.length ? { droppedPaths } : {}),
  };
}

/**
 * Untrusted `worksetCreateResult` payload → picker-response state. `success`
 * is strictly boolean, the echoed name defaults to empty, and only string
 * messages survive.
 */
export function toWorksetCreateResultState(
  message: { success?: unknown; name?: unknown; message?: unknown },
): { success: boolean; name: string; message?: string } {
  return {
    success: message.success === true,
    name: typeof message.name === 'string' ? message.name : '',
    ...(typeof message.message === 'string' ? { message: message.message } : {}),
  };
}

/**
 * Single-purpose Workset picker actions: each callback posts exactly one
 * explicit message. Project switching never invokes `workset open`, Store
 * members are never routed as Project selections, and the one-time opener is
 * forwarded as an explicit optional tool. Creation requests carry the draft
 * verbatim (ordered unique members, optional trimmed tool) — validation and
 * canonicalization are Host responsibilities.
 */
export function createWorksetPickerHandlers(postMessage: DashboardPostMessage) {
  return {
    onSelectProject: (worksetName: string, memberPath: string) => {
      postMessage(sendMessage.selectWorksetProject(worksetName, memberPath));
    },
    onSelectWorksetStore: (worksetName: string, memberPath: string) => {
      postMessage(sendMessage.selectWorksetStore(worksetName, memberPath));
    },
    onSelectProjectDefaultRoot: () => {
      postMessage(sendMessage.selectProjectDefaultRoot());
    },
    onOpenWorkset: (name: string, tool?: string) => {
      postMessage(sendMessage.openWorkset(name, tool));
    },
    onPickMembers: () => {
      postMessage(sendMessage.pickWorksetMembers());
    },
    onCreateWorkset: (name: string, members: string[], tool?: string) => {
      postMessage(sendMessage.createWorkset(name, members, tool));
    },
  };
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
  const [projectFirstTab, setProjectFirstTab] = useState<ProjectFirstTab>('changes');
  const [specRequirements, setSpecRequirements] = useState<Record<string, string[]>>({});
  const [cacheStats, setCacheStats] = useState<CacheStatsView | null>(null);
  const [cacheActionMessage, setCacheActionMessage] = useState<string | null>(null);
  const [pendingCacheAction, setPendingCacheAction] = useState<CacheAction | null>(null);
  const [workflowReceipts, setWorkflowReceipts] = useState<WorkflowActionReceipt[]>([]);
  const pendingWorkflowRequestsRef = useRef(new Map<string, { changeName: string; bindingKey: string }>());
  const latestWorkflowRequestRef = useRef(new Map<string, string>());
  // Tracks the scope the current requirements cache was loaded under; reset on change.
  const lastScopeIdRef = useRef<string | undefined>(undefined);
  // Ref mirror of the current scope id, so the onMessage callback (created once per
  // effect run) can read the latest scope without closing over stale state.
  const scopeIdRef = useRef<string | undefined>(undefined);
  const [workflowLaunchConfig, setWorkflowLaunchConfig] = useState<WorkflowLaunchConfigView | null>(null);
  // Sequence-stamped Host responses for the Workset create flow. The sequence
  // lets the picker apply each Host message at most once, and ignore responses
  // that arrive after the form was left. The payloads stay untrusted: the
  // picker re-checks member eligibility before merging.
  const worksetResponseSeqRef = useRef(0);
  const [worksetPickedMembers, setWorksetPickedMembers] = useState<{
    seq: number;
    paths: unknown[];
    droppedPaths?: string[];
  } | null>(null);
  const [worksetCreateResult, setWorksetCreateResult] = useState<{
    seq: number;
    success: boolean;
    name: string;
    message?: string;
  } | null>(null);

  const { data, loading, loadingReason, pendingScopeId, activity, error } = state;
  const projectSidebar = state.projectSidebar;
  const projectFirst = state.projectFirst === true || state.projectSidebar !== undefined;
  const projectDiagnostic = state.cliDiagnostic
    ?? (projectSidebar?.cliDiagnostic
      ? { diagnostic: projectSidebar.cliDiagnostic, mode: 'warning' as const }
      : null);

  useEffect(() => {
    setProjectFirstTab('changes');
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
      } else if (message.type === 'workflowActionReceipt') {
        const pending = pendingWorkflowRequestsRef.current.get(message.requestId);
        const key = `${message.changeName}\u0000${message.bindingKey}`;
        if (
          pending
          && pending.changeName === message.changeName
          && pending.bindingKey === message.bindingKey
          && latestWorkflowRequestRef.current.get(key) === message.requestId
        ) {
          setWorkflowReceipts((previous) => [
            ...previous.filter((receipt) => (
              receipt.changeName !== message.changeName
              || receipt.bindingKey !== message.bindingKey
            )),
            message as WorkflowActionReceipt,
          ]);
          if (message.status !== 'running') {
            pendingWorkflowRequestsRef.current.delete(message.requestId);
          }
        }
      } else if (message.type === 'cacheStats') {
        setCacheStats(message.stats ?? null);
      } else if (message.type === 'cacheActionResult') {
        setPendingCacheAction(null);
        setCacheActionMessage(message.message ?? (message.success ? t('cache.menuLabel') : t('cache.unavailable')));
        if (message.success) {
          postMessage(sendMessage.getCacheStats(true));
        }
      } else if (message.type === 'worksetMembersPicked') {
        // Folder-picker result from the Host. Cancelled pickers never produce
        // this message, and the picker ignores it unless the create form is
        // active — a late response after leaving the form is harmless.
        // Host-dropped (unrealpath-able) picks ride along as droppedPaths.
        worksetResponseSeqRef.current += 1;
        setWorksetPickedMembers({
          seq: worksetResponseSeqRef.current,
          ...toWorksetPickedMembersState(message),
        });
      } else if (message.type === 'worksetCreateResult') {
        worksetResponseSeqRef.current += 1;
        setWorksetCreateResult({
          seq: worksetResponseSeqRef.current,
          ...toWorksetCreateResultState(message),
        });
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
    postMessage(
      projectSidebar
        ? sendMessage.openChangeDetailInEditor(
          `archive:${directoryName}`,
          undefined,
          undefined,
          undefined,
          projectSidebar.project,
          projectSidebar.binding,
        )
        : sendMessage.openChangeDetailInEditor(`archive:${directoryName}`, undefined, undefined, state.data?.scope?.id)
    );
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

  const handleLaunchWorkflow = (action: WorkflowAction, changeName: string, bindingKey?: string) => {
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
    const requestId = createWorkflowRequestId('dashboard');
    if (bindingKey) {
      const key = `${changeName}\u0000${bindingKey}`;
      pendingWorkflowRequestsRef.current.set(requestId, { changeName, bindingKey });
      latestWorkflowRequestRef.current.set(key, requestId);
    }
    postMessage(sendMessage.launchWorkflowAction(
      action,
      changeName,
      getDashboardActionScopeId(projectSidebar, state.data?.scope?.id),
      requestId,
      bindingKey,
    ));
  };

  const handleOpenPriorityChange = (change: ChangeInfo, groupKey: string) => {
    routeDashboardPriorityAction(change, groupKey as DashboardPriorityGroupKey, {
      onOpenChange: handleOpenChange,
      onLaunchWorkflow: handleLaunchWorkflow,
    });
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

  const handleOpenProjectSpec = (
    spec: SpecInfo,
    binding: OpenSpecRootBinding,
    requirementIndex?: number,
  ) => {
    if (!projectSidebar) return;
    sendProjectSidebarSpecDetail(
      postMessage,
      projectSidebar.project,
      binding,
      spec.id,
      requirementIndex,
    );
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
  const prioritySourceChanges = projectSidebar ? projectChanges : data?.changes ?? [];
  const priorities = getDashboardPriorityChanges(prioritySourceChanges, workflowReceipts);
  const priorityGroups = [
    { key: 'needs-attention', label: t('dashboard.priorityReasonNeedsAttention'), changes: priorities.needsAttention },
    { key: 'ready-to-verify', label: t('dashboard.priorityReasonReadyToVerify'), changes: priorities.readyToVerify },
    { key: 'recommended', label: t('dashboard.priorityReasonRecommended'), changes: priorities.recommended },
  ] as const;
  const seenPriorityKeys = new Set<string>();
  const priorityRows = priorityGroups
    .flatMap((group) => group.changes.map((change) => ({ group, change })))
    .filter(({ change }) => {
      const key = `${change.name}\u0000${change.workflowSnapshot?.bindingKey ?? ''}`;
      if (seenPriorityKeys.has(key)) return false;
      seenPriorityKeys.add(key);
      return true;
    })
    .slice(0, 3);
  const priorityWorkflowConfig = projectSidebar?.workflowLaunchConfig ?? workflowLaunchConfig;

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
          onOpenChanges={projectSidebar
            ? () => selectProjectFirstTab(setProjectFirstTab, 'changes')
            : undefined}
          onOpenSpecs={projectSidebar
            ? () => selectProjectFirstTab(setProjectFirstTab, 'specs')
            : undefined}
          onOpenDashboard={projectSidebar
            ? () => postMessage(sendMessage.openProjectDashboard())
            : undefined}
          activeProjectTab={projectSidebar ? projectFirstTab : undefined}
          worksetCount={projectSidebar?.worksetNavigation?.worksets.length ?? 0}
          worksetsCapabilityAvailable={projectSidebar
            ? projectSidebar.worksetCapabilityAvailable !== false
            : undefined}
          onOpenWorksets={projectSidebar && getWorksetsTabAvailable(projectSidebar)
            ? () => selectProjectFirstTab(setProjectFirstTab, 'worksets')
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

        {priorityRows.length > 0 && (
          <div className="mb-4 flex flex-col gap-1" aria-label={t('dashboard.workflowPriorities')} data-action-rail>
            {priorityRows.map(({ group, change }) => {
              const recommended = change.workflowSnapshot
                ? resolveWorkflowActions(change.workflowSnapshot, {
                  completedTasks: change.completedTasks,
                  totalTasks: change.totalTasks,
                  isArchived: change.lifecycleStatus === 'archived',
                }).recommended
                : null;
              const ctaLabel = group.key === 'needs-attention'
                ? t('verifyArchive.reviewArchive')
                : group.key === 'ready-to-verify'
                  ? t('detail.verifyArchive')
                  : recommended
                    ? getWorkflowActionButtonLabel(recommended.label, priorityWorkflowConfig)
                    : null;
              if (!ctaLabel) return null;
              const ctaAccessibleName = t('dashboard.priorityActionAriaLabel', {
                action: ctaLabel,
                name: change.name,
              });
              const statusIcon = group.key === 'needs-attention'
                ? 'codicon-warning'
                : group.key === 'ready-to-verify'
                  ? 'codicon-check'
                  : 'codicon-lightbulb';
              return (
                <div
                  key={`${group.key}:${change.name}:${change.workflowSnapshot?.bindingKey ?? ''}`}
                  data-priority-row={change.name}
                  data-priority-status={group.key}
                  className="flex min-w-0 items-center gap-2 rounded border px-2 py-1.5 transition-colors hover:bg-[var(--vscode-list-hoverBackground)]"
                  style={{
                    background: 'var(--vscode-sideBar-background)',
                    borderColor: 'var(--vscode-panel-border)',
                  }}
                >
                  <span className={`codicon ${statusIcon} shrink-0`} aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--vscode-descriptionForeground)' }}>
                      {group.label}
                    </div>
                    <div
                      data-change-name={change.name}
                      className="truncate text-xs"
                      title={change.name}
                    >
                      {change.name}
                    </div>
                  </div>
                  <button
                    type="button"
                    data-priority-cta={change.name}
                    className="shrink-0 rounded px-2 py-1 text-xs focus-visible:outline focus-visible:outline-1 focus-visible:outline-[var(--vscode-focusBorder)]"
                    style={{
                      background: 'var(--vscode-button-secondaryBackground)',
                      color: 'var(--vscode-button-secondaryForeground)',
                    }}
                    title={ctaAccessibleName}
                    aria-label={ctaAccessibleName}
                    onClick={() => handleOpenPriorityChange(change, group.key)}
                  >
                    {ctaLabel}
                  </button>
                </div>
              );
            })}
          </div>
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
            {projectFirstTab === 'worksets' && projectSidebar.worksetNavigation ? (
              <WorksetProjectPicker
                navigation={projectSidebar.worksetNavigation}
                activeStoreId={getWorksetPickerActiveStoreId(projectSidebar)}
                explicitStoreSelector={getWorksetPickerExplicitStoreSelector(projectSidebar)}
                createAvailable={getWorksetCreateAvailable(projectSidebar)}
                {...createWorksetPickerHandlers(postMessage)}
                pickedMembers={worksetPickedMembers}
                createResult={worksetCreateResult}
                onBackToCurrentProject={() => returnToCurrentProject(setProjectFirstTab, postMessage)}
              />
            ) : (
              <>
                {projectFirstTab === 'changes' ? (
                  <div id="project-first-changes-panel" role="tabpanel" aria-label={t('projectSidebar.allChanges')}>
                    <ChangesSection
                      changes={[...projectChanges]}
                      changeStatusCounts={buildChangeStatusCounts(projectChanges, projectSidebar.archivedChanges ?? [])}
                      onOpenChange={handleOpenChange}
                      onOpenArchivedChange={handleOpenArchivedChange}
                      archivedItems={[...(projectSidebar.archivedChanges ?? [])]}
                      onLaunchWorkflow={handleLaunchWorkflow}
                      workflowLaunchConfig={projectSidebar.workflowLaunchConfig ?? workflowLaunchConfig}
                      layout="narrow"
                    />
                  </div>
                ) : (
                  <div id="project-first-specs-panel" role="tabpanel" aria-label={t('projectSidebar.specs')}>
                    <SpecsSection
                      specs={[...(projectSidebar.projectSpecs ?? [])]}
                      heading={t('projectSidebar.projectSpecs')}
                      emptyMessage={t('projectSidebar.emptyProjectSpecs')}
                      sourceLabel={projectSidebar.project.label}
                      readOnly
                      onOpenSpec={(spec) => handleOpenProjectSpec(spec, projectSidebar.binding)}
                    />
                    {(projectSidebar.referencedStoreSpecs ?? []).map((group) => (
                      <SpecsSection
                        key={group.storeId}
                        specs={[...group.specs]}
                        heading={t('projectSidebar.referencedStoreSpecs', { storeId: group.storeId })}
                        emptyMessage={t('projectSidebar.emptyStoreSpecs', { storeId: group.storeId })}
                        loadError={group.error}
                        sourceLabel={group.storeId}
                        readOnly
                        onOpenSpec={group.binding
                          ? (spec) => handleOpenProjectSpec(spec, group.binding!)
                          : undefined}
                      />
                    ))}
                  </div>
                )}
              </>
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
                      label: t(
                        data.relationships.health.root.healthy
                          ? 'scope.health.ok'
                          : 'scope.health.warning',
                      ),
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
