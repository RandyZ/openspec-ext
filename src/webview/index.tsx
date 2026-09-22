import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { App } from './App';
import { mountAgentUnavailableApp } from './agentUnavailableEntry';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { getVsCodeApi } from './hooks/useVscode';
import { readInlineWebviewBootstrap, readWebviewBootstrap } from '../shared/webviewBootstrap';
import {
  WEBVIEW_EXECUTOR_ADAPTERS_MARKER,
  WEBVIEW_EXECUTOR_FN_MARKER,
  WEBVIEW_EXECUTOR_NORMALIZE_MARKER,
  WEBVIEW_EXECUTOR_RESOLVE_MARKER,
  WEBVIEW_EXECUTOR_UI_BUILD_MARKER,
} from './utils/executorUiLaunchConfig';

(globalThis as typeof globalThis & {
  __openspecWebviewExecutorMarkers?: readonly string[];
}).__openspecWebviewExecutorMarkers = [
  WEBVIEW_EXECUTOR_UI_BUILD_MARKER,
  WEBVIEW_EXECUTOR_FN_MARKER,
  WEBVIEW_EXECUTOR_NORMALIZE_MARKER,
  WEBVIEW_EXECUTOR_ADAPTERS_MARKER,
  WEBVIEW_EXECUTOR_RESOLVE_MARKER,
  'executorUiLaunchConfig',
  'executorLaunchPresentation',
  'data-executor-ui-ready',
];

const rootElement = document.getElementById('root')!;
const bootstrap = readWebviewBootstrap(rootElement) ?? readInlineWebviewBootstrap();

if (bootstrap?.view === 'agentUnavailable') {
  mountAgentUnavailableApp(rootElement, bootstrap);
} else {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>,
  );

  try {
    getVsCodeApi().postMessage({ type: 'webviewReady' });
  } catch {
    // Standalone webview dev server has no VS Code API.
  }
}
