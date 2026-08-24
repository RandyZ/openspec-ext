import { describe, expect, it, vi, beforeEach } from 'vitest';
import * as vscode from 'vscode';
import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { handleWebviewMessage } from '@extension/providers/webviewMessageHandler';
import { setLocale, t } from '../../../src/i18n';

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
    showOpenDialog: vi.fn(() => Promise.resolve(undefined)),
    showInputBox: vi.fn(() => Promise.resolve(undefined)),
    showTextDocument: vi.fn(() => Promise.resolve(undefined)),
  },
  workspace: {
    getConfiguration: vi.fn(() => ({
      get: vi.fn(() => false),
      inspect: vi.fn(() => undefined),
    })),
    openTextDocument: vi.fn(() => Promise.resolve({})),
    fs: {
      createDirectory: vi.fn(() => Promise.resolve()),
    },
  },
  commands: {
    executeCommand: vi.fn(),
  },
  env: {
    clipboard: {
      writeText: vi.fn(),
    },
    openExternal: vi.fn(() => Promise.resolve(true)),
  },
  Uri: {
    file: vi.fn((fsPath: string) => ({ fsPath, path: fsPath, scheme: 'file' })),
    parse: vi.fn((value: string) => ({ fsPath: value, path: value, scheme: value.split(':')[0] })),
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
    setLocale('en');
    adapterFillChat.mockResolvedValue({ success: true, adapterId: 'cursor' });
  });

  it('bound detail reads Specs from the originating binding instead of the selected scope', async () => {
    const boundScope = {
      id: 'project:/projects/current:/planning/current:nearest:',
      label: 'Current Project',
      rootPath: '/planning/current',
      source: 'declared',
      runtimeSource: 'installed',
      capabilities: { stores: false, context: false, doctor: false, worksets: false, diagnostics: [] },
      diagnostics: [],
    };
    const selectedScope = {
      ...boundScope,
      id: 'local:/wrong-project',
      rootPath: '/wrong-project',
    };
    const dataManager = {
      getWorkspaceRoot: vi.fn().mockReturnValue('/workspace'),
      resolveScope: vi.fn().mockReturnValue(selectedScope),
      readSpec: vi.fn().mockResolvedValue('# bound spec'),
    };
    const webview = { postMessage: vi.fn() };

    await (handleWebviewMessage as any)(
      { type: 'getSpecContent', specId: 'same-spec', scopeId: selectedScope.id },
      webview,
      dataManager,
      undefined,
      boundScope
    );

    expect(dataManager.resolveScope).not.toHaveBeenCalled();
    expect(dataManager.readSpec).toHaveBeenCalledWith('same-spec', boundScope);
    expect(webview.postMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: 'specContent',
      content: '# bound spec',
    }));
  });

  it('passes the host-created Project scope through execute, set-state, and get-state task messages', async () => {
    const projectScope = {
      id: 'project:/projects/current:/projects/current:nearest:',
      label: 'Current Project',
      rootPath: '/projects/current',
      source: 'declared',
      runtimeSource: 'installed',
      capabilities: { stores: false, context: false, doctor: false, worksets: false, diagnostics: [] },
      diagnostics: [],
    };
    const selectedLegacyStore = {
      ...projectScope,
      id: 'store:legacy-store',
      label: 'legacy-store',
      rootPath: '/stores/legacy-store',
      source: 'store',
      storeId: 'legacy-store',
    };
    const dataManager = {
      getWorkspaceRoot: vi.fn().mockReturnValue('/workspace'),
      resolveScope: vi.fn().mockReturnValue(selectedLegacyStore),
      executeTaskRequest: vi.fn().mockResolvedValue({ success: true }),
      setTaskExecutionState: vi.fn().mockResolvedValue(undefined),
      getTaskExecutionState: vi.fn().mockResolvedValue({ 0: { success: true, timestamp: 1 } }),
    };
    const webview = { postMessage: vi.fn() };

    await handleWebviewMessage(
      { type: 'executeTask', changeName: 'same-name', taskIndex: 0, taskText: 'Task', scopeId: selectedLegacyStore.id },
      webview as any,
      dataManager as any,
      undefined,
      projectScope as any,
    );
    await handleWebviewMessage(
      { type: 'getTaskExecutionState', changeName: 'same-name', scopeId: selectedLegacyStore.id },
      webview as any,
      dataManager as any,
      undefined,
      projectScope as any,
    );

    expect(dataManager.resolveScope).not.toHaveBeenCalled();
    expect(dataManager.executeTaskRequest).toHaveBeenCalledWith('same-name', 0, 'Task', projectScope);
    expect(dataManager.setTaskExecutionState).toHaveBeenCalledWith('same-name', 0, true, projectScope);
    expect(dataManager.getTaskExecutionState).toHaveBeenNthCalledWith(1, 'same-name', projectScope);
    expect(dataManager.getTaskExecutionState).toHaveBeenNthCalledWith(2, 'same-name', projectScope);
  });

  it('keeps scope-only task messages on the selected legacy Store scope', async () => {
    const selectedLegacyStore = {
      id: 'store:legacy-store',
      label: 'legacy-store',
      rootPath: '/stores/legacy-store',
      source: 'store',
      storeId: 'legacy-store',
      runtimeSource: 'installed',
      capabilities: { diagnostics: [] },
      diagnostics: [],
    };
    const dataManager = {
      getWorkspaceRoot: vi.fn().mockReturnValue('/workspace'),
      resolveScope: vi.fn().mockReturnValue(selectedLegacyStore),
      executeTaskRequest: vi.fn().mockResolvedValue({ success: true }),
      setTaskExecutionState: vi.fn().mockResolvedValue(undefined),
      getTaskExecutionState: vi.fn().mockResolvedValue({}),
    };
    const webview = { postMessage: vi.fn() };

    await handleWebviewMessage(
      { type: 'executeTask', changeName: 'legacy-change', taskIndex: 0, taskText: 'Task', scopeId: selectedLegacyStore.id },
      webview as any,
      dataManager as any,
    );

    expect(dataManager.executeTaskRequest).toHaveBeenCalledWith('legacy-change', 0, 'Task', selectedLegacyStore);
    expect(dataManager.setTaskExecutionState).toHaveBeenCalledWith('legacy-change', 0, true, selectedLegacyStore);
    expect(dataManager.getTaskExecutionState).toHaveBeenCalledWith('legacy-change', selectedLegacyStore);
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
    expect(dataManager.toggleTask).toHaveBeenCalledWith('change-a', 0, undefined);
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

  it('rejects a workflow action whose request binding is stale', async () => {
    const dataManager = {
      getWorkspaceRoot: vi.fn().mockReturnValue('/workspace'),
      getChangeWorkflowSnapshot: vi.fn().mockResolvedValue({ bindingKey: 'root-current' }),
    };
    const webview = { postMessage: vi.fn() };

    await handleWebviewMessage(
      {
        type: 'launchWorkflowAction',
        action: 'apply',
        changeName: 'demo-change',
        requestId: 'request-1',
        bindingKey: 'root-stale',
      },
      webview as any,
      dataManager as any,
    );

    expect(vscode.env.clipboard.writeText).not.toHaveBeenCalled();
    expect(adapterFillChat).not.toHaveBeenCalled();
    expect(webview.postMessage).toHaveBeenCalledWith({
      type: 'workflowActionReceipt',
      requestId: 'request-1',
      changeName: 'demo-change',
      bindingKey: 'root-stale',
      action: 'apply',
      target: 'unknown',
      status: 'failed',
      message: 'The workflow request belongs to a different Change root.',
    });
  });

  it('reports clipboard delivery as copied rather than completed', async () => {
    const dataManager = {
      getWorkspaceRoot: vi.fn().mockReturnValue('/workspace'),
      getChangeWorkflowSnapshot: vi.fn().mockResolvedValue({ bindingKey: 'root-current' }),
    };
    const webview = { postMessage: vi.fn() };

    await handleWebviewMessage(
      {
        type: 'launchWorkflowAction',
        action: 'apply',
        changeName: 'demo-change',
        requestId: 'request-2',
        bindingKey: 'root-current',
      },
      webview as any,
      dataManager as any,
    );

    expect(webview.postMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: 'workflowActionReceipt',
      requestId: 'request-2',
      bindingKey: 'root-current',
      target: 'clipboard',
      status: 'copied',
    }));
    expect(webview.postMessage).not.toHaveBeenCalledWith(expect.objectContaining({ status: 'completed' }));
  });

  it('posts formatted cache stats for getCacheStats requests', async () => {
    const calculatedAt = 1_720_000_000_000;
    const dataManager = {
      getWorkspaceRoot: vi.fn().mockReturnValue('/workspace'),
      getCacheStats: vi.fn().mockResolvedValue({
        rootPath: '/tmp/openspec-cache',
        totalBytes: 12 * 1024,
        fileCount: 3,
        calculatedAt,
        isCalculating: false,
      }),
    };
    const webview = {
      postMessage: vi.fn(),
    };

    await handleWebviewMessage(
      { type: 'getCacheStats' },
      webview as any,
      dataManager as any
    );

    expect(dataManager.getCacheStats).toHaveBeenCalledWith({ force: false });
    expect(webview.postMessage).toHaveBeenCalledWith({
      type: 'cacheStats',
      stats: {
        rootPath: '/tmp/openspec-cache',
        totalBytes: 12 * 1024,
        formattedSize: '12 KB',
        fileCount: 3,
        calculatedAt,
        isCalculating: false,
      },
    });
  });

  it('copies the cache path for cacheAction copyPath and posts a success result', async () => {
    const dataManager = {
      getWorkspaceRoot: vi.fn().mockReturnValue('/workspace'),
      getCacheRootPath: vi.fn().mockReturnValue('/tmp/openspec-cache'),
    };
    const webview = {
      postMessage: vi.fn(),
    };

    await handleWebviewMessage(
      { type: 'cacheAction', action: 'copyPath' },
      webview as any,
      dataManager as any
    );

    expect(vscode.env.clipboard.writeText).toHaveBeenCalledWith('/tmp/openspec-cache');
    expect(webview.postMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: 'cacheActionResult',
      action: 'copyPath',
      success: true,
    }));
  });

  it('clears the cache, refreshes dashboard data, and posts fresh zero-byte stats', async () => {
    vi.mocked(vscode.window.showWarningMessage).mockResolvedValueOnce(t('cache.clear') as any);
    const dashboardData = { changes: [], specs: [], lastRefresh: 2 };
    const dataManager = {
      getWorkspaceRoot: vi.fn().mockReturnValue('/workspace'),
      getCacheRootPath: vi.fn().mockReturnValue('/tmp/openspec-cache'),
      clearCache: vi.fn().mockResolvedValue(undefined),
      refresh: vi.fn().mockResolvedValue(dashboardData),
      getCacheStats: vi.fn().mockResolvedValue({
        rootPath: '/tmp/openspec-cache',
        totalBytes: 0,
        fileCount: 0,
        calculatedAt: 1_720_000_000_001,
        isCalculating: false,
      }),
    };
    const webview = {
      postMessage: vi.fn(),
    };

    await handleWebviewMessage(
      { type: 'cacheAction', action: 'clear' },
      webview as any,
      dataManager as any
    );

    expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
      t('cache.clearConfirm'),
      { modal: true },
      t('cache.clear'),
    );
    expect(dataManager.clearCache).toHaveBeenCalled();
    expect(dataManager.refresh).toHaveBeenCalled();
    expect(webview.postMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: 'cacheActionResult',
      action: 'clear',
      success: true,
    }));
    expect(webview.postMessage).toHaveBeenCalledWith({
      type: 'dashboardData',
      data: dashboardData,
      debug: false,
    });
    expect(webview.postMessage).toHaveBeenCalledWith({
      type: 'cacheStats',
      stats: {
        rootPath: '/tmp/openspec-cache',
        totalBytes: 0,
        formattedSize: '0 B',
        fileCount: 0,
        calculatedAt: 1_720_000_000_001,
        isCalculating: false,
      },
    });
  });

  it('does not clear the cache and posts a non-success result when the user dismisses the clear confirmation', async () => {
    vi.mocked(vscode.window.showWarningMessage).mockResolvedValueOnce(undefined as any);
    const dataManager = {
      getWorkspaceRoot: vi.fn().mockReturnValue('/workspace'),
      getCacheRootPath: vi.fn().mockReturnValue('/tmp/openspec-cache'),
      clearCache: vi.fn().mockResolvedValue(undefined),
      refresh: vi.fn(),
      getCacheStats: vi.fn(),
    };
    const webview = {
      postMessage: vi.fn(),
    };

    await handleWebviewMessage(
      { type: 'cacheAction', action: 'clear' },
      webview as any,
      dataManager as any
    );

    expect(dataManager.clearCache).not.toHaveBeenCalled();
    expect(dataManager.refresh).not.toHaveBeenCalled();
    expect(webview.postMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: 'cacheActionResult',
      action: 'clear',
      success: false,
      message: t('cache.cancelled'),
    }));
  });

  it('posts an error message when manual refresh fails', async () => {
    const dataManager = {
      getWorkspaceRoot: vi.fn().mockReturnValue('/workspace'),
      refresh: vi.fn().mockRejectedValue(new Error('refresh failed')),
    };
    const webview = {
      postMessage: vi.fn(),
    };

    await expect(handleWebviewMessage(
      { type: 'refresh' },
      webview as any,
      dataManager as any
    )).resolves.toBeUndefined();

    expect(webview.postMessage).toHaveBeenCalledWith({
      type: 'error',
      message: 'refresh failed',
    });
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

  it('starts interactive verify workflow and posts session state', async () => {
    const interactiveTerminalManager = {
      start: vi.fn().mockResolvedValue({
        changeName: 'demo-change',
        sessions: {
          verify: {
            action: 'verify',
            status: 'running',
            terminalName: 'OpenSpec Verify: demo-change',
          },
        },
      }),
    };
    const dataManager = {
      getWorkspaceRoot: vi.fn().mockReturnValue('/workspace'),
    };
    const webview = {
      postMessage: vi.fn(),
    };

    await handleWebviewMessage(
      { type: 'runInteractiveWorkflow', action: 'verify', changeName: 'demo-change' },
      webview as any,
      dataManager as any,
      interactiveTerminalManager as any
    );

    expect(interactiveTerminalManager.start).toHaveBeenCalledWith({
      workspaceRoot: '/workspace',
      changeName: 'demo-change',
      action: 'verify',
    });
    expect(webview.postMessage).toHaveBeenCalledWith({
      type: 'interactiveWorkflowState',
      changeName: 'demo-change',
      state: {
        changeName: 'demo-change',
        sessions: {
          verify: {
            action: 'verify',
            status: 'running',
            terminalName: 'OpenSpec Verify: demo-change',
          },
        },
      },
    });
  });

  it('reveals, stops, clears, and gets interactive workflow state', async () => {
    const state = {
      changeName: 'demo-change',
      sessions: {
        archive: {
          action: 'archive',
          status: 'running',
          terminalName: 'OpenSpec Archive: demo-change',
        },
      },
    };
    const interactiveTerminalManager = {
      reveal: vi.fn().mockReturnValue(state),
      stop: vi.fn().mockReturnValue({ changeName: 'demo-change', sessions: {} }),
      clear: vi.fn().mockReturnValue({ changeName: 'demo-change', sessions: {} }),
      getState: vi.fn().mockReturnValue(state),
    };
    const dataManager = {
      getWorkspaceRoot: vi.fn().mockReturnValue('/workspace'),
    };
    const webview = {
      postMessage: vi.fn(),
    };

    await handleWebviewMessage(
      { type: 'revealInteractiveWorkflow', action: 'archive', changeName: 'demo-change' },
      webview as any,
      dataManager as any,
      interactiveTerminalManager as any
    );
    await handleWebviewMessage(
      { type: 'stopInteractiveWorkflow', action: 'archive', changeName: 'demo-change' },
      webview as any,
      dataManager as any,
      interactiveTerminalManager as any
    );
    await handleWebviewMessage(
      { type: 'clearInteractiveWorkflow', action: 'archive', changeName: 'demo-change' },
      webview as any,
      dataManager as any,
      interactiveTerminalManager as any
    );
    await handleWebviewMessage(
      { type: 'getInteractiveWorkflowState', changeName: 'demo-change' },
      webview as any,
      dataManager as any,
      interactiveTerminalManager as any
    );

    expect(interactiveTerminalManager.reveal).toHaveBeenCalledWith('/workspace', 'demo-change', 'archive', undefined);
    expect(interactiveTerminalManager.stop).toHaveBeenCalledWith('/workspace', 'demo-change', 'archive', undefined);
    expect(interactiveTerminalManager.clear).toHaveBeenCalledWith('/workspace', 'demo-change', 'archive', undefined);
    expect(interactiveTerminalManager.getState).toHaveBeenCalledWith('/workspace', 'demo-change', undefined);
    expect(webview.postMessage).toHaveBeenNthCalledWith(4, {
      type: 'interactiveWorkflowState',
      changeName: 'demo-change',
      state,
    });
  });

  it('rejects archive runs for archived changes', async () => {
    const interactiveTerminalManager = {
      start: vi.fn(),
    };
    const dataManager = {
      getWorkspaceRoot: vi.fn().mockReturnValue('/workspace'),
    };
    const webview = {
      postMessage: vi.fn(),
    };

    await handleWebviewMessage(
      { type: 'runInteractiveWorkflow', action: 'archive', changeName: 'archive:2026-05-25-demo-change' },
      webview as any,
      dataManager as any,
      interactiveTerminalManager as any
    );

    expect(interactiveTerminalManager.start).not.toHaveBeenCalled();
    expect(webview.postMessage).toHaveBeenCalledWith({
      type: 'interactiveWorkflowState',
      changeName: 'archive:2026-05-25-demo-change',
      state: {
        changeName: 'archive:2026-05-25-demo-change',
        sessions: {
          archive: {
            action: 'archive',
            status: 'error',
            message: t('verifyArchive.archivedArchiveRejected'),
          },
        },
      },
    });
  });

  it('rejects invalid interactive actions with an error state', async () => {
    const interactiveTerminalManager = {
      start: vi.fn(),
    };
    const dataManager = {
      getWorkspaceRoot: vi.fn().mockReturnValue('/workspace'),
    };
    const webview = {
      postMessage: vi.fn(),
    };

    await handleWebviewMessage(
      { type: 'runInteractiveWorkflow', action: 'oops', changeName: 'demo-change' } as any,
      webview as any,
      dataManager as any,
      interactiveTerminalManager as any
    );

    expect(interactiveTerminalManager.start).not.toHaveBeenCalled();
    expect(webview.postMessage).toHaveBeenCalledWith({
      type: 'interactiveWorkflowState',
      changeName: 'demo-change',
      state: {
        changeName: 'demo-change',
        sessions: {
          verify: {
            action: 'verify',
            status: 'error',
            message: 'Invalid interactive workflow action: oops',
          },
        },
      },
    });
  });

  it('returns a localized error state when the interactive terminal manager is unavailable', async () => {
    const dataManager = {
      getWorkspaceRoot: vi.fn().mockReturnValue('/workspace'),
    };
    const webview = {
      postMessage: vi.fn(),
    };

    await handleWebviewMessage(
      { type: 'getInteractiveWorkflowState', changeName: 'demo-change' },
      webview as any,
      dataManager as any,
      undefined
    );

    expect(webview.postMessage).toHaveBeenCalledWith({
      type: 'interactiveWorkflowState',
      changeName: 'demo-change',
      state: {
        changeName: 'demo-change',
        sessions: {
          verify: {
            action: 'verify',
            status: 'error',
            message: t('verifyArchive.managerUnavailable'),
          },
        },
      },
    });
  });

  it('returns a localized error state when running without an interactive terminal manager', async () => {
    const dataManager = {
      getWorkspaceRoot: vi.fn().mockReturnValue('/workspace'),
    };
    const webview = {
      postMessage: vi.fn(),
    };

    await handleWebviewMessage(
      { type: 'runInteractiveWorkflow', changeName: 'demo-change', action: 'archive' },
      webview as any,
      dataManager as any,
      undefined
    );

    expect(webview.postMessage).toHaveBeenCalledWith({
      type: 'interactiveWorkflowState',
      changeName: 'demo-change',
      state: {
        changeName: 'demo-change',
        sessions: {
          archive: {
            action: 'archive',
            status: 'error',
            message: t('verifyArchive.managerUnavailable'),
          },
        },
      },
    });
  });

  it('archiveChange with verify-first choice routes to the Verify & Archive tab without archiving', async () => {
    vi.mocked(vscode.window.showWarningMessage).mockResolvedValueOnce(
      t('command.archiveVerifyFirst') as any
    );
    const archiveChange = vi.fn();
    const dataManager = {
      getWorkspaceRoot: vi.fn().mockReturnValue('/workspace'),
      archiveChange,
      getDashboardData: vi.fn(),
    };
    const webview = {
      postMessage: vi.fn(),
    };

    await handleWebviewMessage(
      { type: 'archiveChange', name: 'demo-change' },
      webview as any,
      dataManager as any,
      undefined
    );

    expect(archiveChange).not.toHaveBeenCalled();
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
      'openspec.openChangeDetail',
      'demo-change',
      'verifyArchive',
      'verify'
    );
  });

  it('archiveChange with archive choice proceeds with direct archive', async () => {
    vi.mocked(vscode.window.showWarningMessage).mockResolvedValueOnce(
      t('command.archive') as any
    );
    const archiveChange = vi.fn().mockResolvedValue(undefined);
    const dataManager = {
      getWorkspaceRoot: vi.fn().mockReturnValue('/workspace'),
      archiveChange,
      getDashboardData: vi.fn().mockResolvedValue({ changes: [], specs: [], lastRefresh: 1 }),
    };
    const webview = {
      postMessage: vi.fn(),
    };

    await handleWebviewMessage(
      { type: 'archiveChange', name: 'demo-change' },
      webview as any,
      dataManager as any,
      undefined
    );

    expect(archiveChange).toHaveBeenCalledWith('demo-change', undefined);
  });

  it('archiveChange binds the visible Root via scopeId', async () => {
    vi.mocked(vscode.window.showWarningMessage).mockResolvedValueOnce(
      t('command.archive') as any
    );
    const storeScope = {
      id: 'store:team-plans',
      label: 'team-plans',
      rootPath: '/stores/team-plans',
      source: 'store',
      storeId: 'team-plans',
      runtimeSource: 'installed',
      capabilities: { diagnostics: [] },
    };
    const archiveChange = vi.fn().mockResolvedValue(undefined);
    const dataManager = {
      getWorkspaceRoot: vi.fn().mockReturnValue('/workspace'),
      resolveScope: vi.fn((scopeId?: string) => (scopeId === storeScope.id ? storeScope : undefined)),
      archiveChange,
      getDashboardData: vi.fn().mockResolvedValue({
        changes: [],
        specs: [],
        archivedChanges: [],
        changeStatusCounts: {
          all: 0,
          planning: 0,
          readyToApply: 0,
          applying: 0,
          readyToVerify: 0,
          archived: 0,
          needsAttention: 0,
        },
        lastRefresh: 1,
      }),
    };
    const webview = { postMessage: vi.fn() };

    await handleWebviewMessage(
      { type: 'archiveChange', name: 'same-name', scopeId: storeScope.id },
      webview as any,
      dataManager as any,
      undefined
    );

    expect(dataManager.resolveScope).toHaveBeenCalledWith(storeScope.id);
    expect(archiveChange).toHaveBeenCalledWith('same-name', storeScope);
  });

  it('archiveChange with dismiss (cancel) does not archive or open detail', async () => {
    vi.mocked(vscode.window.showWarningMessage).mockResolvedValueOnce(undefined as any);
    const archiveChange = vi.fn();
    const dataManager = {
      getWorkspaceRoot: vi.fn().mockReturnValue('/workspace'),
      archiveChange,
      getDashboardData: vi.fn(),
    };
    const webview = {
      postMessage: vi.fn(),
    };

    await handleWebviewMessage(
      { type: 'archiveChange', name: 'demo-change' },
      webview as any,
      dataManager as any,
      undefined
    );

    expect(archiveChange).not.toHaveBeenCalled();
    expect(vscode.commands.executeCommand).not.toHaveBeenCalled();
  });

  it('openArtifact resolves archived artifact paths against the panel-bound store root', async () => {
    const storeScope = {
      id: 'store:team-plans',
      rootPath: '/stores/team-plans',
      source: 'store',
      storeId: 'team-plans',
      runtimeSource: 'installed',
    };
    const dataManager = {
      getWorkspaceRoot: vi.fn().mockReturnValue('/workspace'),
      resolveScope: vi.fn().mockReturnValue(storeScope),
    };
    const webview = { postMessage: vi.fn() };

    await handleWebviewMessage(
      { type: 'openArtifact', changeName: 'archive:demo-change', artifactType: 'proposal', scopeId: 'store:team-plans' },
      webview as any,
      dataManager as any
    );

    // Path must be derived from the store root, not the workspace root.
    expect(vscode.workspace.openTextDocument).toHaveBeenCalledWith(
      expect.stringContaining('/stores/team-plans/openspec/changes/archive/demo-change/proposal.md')
    );
    expect(dataManager.resolveScope).toHaveBeenCalledWith('store:team-plans');
  });

  it('fails closed for active artifacts when the snapshot gateway is unavailable', async () => {
    const rootPath = await fs.mkdtemp(path.join(os.tmpdir(), 'openspec-no-snapshot-'));
    const guessedPath = path.join(rootPath, 'openspec/changes/demo-change/proposal.md');
    await fs.mkdir(path.dirname(guessedPath), { recursive: true });
    await fs.writeFile(guessedPath, '# guessed');
    const dataManager = {
      getWorkspaceRoot: vi.fn().mockReturnValue(rootPath),
      resolveScope: vi.fn().mockReturnValue({ id: 'local:workspace', rootPath, source: 'local' }),
      artifactExists: vi.fn().mockResolvedValue(true),
      readArtifact: vi.fn().mockResolvedValue('# guessed'),
    };
    const webview = { postMessage: vi.fn() };

    await handleWebviewMessage(
      { type: 'getArtifactContent', changeName: 'demo-change', artifactType: 'proposal' },
      webview as any,
      dataManager as any,
    );

    expect(dataManager.readArtifact).not.toHaveBeenCalled();
    expect(webview.postMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: 'artifactContentError',
      code: 'ARTIFACT_READ_ERROR',
    }));
  });

  it('rejects an active output that is not a member of the bound snapshot', async () => {
    const dataManager = {
      getWorkspaceRoot: vi.fn().mockReturnValue('/workspace'),
      resolveScope: vi.fn().mockReturnValue({
        id: 'local:workspace',
        rootPath: '/workspace',
        source: 'local',
      }),
      getChangeWorkflowSnapshot: vi.fn().mockResolvedValue({
        changeName: 'demo-change',
        schema: 'custom-schema',
        bindingKey: 'current',
        artifacts: [{
          id: 'custom',
          status: 'done',
          requires: [],
          missingDeps: [],
          outputPath: 'openspec/changes/demo-change/safe.md',
          existingOutputPaths: ['openspec/changes/demo-change/safe.md'],
        }],
      }),
    };
    const webview = { postMessage: vi.fn() };

    await handleWebviewMessage(
      {
        type: 'openArtifact',
        changeName: 'demo-change',
        artifactType: 'custom',
        artifactPath: 'openspec/changes/demo-change/secret.md',
      } as any,
      webview as any,
      dataManager as any,
    );

    expect(vscode.workspace.openTextDocument).not.toHaveBeenCalled();
    expect(vscode.window.showErrorMessage).toHaveBeenCalled();
  });

  it('opens only a current status-owned output inside the Change root', async () => {
    const rootPath = await fs.mkdtemp(path.join(os.tmpdir(), 'openspec-output-'));
    const outputPath = path.join(rootPath, 'openspec/changes/demo-change/custom.md');
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, '# custom');
    const dataManager = {
      getWorkspaceRoot: vi.fn().mockReturnValue(rootPath),
      resolveScope: vi.fn().mockReturnValue({ id: 'local:workspace', rootPath, source: 'local' }),
      getChangeWorkflowSnapshot: vi.fn().mockResolvedValue({
        changeName: 'demo-change',
        schema: 'custom-schema',
        bindingKey: 'current',
        artifacts: [{
          id: 'custom',
          status: 'done',
          requires: [],
          missingDeps: [],
          outputPath: 'openspec/changes/demo-change/custom.md',
          existingOutputPaths: ['openspec/changes/demo-change/custom.md'],
        }],
      }),
    };
    const webview = { postMessage: vi.fn() };

    await handleWebviewMessage(
      { type: 'openArtifact', changeName: 'demo-change', artifactType: 'custom', artifactPath: 'openspec/changes/demo-change/custom.md' },
      webview as any,
      dataManager as any,
    );

    expect(vscode.window.showErrorMessage).not.toHaveBeenCalled();
    expect(vscode.workspace.openTextDocument).toHaveBeenCalledWith(await fs.realpath(outputPath));
  });

  it('returns output descriptors with active artifact content', async () => {
    const rootPath = await fs.mkdtemp(path.join(os.tmpdir(), 'openspec-output-content-'));
    const outputPath = path.join(rootPath, 'openspec/changes/demo-change/custom.md');
    const secondPath = path.join(rootPath, 'openspec/changes/demo-change/other.md');
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, '# custom');
    await fs.writeFile(secondPath, '# other');
    const dataManager = {
      getWorkspaceRoot: vi.fn().mockReturnValue(rootPath),
      resolveScope: vi.fn().mockReturnValue({ id: 'local:workspace', rootPath, source: 'local' }),
      getChangeWorkflowSnapshot: vi.fn().mockResolvedValue({
        changeName: 'demo-change',
        schema: 'custom-schema',
        bindingKey: 'current',
        artifacts: [{
          id: 'custom',
          status: 'done',
          requires: [],
          missingDeps: [],
          outputPath: 'openspec/changes/demo-change/custom.md',
          existingOutputPaths: [
            'openspec/changes/demo-change/custom.md',
            'openspec/changes/demo-change/other.md',
          ],
        }],
      }),
    };
    const webview = { postMessage: vi.fn() };

    await handleWebviewMessage(
      { type: 'getArtifactContent', artifactId: 'custom', changeName: 'demo-change' },
      webview as any,
      dataManager as any,
    );

    expect(webview.postMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: 'artifactContent',
      content: '# custom',
      outputs: [
        expect.objectContaining({ label: 'custom.md' }),
        expect.objectContaining({ label: 'other.md' }),
      ],
    }));
  });

  it('resolves CLI absolute outputs when the artifact output pattern is relative', async () => {
    const rootPath = await fs.mkdtemp(path.join(os.tmpdir(), 'openspec-cli-output-'));
    const outputPath = path.join(rootPath, 'openspec/changes/demo-change/proposal.md');
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, '# proposal');
    const dataManager = {
      getWorkspaceRoot: vi.fn().mockReturnValue(rootPath),
      resolveScope: vi.fn().mockReturnValue({ id: 'local:workspace', rootPath, source: 'local' }),
      getChangeWorkflowSnapshot: vi.fn().mockResolvedValue({
        changeName: 'demo-change',
        schema: 'aihelp-dev',
        bindingKey: 'current',
        artifacts: [{
          id: 'proposal',
          status: 'done',
          requires: [],
          missingDeps: [],
          outputPath: 'proposal.md',
          existingOutputPaths: [outputPath],
        }],
      }),
    };
    const webview = { postMessage: vi.fn() };

    await handleWebviewMessage(
      { type: 'getArtifactContent', artifactId: 'proposal', changeName: 'demo-change' },
      webview as any,
      dataManager as any,
    );

    expect(webview.postMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: 'artifactContent',
      content: '# proposal',
    }));
  });

  it('getSpecRequirements reads requirements against the store scope', async () => {
    const storeScope = {
      id: 'store:team-plans',
      rootPath: '/stores/team-plans',
      source: 'store',
      storeId: 'team-plans',
      runtimeSource: 'installed',
    };
    const dataManager = {
      getWorkspaceRoot: vi.fn().mockReturnValue('/workspace'),
      resolveScope: vi.fn().mockReturnValue(storeScope),
      getSpecRequirements: vi.fn().mockResolvedValue(['REQ-1', 'REQ-2']),
    };
    const webview = { postMessage: vi.fn() };

    await handleWebviewMessage(
      { type: 'getSpecRequirements', specId: 'auth', scopeId: 'store:team-plans' },
      webview as any,
      dataManager as any
    );

    // Requirements must be read via the store scope, not the default root.
    expect(dataManager.getSpecRequirements).toHaveBeenCalledWith('auth', storeScope);
    expect(webview.postMessage).toHaveBeenCalledWith({
      type: 'specRequirements',
      specId: 'auth',
      requirements: ['REQ-1', 'REQ-2'],
    });
  });

  it('getSpecContent reads the spec against the store scope', async () => {
    const storeScope = {
      id: 'store:team-plans',
      rootPath: '/stores/team-plans',
      source: 'store',
      storeId: 'team-plans',
      runtimeSource: 'installed',
    };
    const dataManager = {
      getWorkspaceRoot: vi.fn().mockReturnValue('/workspace'),
      resolveScope: vi.fn().mockReturnValue(storeScope),
      readSpec: vi.fn().mockResolvedValue('# auth spec'),
    };
    const webview = { postMessage: vi.fn() };

    await handleWebviewMessage(
      { type: 'getSpecContent', specId: 'auth', scopeId: 'store:team-plans' },
      webview as any,
      dataManager as any
    );

    expect(dataManager.readSpec).toHaveBeenCalledWith('auth', storeScope);
    expect(webview.postMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: 'specContent',
      specId: 'auth',
      content: '# auth spec',
    }));
  });

  it('posts cached artifact content before fresh scoped artifact content', async () => {
    const webview = { postMessage: vi.fn() };
    const scope = { id: 'store:aihelp', rootPath: '/store', label: 'aihelp', source: 'store' };
    const dataManager = {
      resolveScope: vi.fn().mockReturnValue(scope),
      artifactExists: vi.fn().mockResolvedValue(true),
      getCachedArtifactContent: vi.fn().mockResolvedValue({
        content: 'cached tasks',
        source: 'disk',
        generatedAt: 1,
      }),
      readArtifact: vi.fn().mockResolvedValue('fresh tasks'),
    };

    await handleWebviewMessage(
      { type: 'getArtifactContent', changeName: 'archive:same', artifactType: 'tasks', scopeId: 'store:aihelp' },
      webview as any,
      dataManager as any
    );

    expect(webview.postMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({
      type: 'artifactContent',
      content: 'cached tasks',
      cache: { source: 'disk', stale: true, generatedAt: 1 },
    }));
    expect(webview.postMessage).toHaveBeenLastCalledWith(expect.objectContaining({
      type: 'artifactContent',
      content: 'fresh tasks',
      cache: { source: 'fresh', stale: false },
    }));
  });

  it('calls resolveScope with the data manager receiver intact', async () => {
    const storeScope = {
      id: 'store:team-plans',
      rootPath: '/stores/team-plans',
      source: 'store',
      storeId: 'team-plans',
      runtimeSource: 'installed',
    };
    const dataManager = {
      scopeById: new Map([['store:team-plans', storeScope]]),
      getWorkspaceRoot: vi.fn().mockReturnValue('/workspace'),
      resolveScope(scopeId?: string) {
        return this.scopeById.get(scopeId ?? '');
      },
      readSpec: vi.fn().mockResolvedValue('# auth spec'),
    };
    const webview = { postMessage: vi.fn() };

    await handleWebviewMessage(
      { type: 'getSpecContent', specId: 'auth', scopeId: 'store:team-plans' },
      webview as any,
      dataManager as any
    );

    expect(dataManager.readSpec).toHaveBeenCalledWith('auth', storeScope);
  });

  it('getSpecRequirements without scopeId falls back to the selected/local scope', async () => {
    const dataManager = {
      getWorkspaceRoot: vi.fn().mockReturnValue('/workspace'),
      resolveScope: vi.fn().mockReturnValue(undefined),
      getSpecRequirements: vi.fn().mockResolvedValue([]),
    };
    const webview = { postMessage: vi.fn() };

    await handleWebviewMessage(
      { type: 'getSpecRequirements', specId: 'auth' },
      webview as any,
      dataManager as any
    );

    // No store scope — readSpec called with undefined scope (default root).
    expect(dataManager.getSpecRequirements).toHaveBeenCalledWith('auth', undefined);
  });

  it('registers an existing store from the no-stores action and refreshes dashboard data', async () => {
    const data = { changes: [], specs: [], lastRefresh: 1 };
    vi.mocked(vscode.window.showOpenDialog).mockResolvedValueOnce([
      { fsPath: '/stores/team-plans' },
    ] as any);
    const dataManager = {
      getWorkspaceRoot: vi.fn().mockReturnValue('/workspace'),
      registerStore: vi.fn().mockResolvedValue(data),
      getDashboardData: vi.fn(),
    };
    const webview = { postMessage: vi.fn() };

    await handleWebviewMessage(
      { type: 'requestRegisterStore' },
      webview as any,
      dataManager as any
    );

    expect(dataManager.registerStore).toHaveBeenCalledWith('/stores/team-plans');
    expect(dataManager.getDashboardData).not.toHaveBeenCalled();
    expect(webview.postMessage).toHaveBeenCalledWith({ type: 'dashboardData', data, debug: false });
  });

  it('creates a new store under the selected parent folder and refreshes dashboard data', async () => {
    const data = { changes: [], specs: [], lastRefresh: 1 };
    vi.mocked(vscode.window.showInputBox).mockResolvedValueOnce('team-plans');
    vi.mocked(vscode.window.showOpenDialog).mockResolvedValueOnce([{ fsPath: '/stores' }] as any);
    const dataManager = {
      getWorkspaceRoot: vi.fn().mockReturnValue('/workspace'),
      setupStore: vi.fn().mockResolvedValue(data),
      getDashboardData: vi.fn(),
    };
    const webview = { postMessage: vi.fn() };

    await handleWebviewMessage(
      { type: 'requestSetupStore' },
      webview as any,
      dataManager as any
    );

    expect(dataManager.setupStore).toHaveBeenCalledWith('team-plans', '/stores/team-plans');
    expect(dataManager.getDashboardData).not.toHaveBeenCalled();
    expect(webview.postMessage).toHaveBeenCalledWith({ type: 'dashboardData', data, debug: false });
  });

  it('queues a fresh refresh when selecting a scope instead of reusing stale in-flight data', async () => {
    const staleData = {
      changes: [],
      specs: [],
      lastRefresh: 1,
      scope: { id: 'local:/workspace', label: 'Local Root' },
    };
    const selectedData = {
      changes: [],
      specs: [],
      lastRefresh: 2,
      scope: { id: 'store:team-plans', label: 'team-plans' },
    };
    const dataManager = {
      getWorkspaceRoot: vi.fn().mockReturnValue('/workspace'),
      selectScope: vi.fn(),
      refresh: vi.fn().mockResolvedValue(selectedData),
      getDashboardData: vi.fn().mockResolvedValue(staleData),
    };
    const webview = { postMessage: vi.fn() };

    await handleWebviewMessage(
      { type: 'selectScope', scopeId: 'store:team-plans' },
      webview as any,
      dataManager as any
    );

    expect(dataManager.selectScope).toHaveBeenCalledWith('store:team-plans');
    expect(dataManager.refresh).toHaveBeenCalled();
    expect(dataManager.getDashboardData).not.toHaveBeenCalled();
    expect(webview.postMessage).toHaveBeenCalledWith({
      type: 'dashboardData',
      data: selectedData,
      debug: false,
      cache: { source: 'fresh', stale: false },
    });
  });

  it('posts cached target data and an error when selected scope fresh refresh fails', async () => {
    const cachedData = {
      changes: [],
      specs: [],
      lastRefresh: 1,
      scope: { id: 'store:team-plans', label: 'team-plans' },
    };
    const selectedScope = { id: 'store:team-plans', label: 'team-plans', rootPath: '/stores/team-plans' };
    const dataManager = {
      getWorkspaceRoot: vi.fn().mockReturnValue('/workspace'),
      selectScope: vi.fn(),
      resolveScope: vi.fn().mockReturnValue(selectedScope),
      getCachedDashboardData: vi.fn().mockResolvedValue({
        payload: cachedData,
        source: 'disk',
        metadata: { generatedAt: 123 },
      }),
      refresh: vi.fn().mockRejectedValue(new Error('fresh refresh failed')),
    };
    const webview = { postMessage: vi.fn() };

    await expect(handleWebviewMessage(
      { type: 'selectScope', scopeId: 'store:team-plans' },
      webview as any,
      dataManager as any
    )).resolves.toBeUndefined();

    expect(webview.postMessage).toHaveBeenCalledWith({
      type: 'dashboardData',
      data: cachedData,
      debug: false,
      cache: {
        source: 'disk',
        stale: true,
        generatedAt: 123,
      },
    });
    expect(webview.postMessage).toHaveBeenCalledWith({
      type: 'error',
      message: 'fresh refresh failed',
    });
  });

  it('restores dashboard data when register-store directory selection is cancelled', async () => {
    const data = { changes: [], specs: [], lastRefresh: 7 };
    vi.mocked(vscode.window.showOpenDialog).mockResolvedValueOnce(undefined as any);
    const dataManager = {
      getWorkspaceRoot: vi.fn().mockReturnValue('/workspace'),
      registerStore: vi.fn(),
      getDashboardData: vi.fn().mockResolvedValue(data),
    };
    const webview = { postMessage: vi.fn() };

    await handleWebviewMessage(
      { type: 'requestRegisterStore' },
      webview as any,
      dataManager as any
    );

    expect(dataManager.registerStore).not.toHaveBeenCalled();
    expect(dataManager.getDashboardData).toHaveBeenCalled();
    expect(webview.postMessage).toHaveBeenCalledWith({ type: 'dashboardData', data, debug: false });
  });

  it('restores dashboard data when setup-store input is cancelled', async () => {
    const data = { changes: [], specs: [], lastRefresh: 8 };
    vi.mocked(vscode.window.showInputBox).mockResolvedValueOnce(undefined as any);
    const dataManager = {
      getWorkspaceRoot: vi.fn().mockReturnValue('/workspace'),
      setupStore: vi.fn(),
      getDashboardData: vi.fn().mockResolvedValue(data),
    };
    const webview = { postMessage: vi.fn() };

    await handleWebviewMessage(
      { type: 'requestSetupStore' },
      webview as any,
      dataManager as any
    );

    expect(dataManager.setupStore).not.toHaveBeenCalled();
    expect(dataManager.getDashboardData).toHaveBeenCalled();
    expect(webview.postMessage).toHaveBeenCalledWith({ type: 'dashboardData', data, debug: false });
  });

  it('restores dashboard data when setup-store parent folder selection is cancelled', async () => {
    const data = { changes: [], specs: [], lastRefresh: 9 };
    vi.mocked(vscode.window.showInputBox).mockResolvedValueOnce('team-plans');
    vi.mocked(vscode.window.showOpenDialog).mockResolvedValueOnce(undefined as any);
    const dataManager = {
      getWorkspaceRoot: vi.fn().mockReturnValue('/workspace'),
      setupStore: vi.fn(),
      getDashboardData: vi.fn().mockResolvedValue(data),
    };
    const webview = { postMessage: vi.fn() };

    await handleWebviewMessage(
      { type: 'requestSetupStore' },
      webview as any,
      dataManager as any
    );

    expect(dataManager.setupStore).not.toHaveBeenCalled();
    expect(dataManager.getDashboardData).toHaveBeenCalled();
    expect(webview.postMessage).toHaveBeenCalledWith({ type: 'dashboardData', data, debug: false });
  });

  it('posts an error when register-store fails so pending UI can clear', async () => {
    vi.mocked(vscode.window.showOpenDialog).mockResolvedValueOnce([
      { fsPath: '/stores/team-plans' },
    ] as any);
    const dataManager = {
      getWorkspaceRoot: vi.fn().mockReturnValue('/workspace'),
      registerStore: vi.fn().mockRejectedValue(new Error('register failed')),
      getDashboardData: vi.fn(),
    };
    const webview = { postMessage: vi.fn() };

    await handleWebviewMessage(
      { type: 'requestRegisterStore' },
      webview as any,
      dataManager as any
    );

    expect(webview.postMessage).toHaveBeenCalledWith({
      type: 'error',
      message: 'register failed',
    });
  });

  it('posts an error when setup-store fails so pending UI can clear', async () => {
    vi.mocked(vscode.window.showInputBox).mockResolvedValueOnce('team-plans');
    vi.mocked(vscode.window.showOpenDialog).mockResolvedValueOnce([
      { fsPath: '/stores' },
    ] as any);
    const dataManager = {
      getWorkspaceRoot: vi.fn().mockReturnValue('/workspace'),
      setupStore: vi.fn().mockRejectedValue(new Error('setup failed')),
      getDashboardData: vi.fn(),
    };
    const webview = { postMessage: vi.fn() };

    await handleWebviewMessage(
      { type: 'requestSetupStore' },
      webview as any,
      dataManager as any
    );

    expect(webview.postMessage).toHaveBeenCalledWith({
      type: 'error',
      message: 'setup failed',
    });
  });

  it('passes the resolved store scope when listing archived changes', async () => {
    const storeScope = {
      id: 'store:team-plans',
      label: 'team-plans',
      source: 'store',
      rootPath: '/stores/team-plans',
      storeId: 'team-plans',
    };
    const dataManager = {
      getWorkspaceRoot: vi.fn().mockReturnValue('/workspace'),
      resolveScope: vi.fn().mockReturnValue(storeScope),
      listArchivedChanges: vi.fn().mockResolvedValue([
        {
          directoryName: '2026-06-30-store-change',
          name: 'store-change',
          archiveDate: '2026-06-30',
        },
      ]),
    };
    const webview = { postMessage: vi.fn() };

    await handleWebviewMessage(
      { type: 'getArchivedChanges', scopeId: 'store:team-plans' },
      webview as any,
      dataManager as any,
    );

    expect(dataManager.resolveScope).toHaveBeenCalledWith('store:team-plans');
    expect(dataManager.listArchivedChanges).toHaveBeenCalledWith(storeScope);
    expect(webview.postMessage).toHaveBeenCalledWith({
      type: 'archivedChanges',
      items: [
        {
          directoryName: '2026-06-30-store-change',
          name: 'store-change',
          archiveDate: '2026-06-30',
        },
      ],
      scopeId: 'store:team-plans',
    });
  });

  it('returns an empty archive list when the selected scoped archive request fails', async () => {
    const storeScope = {
      id: 'store:team-plans',
      label: 'team-plans',
      source: 'store',
      rootPath: '/stores/team-plans',
      storeId: 'team-plans',
    };
    const dataManager = {
      getWorkspaceRoot: vi.fn().mockReturnValue('/workspace'),
      resolveScope: vi.fn().mockReturnValue(storeScope),
      listArchivedChanges: vi.fn().mockRejectedValue(new Error('store archive unavailable')),
    };
    const webview = { postMessage: vi.fn() };

    await handleWebviewMessage(
      { type: 'getArchivedChanges', scopeId: 'store:team-plans' },
      webview as any,
      dataManager as any,
    );

    expect(dataManager.listArchivedChanges).toHaveBeenCalledWith(storeScope);
    expect(webview.postMessage).toHaveBeenCalledWith({ type: 'archivedChanges', items: [], scopeId: 'store:team-plans' });
  });

  // Workset launching and root selection MUST stay separate: opening a workset
  // launches an editor workspace view and must NOT call selectScope or otherwise
  // change the selected OpenSpec root. (Task 4.2 regression coverage.)
  it('openWorkset launches the workset without selecting a scope or refreshing dashboard data', async () => {
    const dataManager = {
      getWorkspaceRoot: vi.fn().mockReturnValue('/workspace'),
      openWorkset: vi.fn().mockResolvedValue(undefined),
      selectScope: vi.fn(),
      refresh: vi.fn(),
    };
    const webview = { postMessage: vi.fn() };

    await handleWebviewMessage(
      { type: 'openWorkset', name: 'platform' },
      webview as any,
      dataManager as any,
    );

    expect(dataManager.openWorkset).toHaveBeenCalledWith('platform');
    // Opening a workset must not touch root selection or dashboard data.
    expect(dataManager.selectScope).not.toHaveBeenCalled();
    expect(dataManager.refresh).not.toHaveBeenCalled();
  });
});

