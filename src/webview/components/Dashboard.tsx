import React, { useEffect } from 'react';
import { useVscode } from '../hooks/useVscode';
import { useAppState } from '../context/AppContext';
import { sendMessage } from '../types/messages';
import { Header } from './Header';
import { ChangesSection } from './ChangesSection';
import { SpecsSection } from './SpecsSection';

export const Dashboard: React.FC = () => {
  const { postMessage, onMessage } = useVscode();
  const { state, dispatch } = useAppState();

  useEffect(() => {
    // Listen for messages from extension
    const cleanup = onMessage((event: MessageEvent) => {
      const message = event.data;
      
      if (message.type === 'dashboardData') {
        dispatch({ type: 'SET_DATA', payload: message.data });
      } else if (message.type === 'error') {
        dispatch({ type: 'SET_ERROR', payload: message.message });
      }
    });

    // Request initial data
    dispatch({ type: 'SET_LOADING', payload: true });
    postMessage(sendMessage.getDashboardData());

    return cleanup;
  }, [postMessage, onMessage, dispatch]);

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
    postMessage(sendMessage.copyToClipboard(`/opsx-ff ${changeName}`));
  };

  const handleCopyApply = (changeName: string) => {
    postMessage(sendMessage.copyToClipboard(`/opsx-apply ${changeName}`));
  };

  const handleArchive = (changeName: string) => {
    postMessage(sendMessage.archiveChange(changeName));
  };

  const handleOpenSpec = (spec: { id: string; path?: string }) => {
    if (spec.path) {
      postMessage(sendMessage.openSpec(spec.path));
    }
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

        {data ? (
          <>
            <ChangesSection
              changes={data.changes}
              onOpenChange={handleOpenChange}
              onRequestNewChange={handleRequestNewChange}
              onCopyFf={handleCopyFf}
              onCopyApply={handleCopyApply}
              onArchive={handleArchive}
            />
            <SpecsSection specs={data.specs} onOpenSpec={handleOpenSpec} />
          </>
        ) : loading ? (
          <div className="text-xs py-4" style={{ 
            color: 'var(--vscode-descriptionForeground)' 
          }}>
            Loading OpenSpec data...
          </div>
        ) : (
          <div className="text-xs py-4" style={{ 
            color: 'var(--vscode-errorForeground)' 
          }}>
            Failed to load data. Try refreshing.
          </div>
        )}
      </div>
    </div>
  );
};
