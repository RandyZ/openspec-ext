import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as vscode from 'vscode';
import {
  launchWorkflowAgentCommand,
  resetWorkflowLaunchDedupeForTests,
} from '@extension/services/workflowAgentLaunch';

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
    resetWorkflowLaunchDedupeForTests();
    vi.mocked(vscode.env.appName as unknown as string);
    Object.defineProperty(vscode.env, 'appName', { value: 'Cursor', configurable: true });
    vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
      get: vi.fn((key: string) => {
        if (key === 'agentAutoSubmit') return 'readOnly';
        if (key === 'workflowLaunchMode') return 'adapter';
        if (key === 'preferredAgentAdapter') return 'cursor';
        if (key === 'cursorLaunchMode') return 'agentPanel';
        if (key === 'cursorAgentModel') return 'auto';
        return undefined;
      }),
      inspect: vi.fn(() => undefined),
    } as ReturnType<typeof vscode.workspace.getConfiguration>);
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

  it('does not dedupe a retry after a failed agentCli launch', async () => {
    const { getAdapterById } = await import('@extension/adapters');
    const { cursorAdapter } = await import('@extension/adapters/cursor-adapter');
    const configGet = vi.fn((key: string) => {
      if (key === 'cursorLaunchMode') return 'agentCli';
      if (key === 'workflowLaunchMode') return 'adapter';
      if (key === 'preferredAgentAdapter') return 'cursor';
      if (key === 'agentAutoSubmit') return 'readOnly';
      if (key === 'cursorAgentModel') return 'auto';
      return undefined;
    });
    vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
      get: configGet,
      inspect: vi.fn(() => undefined),
    } as ReturnType<typeof vscode.workspace.getConfiguration>);
    vi.mocked(getAdapterById).mockResolvedValue({
      id: 'cursor',
      displayName: 'Cursor',
      fillChat: vi.fn(),
      executeTask: vi.fn(),
      isAvailable: vi.fn(),
    });
    const executeTask = vi.spyOn(cursorAdapter, 'executeTask')
      .mockResolvedValueOnce({ success: false, adapterId: 'cursor', message: 'spawn agent ENOENT' })
      .mockResolvedValueOnce({ success: false, adapterId: 'cursor', message: 'spawn agent ENOENT' });

    const request = {
      action: 'apply' as const,
      changeName: 'demo-change',
      workspaceRoot: '/workspace',
    };
    await launchWorkflowAgentCommand(request);
    await launchWorkflowAgentCommand(request);

    expect(executeTask).toHaveBeenCalledTimes(2);
    executeTask.mockRestore();
    vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
      get: vi.fn((key: string) => {
        if (key === 'agentAutoSubmit') return 'readOnly';
        if (key === 'workflowLaunchMode') return 'adapter';
        if (key === 'preferredAgentAdapter') return 'cursor';
        if (key === 'cursorLaunchMode') return 'agentPanel';
        if (key === 'cursorAgentModel') return 'auto';
        return undefined;
      }),
      inspect: vi.fn(() => undefined),
    } as ReturnType<typeof vscode.workspace.getConfiguration>);
  });

  it('does not dedupe rapid repeat cursorLaunchMode=clipboard copies', async () => {
    vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
      get: vi.fn((key: string) => {
        if (key === 'agentAutoSubmit') return 'readOnly';
        if (key === 'workflowLaunchMode') return 'adapter';
        if (key === 'preferredAgentAdapter') return 'cursor';
        if (key === 'cursorLaunchMode') return 'clipboard';
        if (key === 'cursorAgentModel') return 'auto';
        return undefined;
      }),
      inspect: vi.fn((key: string) => (
        key === 'cursorLaunchMode' ? { globalValue: 'clipboard' } : undefined
      )),
    } as ReturnType<typeof vscode.workspace.getConfiguration>);

    const request = {
      action: 'verify' as const,
      changeName: 'demo-change',
      workspaceRoot: '/workspace',
    };
    await launchWorkflowAgentCommand(request);
    await launchWorkflowAgentCommand(request);

    expect(vscode.env.clipboard.writeText).toHaveBeenCalledTimes(2);
    expect(launchAgentPanelPrompt).not.toHaveBeenCalled();
  });

  it('does not dedupe rapid repeat copy-only launches', async () => {
    vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
      get: vi.fn((key: string) => {
        if (key === 'agentAutoSubmit') return 'readOnly';
        if (key === 'workflowLaunchMode') return 'clipboard';
        if (key === 'preferredAgentAdapter') return 'clipboard';
        if (key === 'cursorLaunchMode') return 'clipboard';
        if (key === 'cursorAgentModel') return 'auto';
        return undefined;
      }),
      inspect: vi.fn((key: string) => (
        key === 'workflowLaunchMode' || key === 'preferredAgentAdapter'
          ? { globalValue: 'clipboard' }
          : undefined
      )),
    } as ReturnType<typeof vscode.workspace.getConfiguration>);

    const request = {
      action: 'apply' as const,
      changeName: 'demo-change',
      workspaceRoot: '/workspace',
    };
    await launchWorkflowAgentCommand(request);
    await launchWorkflowAgentCommand(request);

    expect(vscode.env.clipboard.writeText).toHaveBeenCalledTimes(2);
    expect(launchAgentPanelPrompt).not.toHaveBeenCalled();
  });

  it('dedupes rapid repeat launches for the same change and action', async () => {
    const request = {
      action: 'verify' as const,
      changeName: 'demo-change',
      workspaceRoot: '/workspace',
    };
    await launchWorkflowAgentCommand(request);
    await launchWorkflowAgentCommand(request);

    expect(launchAgentPanelPrompt).toHaveBeenCalledTimes(1);
  });
});
