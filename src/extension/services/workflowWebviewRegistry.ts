import type * as vscode from 'vscode';
import type { WorkflowActionReceipt } from '../../shared/changeWorkflow';

const webviews = new Set<vscode.Webview>();

export function registerWorkflowReceiptWebview(webview: vscode.Webview): vscode.Disposable {
  webviews.add(webview);
  return {
    dispose: () => {
      webviews.delete(webview);
    },
  };
}

export function broadcastWorkflowActionReceipt(
  receipt: WorkflowActionReceipt,
  except?: vscode.Webview,
): void {
  for (const webview of webviews) {
    if (webview === except) continue;
    try {
      webview.postMessage({ type: 'workflowActionReceipt', ...receipt });
    } catch {
      // Panel may be disposed.
    }
  }
}

export function resetWorkflowReceiptWebviewsForTests(): void {
  webviews.clear();
}
