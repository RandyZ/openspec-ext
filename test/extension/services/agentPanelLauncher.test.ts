import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  launchAgentPanelPrompt,
  resetAgentPanelLauncherCommandCache,
  resetAgentPanelLauncherInFlightState,
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
    resetAgentPanelLauncherInFlightState();
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

  it('invokes composer.createNew at most once while a launch is in flight', async () => {
    let releaseCreateNew: (() => void) | undefined;
    const createNewGate = new Promise<void>((resolve) => {
      releaseCreateNew = resolve;
    });
    const executeCommand = vi.fn(async (command: string) => {
      if (command === 'composer.getOrderedSelectedComposerIds') return ['a'];
      if (command === 'composer.createNew') {
        await createNewGate;
      }
      return undefined;
    });

    const deps = {
      isCursorHost: () => true,
      getCommands: async () => new Set([
        'composer.createNew',
        'composer.getOrderedSelectedComposerIds',
      ]),
      executeCommand,
      sleep: async () => undefined,
    };

    const first = launchAgentPanelPrompt({ text: 'one', autoSubmit: false }, deps);
    const second = launchAgentPanelPrompt({ text: 'two', autoSubmit: false }, deps);
    releaseCreateNew?.();
    const [firstResult, secondResult] = await Promise.all([first, second]);

    expect(firstResult.layer).toBe('composerCreateNew');
    expect(secondResult.outcome).toBe('deduped');
    expect(executeCommand.mock.calls.filter(([c]) => c === 'composer.createNew')).toHaveLength(1);
  });
});
