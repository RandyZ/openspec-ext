import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as vscode from 'vscode';
import { cursorAdapter } from '@extension/adapters/cursor-adapter';

const mocks = vi.hoisted(() => ({
  spawn: vi.fn(),
  outputChannel: {
    append: vi.fn(),
    appendLine: vi.fn(),
    clear: vi.fn(),
    show: vi.fn(),
  },
}));

vi.mock('child_process', () => ({
  spawn: mocks.spawn,
}));

vi.mock('vscode', () => ({
  env: {
    appName: 'Cursor',
    clipboard: {
      writeText: vi.fn(),
    },
    openExternal: vi.fn(),
  },
  Uri: {
    parse: vi.fn((value: string) => value),
  },
  commands: {
    executeCommand: vi.fn(),
  },
  window: {
    createOutputChannel: vi.fn(() => mocks.outputChannel),
    showInformationMessage: vi.fn(),
  },
  workspace: {
    getConfiguration: vi.fn(),
  },
}));

const getConfiguration = vi.mocked(vscode.workspace.getConfiguration);
const writeText = vi.mocked(vscode.env.clipboard.writeText);
const openExternal = vi.mocked(vscode.env.openExternal);
const executeCommand = vi.mocked(vscode.commands.executeCommand);
const showInformationMessage = vi.mocked(vscode.window.showInformationMessage);

function mockConfig(values: Record<string, unknown>) {
  getConfiguration.mockReturnValue({
    get: vi.fn((key: string) => values[key]),
  } as any);
}

describe('cursorAdapter fillChat launch modes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConfig({
      cursorLaunchMode: 'deeplink',
      cursorAgentModel: 'auto',
    });
    openExternal.mockResolvedValue(true);
    executeCommand.mockResolvedValue(undefined);
    mocks.spawn.mockReturnValue({
      pid: 1234,
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
      on: vi.fn((event: string, callback: (...args: any[]) => void) => {
        if (event === 'close') callback(0);
      }),
    });
  });

  it('is available in Cursor even when agent CLI is not required for chat launch', async () => {
    expect(await cursorAdapter.isAvailable()).toBe(true);
  });

  it('copies command and opens Cursor deeplink in deeplink mode', async () => {
    await cursorAdapter.fillChat({
      changeName: 'demo-change',
      taskIndex: -1,
      taskText: '',
      contextFiles: [],
      workspaceRoot: '/workspace',
      promptOverride: '/opsx-apply demo-change',
    });

    expect(writeText).toHaveBeenCalledWith('/opsx-apply demo-change');
    expect(openExternal).toHaveBeenCalledWith(
      'cursor://anysphere.cursor-deeplink/prompt?text=%2Fopsx-apply%20demo-change'
    );
    expect(showInformationMessage).toHaveBeenCalledWith(expect.stringContaining('/opsx-apply'));
  });

  it('copies command and opens chat query in chatCommand mode', async () => {
    mockConfig({
      cursorLaunchMode: 'chatCommand',
      cursorAgentModel: 'auto',
    });

    await cursorAdapter.fillChat({
      changeName: 'demo-change',
      taskIndex: -1,
      taskText: '',
      contextFiles: [],
      workspaceRoot: '/workspace',
      promptOverride: '/opsx-apply demo-change',
    });

    expect(writeText).toHaveBeenCalledWith('/opsx-apply demo-change');
    expect(executeCommand).toHaveBeenCalledWith('workbench.action.chat.open', {
      query: '/opsx-apply demo-change',
      isPartialQuery: true,
    });
  });

  it('only copies command in clipboard mode', async () => {
    mockConfig({
      cursorLaunchMode: 'clipboard',
      cursorAgentModel: 'auto',
    });

    await cursorAdapter.fillChat({
      changeName: 'demo-change',
      taskIndex: -1,
      taskText: '',
      contextFiles: [],
      workspaceRoot: '/workspace',
      promptOverride: '/opsx-apply demo-change',
    });

    expect(writeText).toHaveBeenCalledWith('/opsx-apply demo-change');
    expect(openExternal).not.toHaveBeenCalled();
    expect(executeCommand).not.toHaveBeenCalled();
  });

  it('copies command and runs Cursor Agent CLI in agentCli mode', async () => {
    mockConfig({
      cursorLaunchMode: 'agentCli',
      cursorAgentModel: 'auto',
    });

    await cursorAdapter.fillChat({
      changeName: 'demo-change',
      taskIndex: -1,
      taskText: 'Apply change',
      contextFiles: [],
      workspaceRoot: '/workspace',
      promptOverride: '/opsx-apply demo-change',
    });

    expect(writeText).toHaveBeenCalledWith('/opsx-apply demo-change');
    expect(mocks.spawn).toHaveBeenCalledWith(
      'agent',
      ['-p', '--trust', '--force', '--model', 'auto', '/opsx-apply demo-change'],
      expect.objectContaining({ cwd: '/workspace' })
    );
    expect(mocks.outputChannel.appendLine).toHaveBeenCalledWith(
      expect.stringContaining('pid: 1234')
    );
  });

  it('reports that Cursor Agent CLI is still running when startup is silent', async () => {
    vi.useFakeTimers();
    try {
      let closeHandler: ((code: number) => void) | undefined;
      mocks.spawn.mockReturnValue({
        pid: 1234,
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn((event: string, callback: (...args: any[]) => void) => {
          if (event === 'close') {
            closeHandler = callback as (code: number) => void;
          }
        }),
      });

      const result = cursorAdapter.executeTask({
        changeName: 'demo-change',
        taskIndex: -1,
        taskText: 'Apply change',
        contextFiles: [],
        workspaceRoot: '/workspace',
        promptOverride: '/opsx-apply demo-change',
      });

      await vi.advanceTimersByTimeAsync(10000);
      expect(mocks.outputChannel.appendLine).toHaveBeenCalledWith(
        expect.stringContaining('still running')
      );

      await vi.advanceTimersByTimeAsync(20000);
      expect(mocks.outputChannel.appendLine).toHaveBeenCalledWith(
        expect.stringContaining('30s')
      );

      closeHandler?.(0);
      await result;
    } finally {
      vi.useRealTimers();
    }
  });

  it('falls back to copied command notification when deeplink fails', async () => {
    openExternal.mockRejectedValue(new Error('no handler'));

    await cursorAdapter.fillChat({
      changeName: 'demo-change',
      taskIndex: -1,
      taskText: '',
      contextFiles: [],
      workspaceRoot: '/workspace',
      promptOverride: '/opsx-apply demo-change',
    });

    expect(writeText).toHaveBeenCalledWith('/opsx-apply demo-change');
    expect(showInformationMessage).toHaveBeenCalledWith(expect.stringContaining('/opsx-apply demo-change'));
  });
});