describe('handleWebviewMessage removeWorkset message contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setLocale('en');
  });

  it('sendMessage.removeWorkset builds a { type: "removeWorkset", name } message', async () => {
    const { sendMessage } = await import('../../../src/webview/types/messages');
    const message = sendMessage.removeWorkset('platform');
    expect(message).toEqual({ type: 'removeWorkset', name: 'platform' });
  });

  it('accepts a removeWorkset message variant with a name field (type-level regression)', async () => {
    // The handler should at least recognize the type and not fall through to
    // the "Unknown message type" branch.
    const dataManager = {
      getWorkspaceRoot: vi.fn().mockReturnValue('/workspace'),
      removeWorkset: vi.fn().mockResolvedValue({ changes: [], specs: [], lastRefresh: 1 }),
      refresh: vi.fn().mockResolvedValue({ changes: [], specs: [], lastRefresh: 1 }),
    };
    const webview = { postMessage: vi.fn() };

    vi.mocked(vscode.window.showWarningMessage).mockResolvedValueOnce(undefined as any);

    await handleWebviewMessage(
      { type: 'removeWorkset', name: 'platform' },
      webview as any,
      dataManager as any,
    );

    // Cancel => no removal call, but the message must be a recognized variant
    // (no exception thrown, handler returns normally).
    expect(dataManager.removeWorkset).not.toHaveBeenCalled();
  });
});

