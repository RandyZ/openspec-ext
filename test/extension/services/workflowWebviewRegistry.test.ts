import { describe, expect, it, vi } from 'vitest';
import {
  broadcastWorkflowActionReceipt,
  registerWorkflowReceiptWebview,
  resetWorkflowReceiptWebviewsForTests,
} from '@extension/services/workflowWebviewRegistry';

describe('workflowWebviewRegistry', () => {
  it('broadcasts workflow receipts to every registered webview', () => {
    resetWorkflowReceiptWebviewsForTests();
    const a = { postMessage: vi.fn() };
    const b = { postMessage: vi.fn() };
    registerWorkflowReceiptWebview(a as never);
    registerWorkflowReceiptWebview(b as never);

    broadcastWorkflowActionReceipt({
      requestId: 'r1',
      changeName: 'demo',
      bindingKey: 'bk',
      action: 'apply',
      target: 'cursor',
      status: 'delivered',
    });

    expect(a.postMessage).toHaveBeenCalledTimes(1);
    expect(b.postMessage).toHaveBeenCalledTimes(1);
  });
});
