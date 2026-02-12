import React, { useEffect, useState } from 'react';
import { AppProvider, useAppState } from './context/AppContext';
import { useVscode } from './hooks/useVscode';
import { Dashboard } from './components/Dashboard';
import { ChangeDetail } from './components/ChangeDetail';

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
        setExistingArtifactIds(msg.existingArtifactIds);
        dispatch({ type: 'SELECT_CHANGE', payload: msg.changeName });
      }
    });
    return cleanup;
  }, [onMessage, dispatch]);

  if (panelChangeName) {
    return <ChangeDetail changeName={panelChangeName} existingArtifactIds={existingArtifactIds} />;
  }
  if (state.selectedChange) {
    return <ChangeDetail changeName={state.selectedChange} />;
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
