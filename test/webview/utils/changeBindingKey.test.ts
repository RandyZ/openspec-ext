import { describe, expect, it } from 'vitest';
import { getWorkflowBindingKey } from '../../../src/shared/changeWorkflow';
import { resolveChangeBindingKey } from '../../../src/webview/utils/changeBindingKey';
import type { ChangeInfo } from '../../../src/webview/types/messages';

describe('resolveChangeBindingKey', () => {
  const projectBinding = {
    projectId: 'ws2',
    commandCwd: '/fixtures/ws2',
    rootPath: '/fixtures/ws2',
    rootSource: 'declared' as const,
  };

  it('prefers workflowSnapshot.bindingKey when present', () => {
    const change = {
      name: 'gamma',
      workflowSnapshot: { bindingKey: 'snapshot-key' },
    } as ChangeInfo;
    expect(resolveChangeBindingKey(change, projectBinding)).toBe('snapshot-key');
  });

  it('derives binding key from projectBinding when snapshot is absent', () => {
    const change = { name: 'gamma' } as ChangeInfo;
    expect(resolveChangeBindingKey(change, projectBinding)).toBe(getWorkflowBindingKey(projectBinding));
  });
});
