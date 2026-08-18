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
      parse: (uri: string) => ({ fsPath: uri, toString: () => uri }),
    },
    workspace: {
      getConfiguration: vi.fn(() => ({
        get: vi.fn(() => false),
      })),
    },
    env: {
      language: 'en',
      clipboard: {
        writeText: vi.fn(),
      },
      openExternal: vi.fn(),
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
  function makeDashboardData({
    changeName,
    lastRefresh,
  }: {
    changeName: string;
    lastRefresh: number;
  }) {
    return {
      changes: [
        {
          name: changeName,
          completedTasks: 0,
          totalTasks: 1,
          lastModified: '2026-06-01T00:00:00.000Z',
          status: 'draft' as const,
          lifecycleStatus: 'planning' as const,
        },
      ],
      specs: [],
      archivedChanges: [],
      changeStatusCounts: {
        all: 1,
        planning: 1,
        readyToApply: 0,
        applying: 0,
        readyToVerify: 0,
        archived: 0,
        needsAttention: 0,
      },
      lastRefresh,
    };
  }

  function makeWebview(postMessage = vi.fn()) {
    return {
      options: undefined,
      html: '',
      cspSource: 'vscode-resource',
      asWebviewUri: vi.fn((uri) => `vscode-resource:${uri.fsPath}`),
      postMessage,
      onDidReceiveMessage: vi.fn(),
    };
  }

  function makeWebviewView(webview: ReturnType<typeof makeWebview>) {
    return {
      webview,
      onDidDispose: vi.fn(),
      show: vi.fn(),
    };
  }

  function makeDataManager(overrides: Record<string, unknown> = {}) {
    return {
      onRefresh: vi.fn(() => ({ dispose: vi.fn() })),
      getCliDiagnostic: vi.fn().mockReturnValue(null),
      ...overrides,
    };
  }

  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('posts cached dashboard data before fresh initial refresh data', async () => {
    vi.useFakeTimers();
    const cachedData = makeDashboardData({ changeName: 'cached-change', lastRefresh: 1 });
    const freshData = makeDashboardData({ changeName: 'fresh-change', lastRefresh: 2 });
    const postMessage = vi.fn();
    const webview = makeWebview(postMessage);
    const dataManager = makeDataManager({
      getCachedDashboardData: vi.fn().mockResolvedValue({
        payload: cachedData,
        metadata: { generatedAt: 1 },
        source: 'disk',
      }),
      refresh: vi.fn().mockResolvedValue(freshData),
    });
    const provider = new DashboardViewProvider(dataManager as any, '/ext');

    provider.resolveWebviewView(makeWebviewView(webview) as any, {} as any, {} as any);
    await vi.runAllTimersAsync();

    expect(postMessage.mock.calls[0][0]).toMatchObject({
      type: 'dashboardData',
      data: cachedData,
      cache: { source: 'disk', stale: true },
    });
    expect(postMessage.mock.calls.at(-1)?.[0]).toMatchObject({
      type: 'dashboardData',
      data: freshData,
      cache: { source: 'fresh', stale: false },
    });
  });

  it('posts initial dashboard data after the sidebar webview resolves', async () => {
    vi.useFakeTimers();
    const dashboardData = { changes: [], specs: [], lastRefresh: 123 };
    const dataManager = {
      onRefresh: vi.fn(() => ({ dispose: vi.fn() })),
      getDashboardData: vi.fn().mockResolvedValue(dashboardData),
      getCachedDashboardData: vi.fn().mockResolvedValue(undefined),
      refresh: vi.fn().mockResolvedValue(dashboardData),
      getCliDiagnostic: vi.fn().mockReturnValue(null),
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

    expect(dataManager.refresh).toHaveBeenCalled();
    expect(webview.postMessage).toHaveBeenCalledWith({
      type: 'dashboardData',
      data: dashboardData,
      debug: false,
      cache: { source: 'fresh', stale: false },
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
      getCachedDashboardData: vi.fn().mockResolvedValue(undefined),
      refresh: vi.fn().mockResolvedValue(dashboardData),
      getCliDiagnostic: vi.fn().mockReturnValue(null),
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
      cache: { source: 'fresh', stale: false },
    });
  });

  it('forwards initialTab and interactiveAction when opening change detail from the dashboard', async () => {
    const dataManager = {
      onRefresh: vi.fn(() => ({ dispose: vi.fn() })),
      getDashboardData: vi.fn().mockResolvedValue({ changes: [], specs: [], lastRefresh: 1 }),
    };
    const panelManager = {
      open: vi.fn(),
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

    const provider = new DashboardViewProvider(dataManager as any, '/ext', panelManager as any);
    provider.resolveWebviewView(webviewView as any, {} as any, {} as any);

    const handler = vi.mocked(webview.onDidReceiveMessage).mock.calls[0]?.[0];
    await handler?.({
      type: 'openChangeDetailInEditor',
      changeName: 'demo-change',
      initialTab: 'verifyArchive',
      interactiveAction: 'archive',
      scopeId: 'store:team-plans',
    });

    expect(panelManager.open).toHaveBeenCalledWith('demo-change', {
      initialTab: 'verifyArchive',
      interactiveAction: 'archive',
      scopeId: 'store:team-plans',
    });
  });

  it('keeps same-named spec preview panels isolated by scope', async () => {
    const localScope = { id: 'local:/workspace', rootPath: '/workspace', source: 'local' };
    const storeScope = { id: 'store:team-plans', rootPath: '/stores/team-plans', source: 'store' };
    const dataManager = {
      onRefresh: vi.fn(() => ({ dispose: vi.fn() })),
      getDashboardData: vi.fn().mockResolvedValue({ changes: [], specs: [], lastRefresh: 1 }),
      getCliDiagnostic: vi.fn().mockReturnValue(null),
      resolveScope: vi.fn((scopeId?: string) => (scopeId === storeScope.id ? storeScope : localScope)),
      readSpec: vi.fn(async (_specId: string, scope?: { id: string }) => `# ${scope?.id ?? 'default'}`),
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
    const createSpecPanel = () => ({
      webview: {
        html: '',
        cspSource: 'vscode-resource',
        asWebviewUri: vi.fn((uri) => `vscode-resource:${uri.fsPath}`),
        postMessage: vi.fn(),
        onDidReceiveMessage: vi.fn(),
      },
      reveal: vi.fn(),
      onDidDispose: vi.fn(),
    });
    const vscode = await import('vscode');
    vi.mocked(vscode.window.createWebviewPanel)
      .mockReturnValueOnce(createSpecPanel() as any)
      .mockReturnValueOnce(createSpecPanel() as any);

    const provider = new DashboardViewProvider(dataManager as any, '/ext');
    provider.resolveWebviewView(webviewView as any, {} as any, {} as any);

    const handler = vi.mocked(webview.onDidReceiveMessage).mock.calls[0]?.[0];
    await handler?.({ type: 'openSpecInEditor', specId: 'auth', scopeId: localScope.id });
    await handler?.({ type: 'openSpecInEditor', specId: 'auth', scopeId: storeScope.id });

    await vi.waitFor(() => {
      expect(vscode.window.createWebviewPanel).toHaveBeenCalledTimes(2);
    });
    expect(dataManager.readSpec).toHaveBeenNthCalledWith(1, 'auth', localScope);
    expect(dataManager.readSpec).toHaveBeenNthCalledWith(2, 'auth', storeScope);
  });

  describe('CLI activation diagnostic', () => {
    const diagnostic = {
      category: 'cli-not-found',
      message: 'OpenSpec CLI unavailable',
      recoveryActions: ['open-docs', 'open-settings', 'retry', 'copy-diagnostics'],
      safeDetails: ['extension host PATH: failed ENOENT'],
      copyText: 'category=cli-not-found',
      canRetry: true,
      normalizedMessage: 'openspec cli unavailable',
    };

    function createDiagnosticDataManager(loadDashboardData: () => Promise<any>) {
      return {
        onRefresh: vi.fn(() => ({ dispose: vi.fn() })),
        getDashboardData: loadDashboardData,
        getCachedDashboardData: vi.fn().mockResolvedValue(undefined),
        getCliDiagnostic: vi.fn().mockReturnValue(diagnostic),
        refresh: vi.fn(loadDashboardData),
      };
    }

    it('posts blocking diagnostic when initial data fails without cached data', async () => {
      vi.useFakeTimers();
      const dataManager = createDiagnosticDataManager(() => Promise.reject(new Error('OpenSpec CLI unavailable')));
      const webview = {
        options: undefined,
        html: '',
        cspSource: 'vscode-resource',
        asWebviewUri: vi.fn((uri) => `vscode-resource:${uri.fsPath}`),
        postMessage: vi.fn(),
        onDidReceiveMessage: vi.fn(),
      };
      const webviewView = { webview, onDidDispose: vi.fn(), show: vi.fn() };

      const provider = new DashboardViewProvider(dataManager as any, '/ext');
      provider.resolveWebviewView(webviewView as any, {} as any, {} as any);
      await vi.runAllTimersAsync();

      expect(webview.postMessage).toHaveBeenCalledWith({
        type: 'cliActivationDiagnostic',
        diagnostic,
        mode: 'blocking',
      });
    });

    it('posts warning diagnostic alongside cached data on refresh', async () => {
      const dataManager = createDiagnosticDataManager(() => Promise.resolve({ changes: [], specs: [], lastRefresh: 1 }));
      const webview = {
        options: undefined,
        html: '',
        cspSource: 'vscode-resource',
        asWebviewUri: vi.fn((uri) => `vscode-resource:${uri.fsPath}`),
        postMessage: vi.fn(),
        onDidReceiveMessage: vi.fn(),
      };
      const webviewView = { webview, onDidDispose: vi.fn(), show: vi.fn() };

      const provider = new DashboardViewProvider(dataManager as any, '/ext');
      provider.resolveWebviewView(webviewView as any, {} as any, {} as any);
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Trigger the onRefresh callback to simulate a refresh with diagnostic present
      const onRefreshCallback = vi.mocked(dataManager.onRefresh).mock.calls[0]?.[0];
      onRefreshCallback?.({ changes: [], specs: [], lastRefresh: 2 });

      expect(webview.postMessage).toHaveBeenCalledWith({
        type: 'cliActivationDiagnostic',
        diagnostic,
        mode: 'warning',
      });
    });

    it('opens cliPath settings when requested', async () => {
      const vscode = await import('vscode');
      const dataManager = createDiagnosticDataManager(() => Promise.resolve({ changes: [], specs: [], lastRefresh: 1 }));
      const webview = {
        options: undefined,
        html: '',
        cspSource: 'vscode-resource',
        asWebviewUri: vi.fn((uri) => `vscode-resource:${uri.fsPath}`),
        postMessage: vi.fn(),
        onDidReceiveMessage: vi.fn(),
      };
      const webviewView = { webview, onDidDispose: vi.fn(), show: vi.fn() };

      const provider = new DashboardViewProvider(dataManager as any, '/ext');
      provider.resolveWebviewView(webviewView as any, {} as any, {} as any);

      const handler = vi.mocked(webview.onDidReceiveMessage).mock.calls[0]?.[0];
      await handler?.({ type: 'openCliPathSettings' });

      expect(vscode.commands.executeCommand).toHaveBeenCalledWith('workbench.action.openSettings', 'openspec.cliPath');
    });

    it('copies diagnostic text when requested', async () => {
      const vscode = await import('vscode');
      const dataManager = createDiagnosticDataManager(() => Promise.resolve({ changes: [], specs: [], lastRefresh: 1 }));
      const webview = {
        options: undefined,
        html: '',
        cspSource: 'vscode-resource',
        asWebviewUri: vi.fn((uri) => `vscode-resource:${uri.fsPath}`),
        postMessage: vi.fn(),
        onDidReceiveMessage: vi.fn(),
      };
      const webviewView = { webview, onDidDispose: vi.fn(), show: vi.fn() };

      const provider = new DashboardViewProvider(dataManager as any, '/ext');
      provider.resolveWebviewView(webviewView as any, {} as any, {} as any);

      const handler = vi.mocked(webview.onDidReceiveMessage).mock.calls[0]?.[0];
      await handler?.({ type: 'copyCliDiagnostic' });

      expect(vscode.env.clipboard.writeText).toHaveBeenCalledWith(diagnostic.copyText);
    });

    it('opens install docs when requested', async () => {
      const vscode = await import('vscode');
      const dataManager = createDiagnosticDataManager(() => Promise.resolve({ changes: [], specs: [], lastRefresh: 1 }));
      const webview = {
        options: undefined,
        html: '',
        cspSource: 'vscode-resource',
        asWebviewUri: vi.fn((uri) => `vscode-resource:${uri.fsPath}`),
        postMessage: vi.fn(),
        onDidReceiveMessage: vi.fn(),
      };
      const webviewView = { webview, onDidDispose: vi.fn(), show: vi.fn() };

      const provider = new DashboardViewProvider(dataManager as any, '/ext');
      provider.resolveWebviewView(webviewView as any, {} as any, {} as any);

      const handler = vi.mocked(webview.onDidReceiveMessage).mock.calls[0]?.[0];
      await handler?.({ type: 'openCliInstallDocs' });

      expect(vscode.env.openExternal).toHaveBeenCalled();
    });

    it('refreshes dashboard data when retry succeeds', async () => {
      const refreshedData = { changes: [], specs: [], lastRefresh: 2 };
      const dataManager = {
        onRefresh: vi.fn(() => ({ dispose: vi.fn() })),
        getDashboardData: vi.fn(),
        getCliDiagnostic: vi.fn().mockReturnValue(diagnostic),
        refresh: vi.fn().mockResolvedValue(refreshedData),
      };
      const webview = {
        options: undefined,
        html: '',
        cspSource: 'vscode-resource',
        asWebviewUri: vi.fn((uri) => `vscode-resource:${uri.fsPath}`),
        postMessage: vi.fn(),
        onDidReceiveMessage: vi.fn(),
      };
      const webviewView = { webview, onDidDispose: vi.fn(), show: vi.fn() };

      const provider = new DashboardViewProvider(dataManager as any, '/ext');
      provider.resolveWebviewView(webviewView as any, {} as any, {} as any);

      const handler = vi.mocked(webview.onDidReceiveMessage).mock.calls[0]?.[0];
      await handler?.({ type: 'retryCliDetection' });

      expect(dataManager.refresh).toHaveBeenCalled();
      expect(webview.postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'dashboardData', data: refreshedData }));
    });
  });
});
