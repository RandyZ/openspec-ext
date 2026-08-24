import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as vscode from 'vscode';
import { CommandManager } from '@extension/commands/commandManager';
import { setLocale } from '../../../src/i18n';

const registeredCommands = vi.hoisted(() => new Map<string, (...args: unknown[]) => unknown>());

vi.mock('vscode', () => ({
  commands: {
    registerCommand: vi.fn((command: string, callback: (...args: unknown[]) => unknown) => {
      registeredCommands.set(command, callback);
      return { dispose: vi.fn() };
    }),
    executeCommand: vi.fn(),
  },
  workspace: {
    getConfiguration: vi.fn(() => ({
      get: vi.fn(() => false),
      inspect: vi.fn(() => undefined),
    })),
    fs: {
      createDirectory: vi.fn(() => Promise.resolve()),
    },
  },
  window: {
    showErrorMessage: vi.fn(),
    showInformationMessage: vi.fn(() => Promise.resolve(undefined)),
    showWarningMessage: vi.fn(() => Promise.resolve(undefined)),
    showInputBox: vi.fn(() => Promise.resolve(undefined)),
    withProgress: vi.fn((_options, task: () => Promise<unknown>) => task()),
  },
  env: {
    clipboard: {
      writeText: vi.fn(),
    },
  },
  Uri: {
    file: vi.fn((fsPath: string) => ({ fsPath, path: fsPath, scheme: 'file' })),
  },
  ProgressLocation: {
    Notification: 15,
  },
}));

vi.mock('@extension/utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('CommandManager cache commands', () => {
  beforeEach(() => {
    registeredCommands.clear();
    vi.clearAllMocks();
    setLocale('en');
  });

  it('creates the cache root before revealing it from the command palette', async () => {
    const dataManager = {
      getCacheRootPath: vi.fn().mockReturnValue('/tmp/openspec-cache'),
    };
    const context = { subscriptions: [] };
    const dashboardViewProvider = {
      openInEditor: vi.fn(),
      reveal: vi.fn(),
    };
    const manager = new CommandManager(
      dataManager as any,
      context as any,
      dashboardViewProvider as any
    );

    manager.register();
    await registeredCommands.get('openspec.openCacheFolder')?.();

    expect(vscode.workspace.fs.createDirectory).toHaveBeenCalledWith(expect.objectContaining({
      fsPath: '/tmp/openspec-cache',
    }));
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
      'revealFileInOS',
      expect.objectContaining({ fsPath: '/tmp/openspec-cache' })
    );
    expect(vi.mocked(vscode.workspace.fs.createDirectory).mock.invocationCallOrder[0])
      .toBeLessThan(vi.mocked(vscode.commands.executeCommand).mock.invocationCallOrder[0]);
  });

  it('uses generic Continue semantics for the legacy command entry', async () => {
    const manager = new CommandManager(
      {} as any,
      { subscriptions: [] } as any,
      {} as any
    );

    manager.register();
    await registeredCommands.get('openspec.continueArtifact')?.('demo-change', 'proposal');

    expect(vscode.env.clipboard.writeText).toHaveBeenCalledWith('/opsx:continue demo-change');
    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
      'Copied /opsx:continue. Paste into AI chat to generate artifact'
    );
  });
});
