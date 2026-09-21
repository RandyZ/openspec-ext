import { describe, expect, it, vi, beforeEach } from 'vitest';
import * as vscode from 'vscode';
import { createExecutorLaunchPresentation } from '@extension/services/executorLaunchPresentation';

vi.mock('@extension/services/workflowLaunchConfig', () => ({
  getWorkflowLaunchConfig: vi.fn(() => ({
    workflowLaunchMode: 'adapter',
    preferredAgentAdapter: 'cursor',
    cursorLaunchMode: 'deeplink',
    cursorAgentModel: 'auto',
    cursorLaunchModeExplicit: true,
  })),
}));

describe('createExecutorLaunchPresentation', () => {
  beforeEach(() => {
    vi.stubGlobal('vscode', {
      ...vscode,
      env: { appName: 'Visual Studio Code' },
    });
  });

  it('returns copy-only ui config when only clipboard adapter is available', async () => {
    const dataManager = {
      getAgentAdaptersInfo: vi.fn().mockResolvedValue({
        available: [{ id: 'clipboard', displayName: 'Clipboard (copy to clipboard)' }],
        currentId: 'clipboard',
      }),
    };

    const presentation = await createExecutorLaunchPresentation(dataManager as any);

    expect(presentation.agentAdapters.currentId).toBe('clipboard');
    expect(presentation.uiWorkflowLaunchConfig.effectiveAdapterId).toBe('clipboard');
    expect(presentation.uiWorkflowLaunchConfig.workflowLaunchMode).toBe('clipboard');
  });
});
