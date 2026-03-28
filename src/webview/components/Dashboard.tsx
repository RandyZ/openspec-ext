import React, { useEffect, useState } from 'react';
import { useVscode } from '../hooks/useVscode';
import { useAppState } from '../context/AppContext';
import { sendMessage } from '../types/messages';
import type { ArchivedChangeInfo, SpecInfo } from '../types/messages';
import { Header } from './Header';
import { ChangesSection } from './ChangesSection';
import { SpecsSection } from './SpecsSection';
import { MarkdownRenderer } from './MarkdownRenderer';
import { t } from '../../i18n';

export const Dashboard: React.FC = () => {
  const { postMessage, onMessage } = useVscode();
  const { state, dispatch } = useAppState();
  const [archivedExpanded, setArchivedExpanded] = useState(false);
  const [archivedItems, setArchivedItems] = useState<ArchivedChangeInfo[]>([]);
  const [archivedLoading, setArchivedLoading] = useState(false);
  const [selectedSpec, setSelectedSpec] = useState<SpecInfo | null>(null);
  const [specContent, setSpecContent] = useState<string | null>(null);
  const [specLoading, setSpecLoading] = useState(false);

  useEffect(() => {
    // Listen for messages from extension
    const cleanup = onMessage((event: MessageEvent) => {
      const message = event.data;

      if (message.type === 'dashboardData') {
        dispatch({ type: 'SET_DATA', payload: message.data });
        if (message.debug !== undefined) {
          dispatch({ type: 'SET_DEBUG', payload: message.debug });
        }
      } else if (message.type === 'error') {
        dispatch({ type: 'SET_ERROR', payload: message.message });
      } else if (message.type === 'specContent') {
        setSpecContent(message.content ?? '');
        setSpecLoading(false);
      } else if (message.type === 'specContentError') {
        setSpecContent(null);
        setSpecLoading(false);
      } else if (message.type === 'archivedChanges') {
        setArchivedItems(message.items ?? []);
        setArchivedLoading(false);
      }
    });

    // Request initial data
    dispatch({ type: 'SET_LOADING', payload: true });
    postMessage(sendMessage.getDashboardData());

    return cleanup;
  }, [postMessage, onMessage, dispatch]);

  const handleArchivedToggle = () => {
    const next = !archivedExpanded;
    setArchivedExpanded(next);
    if (next) {
      setArchivedLoading(true);
      postMessage(sendMessage.getArchivedChanges());
    }
  };

  const handleOpenArchivedChange = (directoryName: string) => {
    postMessage(sendMessage.openChangeDetailInEditor(`archive:${directoryName}`));
  };

  const handleRefresh = () => {
    dispatch({ type: 'SET_LOADING', payload: true });
    postMessage(sendMessage.refresh());
  };

  const handleOpenChange = (changeName: string) => {
    postMessage(sendMessage.openChangeDetailInEditor(changeName));
  };

  const handleRequestNewChange = () => {
    postMessage(sendMessage.requestNewChange());
  };

  const handleCopyFf = (changeName: string) => {
    postMessage(sendMessage.copyToClipboard(`/opsx:ff ${changeName}`));
  };

  const handleCopyApply = (changeName: string) => {
    postMessage(sendMessage.copyToClipboard(`/opsx:apply ${changeName}`));
  };

  const handleArchive = (changeName: string) => {
    postMessage(sendMessage.archiveChange(changeName));
  };

  const handleFillChat = (command: string) => {
    postMessage(sendMessage.fillChat(command));
  };

  const handleOpenSpec = (spec: SpecInfo) => {
    setSelectedSpec(spec);
    setSpecContent(null);
    setSpecLoading(true);
    postMessage(sendMessage.getSpecContent(spec.id));
  };

  const handleBackFromSpec = () => {
    setSelectedSpec(null);
    setSpecContent(null);
  };

  const { data, loading, error } = state;

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

        {selectedSpec ? (
          <div>
            <button
              type="button"
              className="flex items-center gap-1 mb-3 px-2 py-1 text-xs rounded cursor-pointer border-none"
              style={{
                background: 'var(--vscode-button-secondaryBackground)',
                color: 'var(--vscode-button-secondaryForeground)',
              }}
              onClick={handleBackFromSpec}
            >
              ← Back
            </button>
            <h2 className="text-base font-semibold mb-1" style={{ color: 'var(--vscode-foreground)' }}>
              {selectedSpec.id}
            </h2>
            <div className="text-xs mb-3" style={{ color: 'var(--vscode-descriptionForeground)' }}>
              {t('spec.requirements', { count: selectedSpec.requirementCount })}
            </div>
            {specLoading ? (
              <div className="text-xs py-4" style={{ color: 'var(--vscode-descriptionForeground)' }}>
                {t('loading')}
              </div>
            ) : specContent ? (
              <div className="overflow-auto">
                <MarkdownRenderer content={specContent} />
              </div>
            ) : (
              <div className="text-xs py-4" style={{ color: 'var(--vscode-descriptionForeground)' }}>
                {t('noContent')}
              </div>
            )}
          </div>
        ) : data ? (
          <>
            <ChangesSection
              changes={data.changes}
              onOpenChange={handleOpenChange}
              onRequestNewChange={handleRequestNewChange}
              onCopyFf={handleCopyFf}
              onCopyApply={handleCopyApply}
              onArchive={handleArchive}
              onFillChat={handleFillChat}
              archivedExpanded={archivedExpanded}
              onArchivedToggle={handleArchivedToggle}
              archivedItems={archivedItems}
              archivedLoading={archivedLoading}
              onOpenArchivedChange={handleOpenArchivedChange}
            />
            <SpecsSection specs={data.specs} onOpenSpec={handleOpenSpec} />
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
