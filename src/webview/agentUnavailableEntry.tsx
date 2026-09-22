import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { AgentUnavailableCard } from './components/AgentUnavailableCard';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { setLocale } from '../i18n';
import type { WebviewBootstrap } from '../shared/webviewBootstrap';
import { getVsCodeApi } from './hooks/useVscode';

export function AgentUnavailableRoot({ workspacePath }: { workspacePath?: string }) {
  useEffect(() => {
    const lang = document.documentElement.lang || navigator.language || 'en';
    setLocale(lang);
  }, []);

  return <AgentUnavailableCard workspacePath={workspacePath} />;
}

export function mountAgentUnavailableApp(
  rootElement: HTMLElement,
  bootstrap: WebviewBootstrap,
): void {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <ErrorBoundary>
        <AgentUnavailableRoot workspacePath={bootstrap.workspacePath} />
      </ErrorBoundary>
    </React.StrictMode>,
  );

  try {
    getVsCodeApi().postMessage({ type: 'webviewReady' });
  } catch {
    // Standalone dev server.
  }
}