describe('handleWebviewMessage removeWorkset confirmation flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setLocale('en');
  });

  it('asks for modal confirmation naming the workset before removing it', async () => {
    const dataManager = {
      getWorkspaceRoot: vi.fn().mockReturnValue('/workspace'),
      removeWorkset: vi.fn().mockResolvedValue({ changes: [], specs: [], lastRefresh: 1 }),
    };
    const webview = { postMessage: vi.fn() };

    vi.mocked(vscode.window.showWarningMessage).mockResolvedValueOnce(
      t('worksetsPage.removeConfirm') as any
    );

    await handleWebviewMessage(
      { type: 'removeWorkset', name: 'platform' },
      webview as any,
      dataManager as any,
    );

    // A modal warning MUST be shown, naming the workset, with the confirm button.
    expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
      expect.stringContaining('platform'),
      { modal: true },
      t('worksetsPage.removeConfirm'),
    );
  });

  it('the confirmation message states member folders/repos/stores are not deleted (non-destructive copy)', async () => {
    const dataManager = {
      getWorkspaceRoot: vi.fn().mockReturnValue('/workspace'),
      removeWorkset: vi.fn().mockResolvedValue({ changes: [], specs: [], lastRefresh: 1 }),
    };
    const webview = { postMessage: vi.fn() };

    vi.mocked(vscode.window.showWarningMessage).mockResolvedValueOnce(
      t('worksetsPage.removeConfirm') as any
    );

    await handleWebviewMessage(
      { type: 'removeWorkset', name: 'platform' },
      webview as any,
      dataManager as any,
    );

    const callArgs = vi.mocked(vscode.window.showWarningMessage).mock.calls[0];
    const message = String(callArgs[0]);
    // Non-destructive: the copy MUST reassure that member folders/repos/stores survive.
    expect(message.toLowerCase()).toContain('not be deleted');
  });

  it('on confirm, calls removeWorkset and posts refreshed dashboard data', async () => {
    const refreshedData = { changes: [], specs: [], lastRefresh: 5, worksets: [] };
    const dataManager = {
      getWorkspaceRoot: vi.fn().mockReturnValue('/workspace'),
      removeWorkset: vi.fn().mockResolvedValue(refreshedData),
    };
    const webview = { postMessage: vi.fn() };

    vi.mocked(vscode.window.showWarningMessage).mockResolvedValueOnce(
      t('worksetsPage.removeConfirm') as any
    );

    await handleWebviewMessage(
      { type: 'removeWorkset', name: 'platform' },
      webview as any,
      dataManager as any,
    );

    expect(dataManager.removeWorkset).toHaveBeenCalledWith('platform');
    // The handler MUST post the refreshed dashboard data returned by removeWorkset.
    expect(webview.postMessage).toHaveBeenCalledWith({
      type: 'dashboardData',
      data: refreshedData,
    });
  });

  it('on cancel, does NOT call removeWorkset and does NOT post dashboard data', async () => {
    const dataManager = {
      getWorkspaceRoot: vi.fn().mockReturnValue('/workspace'),
      removeWorkset: vi.fn(),
    };
    const webview = { postMessage: vi.fn() };

    // Cancel = showWarningMessage resolves to undefined (dismiss / Escape in a modal).
    vi.mocked(vscode.window.showWarningMessage).mockResolvedValueOnce(undefined as any);

    await handleWebviewMessage(
      { type: 'removeWorkset', name: 'platform' },
      webview as any,
      dataManager as any,
    );

    expect(dataManager.removeWorkset).not.toHaveBeenCalled();
    expect(webview.postMessage).not.toHaveBeenCalled();
  });

  it('on error, shows an error message and does NOT post dashboard data', async () => {
    const dataManager = {
      getWorkspaceRoot: vi.fn().mockReturnValue('/workspace'),
      removeWorkset: vi.fn().mockRejectedValue(new Error('boom')),
    };
    const webview = { postMessage: vi.fn() };

    vi.mocked(vscode.window.showWarningMessage).mockResolvedValueOnce(
      t('worksetsPage.removeConfirm') as any
    );

    await handleWebviewMessage(
      { type: 'removeWorkset', name: 'platform' },
      webview as any,
      dataManager as any,
    );

    expect(dataManager.removeWorkset).toHaveBeenCalledWith('platform');
    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
      expect.stringContaining('platform'),
    );
    // Failed removal must not post a dashboardData refresh.
    expect(webview.postMessage).not.toHaveBeenCalled();
  });

  // Regression (Task 1.4): the confirmation modal copy is exactly the spec'd
  // non-destructive phrasing — member folders/repos/stores are NOT deleted.
  it('uses the exact non-destructive confirmation title and message copy', async () => {
    const dataManager = {
      getWorkspaceRoot: vi.fn().mockReturnValue('/workspace'),
      removeWorkset: vi.fn().mockResolvedValue({ changes: [], specs: [], lastRefresh: 1 }),
    };
    const webview = { postMessage: vi.fn() };

    vi.mocked(vscode.window.showWarningMessage).mockResolvedValueOnce(
      t('worksetsPage.removeConfirm') as any
    );

    await handleWebviewMessage(
      { type: 'removeWorkset', name: 'platform' },
      webview as any,
      dataManager as any,
    );

    const shown = String(vi.mocked(vscode.window.showWarningMessage).mock.calls[0][0]);
    // Title interpolates the workset name; message is the non-destructive guarantee.
    expect(shown).toContain(t('worksetsPage.removeConfirmTitle', { name: 'platform' }));
    expect(shown).toContain(t('worksetsPage.removeConfirmMessage'));
  });

  // Regression (Task 1.4): the refreshed dashboardData is posted exactly once
  // and the post contract is { type: 'dashboardData', data }.
  it('posts refreshed dashboardData exactly once on success with the dashboardData contract', async () => {
    const refreshedData = { changes: [], specs: [], lastRefresh: 9, worksets: [] };
    const dataManager = {
      getWorkspaceRoot: vi.fn().mockReturnValue('/workspace'),
      removeWorkset: vi.fn().mockResolvedValue(refreshedData),
    };
    const webview = { postMessage: vi.fn() };

    vi.mocked(vscode.window.showWarningMessage).mockResolvedValueOnce(
      t('worksetsPage.removeConfirm') as any
    );

    await handleWebviewMessage(
      { type: 'removeWorkset', name: 'platform' },
      webview as any,
      dataManager as any,
    );

    expect(webview.postMessage).toHaveBeenCalledTimes(1);
    expect(webview.postMessage).toHaveBeenCalledWith({
      type: 'dashboardData',
      data: refreshedData,
    });
  });

  // Regression (Task 1.4): cancelling the modal must not show any error/info
  // message — the user simply backed out.
  it('on cancel, shows no informational or error messages', async () => {
    const dataManager = {
      getWorkspaceRoot: vi.fn().mockReturnValue('/workspace'),
      removeWorkset: vi.fn(),
    };
    const webview = { postMessage: vi.fn() };

    vi.mocked(vscode.window.showWarningMessage).mockResolvedValueOnce(undefined as any);

    await handleWebviewMessage(
      { type: 'removeWorkset', name: 'platform' },
      webview as any,
      dataManager as any,
    );

    expect(vscode.window.showErrorMessage).not.toHaveBeenCalled();
    expect(vscode.window.showInformationMessage).not.toHaveBeenCalled();
  });
});
