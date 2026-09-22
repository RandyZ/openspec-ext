import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { App } from './App';
import { createAgentUnavailableInitialState } from './context/AppContext';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { readInlineWebviewBootstrap, readWebviewBootstrap } from '../shared/webviewBootstrap';
import {
  WEBVIEW_EXECUTOR_ADAPTERS_MARKER,
  WEBVIEW_EXECUTOR_FN_MARKER,
  WEBVIEW_EXECUTOR_NORMALIZE_MARKER,
  WEBVIEW_EXECUTOR_RESOLVE_MARKER,
  WEBVIEW_EXECUTOR_UI_BUILD_MARKER,
} from './utils/executorUiLaunchConfig';

// Keep executor UI markers in the webview bundle for VSIX verification.
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
const initialState = bootstrap?.view === 'agentUnavailable'
  ? createAgentUnavailableInitialState(bootstrap.workspacePath)
  : undefined;

const root = ReactDOM.createRoot(rootElement);

root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App initialState={initialState} />
    </ErrorBoundary>
  </React.StrictMode>
);

try {
  window.acquireVsCodeApi().postMessage({ type: 'webviewReady' });
} catch {
  // Standalone webview dev server has no VS Code API.
}
