import React, { useEffect, useState } from 'react';
import { AppProvider, useAppState, type AppState } from './context/AppContext';
import { useVscode } from './hooks/useVscode';
import { Dashboard } from './components/Dashboard';
import { ChangeDetail } from './components/ChangeDetail';
import { SpecViewer } from './components/SpecViewer';
import { ChangesExplorer } from './components/ChangesExplorer';
import { SpecsExplorer } from './components/SpecsExplorer';
import { setLocale } from '../i18n';
import type { ChangeDetailTabId, InteractiveWorkflowAction } from '../shared/interactiveWorkflow';
import { isProjectPageContext } from './types/messages';

export type AppMessageRoute =
  | 'sidebar'
  | 'changesExplorer'
  | 'specsExplorer'
  | 'changeDetail'
  | 'specContent'
  | 'unknown';

export function resolveAppMessageRoute(message: unknown): AppMessageRoute {
  if (isProjectPageContext(message)) {
    return message.view;
  }
  if (!message || typeof message !== 'object') {
    return 'unknown';
  }
  const candidate = message as { type?: unknown; view?: unknown; changeName?: unknown; specId?: unknown };
  if (candidate.type === 'setContext' && candidate.view === 'changeDetail' && typeof candidate.changeName === 'string' && candidate.changeName.length > 0) {
    return 'changeDetail';
  }
  if (candidate.type === 'specContent' && typeof candidate.specId === 'string' && candidate.specId.length > 0) {
    return 'specContent';
  }
  return 'unknown';
}

function idsEqual(a: string[] | undefined, b: string[] | undefined): boolean {
  if (a === b) return true;
  if (!a || !b) return !a && !b;
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((id, i) => id === sb[i]);
}

function initWebviewLocale() {
  const lang = document.documentElement.lang || navigator.language || 'en';
  setLocale(lang);
}

function AppContent() {
  const { state, dispatch } = useAppState();
  const { onMessage } = useVscode();
  const [panelChangeName, setPanelChangeName] = useState<string | null>(null);
  const [existingArtifactIds, setExistingArtifactIds] = useState<string[] | undefined>(undefined);
  const [initialTab, setInitialTab] = useState<ChangeDetailTabId | undefined>(undefined);
  const [interactiveAction, setInteractiveAction] = useState<InteractiveWorkflowAction | undefined>(undefined);
  const [panelScopeId, setPanelScopeId] = useState<string | undefined>(undefined);
  const [panelSpecId, setPanelSpecId] = useState<string | null>(null);
  const [panelSpecContent, setPanelSpecContent] = useState<string | null>(null);

  useEffect(() => { initWebviewLocale(); }, []);

  useEffect(() => {
    const cleanup = onMessage((event: MessageEvent) => {
      const msg = event.data;
      if (!msg || typeof msg !== 'object') {
        dispatch({ type: 'CLEAR_PAGE_CONTEXT' });
        return;
      }
      const route = resolveAppMessageRoute(msg);
      if (route === 'changeDetail') {
        setPanelChangeName(msg.changeName);
        setPanelSpecId(null);
        setInitialTab(msg.initialTab);
        // Bind the panel to the scope it was opened under so store-scoped changes don't
        // cross-resolve with a same-named change in another root.
        setPanelScopeId(msg.scope?.id);
        if (msg.interactiveAction) {
          setInteractiveAction(undefined);
          setTimeout(() => setInteractiveAction(msg.interactiveAction), 0);
        } else {
          setInteractiveAction(undefined);
        }
        setExistingArtifactIds((prev) => {
          const next = msg.existingArtifactIds as string[] | undefined;
          if (idsEqual(prev, next)) return prev;
          return next;
        });
        dispatch({ type: 'SELECT_CHANGE', payload: msg.changeName });
        if (msg.debug !== undefined) {
          dispatch({ type: 'SET_DEBUG', payload: msg.debug });
        }
      } else if (
        (route === 'sidebar' || route === 'changesExplorer' || route === 'specsExplorer')
        && isProjectPageContext(msg)
      ) {
        setPanelChangeName(null);
        setPanelSpecId(null);
        setPanelSpecContent(null);
        setInitialTab(undefined);
        setInteractiveAction(undefined);
        setPanelScopeId(undefined);
        dispatch({ type: 'SET_PAGE_CONTEXT', payload: msg });
      } else if (msg.type === 'setContext') {
        setPanelChangeName(null);
        setPanelSpecId(null);
        setPanelSpecContent(null);
        dispatch({ type: 'CLEAR_PAGE_CONTEXT' });
      } else if (route === 'specContent' && !panelChangeName) {
        setPanelSpecId(msg.specId);
        setPanelSpecContent(msg.content ?? '');
      }
    });
    return cleanup;
  }, [onMessage, dispatch, panelChangeName]);

  if (panelChangeName) {
    return (
        <ChangeDetail
          changeName={panelChangeName}
          existingArtifactIds={existingArtifactIds}
          debug={state.debug}
          initialTab={initialTab}
          interactiveAction={interactiveAction}
          scopeId={panelScopeId}
        />
      );
  }
  if (panelSpecId) {
    return <SpecViewer specId={panelSpecId} initialContent={panelSpecContent ?? undefined} />;
  }
  if (state.selectedChange) {
    return <ChangeDetail changeName={state.selectedChange} debug={state.debug} />;
  }

  switch (state.page) {
    case 'changesExplorer':
      return state.changesExplorer ? <ChangesExplorer data={state.changesExplorer} /> : <Dashboard />;
    case 'specsExplorer':
      return state.specsExplorer ? <SpecsExplorer data={state.specsExplorer} /> : <Dashboard />;
    case 'sidebar':
    case 'dashboard':
    case 'loading':
    default:
      return <Dashboard />;
  }
}

export interface AppProps {
  initialState?: AppState;
}

export const App: React.FC<AppProps> = ({ initialState }) => {
  return (
    <AppProvider initialState={initialState}>
      <div className="app">
        <AppContent />
      </div>
    </AppProvider>
  );
};
