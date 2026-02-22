import React, { useEffect, useState } from 'react';
import { AppProvider, useAppState } from './context/AppContext';
import { useVscode } from './hooks/useVscode';
import { Dashboard } from './components/Dashboard';
import { ChangeDetail } from './components/ChangeDetail';

function idsEqual(a: string[] | undefined, b: string[] | undefined): boolean {
  if (a === b) return true;
  if (!a || !b) return !a && !b;
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((id, i) => id === sb[i]);
}

function AppContent() {
  const { state, dispatch } = useAppState();
  const { onMessage } = useVscode();
  const [panelChangeName, setPanelChangeName] = useState<string | null>(null);
  const [existingArtifactIds, setExistingArtifactIds] = useState<string[] | undefined>(undefined);

  useEffect(() => {
    const cleanup = onMessage((event: MessageEvent) => {
      const msg = event.data;
      if (msg.type === 'setContext' && msg.view === 'changeDetail' && msg.changeName) {
        setPanelChangeName(msg.changeName);
        setExistingArtifactIds((prev) => {
          const next = msg.existingArtifactIds as string[] | undefined;
          if (idsEqual(prev, next)) return prev;
          return next;
        });
        dispatch({ type: 'SELECT_CHANGE', payload: msg.changeName });
        if (msg.debug !== undefined) {
          dispatch({ type: 'SET_DEBUG', payload: msg.debug });
        }
      }
    });
    return cleanup;
  }, [onMessage, dispatch]);

  if (panelChangeName) {
    return (
      <ChangeDetail
        changeName={panelChangeName}
        existingArtifactIds={existingArtifactIds}
        debug={state.debug}
      />
    );
  }
  if (state.selectedChange) {
    return <ChangeDetail changeName={state.selectedChange} debug={state.debug} />;
  }
  return <Dashboard />;
}

export const App: React.FC = () => {
  return (
    <AppProvider>
      <div className="app">
        <AppContent />
      </div>
    </AppProvider>
  );
};
