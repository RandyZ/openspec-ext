import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useVscode } from '../hooks/useVscode';
import { sendMessage } from '../types/messages';
import { ActionBar } from './ActionBar';
import { ArtifactViewer } from './ArtifactViewer';
import { TaskList } from './TaskList';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { WorkflowStepIndicator } from './WorkflowStepIndicator';
import { VerifyArchivePanel } from './VerifyArchivePanel';
import { IconButton } from './ui/IconButton';
import { deriveWorkflowState, type WorkflowStep } from '../utils/workflowState';
import { t } from '../../i18n';
import { buildWorkflowCommand } from '../../shared/workflowCommand';
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
}

const ALL_TABS = [
  { id: 'proposal' as const, label: 'Proposal' },
  { id: 'specs' as const, label: 'Specs' },
  { id: 'design' as const, label: 'Design' },
  { id: 'tasks' as const, label: 'Tasks' },
  { id: 'verifyArchive' as const, label: 'Verify & Archive' },
];

const cacheKey = (type: string, specId?: string | null) =>
  type === 'specs' && specId ? `specs:${specId}` : type;

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

export const ChangeDetail: React.FC<ChangeDetailProps> = ({
  changeName,
  existingArtifactIds,
  debug = false,
  initialTab,
  interactiveAction,
}) => {
  const { postMessage, onMessage } = useVscode();
  const [activeTab, setActiveTab] = useState<ChangeDetailTabId>(initialTab ?? 'proposal');
  const contentCacheRef = useRef<Map<string, string>>(new Map());
  const [completedTasks, setCompletedTasks] = useState(0);
  const [totalTasks, setTotalTasks] = useState(0);
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | undefined>(undefined);
  const [deltaSpecIds, setDeltaSpecIds] = useState<string[]>([]);
  const [selectedSpecId, setSelectedSpecId] = useState<string | null>(null);
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

  const handleCopyChangeName = () => {
    postMessage(sendMessage.copyToClipboard(changeName));
    setCopiedName(true);
    window.setTimeout(() => setCopiedName(false), 1200);
  };

  const isArchived = changeName.startsWith('archive:');
  const workflowState = useMemo(
    () =>
      deriveWorkflowState(
        changeName,
        existingArtifactIds,
        completedTasks,
        totalTasks,
        isArchived,
        false
      ),
    [changeName, existingArtifactIds, completedTasks, totalTasks, isArchived]
  );
  const showVerifyArchiveTab = debug || (completedTasks > 0 && totalTasks > 0);
  const tabs = showVerifyArchiveTab ? ALL_TABS : ALL_TABS.filter((tab) => tab.id !== 'verifyArchive');

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    } else if (!showVerifyArchiveTab && activeTab === 'verifyArchive') {
      setActiveTab('proposal');
    }
  }, [initialTab, showVerifyArchiveTab, activeTab]);

  useEffect(() => {
    if (interactiveAction) {
      setActiveTab('verifyArchive');
      setPendingInteractiveAction(interactiveAction);
    }
  }, [interactiveAction]);

  const requestArtifact = (artifactType: string) => {
    setLoading(true);
    setError(null);
    setErrorCode(undefined);
    setContent(null);
    postMessage(sendMessage.getArtifactContent(changeName, artifactType));
  };

  const requestSpecsList = () => {
    setLoading(true);
    setError(null);
    setContent(null);
    setDeltaSpecIds([]);
    setSelectedSpecId(null);
    postMessage(sendMessage.listDeltaSpecs(changeName));
  };

  useEffect(() => {
    if (activeTab === 'verifyArchive') {
      setLoading(false);
      setError(null);
      setContent(null);
      return;
    }

    const artifactId = activeTab;
    const knownMissing =
      !isArchived &&
      Array.isArray(existingArtifactIds) &&
      !existingArtifactIds.includes(artifactId);

    if (knownMissing) {
      setLoading(false);
      setError(MISSING_ARTIFACT_MESSAGE);
      setErrorCode('ARTIFACT_MISSING');
      setContent(null);
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

    const key = cacheKey(activeTab, null);
    const cached = contentCacheRef.current.get(key);
    if (cached !== undefined) {
      setContent(cached);
      setLoading(false);
      setError(null);
      setErrorCode(undefined);
      return;
    }
    requestArtifact(activeTab);
  }, [changeName, activeTab, existingArtifactIds, isArchived]);

  useEffect(() => {
    const cleanup = onMessage((event: MessageEvent) => {
      const msg = event.data;
      if (msg.type === 'artifactContent' && msg.changeName === changeName) {
        const key = cacheKey(msg.artifactType, null);
        contentCacheRef.current.set(key, msg.content ?? '');
        setContent(msg.content ?? '');
        setLoading(false);
        setError(null);
        if (msg.artifactType === 'tasks' && msg.content) {
          const lines = msg.content.split('\n');
          const taskLines = lines.filter((line: string) => /^\s*-\s*\[[ x]\]/.test(line));
          const doneLines = taskLines.filter((line: string) => /^\s*-\s*\[x\]/i.test(line));
          setTotalTasks(taskLines.length);
          setCompletedTasks(doneLines.length);
        }
      } else if (msg.type === 'artifactContentError' && msg.changeName === changeName) {
        setError(msg.message ?? 'Failed to load');
        setErrorCode(msg.code);
        setLoading(false);
        setContent(null);
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
        const key = cacheKey('specs', msg.specId);
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
      } else if (msg.type === 'workflowLaunchConfig') {
        setWorkflowLaunchConfig(msg.config ?? null);
      } else if (msg.type === 'interactiveWorkflowState' && msg.changeName === changeName) {
        setInteractiveState(msg.state ?? { changeName, sessions: {} });
      } else if (msg.type === 'artifactInvalidated' && msg.changeName === changeName) {
        const invalidated: string[] = msg.artifactTypes ?? [];
        for (const type of invalidated) {
          if (type === 'specs') {
            for (const key of Array.from(contentCacheRef.current.keys())) {
              if (key === 'specs' || key.startsWith('specs:')) {
                contentCacheRef.current.delete(key);
              }
            }
          } else {
            contentCacheRef.current.delete(type);
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
  }, [activeTab, changeName, onMessage, postMessage]);

  useEffect(() => {
    postMessage(sendMessage.getWorkflowLaunchConfig());
  }, [postMessage]);

  useEffect(() => {
    if (activeTab === 'specs' && selectedSpecId) {
      const key = cacheKey('specs', selectedSpecId);
      const cached = contentCacheRef.current.get(key);
      if (cached !== undefined) {
        setContent(cached);
        setLoading(false);
        setError(null);
        return;
      }
      setLoading(true);
      setError(null);
      postMessage(sendMessage.getDeltaSpecContent(changeName, selectedSpecId));
    }
  }, [activeTab, selectedSpecId, changeName, postMessage]);

  useEffect(() => {
    if (activeTab === 'tasks') {
      postMessage(sendMessage.getAgentAdapters());
      postMessage(sendMessage.getTaskExecutionState(changeName));
    }
  }, [activeTab, changeName, postMessage]);

  useEffect(() => {
    if (activeTab !== 'verifyArchive') return;
    postMessage(sendMessage.getInteractiveWorkflowState(changeName));
    if (pendingInteractiveAction) {
      postMessage(sendMessage.runInteractiveWorkflow(changeName, pendingInteractiveAction));
      setPendingInteractiveAction(null);
    }
  }, [activeTab, changeName, pendingInteractiveAction, postMessage]);


  const handleOpenInEditor = () => {
    if (activeTab === 'verifyArchive') return;
    if (activeTab === 'specs' && selectedSpecId) {
      postMessage(sendMessage.openDeltaSpec(changeName, selectedSpecId));
      return;
    }
    postMessage(sendMessage.openArtifact(changeName, activeTab));
  };

  const handleRefresh = () => {
    contentCacheRef.current.clear();
    postMessage(sendMessage.refresh());
    if (activeTab === 'verifyArchive') {
      postMessage(sendMessage.getInteractiveWorkflowState(changeName));
      return;
    }
    if (activeTab === 'specs') {
      requestSpecsList();
    } else {
      requestArtifact(activeTab);
    }
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
    postMessage(sendMessage.launchWorkflowAction(action, changeName));
  };

  const handleStepClick = (step: WorkflowStep) => {
    const tabSteps: WorkflowStep[] = ['proposal', 'specs', 'design', 'tasks'];
    if (tabSteps.includes(step)) {
      setActiveTab(step as ChangeDetailTabId);
      return;
    }
    if (step === 'verify' || step === 'archive') {
      if (showVerifyArchiveTab || step === 'archive') {
        setActiveTab('verifyArchive');
      }
      return;
    }
    if (step === 'apply' && !isArchived) {
      handleLaunchWorkflow('apply');
    }
  };

  const handleConfirmTaskToggle = () => {
    if (!pendingTaskToggle) return;
    postMessage(sendMessage.toggleTask(changeName, pendingTaskToggle.taskIndex));
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
        </div>
        <div className="flex flex-wrap gap-1">
          <IconButton icon="go-to-file" label={t('action.openInEditor')} onClick={handleOpenInEditor} />
          <IconButton icon="refresh" label={t('action.refresh')} onClick={handleRefresh} />
        </div>
      </div>

      <WorkflowStepIndicator
        steps={workflowState.steps}
        onStepClick={handleStepClick}
        isArchived={isArchived}
      />

      <ActionBar
        changeName={changeName}
        isArchived={isArchived}
        workflowState={workflowState}
        workflowLaunchConfig={workflowLaunchConfig}
        onAction={(action) => handleLaunchWorkflow(action)}
        onCopyFf={(name) =>
          postMessage(sendMessage.copyToClipboard(buildWorkflowCommand({ action: 'ff', changeName: name, target: 'clipboard' })))
        }
        onCopyApply={(name) =>
          postMessage(sendMessage.copyToClipboard(buildWorkflowCommand({ action: 'apply', changeName: name, target: 'clipboard' })))
        }
      />

      <div className="flex border-b gap-1 px-3" style={{ borderColor: 'var(--vscode-panel-border)' }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className="px-3 py-2 text-xs font-medium cursor-pointer border-b-2 -mb-px"
            style={{
              borderColor: activeTab === tab.id ? 'var(--vscode-focusBorder)' : 'transparent',
              color: activeTab === tab.id ? 'var(--vscode-foreground)' : 'var(--vscode-descriptionForeground)',
            }}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
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
              sessions={interactiveState.sessions}
              onRun={(action) => postMessage(sendMessage.runInteractiveWorkflow(changeName, action))}
              onReveal={(action) => postMessage(sendMessage.revealInteractiveWorkflow(changeName, action))}
              onStop={(action) => postMessage(sendMessage.stopInteractiveWorkflow(changeName, action))}
              onClear={(action) => postMessage(sendMessage.clearInteractiveWorkflow(changeName, action))}
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
                postMessage(sendMessage.executeTask(name, taskIndex, taskText));
              }}
            />
          </>
        ) : (
          <ArtifactViewer
            content={content}
            loading={loading}
            error={error}
            errorCode={errorCode}
            onOpenInEditor={() => handleOpenInEditor()}
            onCreateWithAi={isArchived ? undefined : () => handleLaunchWorkflow('continue')}
            onContinue={isArchived ? undefined : () => handleLaunchWorkflow('continue')}
            onExplore={
              !isArchived && activeTab === 'proposal' && !(existingArtifactIds?.includes('proposal'))
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
