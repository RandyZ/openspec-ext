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
  window: {
    showWarningMessage: vi.fn(),
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
    expect(result.outcome).toBe('submitted');
    expect(executeCommand).toHaveBeenCalledWith(
      'composer.createNew',
      expect.objectContaining({ autoSubmit: true, view: 'pane' }),
    );
  });

  it('returns optimistically after composer.createNew without waiting for pane confirmation', async () => {
    const executeCommand = vi.fn(async (command: string) => {
      if (command === 'composer.getOrderedSelectedComposerIds') return ['only'];
      return undefined;
    });
    const sleep = vi.fn(async () => undefined);

    const started = Date.now();
    const result = await launchAgentPanelPrompt(
      { text: '/opsx-apply demo', autoSubmit: false },
      {
        isCursorHost: () => true,
        getCommands: async () => new Set([
          'composer.createNew',
          'composer.getOrderedSelectedComposerIds',
        ]),
        executeCommand,
        sleep,
      },
    );
    const elapsed = Date.now() - started;

    expect(result.layer).toBe('composerCreateNew');
    expect(elapsed).toBeLessThan(200);
    expect(executeCommand).toHaveBeenCalledWith('composer.createNew', expect.any(Object));
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

  it('awaits composer.createNew and does not open chat when composer succeeds', async () => {
    const executeCommand = vi.fn(async (command: string) => {
      if (command === 'composer.getOrderedSelectedComposerIds') return ['a'];
      return undefined;
    });

    const result = await launchAgentPanelPrompt(
      { text: '/opsx:apply demo', autoSubmit: false },
      {
        isCursorHost: () => true,
        getCommands: async () => new Set([
          'composer.createNew',
          'composer.getOrderedSelectedComposerIds',
          'workbench.action.chat.open',
        ]),
        executeCommand,
        sleep: async () => undefined,
      },
    );

    expect(result.layer).toBe('composerCreateNew');
    expect(executeCommand).toHaveBeenCalledWith('composer.createNew', expect.any(Object));
    expect(executeCommand).not.toHaveBeenCalledWith(
      'workbench.action.chat.open',
      expect.anything(),
    );
  });

  it('returns quickly when composer.createNew never resolves (autoSubmit) and does not block a second launch', async () => {
    const executeCommand = vi.fn((command: string) => {
      if (command === 'composer.getOrderedSelectedComposerIds') return Promise.resolve(['a']);
      if (command === 'composer.createNew') {
        return new Promise(() => undefined);
      }
      return Promise.resolve(undefined);
    });

    const deps = {
      isCursorHost: () => true,
      getCommands: async () => new Set([
        'composer.createNew',
        'composer.getOrderedSelectedComposerIds',
        'workbench.action.chat.open',
      ]),
      executeCommand,
      sleep: (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)),
    };

    const started = Date.now();
    const first = await launchAgentPanelPrompt(
      { text: '/opsx:verify change-a', autoSubmit: true },
      deps,
    );
    const firstElapsed = Date.now() - started;

    expect(first.layer).toBe('composerCreateNew');
    expect(firstElapsed).toBeLessThan(300);
    expect(executeCommand).not.toHaveBeenCalledWith(
      'workbench.action.chat.open',
      expect.anything(),
    );

    const secondStarted = Date.now();
    const second = await launchAgentPanelPrompt(
      { text: '/opsx:verify change-b', autoSubmit: true },
      deps,
    );
    const secondElapsed = Date.now() - secondStarted;

    expect(second.layer).toBe('composerCreateNew');
    expect(secondElapsed).toBeLessThan(300);
    expect(executeCommand.mock.calls.filter(([c]) => c === 'composer.createNew')).toHaveLength(2);
  });

  it('falls back to chat.open when composer.createNew rejects quickly', async () => {
    const executeCommand = vi.fn((command: string) => {
      if (command === 'composer.getOrderedSelectedComposerIds') return Promise.resolve(['a']);
      if (command === 'composer.createNew') {
        return Promise.reject(new Error('createNew unavailable'));
      }
      return Promise.resolve(undefined);
    });

    const result = await launchAgentPanelPrompt(
      { text: '/opsx:apply demo', autoSubmit: false },
      {
        isCursorHost: () => true,
        getCommands: async () => new Set([
          'composer.createNew',
          'composer.getOrderedSelectedComposerIds',
          'workbench.action.chat.open',
        ]),
        executeCommand,
        sleep: (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)),
      },
    );

    expect(result.layer).toBe('chatOpen');
    expect(executeCommand).toHaveBeenCalledWith('composer.createNew', expect.any(Object));
    expect(executeCommand).toHaveBeenCalledWith('workbench.action.chat.open', { query: '/opsx:apply demo' });
  });
});
