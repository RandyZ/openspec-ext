import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  launchAgentPanelPrompt,
  resetAgentPanelLauncherCommandCache,
} from '@extension/services/agentPanelLauncher';

vi.mock('@extension/utils/logger', () => ({
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('vscode', () => ({
  Uri: {
    parse: (value: string) => ({ toString: () => value }),
  },
  env: {
    openExternal: vi.fn(async () => false),
    clipboard: { writeText: vi.fn() },
  },
  commands: {
    executeCommand: vi.fn(),
  },
}));

describe('agentPanelLauncher', () => {
  beforeEach(() => {
    resetAgentPanelLauncherCommandCache();
  });

  it('uses composer.createNew on Cursor when available and ids increase', async () => {
    const executeCommand = vi.fn(async (command: string) => {
      if (command === 'composer.getOrderedSelectedComposerIds') {
        return executeCommand.mock.calls.filter(([c]) => c === 'composer.getOrderedSelectedComposerIds').length === 1
          ? ['a']
          : ['a', 'b'];
      }
      return undefined;
    });

    const result = await launchAgentPanelPrompt(
      { text: '/opsx-verify demo', autoSubmit: true },
      {
        isCursorHost: () => true,
        getCommands: async () => new Set([
          'composer.createNew',
          'composer.getOrderedSelectedComposerIds',
        ]),
        executeCommand,
        sleep: async () => undefined,
      },
    );

    expect(result.layer).toBe('composerCreateNew');
    expect(result.outcome).toBe('started');
    expect(executeCommand).toHaveBeenCalledWith(
      'composer.createNew',
      expect.objectContaining({ autoSubmit: true, view: 'pane' }),
    );
  });

  it('does not fall back to chat.open when composer.createNew is available but unconfirmed', async () => {
    const executeCommand = vi.fn(async (command: string) => {
      if (command === 'composer.getOrderedSelectedComposerIds') return ['only'];
      return undefined;
    });

    const result = await launchAgentPanelPrompt(
      { text: '/opsx-apply demo', autoSubmit: false },
      {
        isCursorHost: () => true,
        getCommands: async () => new Set([
          'composer.createNew',
          'composer.getOrderedSelectedComposerIds',
          'workbench.action.chat.open',
          'composerMode.agent',
        ]),
        executeCommand,
        sleep: async () => undefined,
      },
    );

    expect(result.layer).toBe('composerCreateNew');
    expect(result.outcome).toBe('prefilled');
    expect(executeCommand).not.toHaveBeenCalledWith('workbench.action.chat.open', expect.anything());
  });

  it('uses VS Code chat.open with agent mode on non-Cursor hosts', async () => {
    const executeCommand = vi.fn(async () => undefined);
    const result = await launchAgentPanelPrompt(
      { text: '/opsx:apply demo', autoSubmit: false },
      {
        isCursorHost: () => false,
        getCommands: async () => new Set(['workbench.action.chat.open']),
        executeCommand,
      },
    );

    expect(result.layer).toBe('vscodeChat');
    expect(executeCommand).toHaveBeenCalledWith('workbench.action.chat.open', {
      query: '/opsx:apply demo',
      isPartialQuery: true,
      mode: 'agent',
    });
  });

  it('clipboard is the final fallback', async () => {
    const writeClipboard = vi.fn(async () => undefined);
    const result = await launchAgentPanelPrompt(
      { text: '/opsx-verify demo', autoSubmit: false },
      {
        isCursorHost: () => true,
        getCommands: async () => new Set([]),
        openExternal: async () => false,
        writeClipboard,
      },
    );

    expect(result.layer).toBe('clipboard');
    expect(result.outcome).toBe('copied');
    expect(writeClipboard).toHaveBeenCalledWith('/opsx-verify demo');
  });
});
