import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as vscode from 'vscode';
import { launchWorkflowAgentCommand } from '@extension/services/workflowAgentLaunch';

const launchAgentPanelPrompt = vi.hoisted(() => vi.fn());

vi.mock('@extension/services/agentPanelLauncher', () => ({
  launchAgentPanelPrompt,
}));

vi.mock('@extension/adapters', () => ({
  getCurrentAdapter: vi.fn(async () => ({ id: 'cursor', displayName: 'Cursor', fillChat: vi.fn(), executeTask: vi.fn(), isAvailable: vi.fn() })),
  getAdapterById: vi.fn(),
}));

vi.mock('vscode', () => ({
  env: { clipboard: { writeText: vi.fn() } },
  window: { showInformationMessage: vi.fn() },
  workspace: {
    getConfiguration: vi.fn(() => ({
      get: vi.fn((key: string) => {
        if (key === 'agentAutoSubmit') return 'readOnly';
        if (key === 'workflowLaunchMode') return 'adapter';
        if (key === 'preferredAgentAdapter') return 'cursor';
        if (key === 'cursorLaunchMode') return 'agentPanel';
        if (key === 'cursorAgentModel') return 'auto';
        return undefined;
      }),
      inspect: vi.fn(() => undefined),
    })),
  },
}));

describe('launchWorkflowAgentCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(vscode.env.appName as unknown as string);
    Object.defineProperty(vscode.env, 'appName', { value: 'Cursor', configurable: true });
    launchAgentPanelPrompt.mockResolvedValue({
      success: true,
      layer: 'composerCreateNew',
      outcome: 'started',
    });
  });

  it('auto-submits read-only verify actions through composer layer', async () => {
    const result = await launchWorkflowAgentCommand({
      action: 'verify',
      changeName: 'demo-change',
      workspaceRoot: '/workspace',
    });

    expect(launchAgentPanelPrompt).toHaveBeenCalledWith({
      text: '/opsx-verify demo-change',
      autoSubmit: true,
    });
    expect(result.target).toBe('agentPanel');
  });

  it('does not auto-submit apply actions in readOnly mode', async () => {
    await launchWorkflowAgentCommand({
      action: 'apply',
      changeName: 'demo-change',
      workspaceRoot: '/workspace',
    });

    expect(launchAgentPanelPrompt).toHaveBeenCalledWith({
      text: '/opsx-apply demo-change',
      autoSubmit: false,
    });
  });
});
