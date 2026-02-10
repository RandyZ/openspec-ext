import React, { useEffect, useState } from 'react';
import { useVscode } from '../hooks/useVscode';
import { sendMessage } from '../types/messages';
import { ArtifactViewer } from './ArtifactViewer';

const TABS = [
  { id: 'proposal' as const, label: 'Proposal' },
  { id: 'specs' as const, label: 'Specs' },
  { id: 'design' as const, label: 'Design' },
  { id: 'tasks' as const, label: 'Tasks' },
];

export interface ChangeDetailProps {
  changeName: string;
}

export const ChangeDetail: React.FC<ChangeDetailProps> = ({ changeName }) => {
  const { postMessage, onMessage } = useVscode();
  const [activeTab, setActiveTab] = useState<'proposal' | 'specs' | 'design' | 'tasks'>('proposal');
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | undefined>(undefined);
  const [deltaSpecIds, setDeltaSpecIds] = useState<string[]>([]);
  const [selectedSpecId, setSelectedSpecId] = useState<string | null>(null);

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
    if (activeTab === 'specs') {
      requestSpecsList();
    } else {
      requestArtifact(activeTab);
    }
  }, [changeName, activeTab]);

  useEffect(() => {
    const cleanup = onMessage((event: MessageEvent) => {
      const msg = event.data;
      if (msg.type === 'artifactContent' && msg.changeName === changeName) {
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
        setContent(msg.content ?? '');
        setLoading(false);
        setError(null);
      } else if (msg.type === 'deltaSpecContentError' && msg.changeName === changeName) {
        setError(msg.message ?? 'Failed to load spec');
        setLoading(false);
        setContent(null);
      }
    });
    return cleanup;
  }, [changeName, onMessage, postMessage]);

  useEffect(() => {
    if (activeTab === 'specs' && selectedSpecId) {
      setLoading(true);
      setError(null);
      postMessage(sendMessage.getDeltaSpecContent(changeName, selectedSpecId));
    }
  }, [activeTab, selectedSpecId]);

  const handleShowInSidebar = () => {
    postMessage(sendMessage.revealSidebar());
  };

  const handleOpenInEditor = () => {
    if (activeTab === 'specs' && selectedSpecId) {
      const specPath = changeName.startsWith('archive:')
        ? `openspec/changes/archive/${changeName.slice(8)}/specs/${selectedSpecId}/spec.md`
        : `openspec/changes/${changeName}/specs/${selectedSpecId}/spec.md`;
      postMessage(sendMessage.openSpec(specPath));
    } else {
      postMessage(sendMessage.openArtifact(changeName, activeTab));
    }
  };

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
        <button
          type="button"
          className="px-2 py-1 text-xs rounded cursor-pointer ml-auto"
          style={{
            background: 'var(--vscode-button-secondaryBackground)',
            color: 'var(--vscode-button-secondaryForeground)',
          }}
          onClick={handleOpenInEditor}
        >
          Open in Editor
        </button>
      </div>

      <div className="flex border-b gap-1 px-2" style={{ borderColor: 'var(--vscode-panel-border)' }}>
        {TABS.map((tab) => (
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
        <ArtifactViewer
          content={content}
          loading={loading}
          error={error}
          errorCode={errorCode}
          onOpenInEditor={handleOpenInEditor}
        />
      </div>
    </div>
  );
};
