import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DashboardViewProvider } from '@extension/providers/dashboardViewProvider';

vi.mock('vscode', () => {
  class Disposable {
    constructor(private fn?: () => void) {}
    dispose() {
      this.fn?.();
    }
  }

  return {
    Disposable,
    Uri: {
      file: (fsPath: string) => ({ fsPath }),
    },
    workspace: {
      getConfiguration: vi.fn(() => ({
        get: vi.fn(() => false),
      })),
    },
    env: {
      language: 'en',
    },
    commands: {
      executeCommand: vi.fn(),
    },
    window: {
      createWebviewPanel: vi.fn(),
    },
    ViewColumn: {
      One: 1,
    },
  };
});

vi.mock('@extension/utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('DashboardViewProvider', () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('posts initial dashboard data after the sidebar webview resolves', async () => {
    vi.useFakeTimers();
    const dashboardData = { changes: [], specs: [], lastRefresh: 123 };
    const dataManager = {
      onRefresh: vi.fn(() => ({ dispose: vi.fn() })),
      getDashboardData: vi.fn().mockResolvedValue(dashboardData),
    };
    const webview = {
      options: undefined,
      html: '',
      cspSource: 'vscode-resource',
      asWebviewUri: vi.fn((uri) => `vscode-resource:${uri.fsPath}`),
      postMessage: vi.fn(),
      onDidReceiveMessage: vi.fn(),
    };
    const webviewView = {
      webview,
      onDidDispose: vi.fn(),
      show: vi.fn(),
    };

    const provider = new DashboardViewProvider(dataManager as any, '/ext');
    provider.resolveWebviewView(webviewView as any, {} as any, {} as any);

    await vi.runAllTimersAsync();

    expect(dataManager.getDashboardData).toHaveBeenCalled();
    expect(webview.postMessage).toHaveBeenCalledWith({
      type: 'dashboardData',
      data: dashboardData,
      debug: false,
    });
    expect(webview.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'workflowLaunchConfig' })
    );
  });

  it('opens a dashboard editor panel as a command fallback', async () => {
    vi.useFakeTimers();
    const dashboardData = { changes: [], specs: [], lastRefresh: 123 };
    const dataManager = {
      onRefresh: vi.fn(() => ({ dispose: vi.fn() })),
      getDashboardData: vi.fn().mockResolvedValue(dashboardData),
    };
    const webview = {
      options: undefined,
      html: '',
      cspSource: 'vscode-resource',
      asWebviewUri: vi.fn((uri) => `vscode-resource:${uri.fsPath}`),
      postMessage: vi.fn(),
      onDidReceiveMessage: vi.fn(),
    };
    const panel = {
      webview,
      reveal: vi.fn(),
      onDidDispose: vi.fn(),
    };
    const vscode = await import('vscode');
    vi.mocked(vscode.window.createWebviewPanel).mockReturnValue(panel as any);

    const provider = new DashboardViewProvider(dataManager as any, '/ext');
    provider.openInEditor();
    await vi.runAllTimersAsync();

    expect(vscode.window.createWebviewPanel).toHaveBeenCalledWith(
      'openspecDashboard',
      'OpenSpec Dashboard',
      expect.anything(),
      expect.objectContaining({ enableScripts: true })
    );
    expect(webview.postMessage).toHaveBeenCalledWith({
      type: 'dashboardData',
      data: dashboardData,
      debug: false,
    });
  });
});
