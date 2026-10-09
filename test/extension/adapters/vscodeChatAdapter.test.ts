import { describe, expect, it, vi, beforeEach } from 'vitest';
import * as vscode from 'vscode';
import { vscodeChatAdapter } from '@extension/adapters/vscode-chat-adapter';

const launchAgentPanelPrompt = vi.hoisted(() => vi.fn());

vi.mock('@extension/services/agentPanelLauncher', () => ({
  launchAgentPanelPrompt,
}));

vi.mock('vscode', () => ({
  env: {
    appName: 'Visual Studio Code',
    clipboard: { writeText: vi.fn() },
  },
  window: {
    showInformationMessage: vi.fn(),
  },
  commands: {
    executeCommand: vi.fn(async () => undefined),
  },
}));

describe('vscodeChatAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    launchAgentPanelPrompt.mockResolvedValue({
      success: true,
      layer: 'vscodeChat',
      outcome: 'prefilled',
    });
  });

  it('is available on VS Code hosts', async () => {
    await expect(vscodeChatAdapter.isAvailable()).resolves.toBe(true);
  });

  it('opens chat with the task prompt', async () => {
    const result = await vscodeChatAdapter.fillChat({
      changeName: 'demo',
      taskIndex: 0,
      taskText: 'Do thing',
    });

    expect(launchAgentPanelPrompt).toHaveBeenCalledWith({
      text: '/opsx:apply demo',
      autoSubmit: false,
    });
    expect(result.adapterId).toBe('vscode-chat');
  });
});
