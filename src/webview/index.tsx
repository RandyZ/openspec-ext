import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { App } from './App';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
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

const root = ReactDOM.createRoot(document.getElementById('root')!);

root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
