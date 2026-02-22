import React, { useEffect, useRef, useState } from 'react';
import { useVscode } from '../hooks/useVscode';
import { sendMessage } from '../types/messages';
import { ActionBar } from './ActionBar';
import { ArtifactViewer } from './ArtifactViewer';
import { TaskList } from './TaskList';

const MISSING_ARTIFACT_MESSAGE =
  '该内容尚未创建或文件已丢失。可使用 /opsx:continue 生成对应 artifact，或在编辑器中打开 change 目录查看。';

export interface ChangeDetailProps {
  changeName: string;
  existingArtifactIds?: string[];
  debug?: boolean;
}

const TABS_WITH_VERIFY = [
  { id: 'proposal' as const, label: 'Proposal' },
  { id: 'specs' as const, label: 'Specs' },
  { id: 'design' as const, label: 'Design' },
  { id: 'tasks' as const, label: 'Tasks' },
  { id: 'verify' as const, label: 'Verify' },
];

const TABS_WITHOUT_VERIFY = TABS_WITH_VERIFY.filter((t) => t.id !== 'verify');

/** Cache key: artifactType (e.g. proposal, design, tasks) or specs:${specId} */
const cacheKey = (type: string, specId?: string | null) =>
  type === 'specs' && specId ? `specs:${specId}` : type;

