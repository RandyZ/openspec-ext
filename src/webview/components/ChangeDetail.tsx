import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useVscode } from '../hooks/useVscode';
import { sendMessage, type ArtifactOutputDescriptor } from '../types/messages';
import { ActionBar } from './ActionBar';
import { ArtifactViewer } from './ArtifactViewer';
import { TaskList } from './TaskList';
import { countTaskProgress } from '../utils/parseTasks';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { VerifyArchivePanel } from './VerifyArchivePanel';
import { IconButton } from './ui/IconButton';
import { t } from '../../i18n';
import {
  buildWorkflowCommand,
  resolveWorkflowCommandTargetForUi,
  type WorkflowAction,
} from '../../shared/workflowCommand';
import { useWorkflowLaunchPending } from '../hooks/useWorkflowLaunchPending';
import {
  createWorkflowRequestId,
  resolveWorkflowActions,
  type ChangeWorkflowSnapshot,
} from '../../shared/changeWorkflow';
import { getWorkflowLaunchModeHint } from '../utils/workflowLaunchLabels';
import type { ExecutorLaunchPresentation } from '../../shared/executorLaunchPresentation';
import {
  getExecutorUiModeLabel,
  normalizeExecutorPresentation,
  normalizePresentationAdapters,
  resolveExecutorSelectValue,
  resolveExecutorUiLaunchConfig,
  shouldPersistNormalizedExecutor,
} from '../utils/executorUiLaunchConfig';
import type {
  ChangeDetailTabId,
  InteractiveWorkflowAction,
  InteractiveWorkflowState,
} from '../../shared/interactiveWorkflow';
import { ArtifactFetchCoordinator } from '../utils/artifactFetchCoordinator';
import {
  artifactContentCacheKey,
  artifactFetchCoordinatorKey,
} from '../utils/artifactFetchKeys';
import {
  completeArtifactFetchAndStoreContent,
  handleTasksArtifactInvalidated,
  tasksFetchCoordinatorKey,
} from '../utils/changeDetailArtifactInvalidation';
import { isArchiveNowAllowed } from '../utils/changeDetailArchiveGating';

const MISSING_ARTIFACT_MESSAGE = t('artifact.missing');

export interface ChangeDetailProps {
  changeName: string;
  existingArtifactIds?: string[];
  debug?: boolean;
  initialTab?: ChangeDetailTabId;
  interactiveAction?: InteractiveWorkflowAction;
  workflowSnapshot?: ChangeWorkflowSnapshot;
  projectLabel?: string;
  planningRoot?: string;
  scopeSource?: string;
  /** Scope id this panel was opened under; binds reads/writes to a store root. */
  scopeId?: string;
  /** Host-provided executor presentation (from setContext); avoids missing pre-mount postMessage. */
  initialExecutorPresentation?: ExecutorLaunchPresentation | null;
}

const cacheKey = artifactContentCacheKey;

function getCreateDisabledReason(
  artifactType: string,
  existingArtifactIds: string[] | undefined
): string | undefined {
  const has = (id: string) => existingArtifactIds?.includes(id) ?? false;
  switch (artifactType) {
    case 'proposal':
      return undefined;
    case 'specs':
    case 'design':
      return has('proposal') ? undefined : t('artifact.needProposal');
    case 'tasks': {
      const missing: string[] = [];
      if (!has('specs')) missing.push('Specs');
      if (!has('design')) missing.push('Design');
      return missing.length === 0 ? undefined : t('artifact.needBefore', { items: missing.join(t('artifact.and')) });
    }
    default:
      return undefined;
  }
}

function getStatusSummary(
  existingArtifactIds: string[] | undefined,
  completedTasks: number,
  totalTasks: number,
  isArchived: boolean
): string {
  if (isArchived) return t('verifyArchive.statusArchived');
  const artifactCount = existingArtifactIds?.length ?? 0;
  if (totalTasks > 0) {
    return t('verifyArchive.statusTasks', {
      artifacts: artifactCount,
      completed: completedTasks,
      total: totalTasks,
    });
  }
  return t('verifyArchive.statusArtifacts', { count: artifactCount });
}

