import { describe, expect, it, vi, beforeEach } from 'vitest';
import * as vscode from 'vscode';
import { handleWebviewMessage } from '@extension/providers/webviewMessageHandler';

const adapterFillChat = vi.hoisted(() => vi.fn());
const cursorAdapterMock = vi.hoisted(() => ({
  id: 'cursor',
  displayName: 'Cursor',
  fillChat: adapterFillChat,
  executeTask: vi.fn(),
  isAvailable: vi.fn(),
}));

vi.mock('vscode', () => ({
  window: {
    showWarningMessage: vi.fn(() => Promise.resolve(undefined)),
    showInformationMessage: vi.fn(() => Promise.resolve(undefined)),
    showErrorMessage: vi.fn(() => Promise.resolve(undefined)),
  },
  workspace: {
    getConfiguration: vi.fn(() => ({
      get: vi.fn(() => false),
      inspect: vi.fn(() => undefined),
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

vi.mock('@extension/adapters', () => ({
  getCurrentAdapter: vi.fn(async () => cursorAdapterMock),
  getAdapterById: vi.fn(async (id: string) => (id === 'cursor' ? cursorAdapterMock : null)),
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
    adapterFillChat.mockResolvedValue({ success: true, adapterId: 'cursor' });
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

  it('copies a clipboard command for launchWorkflowAction by default', async () => {
    const dataManager = {
      getWorkspaceRoot: vi.fn().mockReturnValue('/workspace'),
    };
    const webview = {
      postMessage: vi.fn(),
    };

    await handleWebviewMessage(
      { type: 'launchWorkflowAction', action: 'apply', changeName: 'demo-change' },
      webview as any,
      dataManager as any
    );

    expect(vscode.env.clipboard.writeText).toHaveBeenCalledWith('/opsx:apply demo-change');
    expect(adapterFillChat).not.toHaveBeenCalled();
  });

  it('copies an archive workflow command for launchWorkflowAction by default', async () => {
    const dataManager = {
      getWorkspaceRoot: vi.fn().mockReturnValue('/workspace'),
    };
    const webview = {
      postMessage: vi.fn(),
    };

    await handleWebviewMessage(
      { type: 'launchWorkflowAction', action: 'archive', changeName: 'demo-change' },
      webview as any,
      dataManager as any
    );

    expect(vscode.env.clipboard.writeText).toHaveBeenCalledWith('/opsx:archive demo-change');
    expect(adapterFillChat).not.toHaveBeenCalled();
  });

  it('routes launchWorkflowAction through Cursor adapter with hyphen command when adapter mode is selected', async () => {
    vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
      get: vi.fn((key: string) => {
        if (key === 'workflowLaunchMode') return 'adapter';
        if (key === 'preferredAgentAdapter') return 'cursor';
        return false;
      }),
      inspect: vi.fn(() => undefined),
    } as any);
    const dataManager = {
      getWorkspaceRoot: vi.fn().mockReturnValue('/workspace'),
    };
    const webview = {
      postMessage: vi.fn(),
    };

    await handleWebviewMessage(
      { type: 'launchWorkflowAction', action: 'apply', changeName: 'demo-change' },
      webview as any,
      dataManager as any
    );

    expect(adapterFillChat).toHaveBeenCalledWith(
      expect.objectContaining({
        promptOverride: '/opsx-apply demo-change',
        changeName: 'demo-change',
      })
    );
  });

  it('routes launchWorkflowAction through Cursor adapter when Cursor launch mode is explicitly agentCli', async () => {
    vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
      get: vi.fn((key: string) => {
        if (key === 'cursorLaunchMode') return 'agentCli';
        return false;
      }),
      inspect: vi.fn((key: string) =>
        key === 'cursorLaunchMode' ? { globalValue: 'agentCli' } : undefined
      ),
    } as any);
    const dataManager = {
      getWorkspaceRoot: vi.fn().mockReturnValue('/workspace'),
    };
    const webview = {
      postMessage: vi.fn(),
    };

    await handleWebviewMessage(
      { type: 'launchWorkflowAction', action: 'apply', changeName: 'demo-change' },
      webview as any,
      dataManager as any
    );

    expect(vscode.env.clipboard.writeText).not.toHaveBeenCalledWith('/opsx:apply demo-change');
    expect(adapterFillChat).toHaveBeenCalledWith(
      expect.objectContaining({
        promptOverride: '/opsx-apply demo-change',
        changeName: 'demo-change',
      })
    );
  });

  it('routes launchWorkflowAction through Cursor adapter when Cursor launch mode is explicitly deeplink', async () => {
    vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
      get: vi.fn((key: string) => {
        if (key === 'cursorLaunchMode') return 'deeplink';
        return false;
      }),
      inspect: vi.fn((key: string) =>
        key === 'cursorLaunchMode' ? { globalValue: 'deeplink' } : undefined
      ),
    } as any);
    const dataManager = {
      getWorkspaceRoot: vi.fn().mockReturnValue('/workspace'),
    };
    const webview = {
      postMessage: vi.fn(),
    };

    await handleWebviewMessage(
      { type: 'launchWorkflowAction', action: 'apply', changeName: 'demo-change' },
      webview as any,
      dataManager as any
    );

    expect(vscode.env.clipboard.writeText).not.toHaveBeenCalledWith('/opsx:apply demo-change');
    expect(adapterFillChat).toHaveBeenCalledWith(
      expect.objectContaining({
        promptOverride: '/opsx-apply demo-change',
        changeName: 'demo-change',
      })
    );
  });
});
