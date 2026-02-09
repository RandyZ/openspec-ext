import { useEffect, useState, useCallback } from 'react';

// Declare VSCode API type
declare global {
  interface Window {
    acquireVsCodeApi: () => VsCodeApi;
  }
}

interface VsCodeApi {
  postMessage(message: any): void;
  getState(): any;
  setState(state: any): void;
}

let vscodeApi: VsCodeApi | undefined;

/**
 * Get or initialize VSCode API
 */
function getVsCodeApi(): VsCodeApi {
  if (!vscodeApi) {
    vscodeApi = window.acquireVsCodeApi();
  }
  return vscodeApi;
}

/**
 * Hook for VSCode API integration
 */
export function useVscode() {
  const [api] = useState(() => getVsCodeApi());

  /**
   * Send message to extension
   */
  const postMessage = useCallback((message: any) => {
    api.postMessage(message);
  }, [api]);

  /**
   * Listen for messages from extension
   */
  const onMessage = useCallback((handler: (event: MessageEvent) => void) => {
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  return {
    postMessage,
    onMessage,
    getState: () => api.getState(),
    setState: (state: any) => api.setState(state),
  };
}

/**
 * Hook for listening to specific message types
 */
export function useVscodeMessage<T = any>(
  type: string,
  handler: (data: T) => void
) {
  const { onMessage } = useVscode();

  useEffect(() => {
    const cleanup = onMessage((event: MessageEvent) => {
      const message = event.data;
      if (message.type === type) {
        handler(message.data);
      }
    });

    return cleanup;
  }, [type, handler, onMessage]);
}