function artifactLabel(id: string): string {
  return id
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function reconcileSelectedOutputPath(
  selectedPath: string | undefined,
  outputs: readonly ArtifactOutputDescriptor[],
): string | undefined {
  return selectedPath && outputs.some((output) => output.path === selectedPath)
    ? selectedPath
    : outputs[0]?.path;
}

export const ChangeDetail: React.FC<ChangeDetailProps> = ({
  changeName,
  existingArtifactIds,
  debug = false,
  initialTab,
  interactiveAction,
  workflowSnapshot,
  projectLabel,
  planningRoot,
  scopeSource,
  scopeId,
  initialExecutorPresentation = null,
}) => {
  const { postMessage, onMessage } = useVscode();
  const [activeTab, setActiveTab] = useState<string>(initialTab ?? 'proposal');
  const contentCacheRef = useRef<Map<string, string>>(new Map());
  const artifactFetchCoordinatorRef = useRef(new ArtifactFetchCoordinator());
  const verifyArchiveTasksLoadedRef = useRef<string | null>(null);
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;
  const workflowLaunchPending = useWorkflowLaunchPending();
  type LaunchSurface = 'actionBar' | 'verifyArchive';
  const [pendingLaunchSurface, setPendingLaunchSurface] = useState<LaunchSurface | null>(null);
  const persistedExecutorRef = useRef<string | null>(null);
  const [completedTasks, setCompletedTasks] = useState(0);
  const [totalTasks, setTotalTasks] = useState(0);
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | undefined>(undefined);
  const [deltaSpecIds, setDeltaSpecIds] = useState<string[]>([]);
  const [selectedSpecId, setSelectedSpecId] = useState<string | null>(null);
  const selectedSpecIdRef = useRef<string | null>(null);
  selectedSpecIdRef.current = selectedSpecId;
  const [artifactOutputs, setArtifactOutputs] = useState<Record<string, ArtifactOutputDescriptor[]>>({});
  const [selectedOutputPaths, setSelectedOutputPaths] = useState<Record<string, string | undefined>>({});
  const selectedOutputPathsRef = useRef(selectedOutputPaths);
  selectedOutputPathsRef.current = selectedOutputPaths;
  const [executorPresentation, setExecutorPresentation] = useState<ExecutorLaunchPresentation | null>(
    initialExecutorPresentation ? normalizeExecutorPresentation(initialExecutorPresentation) : null,
  );
  const [executingTaskIndex, setExecutingTaskIndex] = useState<number | null>(null);
  const [verifyCommandId, setVerifyCommandId] = useState('');
  const [verifyArgsJson, setVerifyArgsJson] = useState('');
  const [runCommandResult, setRunCommandResult] = useState<{ success: boolean; message?: string } | null>(null);
  const [taskExecutionState, setTaskExecutionState] = useState<Record<number, { success: boolean; timestamp: number }>>({});
  const [pendingTaskToggle, setPendingTaskToggle] = useState<{ taskIndex: number; taskText: string; done: boolean } | null>(null);
  const [interactiveState, setInteractiveState] = useState<InteractiveWorkflowState>({
    changeName,
    sessions: {},
  });
  const [pendingInteractiveAction, setPendingInteractiveAction] = useState<InteractiveWorkflowAction | null>(interactiveAction ?? null);
  const [copiedName, setCopiedName] = useState(false);
  const [artifactStateMessage, setArtifactStateMessage] = useState<string | null>(null);
  const [pendingLaunchAction, setPendingLaunchAction] = useState<WorkflowAction | null>(null);
  const [verifyArchiveTasksLoading, setVerifyArchiveTasksLoading] = useState(false);
  const verifyArchiveTasksLoadingRef = useRef(verifyArchiveTasksLoading);
  verifyArchiveTasksLoadingRef.current = verifyArchiveTasksLoading;
  const dispatchExtensionMessageRef = useRef<(msg: unknown) => void>(() => undefined);
  const [archivedLocally, setArchivedLocally] = useState(false);
  const [workflowReceipt, setWorkflowReceipt] = useState<{
    requestId: string;
    bindingKey: string;
    status: string;
    message?: string;
  } | null>(null);

  const handleCopyChangeName = () => {
    postMessage(sendMessage.copyToClipboard(changeName));
    setCopiedName(true);
    window.setTimeout(() => setCopiedName(false), 1200);
  };

  const isArchived = archivedLocally || changeName.startsWith('archive:');

  useEffect(() => {
    if (initialExecutorPresentation) {
      setExecutorPresentation(normalizeExecutorPresentation(initialExecutorPresentation));
    }
  }, [initialExecutorPresentation]);

  const agentAdapters = useMemo(
    () => normalizePresentationAdapters(executorPresentation),
    [executorPresentation],
  );
  const executorUiLaunchConfig = useMemo(
    () => resolveExecutorUiLaunchConfig(executorPresentation),
    [executorPresentation],
  );
  const executorLaunchConfigKey = useMemo(
    () => [
      executorUiLaunchConfig.effectiveAdapterId ?? '',
      executorUiLaunchConfig.cursorLaunchMode ?? '',
      executorUiLaunchConfig.workflowLaunchMode ?? '',
      executorUiLaunchConfig.preferredAgentAdapter ?? '',
    ].join('\u0000'),
    [executorUiLaunchConfig],
  );

  useEffect(() => {
    setWorkflowReceipt(null);
  }, [executorLaunchConfigKey]);
  const tasksLaunchModeHint = getWorkflowLaunchModeHint(executorUiLaunchConfig);
  const executorUiModeLabel = getExecutorUiModeLabel(executorUiLaunchConfig);
  const executorSelectValue = resolveExecutorSelectValue(agentAdapters);
  const resolvedWorkflowActions = useMemo(
    () => workflowSnapshot
      ? resolveWorkflowActions(workflowSnapshot, {
        completedTasks,
        totalTasks,
        isArchived,
        hasDeltaSpecs: deltaSpecIds.length > 0,
      })
      : undefined,
    [workflowSnapshot, completedTasks, totalTasks, isArchived, deltaSpecIds.length]
  );
  const resolverAllowsArchiveNow = Boolean(
    resolvedWorkflowActions?.highImpact.some(
      (action) => action.action === 'archive' && action.highImpact === true
    )
  );
  const canArchiveNow = isArchiveNowAllowed(resolverAllowsArchiveNow, verifyArchiveTasksLoading);
  const archiveNowDisabledReason = isArchived
    ? t('verifyArchive.archiveDisabledArchived')
    : verifyArchiveTasksLoading
      ? t('detail.loadingTaskProgress')
      : t('verifyArchive.archiveDisabledIncomplete');
  const showVerifyArchiveTab = debug || !isArchived || archivedLocally;
  const navigationArtifacts = useMemo(() => {
    if (workflowSnapshot) return workflowSnapshot.artifacts;
    return (existingArtifactIds ?? []).map((id) => ({
      id,
      status: 'done' as const,
      requires: [],
      missingDeps: [],
      outputPath: '',
      existingOutputPaths: [],
    }));
  }, [workflowSnapshot, existingArtifactIds]);
  const tabs = useMemo(
    () => [
      ...navigationArtifacts.map((artifact) => ({
        id: artifact.id,
        label: artifactLabel(artifact.id),
      })),
      ...(showVerifyArchiveTab ? [{ id: 'verifyArchive', label: 'Verify & Archive' }] : []),
    ],
    [navigationArtifacts, showVerifyArchiveTab]
  );
  const artifactGroups = useMemo(() => ([
    { label: t('detail.nav.completed'), statuses: ['done'] as const },
    { label: t('detail.nav.available'), statuses: ['ready'] as const },
    { label: t('detail.nav.blocked'), statuses: ['blocked'] as const },
    { label: t('detail.nav.skipped'), statuses: ['skipped'] as const },
  ].map((group) => ({
    ...group,
    artifacts: navigationArtifacts.filter((artifact) => group.statuses.includes(artifact.status as never)),
  })).filter((group) => group.artifacts.length > 0)), [navigationArtifacts]);

  useEffect(() => {
    if (initialTab && tabs.some((tab) => tab.id === initialTab)) {
      setActiveTab(initialTab);
    } else if (!tabs.some((tab) => tab.id === activeTab)) {
      setActiveTab(tabs[0]?.id ?? '');
    }
  }, [initialTab, tabs, activeTab]);

  useEffect(() => {
    if (interactiveAction) {
      setActiveTab('verifyArchive');
      setPendingInteractiveAction(interactiveAction);
    }
  }, [interactiveAction]);

  const resolveFetchKey = (artifactType: string) =>
    artifactFetchCoordinatorKey(
      scopeId,
      artifactType,
      artifactType === 'specs' ? selectedSpecIdRef.current : undefined,
    );

  const requestArtifact = (artifactType: string, outputPath?: string) => {
    const fetchKey = resolveFetchKey(artifactType);
    const resolvedOutputPath = outputPath ?? selectedOutputPathsRef.current[artifactType];
    artifactFetchCoordinatorRef.current.schedule(fetchKey, () => {
      setLoading(true);
      setError(null);
      setErrorCode(undefined);
      setArtifactStateMessage(null);
      setContent(null);
      postMessage(sendMessage.getArtifactContent(
        changeName,
        artifactType,
        scopeId,
        outputPath ?? resolvedOutputPath,
      ));
    });
  };

  const requestSpecsList = () => {
    setLoading(true);
    setError(null);
    setContent(null);
    setArtifactStateMessage(null);
    setDeltaSpecIds([]);
    setSelectedSpecId(null);
    postMessage(sendMessage.listDeltaSpecs(changeName, scopeId));
  };

  useEffect(() => {
    if (activeTab === 'verifyArchive') {
      setLoading(false);
      setError(null);
      setContent(null);
      return;
    }

    const artifactId = activeTab;
    const selectedArtifact = navigationArtifacts.find((artifact) => artifact.id === artifactId);
    if (workflowSnapshot && selectedArtifact
      && (selectedArtifact.status === 'blocked'
        || selectedArtifact.status === 'skipped'
        || selectedArtifact.existingOutputPaths.length === 0)) {
      setLoading(false);
      setError(null);
      setErrorCode(undefined);
      setContent(null);
      setArtifactStateMessage(
        selectedArtifact.status === 'blocked'
          ? t('artifact.stateBlocked', {
            details: selectedArtifact.missingDeps.length ? `: ${selectedArtifact.missingDeps.join(', ')}` : '',
          })
          : selectedArtifact.status === 'skipped'
            ? t('artifact.stateSkipped')
            : t('artifact.stateNoOutput')
      );
      return;
    }
    const knownMissing =
      !isArchived &&
      Array.isArray(existingArtifactIds) &&
      !existingArtifactIds.includes(artifactId);

    if (knownMissing) {
      setLoading(false);
      setError(MISSING_ARTIFACT_MESSAGE);
      setErrorCode('ARTIFACT_MISSING');
      setContent(null);
      setArtifactStateMessage(null);
      if (activeTab === 'specs') {
        setDeltaSpecIds([]);
        setSelectedSpecId(null);
      }
      return;
    }

    if (activeTab === 'specs') {
      requestSpecsList();
      return;
    }

    const key = cacheKey(scopeId, activeTab, selectedOutputPaths[activeTab]);
    const cached = contentCacheRef.current.get(key);
    if (cached !== undefined) {
      setContent(cached);
      setLoading(false);
      setError(null);
      setErrorCode(undefined);
      return;
    }
    requestArtifact(activeTab);
  }, [
    changeName,
    activeTab,
    existingArtifactIds,
    isArchived,
    navigationArtifacts,
    postMessage,
    scopeId,
    selectedOutputPaths,
    workflowSnapshot,
  ]);

  useEffect(() => {
    if (activeTab !== 'verifyArchive' || isArchived) {
      return;
    }
    const loadKey = `${changeName}\u0000${scopeId ?? ''}`;
    if (verifyArchiveTasksLoadedRef.current === loadKey) {
      return;
    }
    verifyArchiveTasksLoadedRef.current = loadKey;
    setVerifyArchiveTasksLoading(true);
    requestArtifact('tasks');
  }, [activeTab, changeName, isArchived, scopeId]);

  dispatchExtensionMessageRef.current = (msg: unknown) => {
      const data = msg as Record<string, unknown>;
      if (data.type === 'panelVisibility') {
        const visible = data.visible !== false;
        const tasksFetchKey = tasksFetchCoordinatorKey(scopeId);
        const tasksDirtyWhileHidden = visible
          && artifactFetchCoordinatorRef.current.isDirty(tasksFetchKey);
        artifactFetchCoordinatorRef.current.setPanelVisible(visible);
        if (visible && activeTabRef.current === 'verifyArchive') {
          if (tasksDirtyWhileHidden || verifyArchiveTasksLoadingRef.current) {
            verifyArchiveTasksLoadedRef.current = null;
            setVerifyArchiveTasksLoading(true);
            requestArtifact('tasks');
          }
        }
      } else if (data.type === 'dashboardData'
        && Array.isArray((data.data as { archivedChanges?: { name?: string }[] } | undefined)?.archivedChanges)
        && (data.data as { archivedChanges: { name?: string }[] }).archivedChanges.some(
          (archived) => archived.name === changeName,
        )) {
        setArchivedLocally(true);
      } else if (data.type === 'artifactContent' && data.changeName === changeName) {
        completeArtifactFetchAndStoreContent({
          scopeId,
          artifactType: String(data.artifactType),
          artifactPath: typeof data.artifactPath === 'string' ? data.artifactPath : undefined,
          content: String(data.content ?? ''),
          coordinator: artifactFetchCoordinatorRef.current,
          contentCache: contentCacheRef.current,
        });
        setContent(String(data.content ?? ''));
        setArtifactStateMessage(null);
        if (Array.isArray(data.outputs)) {
          const artifactType = String(data.artifactType);
          setArtifactOutputs((previous) => ({
            ...previous,
            [artifactType]: data.outputs as ArtifactOutputDescriptor[],
          }));
          setSelectedOutputPaths((previous) => ({
            ...previous,
            [artifactType]: reconcileSelectedOutputPath(
              typeof data.artifactPath === 'string'
                ? data.artifactPath
                : previous[artifactType],
              data.outputs as ArtifactOutputDescriptor[],
            ),
          }));
        } else if (typeof data.artifactPath === 'string') {
          setSelectedOutputPaths((previous) => ({
            ...previous,
            [String(data.artifactType)]: data.artifactPath as string,
          }));
        }
        setLoading(false);
        setError(null);
        if (data.artifactType === 'tasks' && data.content) {
          const { completed, total } = countTaskProgress(String(data.content));
          setTotalTasks(total);
          setCompletedTasks(completed);
          setVerifyArchiveTasksLoading(false);
        }
      } else if (data.type === 'workflowActionReceipt'
        && data.changeName === changeName
        && workflowSnapshot
        && data.bindingKey === workflowSnapshot.bindingKey) {
        workflowLaunchPending.handleReceipt(data as Parameters<typeof workflowLaunchPending.handleReceipt>[0]);
        if (data.status === 'running') {
          if (data.action === 'verify' || data.action === 'archive') {
            setPendingLaunchAction(data.action as WorkflowAction);
          }
        } else if (data.suppressPriorityAttention === true && data.status === 'completed') {
          setPendingLaunchAction(null);
          setPendingLaunchSurface(null);
        } else {
          setWorkflowReceipt({
            requestId: String(data.requestId),
            bindingKey: String(data.bindingKey),
            status: String(data.status),
            message: typeof data.message === 'string' ? data.message : undefined,
          });
        }
      } else if (data.type === 'artifactContentError' && data.changeName === changeName) {
        const artifactType = typeof data.artifactType === 'string'
          ? data.artifactType
          : activeTabRef.current;
        const fetchKey = artifactFetchCoordinatorKey(
          scopeId,
          artifactType,
          artifactType === 'specs' ? selectedSpecIdRef.current : undefined,
        );
        artifactFetchCoordinatorRef.current.complete(fetchKey);
        if (artifactType === 'tasks') {
          setVerifyArchiveTasksLoading(false);
        }
        if (data.code === 'WORKSPACE_ROOT_STALE') {
          setArtifactStateMessage(
            typeof data.message === 'string' ? data.message : t('workflow.workspaceRootStale'),
          );
          setLoading(false);
          setError(null);
          setErrorCode(String(data.code));
          setContent(null);
        } else {
          setError(typeof data.message === 'string' ? data.message : 'Failed to load');
          setErrorCode(typeof data.code === 'string' ? data.code : undefined);
          setLoading(false);
          setContent(null);
          setArtifactStateMessage(null);
        }
      } else if (data.type === 'deltaSpecList' && data.changeName === changeName) {
        const specIds = Array.isArray(data.specIds) ? data.specIds as string[] : [];
        setDeltaSpecIds(specIds);
        if (specIds.length) {
          setSelectedSpecId(specIds[0]);
          setLoading(true);
        } else {
          setLoading(false);
          setContent(null);
          setError(null);
        }
      } else if (data.type === 'deltaSpecContent' && data.changeName === changeName) {
        const key = cacheKey(scopeId, 'specs', String(data.specId));
        contentCacheRef.current.set(key, String(data.content ?? ''));
        setContent(String(data.content ?? ''));
        setLoading(false);
        setError(null);
      } else if (data.type === 'deltaSpecContentError' && data.changeName === changeName) {
        setError(typeof data.message === 'string' ? data.message : 'Failed to load spec');
        setLoading(false);
        setContent(null);
      } else if (
        (data.type === 'setContext'
          && data.view === 'changeDetail'
          && data.changeName === changeName
          && data.executorLaunchPresentation)
        || data.type === 'executorLaunchPresentation'
      ) {
        const presentation = data.type === 'executorLaunchPresentation'
          ? data
          : data.executorLaunchPresentation as Record<string, unknown>;
        if (presentation) {
          setExecutorPresentation(normalizeExecutorPresentation({
            agentAdapters: presentation.agentAdapters as ExecutorLaunchPresentation['agentAdapters'],
            workflowLaunchConfig: presentation.workflowLaunchConfig as ExecutorLaunchPresentation['workflowLaunchConfig'],
            uiWorkflowLaunchConfig: presentation.uiWorkflowLaunchConfig as ExecutorLaunchPresentation['uiWorkflowLaunchConfig'],
          }));
        }
      } else if (data.type === 'taskExecutionFinished' && data.changeName === changeName) {
        setExecutingTaskIndex(null);
        if (data.executionState && typeof data.executionState === 'object') {
          setTaskExecutionState(data.executionState as Record<number, { success: boolean; timestamp: number }>);
        }
      } else if (data.type === 'taskExecutionState' && data.changeName === changeName) {
        if (data.executionState && typeof data.executionState === 'object') {
          setTaskExecutionState(data.executionState as Record<number, { success: boolean; timestamp: number }>);
        }
      } else if (data.type === 'runCommandResult') {
        setRunCommandResult({
          success: Boolean(data.success),
          message: typeof data.message === 'string' ? data.message : undefined,
        });
      } else if (data.type === 'interactiveWorkflowState' && data.changeName === changeName) {
        setInteractiveState((data.state as InteractiveWorkflowState | undefined) ?? { changeName, sessions: {} });
      } else if (data.type === 'artifactInvalidated' && data.changeName === changeName) {
        const invalidated: string[] = Array.isArray(data.artifactTypes)
          ? data.artifactTypes as string[]
          : [];
        const scopePrefix = scopeId ? `${scopeId}::` : '';
        for (const type of invalidated) {
          if (type === 'specs') {
            for (const key of Array.from(contentCacheRef.current.keys())) {
              const suffix = scopePrefix ? key.slice(scopePrefix.length) : key;
              const isLegacyUnscopedSpecs = scopePrefix && (key === 'specs' || key.startsWith('specs:'));
              if (
                (scopePrefix && key.startsWith(scopePrefix) && (suffix === 'specs' || suffix.startsWith('specs:'))) ||
                (!scopePrefix && (key === 'specs' || key.startsWith('specs:'))) ||
                isLegacyUnscopedSpecs
              ) {
                contentCacheRef.current.delete(key);
              }
            }
          } else if (type !== 'tasks') {
            contentCacheRef.current.delete(`${scopePrefix}${type}`);
            if (scopePrefix) {
              contentCacheRef.current.delete(type);
            }
          }
        }
        if (invalidated.includes('tasks')) {
          handleTasksArtifactInvalidated({
            scopeId,
            coordinator: artifactFetchCoordinatorRef.current,
            contentCache: contentCacheRef.current,
            resetVerifyArchiveLoadedFlag: () => {
              verifyArchiveTasksLoadedRef.current = null;
            },
            markVerifyArchiveLoading: () => {
              if (activeTabRef.current === 'verifyArchive') {
                setVerifyArchiveTasksLoading(true);
              }
            },
            scheduleTasksRefetch: () => requestArtifact('tasks'),
          });
        } else if (invalidated.includes(activeTabRef.current)) {
          if (activeTabRef.current === 'specs') {
            requestSpecsList();
          } else if (activeTabRef.current !== 'verifyArchive') {
            requestArtifact(activeTabRef.current);
          }
        }
      }
  };

  useEffect(() => {
    return onMessage((event: MessageEvent) => {
      dispatchExtensionMessageRef.current(event.data);
    });
  }, [onMessage]);

  useEffect(() => {
    postMessage(sendMessage.getExecutorLaunchPresentation());
  }, [postMessage]);

  useEffect(() => {
    const persistId = shouldPersistNormalizedExecutor(
      executorPresentation?.agentAdapters.currentId,
      agentAdapters,
    );
    if (!persistId || persistedExecutorRef.current === persistId) return;
    persistedExecutorRef.current = persistId;
    postMessage(sendMessage.setPreferredAgentAdapter(persistId));
    setExecutorPresentation((prev) =>
      prev
        ? normalizeExecutorPresentation({
          ...prev,
          agentAdapters: {
            ...prev.agentAdapters,
            currentId: persistId,
          },
        })
        : prev,
    );
  }, [agentAdapters, executorPresentation?.agentAdapters.currentId, postMessage]);

  useEffect(() => {
    if (activeTab === 'specs' && selectedSpecId) {
      const key = cacheKey(scopeId, 'specs', selectedSpecId);
      const cached = contentCacheRef.current.get(key);
      if (cached !== undefined) {
        setContent(cached);
        setLoading(false);
        setError(null);
        postMessage(sendMessage.getDeltaSpecContent(changeName, selectedSpecId, scopeId));
        return;
      }
      setLoading(true);
      setError(null);
      postMessage(sendMessage.getDeltaSpecContent(changeName, selectedSpecId, scopeId));
    }
  }, [activeTab, selectedSpecId, changeName, postMessage, scopeId]);

  useEffect(() => {
    if (activeTab === 'tasks') {
      postMessage(sendMessage.getTaskExecutionState(changeName, scopeId));
    }
  }, [activeTab, changeName, postMessage, scopeId]);



  const handleOpenInEditor = () => {
    if (activeTab === 'verifyArchive') return;
    if (activeTab === 'specs' && selectedSpecId) {
      postMessage(sendMessage.openDeltaSpec(changeName, selectedSpecId, scopeId));
      return;
    }
    postMessage(sendMessage.openArtifact(
      changeName,
      activeTab,
      scopeId,
      selectedOutputPaths[activeTab]
    ));
  };

  const handleRefresh = () => {
    contentCacheRef.current.clear();
    postMessage(sendMessage.refresh());
    if (activeTab === 'verifyArchive') {
      postMessage(sendMessage.getInteractiveWorkflowState(changeName, scopeId));
      return;
    }
    if (activeTab === 'specs') {
      requestSpecsList();
    } else {
      requestArtifact(activeTab);
    }
  };

  const handleArchiveNow = () => {
    postMessage(sendMessage.archiveChange(changeName, scopeId));
  };

  const handleRunCommand = () => {
    const commandId = verifyCommandId.trim();
    if (!commandId) return;
    setRunCommandResult(null);
    postMessage(sendMessage.runCommand(commandId, verifyArgsJson.trim() || undefined, changeName));
  };

  const copyCommandTarget = resolveWorkflowCommandTargetForUi(executorUiLaunchConfig);

  const workflowBindingKey = workflowSnapshot?.bindingKey;
  const isWorkflowLaunchPending = workflowBindingKey
    ? workflowLaunchPending.isPending(changeName, workflowBindingKey)
    : false;
  const actionBarPendingAction = isWorkflowLaunchPending
    && pendingLaunchSurface === 'actionBar'
    ? pendingLaunchAction
    : null;
  const verifyArchivePendingAction = isWorkflowLaunchPending
    && pendingLaunchSurface === 'verifyArchive'
    && (pendingLaunchAction === 'verify' || pendingLaunchAction === 'archive')
    ? pendingLaunchAction
    : null;

  useEffect(() => {
    if (!workflowBindingKey || !pendingLaunchAction) return;
    if (!workflowLaunchPending.isPending(changeName, workflowBindingKey)) {
      setPendingLaunchAction(null);
      setPendingLaunchSurface(null);
    }
  }, [changeName, pendingLaunchAction, workflowBindingKey, workflowLaunchPending.pendingKeys]);

  useEffect(() => {
    if (!verifyArchiveTasksLoading) return;
    const timeout = window.setTimeout(() => {
      verifyArchiveTasksLoadedRef.current = null;
      requestArtifact('tasks');
    }, 15_000);
    return () => window.clearTimeout(timeout);
  }, [verifyArchiveTasksLoading, changeName, scopeId]);

  const handleLaunchWorkflow = (
    action: 'explore' | 'continue' | 'ff' | 'apply' | 'verify' | 'archive' | 'sync',
    surface: LaunchSurface = 'actionBar',
  ) => {
    if (!workflowSnapshot?.bindingKey) return;
    if (pendingLaunchAction === action && workflowLaunchPending.isPending(changeName, workflowSnapshot.bindingKey)) {
      return;
    }
    setPendingLaunchAction(action);
    setPendingLaunchSurface(surface);
    const { requestId } = workflowLaunchPending.registerLaunch(changeName, workflowSnapshot.bindingKey);
    setWorkflowReceipt({
      requestId,
      bindingKey: workflowSnapshot.bindingKey,
      status: 'pending',
    });
    postMessage(sendMessage.launchWorkflowAction(
      action,
      changeName,
      scopeId,
      requestId,
      workflowSnapshot.bindingKey,
    ));
  };

  useEffect(() => {
    if (activeTab !== 'verifyArchive' || !pendingInteractiveAction) return;
    handleLaunchWorkflow(pendingInteractiveAction, 'verifyArchive');
    setPendingInteractiveAction(null);
  }, [activeTab, pendingInteractiveAction]);

  const handleResolvedAction = (
    action: 'explore' | 'continue' | 'ff' | 'apply' | 'verify' | 'archive' | 'sync'
  ) => {
    if (action === 'verify' || action === 'archive') {
      setActiveTab('verifyArchive');
      handleLaunchWorkflow(action, 'actionBar');
      return;
    }
    handleLaunchWorkflow(action, 'actionBar');
  };

  const handleConfirmTaskToggle = () => {
    if (!pendingTaskToggle) return;
    postMessage(sendMessage.toggleTask(changeName, pendingTaskToggle.taskIndex, scopeId));
    setPendingTaskToggle(null);
  };

  return (
    <div
      className="min-h-screen flex flex-col"
      data-executor-ui-ready={executorPresentation ? 'true' : 'false'}
      data-executor-effective-id={executorUiLaunchConfig.effectiveAdapterId ?? 'pending'}
      style={{
        background: 'var(--vscode-editor-background)',
        color: 'var(--vscode-foreground)',
      }}
    >
      <div
        className="px-4 py-4 border-b flex flex-wrap items-start justify-between gap-3"
        style={{ borderColor: 'var(--vscode-panel-border)' }}
      >
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <div className="text-lg font-semibold break-all">
              {changeName.startsWith('archive:') ? `${changeName.slice(8)} (archived)` : changeName}
            </div>
            <IconButton
              icon={copiedName ? 'check' : 'copy'}
              label={copiedName ? t('action.copiedChangeName') : t('action.copyChangeName')}
              onClick={handleCopyChangeName}
            />
          </div>
          <div className="inline-flex items-center gap-2 mt-2 px-2.5 py-1 rounded text-xs" style={{ background: 'var(--vscode-editor-inactiveSelectionBackground)', color: 'var(--vscode-descriptionForeground)' }}>
            {verifyArchiveTasksLoading && activeTab === 'verifyArchive'
              ? t('detail.loadingTaskProgress')
              : getStatusSummary(existingArtifactIds, completedTasks, totalTasks, isArchived)}
          </div>
          {workflowSnapshot && (
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px]" style={{ color: 'var(--vscode-descriptionForeground)' }}>
              <span>{t('detail.schema', { schema: workflowSnapshot.schema })}</span>
              {projectLabel && <span>{t('detail.project', { project: projectLabel })}</span>}
              {planningRoot && <span>{t(scopeSource === 'store' ? 'detail.root.store' : 'detail.root.local', { root: planningRoot })}</span>}
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-1">
          <IconButton icon="go-to-file" label={t('action.openInEditor')} onClick={handleOpenInEditor} />
          <IconButton icon="refresh" label={t('action.refresh')} onClick={handleRefresh} />
        </div>
      </div>

      <ActionBar
        changeName={changeName}
        isArchived={isArchived}
        resolvedActions={resolvedWorkflowActions}
        pendingAction={actionBarPendingAction}
        receiptStatus={workflowReceipt?.status}
        receiptMessage={workflowReceipt?.message}
        executorUiLaunchConfig={executorUiLaunchConfig}
        onAction={handleResolvedAction}
        onCopyFf={(name) =>
          postMessage(sendMessage.copyToClipboard(buildWorkflowCommand({ action: 'ff', changeName: name, target: copyCommandTarget })))
        }
        onCopyApply={(name) =>
          postMessage(sendMessage.copyToClipboard(buildWorkflowCommand({ action: 'apply', changeName: name, target: copyCommandTarget })))
        }
      />

      <div className="flex flex-wrap border-b gap-x-4 gap-y-2 px-3 py-2" style={{ borderColor: 'var(--vscode-panel-border)' }}>
        {artifactGroups.map((group) => (
          <div key={group.label} className="flex flex-wrap items-center gap-1" role="group" aria-label={group.label}>
            <span className="text-[10px] uppercase" style={{ color: 'var(--vscode-descriptionForeground)' }}>{group.label}</span>
            {group.artifacts.map((artifact) => (
              <button
                key={artifact.id}
                type="button"
                className="px-2 py-1 text-xs font-medium cursor-pointer rounded border"
                aria-current={activeTab === artifact.id ? 'page' : undefined}
                style={{
                  borderColor: activeTab === artifact.id ? 'var(--vscode-focusBorder)' : 'var(--vscode-panel-border)',
                  color: activeTab === artifact.id ? 'var(--vscode-foreground)' : 'var(--vscode-descriptionForeground)',
                }}
                onClick={() => setActiveTab(artifact.id)}
              >
                {artifactLabel(artifact.id)}
              </button>
            ))}
          </div>
        ))}
        {tabs.some((tab) => tab.id === 'verifyArchive') && (
          <button
            type="button"
            className="px-2 py-1 text-xs font-medium cursor-pointer rounded border"
            aria-current={activeTab === 'verifyArchive' ? 'page' : undefined}
            style={{
              borderColor: activeTab === 'verifyArchive' ? 'var(--vscode-focusBorder)' : 'var(--vscode-panel-border)',
              color: activeTab === 'verifyArchive' ? 'var(--vscode-foreground)' : 'var(--vscode-descriptionForeground)',
            }}
            onClick={() => setActiveTab('verifyArchive')}
          >
            {t('detail.verifyArchive')}
          </button>
        )}
      </div>

      {activeTab === 'specs' && deltaSpecIds.length > 1 && (
        <div className="px-4 py-2 flex items-center gap-2 border-b" style={{ borderColor: 'var(--vscode-panel-border)' }}>
          <span className="text-xs" style={{ color: 'var(--vscode-descriptionForeground)' }}>{t('spec.label')}</span>
          <select
            className="text-xs rounded px-2 py-1 flex-1 max-w-[240px]"
            style={{
              background: 'var(--vscode-input-background)',
              color: 'var(--vscode-input-foreground)',
              border: '1px solid var(--vscode-input-border)',
            }}
            value={selectedSpecId ?? ''}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedSpecId(e.target.value)}
          >
            {deltaSpecIds.map((id) => (
              <option key={id} value={id}>{id}</option>
            ))}
          </select>
        </div>
      )}

      <div className="p-4 flex-1 overflow-auto">
        {activeTab === 'verifyArchive' ? (
          <div className="flex flex-col gap-4 max-w-4xl">
            <VerifyArchivePanel
              isArchived={isArchived}
              canArchiveNow={canArchiveNow}
              archiveNowDisabledReason={archiveNowDisabledReason}
              pendingAction={verifyArchivePendingAction}
              workflowLaunchConfig={executorUiLaunchConfig}
              onRun={(action) => handleLaunchWorkflow(action, 'verifyArchive')}
              onArchiveNow={handleArchiveNow}
            />

            {debug && (
              <div
                className="rounded border p-3 flex flex-col gap-2 max-w-xl"
                style={{ borderColor: 'var(--vscode-panel-border)' }}
              >
                <div className="text-xs font-medium">{t('verify.debugLabel')}</div>
                <input
                  type="text"
                  value={verifyCommandId}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setVerifyCommandId(e.target.value)}
                  placeholder="composer.newAgentChat"
                  className="w-full px-2 py-1.5 text-sm rounded"
                  style={{
                    background: 'var(--vscode-input-background)',
                    color: 'var(--vscode-input-foreground)',
                    border: '1px solid var(--vscode-input-border)',
                  }}
                />
                <textarea
                  value={verifyArgsJson}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setVerifyArgsJson(e.target.value)}
                  placeholder='{"initialPrompt": "hello"}'
                  rows={3}
                  className="w-full px-2 py-1.5 text-sm rounded font-mono"
                  style={{
                    background: 'var(--vscode-input-background)',
                    color: 'var(--vscode-input-foreground)',
                    border: '1px solid var(--vscode-input-border)',
                  }}
                />
                <button
                  type="button"
                  onClick={handleRunCommand}
                  className="px-3 py-1.5 text-xs rounded cursor-pointer w-fit"
                  style={{
                    background: 'var(--vscode-button-secondaryBackground)',
                    color: 'var(--vscode-button-secondaryForeground)',
                  }}
                >
                  {t('task.execute')}
                </button>
                {runCommandResult !== null && (
                  <div
                    className="text-xs px-2 py-1 rounded"
                    style={{
                      background: runCommandResult.success
                        ? 'var(--vscode-editor-inactiveSelectionBackground)'
                        : 'var(--vscode-inputValidation-errorBackground)',
                      color: runCommandResult.success
                        ? 'var(--vscode-foreground)'
                        : 'var(--vscode-errorForeground)',
                    }}
                  >
                    {runCommandResult.success ? t('verify.executed') : runCommandResult.message ?? 'Failed'}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : activeTab === 'tasks' && content !== null && !loading && !error ? (
          <>
            {agentAdapters.available.length > 0 && (
              <div className="flex flex-col gap-1 mb-3 text-sm">
                <div className="flex items-center gap-2">
                  <span style={{ color: 'var(--vscode-descriptionForeground)' }}>{t('task.executor')}</span>
                  <select
                    value={executorSelectValue}
                    data-executor-select-value={executorSelectValue}
                    data-executor-effective-id={executorUiLaunchConfig.effectiveAdapterId ?? 'pending'}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                      const id = e.target.value;
                      if (id) {
                        postMessage(sendMessage.setPreferredAgentAdapter(id));
                        setExecutorPresentation((prev) =>
                          prev
                            ? normalizeExecutorPresentation({
                              ...prev,
                              agentAdapters: {
                                ...prev.agentAdapters,
                                currentId: id,
                              },
                            })
                            : prev,
                        );
                      }
                    }}
                    style={{
                      padding: '2px 8px',
                      background: 'var(--vscode-input-background)',
                      color: 'var(--vscode-input-foreground)',
                      border: '1px solid var(--vscode-input-border)',
                      borderRadius: '4px',
                    }}
                  >
                    {agentAdapters.available.map((adapter) => (
                      <option key={adapter.id} value={adapter.id}>{adapter.displayName}</option>
                    ))}
                  </select>
                </div>
                <p className="text-xs" style={{ color: 'var(--vscode-descriptionForeground)' }}>
                  {tasksLaunchModeHint && <span>{tasksLaunchModeHint}</span>}
                  {' '}
                  <span data-executor-ui-mode={executorUiModeLabel}>
                    UI: {executorUiModeLabel}
                  </span>
                </p>
              </div>
            )}
            {isArchived && (
              <p className="text-xs mb-2" style={{ color: 'var(--vscode-descriptionForeground)' }}>
                {t('archive.readOnlyLabel')}
              </p>
            )}
            <TaskList
              content={content}
              changeName={changeName}
              isArchived={isArchived}
              executingTaskIndex={executingTaskIndex}
              executionState={taskExecutionState}
              executorUiLaunchConfig={executorUiLaunchConfig}
              onToggleTask={(_name, taskIndex, taskText, done) =>
                setPendingTaskToggle({ taskIndex, taskText, done })
              }
              onExecuteTask={isArchived ? undefined : (name, taskIndex, taskText) => {
                setExecutingTaskIndex(taskIndex);
                postMessage(sendMessage.executeTask(name, taskIndex, taskText, scopeId));
              }}
            />
          </>
        ) : artifactStateMessage ? (
          <div
            className="rounded border p-3 text-sm"
            role="status"
            style={{
              borderColor: 'var(--vscode-panel-border)',
              color: 'var(--vscode-descriptionForeground)',
            }}
          >
            <div className="font-medium" style={{ color: 'var(--vscode-foreground)' }}>{artifactLabel(activeTab)}</div>
            <div className="mt-1">{artifactStateMessage}</div>
          </div>
        ) : (
          <ArtifactViewer
            content={content}
            loading={loading}
            error={error}
            errorCode={errorCode}
            outputs={artifactOutputs[activeTab]}
            selectedOutputPath={selectedOutputPaths[activeTab]}
            onSelectOutput={(outputPath) => requestArtifact(activeTab, outputPath)}
            onOpenInEditor={() => handleOpenInEditor()}
            onCreateWithAi={isArchived || !workflowSnapshot ? undefined : () => handleLaunchWorkflow('continue')}
            onContinue={isArchived || !workflowSnapshot ? undefined : () => handleLaunchWorkflow('continue')}
            onExplore={
              !isArchived && workflowSnapshot && activeTab === 'proposal' && !(existingArtifactIds?.includes('proposal'))
                ? () => handleLaunchWorkflow('explore')
                : undefined
            }
            createDisabledReason={getCreateDisabledReason(activeTab, existingArtifactIds)}
          />
        )}
      </div>

      <ConfirmDialog
        open={pendingTaskToggle !== null}
        title={pendingTaskToggle?.done ? t('confirm.markUndone') : t('confirm.markDone')}
        message={pendingTaskToggle?.taskText ?? ''}
        confirmLabel={pendingTaskToggle?.done ? t('confirm.ok') : t('confirm.markDoneBtn')}
        cancelLabel={t('confirm.cancel')}
        onConfirm={handleConfirmTaskToggle}
        onCancel={() => setPendingTaskToggle(null)}
      />
    </div>
  );
};
