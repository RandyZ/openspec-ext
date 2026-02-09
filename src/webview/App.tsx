import React, { useEffect } from 'react';
import { AppProvider, useAppState } from './context/AppContext';
import { useVscode } from './hooks/useVscode';
import { Dashboard } from './components/Dashboard';
import { ChangeDetail } from './components/ChangeDetail';

function AppContent() {
  const { state, dispatch } = useAppState();
  const { onMessage } = useVscode();

  useEffect(() => {
    const cleanup = onMessage((event: MessageEvent) => {
      const msg = event.data;
      if (msg.type === 'setContext' && msg.view === 'changeDetail' && msg.changeName) {
        dispatch({ type: 'SELECT_CHANGE', payload: msg.changeName });
      }
    });
    return cleanup;
  }, [onMessage, dispatch]);

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
