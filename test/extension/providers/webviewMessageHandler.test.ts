import { describe, expect, it, vi, beforeEach } from 'vitest';
import * as vscode from 'vscode';
import { handleWebviewMessage } from '@extension/providers/webviewMessageHandler';

vi.mock('vscode', () => ({
  window: {
    showWarningMessage: vi.fn(() => Promise.resolve(undefined)),
    showInformationMessage: vi.fn(() => Promise.resolve(undefined)),
    showErrorMessage: vi.fn(() => Promise.resolve(undefined)),
  },
  workspace: {
    getConfiguration: vi.fn(() => ({
      get: vi.fn(() => false),
    })),
    openTextDocument: vi.fn(),
  },
  commands: {
    executeCommand: vi.fn(),
  },
  env: {
    clipboard: {
      writeText: vi.fn(),
    },
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

describe('handleWebviewMessage toggleTask', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('toggles tasks without opening a VS Code modal confirmation', async () => {
    const data = { changes: [], specs: [], lastRefresh: 1 };
    const dataManager = {
      readTasks: vi.fn().mockResolvedValue([{ done: false, text: 'Task', lineIndex: 0, indent: 0, originalLine: '- [ ] Task' }]),
      toggleTask: vi.fn().mockResolvedValue(undefined),
      getDashboardData: vi.fn().mockResolvedValue(data),
      readArtifact: vi.fn().mockResolvedValue('- [x] Task'),
      getWorkspaceRoot: vi.fn().mockReturnValue('/workspace'),
    };
    const webview = {
      postMessage: vi.fn(),
    };

    await handleWebviewMessage(
      { type: 'toggleTask', changeName: 'change-a', taskIndex: 0 },
      webview as any,
      dataManager as any
    );

    expect(vscode.window.showWarningMessage).not.toHaveBeenCalled();
    expect(dataManager.toggleTask).toHaveBeenCalledWith('change-a', 0);
    expect(webview.postMessage).toHaveBeenCalledWith({ type: 'dashboardData', data, debug: false });
  });
});