export const ChangeDetail: React.FC<ChangeDetailProps> = ({ changeName, existingArtifactIds, debug = false }) => {
  const { postMessage, onMessage } = useVscode();
  const tabs = debug ? TABS_WITH_VERIFY : TABS_WITHOUT_VERIFY;
  const [activeTab, setActiveTab] = useState<'proposal' | 'specs' | 'design' | 'tasks' | 'verify'>('proposal');
  const contentCacheRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    if (!debug && activeTab === 'verify') {
      setActiveTab('proposal');
    }
  }, [debug, activeTab]);
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

  const requestDeltaSpec = (specId: string) => {
    setLoading(true);
    setError(null);
    setContent(null);
    postMessage(sendMessage.getDeltaSpecContent(changeName, specId));
  };

  useEffect(() => {
    if (activeTab === 'verify') {
      setLoading(false);
      setError(null);
      setContent(null);
      return;
    }
    const artifactId = activeTab;
    // Archived changes are not in dashboard data, so existingArtifactIds is empty.
    // Never treat archived as "known missing" — always request from extension so backend can read from disk.
    const isArchived = changeName.startsWith('archive:');
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
    } else {
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
    }
  }, [changeName, activeTab, existingArtifactIds]);

  useEffect(() => {
    const cleanup = onMessage((event: MessageEvent) => {
      const msg = event.data;
      if (msg.type === 'artifactContent' && msg.changeName === changeName) {
        const key = cacheKey(msg.artifactType, null);
        contentCacheRef.current.set(key, msg.content ?? '');
        setContent(msg.content ?? '');
        setLoading(false);
        setError(null);
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
      }
    });
    return cleanup;
  }, [changeName, onMessage, postMessage]);

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
  }, [activeTab, changeName]);

  const handleShowInSidebar = () => {
    postMessage(sendMessage.revealSidebar());
  };

  const handleOpenInEditor = () => {
    if (activeTab === 'verify') return;
    if (activeTab === 'specs' && selectedSpecId) {
      postMessage(sendMessage.openDeltaSpec(changeName, selectedSpecId));
    } else {
      postMessage(sendMessage.openArtifact(changeName, activeTab));
    }
  };

  const handleRefresh = () => {
    contentCacheRef.current.clear();
    postMessage(sendMessage.refresh());
    if (activeTab === 'verify') return;
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

  const isArchived = changeName.startsWith('archive:');

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{
        background: 'var(--vscode-editor-background)',
        color: 'var(--vscode-foreground)',
      }}
    >
      <div className="p-3 border-b flex items-center gap-2 flex-wrap" style={{ borderColor: 'var(--vscode-panel-border)' }}>
        <button
          type="button"
          className="px-2 py-1 text-xs rounded cursor-pointer"
          style={{
            background: 'var(--vscode-button-secondaryBackground)',
            color: 'var(--vscode-button-secondaryForeground)',
          }}
          onClick={handleShowInSidebar}
        >
          Show in sidebar
        </button>
        <span className="font-semibold text-sm">
          {changeName.startsWith('archive:') ? `${changeName.slice(8)} (archived)` : changeName}
        </span>
      </div>

      <ActionBar
        changeName={changeName}
        isArchived={isArchived}
        onCopyFf={(name) => postMessage(sendMessage.copyToClipboard(`/opsx-ff ${name}`))}
        onCopyApply={(name) => postMessage(sendMessage.copyToClipboard(`/opsx-apply ${name}`))}
        onOpenInEditor={handleOpenInEditor}
        onArchive={(name) => postMessage(sendMessage.archiveChange(name))}
        onRefresh={handleRefresh}
      />

      <div className="flex border-b gap-1 px-2" style={{ borderColor: 'var(--vscode-panel-border)' }}>
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
        <div className="px-3 py-2 flex items-center gap-2 border-b" style={{ borderColor: 'var(--vscode-panel-border)' }}>
          <span className="text-xs" style={{ color: 'var(--vscode-descriptionForeground)' }}>Spec:</span>
          <select
            className="text-xs rounded px-2 py-1 flex-1 max-w-[200px]"
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

      <div className="p-3 flex-1 overflow-auto">
        {activeTab === 'verify' ? (
          <div className="flex flex-col gap-3 max-w-lg">
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--vscode-descriptionForeground)' }}>
                Command ID
              </label>
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
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--vscode-descriptionForeground)' }}>
                参数 (JSON，可选)
              </label>
              <textarea
                value={verifyArgsJson}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setVerifyArgsJson(e.target.value)}
                placeholder='{"initialPrompt": "hello"}'
                rows={4}
                className="w-full px-2 py-1.5 text-sm rounded font-mono"
                style={{
                  background: 'var(--vscode-input-background)',
                  color: 'var(--vscode-input-foreground)',
                  border: '1px solid var(--vscode-input-border)',
                }}
              />
            </div>
            {!isArchived && (
              <button
                type="button"
                onClick={handleRunCommand}
                className="px-3 py-1.5 text-sm rounded cursor-pointer w-fit"
                style={{
                  background: 'var(--vscode-button-background)',
                  color: 'var(--vscode-button-foreground)',
                }}
              >
                执行
              </button>
            )}
            {runCommandResult !== null && (
              <div
                className="text-sm px-2 py-1.5 rounded"
                style={{
                  background: runCommandResult.success
                    ? 'var(--vscode-editor-inactiveSelectionBackground)'
                    : 'var(--vscode-inputValidation-errorBackground)',
                  color: runCommandResult.success
                    ? 'var(--vscode-foreground)'
                    : 'var(--vscode-errorForeground)',
                }}
              >
                {runCommandResult.success ? 'Command executed.' : runCommandResult.message ?? 'Failed'}
              </div>
            )}
          </div>
        ) : activeTab === 'tasks' && content !== null && !loading && !error ? (
          <>
            {agentAdapters.available.length > 0 && (
              <div className="flex items-center gap-2 mb-3 text-sm">
                <span style={{ color: 'var(--vscode-descriptionForeground)' }}>执行者：</span>
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
                  {agentAdapters.available.map((a) => (
                    <option key={a.id} value={a.id}>{a.displayName}</option>
                  ))}
                </select>
              </div>
            )}
            {isArchived && (
              <p className="text-xs mb-2" style={{ color: 'var(--vscode-descriptionForeground)' }}>
                此 change 已归档，仅可查看
              </p>
            )}
            <TaskList
              content={content}
              changeName={changeName}
              isArchived={isArchived}
              executingTaskIndex={executingTaskIndex}
              executionState={taskExecutionState}
              onToggleTask={(name, taskIndex) =>
                postMessage(sendMessage.toggleTask(name, taskIndex))
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
            onOpenInEditor={handleOpenInEditor}
            onCreateWithAi={isArchived ? undefined : () =>
              postMessage(sendMessage.requestCreateArtifact(changeName, activeTab))
            }
          />
        )}
      </div>
    </div>
  );
};
