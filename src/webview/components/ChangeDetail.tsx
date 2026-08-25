import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useVscode } from '../hooks/useVscode';
import { sendMessage, type ArtifactOutputDescriptor } from '../types/messages';
import { ActionBar } from './ActionBar';
import { ArtifactViewer } from './ArtifactViewer';
import { TaskList } from './TaskList';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { VerifyArchivePanel } from './VerifyArchivePanel';
import { IconButton } from './ui/IconButton';
import { t } from '../../i18n';
import { buildWorkflowCommand, type WorkflowAction } from '../../shared/workflowCommand';
import {
  createWorkflowRequestId,
  resolveWorkflowActions,
  type ChangeWorkflowSnapshot,
} from '../../shared/changeWorkflow';
import type { WorkflowLaunchConfigView } from '../utils/workflowLaunchLabels';
import type {
  ChangeDetailTabId,
  InteractiveWorkflowAction,
  InteractiveWorkflowState,
} from '../../shared/interactiveWorkflow';

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
}

// Cache key includes scopeId so the same change name in two roots never shares content.
const cacheKey = (scopeId: string | undefined, type: string, specId?: string | null) =>
  `${scopeId ? `${scopeId}::` : ''}${type === 'specs' && specId ? `specs:${specId}` : specId ? `${type}:${specId}` : type}`;

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
}) => {
  const { postMessage, onMessage } = useVscode();
  const [activeTab, setActiveTab] = useState<string>(initialTab ?? 'proposal');
  const contentCacheRef = useRef<Map<string, string>>(new Map());
  const [completedTasks, setCompletedTasks] = useState(0);
  const [totalTasks, setTotalTasks] = useState(0);
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | undefined>(undefined);
  const [deltaSpecIds, setDeltaSpecIds] = useState<string[]>([]);
  const [selectedSpecId, setSelectedSpecId] = useState<string | null>(null);
  const [artifactOutputs, setArtifactOutputs] = useState<Record<string, ArtifactOutputDescriptor[]>>({});
  const [selectedOutputPaths, setSelectedOutputPaths] = useState<Record<string, string | undefined>>({});
  const [agentAdapters, setAgentAdapters] = useState<{
    available: { id: string; displayName: string }[];
    currentId: string | null;
  }>({ available: [], currentId: null });
  const [executingTaskIndex, setExecutingTaskIndex] = useState<number | null>(null);
  const [verifyCommandId, setVerifyCommandId] = useState('');
  const [verifyArgsJson, setVerifyArgsJson] = useState('');
  const [runCommandResult, setRunCommandResult] = useState<{ success: boolean; message?: string } | null>(null);
  const [taskExecutionState, setTaskExecutionState] = useState<Record<number, { success: boolean; timestamp: number }>>({});
  const [pendingTaskToggle, setPendingTaskToggle] = useState<{ taskIndex: number; taskText: string; done: boolean } | null>(null);
  const [workflowLaunchConfig, setWorkflowLaunchConfig] = useState<WorkflowLaunchConfigView | null>(null);
  const [interactiveState, setInteractiveState] = useState<InteractiveWorkflowState>({
    changeName,
    sessions: {},
  });
  const [pendingInteractiveAction, setPendingInteractiveAction] = useState<InteractiveWorkflowAction | null>(interactiveAction ?? null);
  const [copiedName, setCopiedName] = useState(false);
  const [artifactStateMessage, setArtifactStateMessage] = useState<string | null>(null);
  const [pendingWorkflowAction, setPendingWorkflowAction] = useState<WorkflowAction | null>(null);
  const [archivedLocally, setArchivedLocally] = useState(false);
  const [directArchivePending, setDirectArchivePending] = useState(false);
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
  const canArchiveNow = Boolean(
    resolvedWorkflowActions?.highImpact.some(
      (action) => action.action === 'archive' && action.highImpact === true
    )
  );
  const archiveNowDisabledReason = isArchived
    ? t('verifyArchive.archiveDisabledArchived')
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

  const requestArtifact = (artifactType: string, outputPath?: string) => {
    setLoading(true);
    setError(null);
    setErrorCode(undefined);
    setArtifactStateMessage(null);
    setContent(null);
    postMessage(sendMessage.getArtifactContent(changeName, artifactType, scopeId, outputPath));
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
      if (!isArchived) {
        postMessage(sendMessage.getArtifactContent(changeName, 'tasks', scopeId));
      }
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
      postMessage(sendMessage.getArtifactContent(
        changeName,
        activeTab,
        scopeId,
        selectedOutputPaths[activeTab]
      ));
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
    const cleanup = onMessage((event: MessageEvent) => {
      const msg = event.data;
      if (msg.type === 'dashboardData'
        && directArchivePending
        && Array.isArray(msg.data?.archivedChanges)
        && msg.data.archivedChanges.some((archived: { name?: string }) => archived.name === changeName)) {
        setArchivedLocally(true);
        setDirectArchivePending(false);
      } else if (msg.type === 'artifactContent' && msg.changeName === changeName) {
        const key = cacheKey(scopeId, msg.artifactType, msg.artifactPath);
        contentCacheRef.current.set(key, msg.content ?? '');
        setContent(msg.content ?? '');
        setArtifactStateMessage(null);
        if (Array.isArray(msg.outputs)) {
          setArtifactOutputs((previous) => ({ ...previous, [msg.artifactType]: msg.outputs }));
          setSelectedOutputPaths((previous) => ({
            ...previous,
            [msg.artifactType]: reconcileSelectedOutputPath(
              typeof msg.artifactPath === 'string'
                ? msg.artifactPath
                : previous[msg.artifactType],
              msg.outputs,
            ),
          }));
        } else if (typeof msg.artifactPath === 'string') {
          setSelectedOutputPaths((previous) => ({ ...previous, [msg.artifactType]: msg.artifactPath }));
        }
        setLoading(false);
        setError(null);
        if (msg.artifactType === 'tasks' && msg.content) {
          const lines = msg.content.split('\n');
          const taskLines = lines.filter((line: string) => /^\s*-\s*\[[ x]\]/.test(line));
          const doneLines = taskLines.filter((line: string) => /^\s*-\s*\[x\]/i.test(line));
          setTotalTasks(taskLines.length);
          setCompletedTasks(doneLines.length);
        }
      } else if (msg.type === 'workflowActionReceipt'
        && msg.changeName === changeName
        && workflowSnapshot
        && msg.bindingKey === workflowSnapshot.bindingKey
        && workflowReceipt?.requestId === msg.requestId) {
        setWorkflowReceipt({
          requestId: msg.requestId,
          bindingKey: msg.bindingKey,
          status: msg.status,
          message: msg.message,
        });
        if (!['running'].includes(msg.status)) setPendingWorkflowAction(null);
      } else if (msg.type === 'artifactContentError' && msg.changeName === changeName) {
        setError(msg.message ?? 'Failed to load');
        setErrorCode(msg.code);
        setLoading(false);
        setContent(null);
        setArtifactStateMessage(null);
        setDirectArchivePending(false);
      } else if (msg.type === 'deltaSpecList' && msg.changeName === changeName) {
        setDeltaSpecIds(msg.specIds ?? []);
        if (msg.specIds?.length) {
          setSelectedSpecId(msg.specIds[0]);
          setLoading(true);
        } else {
          setLoading(false);
          setContent(null);
          setError(null);
        }
      } else if (msg.type === 'deltaSpecContent' && msg.changeName === changeName) {
        const key = cacheKey(scopeId, 'specs', msg.specId);
        contentCacheRef.current.set(key, msg.content ?? '');
        setContent(msg.content ?? '');
        setLoading(false);
        setError(null);
      } else if (msg.type === 'deltaSpecContentError' && msg.changeName === changeName) {
        setError(msg.message ?? 'Failed to load spec');
        setLoading(false);
        setContent(null);
      } else if (msg.type === 'agentAdapters') {
        setAgentAdapters({
          available: msg.available ?? [],
          currentId: msg.currentId ?? null,
        });
      } else if (msg.type === 'taskExecutionFinished' && msg.changeName === changeName) {
        setExecutingTaskIndex(null);
        if (msg.executionState && typeof msg.executionState === 'object') {
          setTaskExecutionState(msg.executionState);
        }
      } else if (msg.type === 'taskExecutionState' && msg.changeName === changeName) {
        if (msg.executionState && typeof msg.executionState === 'object') {
          setTaskExecutionState(msg.executionState);
        }
      } else if (msg.type === 'runCommandResult') {
        setRunCommandResult({ success: msg.success, message: msg.message });
      } else if (msg.type === 'error') {
        setDirectArchivePending(false);
      } else if (msg.type === 'workflowLaunchConfig') {
        setWorkflowLaunchConfig(msg.config ?? null);
      } else if (msg.type === 'interactiveWorkflowState' && msg.changeName === changeName) {
        setInteractiveState(msg.state ?? { changeName, sessions: {} });
      } else if (msg.type === 'artifactInvalidated' && msg.changeName === changeName) {
        const invalidated: string[] = msg.artifactTypes ?? [];
        const scopePrefix = scopeId ? `${scopeId}::` : '';
        for (const type of invalidated) {
          if (type === 'specs') {
            for (const key of Array.from(contentCacheRef.current.keys())) {
              // Cache keys are optionally scope-prefixed; drop the specs entries that
              // belong to this panel's scope (and any legacy unscoped specs:* keys).
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
          } else {
            contentCacheRef.current.delete(`${scopePrefix}${type}`);
            if (scopePrefix) {
              contentCacheRef.current.delete(type);
            }
          }
        }
        if (invalidated.includes(activeTab)) {
          if (activeTab === 'specs') {
            requestSpecsList();
          } else if (activeTab !== 'verifyArchive') {
            requestArtifact(activeTab);
          }
        }
      }
    });
    return cleanup;
   }, [activeTab, changeName, directArchivePending, onMessage, postMessage, scopeId, workflowReceipt, workflowSnapshot]);

  useEffect(() => {
    postMessage(sendMessage.getWorkflowLaunchConfig());
  }, [postMessage]);

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
      postMessage(sendMessage.getAgentAdapters());
      postMessage(sendMessage.getTaskExecutionState(changeName, scopeId));
    }
  }, [activeTab, changeName, postMessage, scopeId]);

  useEffect(() => {
    if (activeTab !== 'verifyArchive') return;
    postMessage(sendMessage.getInteractiveWorkflowState(changeName, scopeId));
    if (pendingInteractiveAction) {
      postMessage(sendMessage.runInteractiveWorkflow(changeName, pendingInteractiveAction, scopeId));
      setPendingInteractiveAction(null);
    }
  }, [activeTab, changeName, pendingInteractiveAction, postMessage, scopeId]);


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
    setDirectArchivePending(true);
    postMessage(sendMessage.archiveChange(changeName, scopeId));
  };

  const handleRunCommand = () => {
    const commandId = verifyCommandId.trim();
    if (!commandId) return;
    setRunCommandResult(null);
    postMessage(sendMessage.runCommand(commandId, verifyArgsJson.trim() || undefined, changeName));
  };

  const handleLaunchWorkflow = (
    action: 'explore' | 'continue' | 'ff' | 'apply' | 'verify' | 'archive' | 'sync'
  ) => {
    if (!workflowSnapshot?.bindingKey || pendingWorkflowAction === action) return;
    const requestId = createWorkflowRequestId();
    setPendingWorkflowAction(action);
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

  const handleResolvedAction = (
    action: 'explore' | 'continue' | 'ff' | 'apply' | 'verify' | 'archive' | 'sync'
  ) => {
    if (action === 'verify' || action === 'archive') {
      setActiveTab('verifyArchive');
      setPendingInteractiveAction(action);
      return;
    }
    handleLaunchWorkflow(action);
  };

  const handleConfirmTaskToggle = () => {
    if (!pendingTaskToggle) return;
    postMessage(sendMessage.toggleTask(changeName, pendingTaskToggle.taskIndex, scopeId));
    setPendingTaskToggle(null);
  };

  return (
    <div
      className="min-h-screen flex flex-col"
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
            {getStatusSummary(existingArtifactIds, completedTasks, totalTasks, isArchived)}
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
        pendingAction={pendingWorkflowAction}
        receiptStatus={workflowReceipt?.status}
        receiptMessage={workflowReceipt?.message}
        workflowLaunchConfig={workflowLaunchConfig}
        onAction={handleResolvedAction}
        onCopyFf={(name) =>
          postMessage(sendMessage.copyToClipboard(buildWorkflowCommand({ action: 'ff', changeName: name, target: 'clipboard' })))
        }
        onCopyApply={(name) =>
          postMessage(sendMessage.copyToClipboard(buildWorkflowCommand({ action: 'apply', changeName: name, target: 'clipboard' })))
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
              sessions={interactiveState.sessions}
              onRun={(action) => postMessage(sendMessage.runInteractiveWorkflow(changeName, action, scopeId))}
              onReveal={(action) => postMessage(sendMessage.revealInteractiveWorkflow(changeName, action, scopeId))}
              onStop={(action) => postMessage(sendMessage.stopInteractiveWorkflow(changeName, action, scopeId))}
              onClear={(action) => postMessage(sendMessage.clearInteractiveWorkflow(changeName, action, scopeId))}
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
                    value={agentAdapters.currentId ?? ''}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                      const id = e.target.value;
                      if (id) {
                        postMessage(sendMessage.setPreferredAgentAdapter(id));
                        setAgentAdapters((prev) => ({ ...prev, currentId: id }));
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
                  {t('workflow.launchHelp')}
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
