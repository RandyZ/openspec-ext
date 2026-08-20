import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as vscode from 'vscode';
import { DashboardViewProvider } from '@extension/providers/dashboardViewProvider';
import { ChangeDetailPanelManager } from '@extension/providers/changeDetailPanelManager';
import type {
  ExtensionMessage,
  ProjectChangesExplorerData,
  ProjectSidebarData,
  ProjectSpecsExplorerData,
} from '../../../src/webview/types/messages';
import type { OpenSpecRootBinding, ProjectContext } from '@extension/services/types';

const adapterFillChat = vi.hoisted(() => vi.fn());

vi.mock('@extension/adapters', () => ({
  getCurrentAdapter: vi.fn(async () => ({
    id: 'cursor',
    displayName: 'Cursor',
    fillChat: adapterFillChat,
  })),
  getAdapterById: vi.fn(async () => ({
    id: 'cursor',
    displayName: 'Cursor',
    fillChat: adapterFillChat,
  })),
}));

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
      showInputBox: vi.fn(async () => 'project-change'),
      showInformationMessage: vi.fn(),
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
  it('project page contract keeps Sidebar and Explorer payloads distinguishable and fully bound', () => {
    const projectA: ProjectContext = {
      id: '/projects/project-a',
      label: 'same-label',
      projectPath: '/projects/project-a',
    };
    const bindingA: OpenSpecRootBinding = {
      projectId: projectA.id,
      commandCwd: projectA.projectPath,
      rootPath: '/planning/project-a',
      rootSource: 'nearest',
    };
    const projectB: ProjectContext = {
      ...projectA,
      id: '/projects/project-b',
      projectPath: '/projects/project-b',
    };
    const bindingB: OpenSpecRootBinding = {
      ...bindingA,
      projectId: projectB.id,
      commandCwd: projectB.projectPath,
      rootPath: '/planning/project-b',
    };
    const sidebar: ProjectSidebarData = {
      project: projectA,
      binding: bindingA,
      changes: [{
        name: 'same-change',
        completedTasks: 0,
        totalTasks: 1,
        lastModified: '2026-08-19T00:00:00.000Z',
        status: 'draft',
        lifecycleStatus: 'planning',
      }],
    };
    const changes: ProjectChangesExplorerData = {
      project: projectB,
      binding: bindingB,
      changes: sidebar.changes,
      archivedChanges: [],
    };
    const specs: ProjectSpecsExplorerData = {
      project: projectA,
      binding: bindingA,
      projectSpecs: [],
      referencedStoreSpecs: [],
    };
    const messages: ExtensionMessage[] = [
      { type: 'setContext', view: 'sidebar', data: sidebar },
      { type: 'setContext', view: 'changesExplorer', data: changes },
      { type: 'setContext', view: 'specsExplorer', data: specs },
    ];

    expect(messages.map((message) => message.type === 'setContext' ? message.view : message.type))
      .toEqual(['sidebar', 'changesExplorer', 'specsExplorer']);
    expect((messages[0] as { type: 'setContext'; view: 'sidebar'; data: ProjectSidebarData }).data.binding)
      .toEqual(bindingA);
    expect((messages[1] as { type: 'setContext'; view: 'changesExplorer'; data: ProjectChangesExplorerData }).data.binding)
      .toEqual(bindingB);
    expect((messages[2] as { type: 'setContext'; view: 'specsExplorer'; data: ProjectSpecsExplorerData }).data.binding)
      .toEqual(bindingA);
    expect((messages[0] as { type: 'setContext'; view: 'sidebar'; data: ProjectSidebarData }).data.project.label)
      .toBe((messages[1] as { type: 'setContext'; view: 'changesExplorer'; data: ProjectChangesExplorerData }).data.project.label);
    expect((messages[0] as { type: 'setContext'; view: 'sidebar'; data: ProjectSidebarData }).data.project.id)
      .not.toBe((messages[1] as { type: 'setContext'; view: 'changesExplorer'; data: ProjectChangesExplorerData }).data.project.id);
  });

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

  function makeProjectFixture(rootPath = '/planning/current') {
    const project: ProjectContext = {
      id: '/projects/current',
      label: 'Current Project',
      projectPath: '/projects/current',
    };
    const binding: OpenSpecRootBinding = {
      projectId: project.id,
      commandCwd: project.projectPath,
      rootPath,
      rootSource: 'nearest',
    };
    return { project, binding };
  }

  function makeProjectChange(name: string, lifecycleStatus = 'planning') {
    return {
      name,
      completedTasks: 0,
      totalTasks: 1,
      lastModified: '2026-08-19T00:00:00.000Z',
      status: 'draft' as const,
      lifecycleStatus,
    };
  }

  function makeProjectProvider(
    dataManager: Record<string, unknown>,
    gateway: Record<string, unknown>,
    fixture = makeProjectFixture()
  ) {
    return new (DashboardViewProvider as any)(
      dataManager,
      '/ext',
      undefined,
      undefined,
      fixture.project,
      gateway
    ) as DashboardViewProvider;
  }

  function makeEditorPanel() {
    return {
      webview: makeWebview(),
      reveal: vi.fn(),
      onDidDispose: vi.fn(),
      onDidChangeViewState: vi.fn(),
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

  it('project Sidebar loads only current-project active Changes with its binding', async () => {
    vi.useFakeTimers();
    const fixture = makeProjectFixture();
    const active = makeProjectChange('active-change');
    const archived = makeProjectChange('archived-change', 'archived');
    const gateway = {
      loadChanges: vi.fn().mockResolvedValue({
        project: fixture.project,
        binding: fixture.binding,
        changes: [active, archived],
      }),
    };
    const dataManager = makeDataManager({
      refresh: vi.fn().mockResolvedValue(makeDashboardData({ changeName: 'legacy', lastRefresh: 1 })),
    });
    const postMessage = vi.fn();
    const webview = makeWebview(postMessage);
    const provider = makeProjectProvider(dataManager, gateway, fixture);

    provider.resolveWebviewView(makeWebviewView(webview) as any, {} as any, {} as any);
    await vi.runAllTimersAsync();

    expect(postMessage).toHaveBeenCalledWith({
      type: 'setContext',
      view: 'sidebar',
      data: expect.objectContaining({
        project: fixture.project,
        binding: fixture.binding,
        changes: [active],
      }),
    });
    expect(postMessage.mock.calls.some(([message]) => message.type === 'dashboardData')).toBe(false);
  });

  it('project Sidebar actions use the Project root instead of the selected Store scope', async () => {
    vi.useFakeTimers();
    const fixture = makeProjectFixture('/planning/current');
    const selectedStoreScope = {
      id: 'store:team-plans',
      label: 'team-plans',
      rootPath: '/stores/team-plans',
      source: 'store',
      runtimeSource: 'installed',
      capabilities: { stores: true, context: true, doctor: true, worksets: true, diagnostics: [] },
      diagnostics: [],
    };
    const createChange = vi.fn().mockResolvedValue(undefined);
    const resolveScope = vi.fn().mockReturnValue(selectedStoreScope);
    const dataManager = makeDataManager({
      resolveScope,
      createChange,
      getDashboardData: vi.fn().mockResolvedValue({ changes: [], specs: [], lastRefresh: 1 }),
      getWorkspaceRoot: vi.fn().mockReturnValue('/workspace'),
    });
    const gateway = {
      loadChanges: vi.fn().mockResolvedValue({
        project: fixture.project,
        binding: fixture.binding,
        changes: [],
      }),
    };
    const postMessage = vi.fn();
    const webview = makeWebview(postMessage);
    const provider = makeProjectProvider(dataManager, gateway, fixture);

    vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
      get: vi.fn((key: string) => {
        if (key === 'workflowLaunchMode') return 'adapter';
        if (key === 'preferredAgentAdapter') return 'cursor';
        return false;
      }),
      inspect: vi.fn(() => undefined),
    } as any);
    adapterFillChat.mockResolvedValue({ success: true, adapterId: 'cursor' });

    provider.resolveWebviewView(makeWebviewView(webview) as any, {} as any, {} as any);
    await vi.runAllTimersAsync();
    const handler = vi.mocked(webview.onDidReceiveMessage).mock.calls[0]?.[0];

    await handler?.({ type: 'requestNewChange', scopeId: selectedStoreScope.id });
    await handler?.({
      type: 'launchWorkflowAction',
      action: 'apply',
      changeName: 'project-change',
      scopeId: selectedStoreScope.id,
    });

    expect(resolveScope).not.toHaveBeenCalled();
    expect(createChange).toHaveBeenCalledWith(
      'project-change',
      expect.objectContaining({ rootPath: fixture.binding.rootPath }),
    );
    expect(createChange.mock.calls[0][1]).not.toEqual(
      expect.objectContaining({ rootPath: selectedStoreScope.rootPath }),
    );
    expect(adapterFillChat).toHaveBeenCalledWith(expect.objectContaining({
      workspaceRoot: fixture.binding.rootPath,
    }));
  });

  it('project Sidebar keeps navigation data when there are no active Changes', async () => {
    vi.useFakeTimers();
    const fixture = makeProjectFixture();
    const gateway = {
      loadChanges: vi.fn().mockResolvedValue({
        project: fixture.project,
        binding: fixture.binding,
        changes: [],
      }),
    };
    const dataManager = makeDataManager({ refresh: vi.fn() });
    const postMessage = vi.fn();
    const provider = makeProjectProvider(dataManager, gateway, fixture);

    provider.resolveWebviewView(makeWebviewView(makeWebview(postMessage)) as any, {} as any, {} as any);
    await vi.runAllTimersAsync();

    const sidebarMessage = postMessage.mock.calls
      .map(([message]) => message)
      .find((message) => message.type === 'setContext' && message.view === 'sidebar');
    expect(sidebarMessage.data.changes).toEqual([]);
    expect(sidebarMessage.data.project).toEqual(fixture.project);
  });

  it('project refreshes use the Project loader for watcher and manual refresh', async () => {
    vi.useFakeTimers();
    const fixture = makeProjectFixture();
    const first = makeProjectChange('first-change');
    const second = makeProjectChange('second-change');
    const gateway = {
      loadChanges: vi.fn()
        .mockResolvedValueOnce({ project: fixture.project, binding: fixture.binding, changes: [first] })
        .mockResolvedValue({ project: fixture.project, binding: fixture.binding, changes: [second] }),
    };
    const refresh = vi.fn().mockResolvedValue(makeDashboardData({ changeName: 'legacy', lastRefresh: 2 }));
    const dataManager = makeDataManager({ refresh });
    const postMessage = vi.fn();
    const webview = makeWebview(postMessage);
    const provider = makeProjectProvider(dataManager, gateway, fixture);

    provider.resolveWebviewView(makeWebviewView(webview) as any, {} as any, {} as any);
    await vi.runAllTimersAsync();
    postMessage.mockClear();

    const refreshCallback = (dataManager.onRefresh as any).mock.calls[0]?.[0] as ((data: any) => void) | undefined;
    refreshCallback?.(makeDashboardData({ changeName: 'legacy-refresh', lastRefresh: 3 }));
    await vi.runAllTimersAsync();
    expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: 'setContext',
      view: 'sidebar',
      data: expect.objectContaining({ changes: [second] }),
    }));

    postMessage.mockClear();
    const handler = vi.mocked(webview.onDidReceiveMessage).mock.calls[0]?.[0];
    await handler?.({ type: 'refresh' });
    expect(refresh).toHaveBeenCalled();
    expect(postMessage.mock.calls.some(([message]) => message.type === 'setContext')).toBe(true);
    expect(postMessage.mock.calls.some(([message]) => message.type === 'dashboardData')).toBe(false);
  });

  it('Project cache renders cached data before a fresh refresh completes', async () => {
    vi.useFakeTimers();
    const fixture = makeProjectFixture();
    const cached = makeProjectChange('cached-change');
    const fresh = makeProjectChange('fresh-change');
    let resolveRefresh: ((value: unknown) => void) | undefined;
    const gateway = {
      loadChanges: vi.fn()
        .mockResolvedValueOnce({ project: fixture.project, binding: fixture.binding, changes: [cached] })
        .mockImplementationOnce(() => new Promise((resolve) => { resolveRefresh = resolve; })),
    };
    const cacheService = {
      readProjectPage: vi.fn().mockResolvedValue({
        payload: {
          project: fixture.project,
          binding: fixture.binding,
          changes: [cached],
          lastRefresh: 1,
        },
        metadata: { generatedAt: 1 },
      }),
      writeProjectPage: vi.fn().mockResolvedValue(undefined),
    };
    const postMessage = vi.fn();
    const provider = new (DashboardViewProvider as any)(
      makeDataManager({ cacheService }),
      '/ext',
      undefined,
      undefined,
      fixture.project,
      gateway,
      cacheService,
    ) as DashboardViewProvider;
    const webview = makeWebview(postMessage);

    provider.resolveWebviewView(makeWebviewView(webview) as any, {} as any, {} as any);
    await vi.runAllTimersAsync();
    postMessage.mockClear();
    (provider as any).cachedProjectSidebarData = undefined;

    const handler = vi.mocked(webview.onDidReceiveMessage).mock.calls[0]?.[0];
    const refresh = handler?.({ type: 'getProjectSidebarData' });
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: 'setContext',
      view: 'sidebar',
      data: expect.objectContaining({
        changes: [cached],
        cache: { source: 'disk', stale: true, generatedAt: 1 },
      }),
    }));

    resolveRefresh?.({ project: fixture.project, binding: fixture.binding, changes: [fresh] });
    await refresh;
    const freshMessage = postMessage.mock.calls
      .map(([message]) => message)
      .filter((message) => message.type === 'setContext' && message.view === 'sidebar')
      .at(-1);
    expect(freshMessage).toEqual(expect.objectContaining({
      type: 'setContext',
      view: 'sidebar',
      data: expect.objectContaining({ changes: [fresh], cache: { source: 'fresh', stale: false } }),
    }));
    expect(cacheService.writeProjectPage).toHaveBeenCalled();
  });

  it('late refresh from binding A cannot replace current binding B', async () => {
    vi.useFakeTimers();
    const fixtureA = makeProjectFixture('/planning/project-a');
    const fixtureB = { ...fixtureA, binding: { ...fixtureA.binding, rootPath: '/planning/project-b' } };
    const resolvers: ((value: unknown) => void)[] = [];
    const gateway = {
      loadChanges: vi.fn(() => new Promise((resolve) => resolvers.push(resolve))),
    };
    const postMessage = vi.fn();
    const provider = makeProjectProvider(makeDataManager(), gateway, fixtureA);
    provider.resolveWebviewView(makeWebviewView(makeWebview(postMessage)) as any, {} as any, {} as any);
    await vi.runAllTimersAsync();

    const refreshCallback = (provider as any).projectRequestGeneration;
    expect(refreshCallback).toBe(1);
    (provider as any).projectContext = fixtureB.project;
    const secondRefresh = (provider as any).reloadProjectSidebarData();
    resolvers[1]?.({ project: fixtureB.project, binding: fixtureB.binding, changes: [makeProjectChange('project-b')] });
    await secondRefresh;
    resolvers[0]?.({ project: fixtureA.project, binding: fixtureA.binding, changes: [makeProjectChange('project-a')] });
    await Promise.resolve();

    const sidebarMessages = postMessage.mock.calls
      .map(([message]) => message)
      .filter((message) => message.type === 'setContext' && message.view === 'sidebar');
    expect(sidebarMessages.at(-1)?.data.binding.rootPath).toBe('/planning/project-b');
    expect(sidebarMessages.some((message) => message.data.binding.rootPath === '/planning/project-a')).toBe(false);
  });

  it('click-time detail navigation reuses the current binding without reloading Project data', async () => {
    vi.useFakeTimers();
    const fixture = makeProjectFixture();
    const panelManager = { open: vi.fn() };
    const gateway = {
      loadChanges: vi.fn().mockResolvedValue({ project: fixture.project, binding: fixture.binding, changes: [] }),
      resolveBinding: vi.fn().mockResolvedValue(fixture.binding),
    };
    const provider = new (DashboardViewProvider as any)(
      makeDataManager(),
      '/ext',
      panelManager,
      undefined,
      fixture.project,
      gateway,
    ) as DashboardViewProvider;
    const webview = makeWebview();
    provider.resolveWebviewView(makeWebviewView(webview) as any, {} as any, {} as any);
    await vi.runAllTimersAsync();
    const handler = vi.mocked(webview.onDidReceiveMessage).mock.calls[0]?.[0];
    await handler?.({
      type: 'openChangeDetailInEditor',
      changeName: 'same-change',
      project: fixture.project,
      binding: fixture.binding,
    });

    expect(gateway.loadChanges).toHaveBeenCalledTimes(1);
    expect(gateway.resolveBinding).not.toHaveBeenCalled();
    expect(panelManager.open).toHaveBeenCalledWith('same-change', expect.objectContaining({ binding: fixture.binding }));
  });

  it('discards a late Project Sidebar response for an older binding request', async () => {
    vi.useFakeTimers();
    const fixture = makeProjectFixture();
    const first = makeProjectChange('first-change');
    const latest = makeProjectChange('latest-change');
    const resolvers: ((value: unknown) => void)[] = [];
    const gateway = {
      loadChanges: vi.fn(() => new Promise((resolve) => resolvers.push(resolve))),
    };
    const dataManager = makeDataManager();
    const postMessage = vi.fn();
    const webview = makeWebview(postMessage);
    const provider = makeProjectProvider(dataManager, gateway, fixture);

    provider.resolveWebviewView(makeWebviewView(webview) as any, {} as any, {} as any);
    await vi.runAllTimersAsync();
    const refreshCallback = (dataManager.onRefresh as any).mock.calls[0]?.[0] as ((data: any) => void) | undefined;
    refreshCallback?.(makeDashboardData({ changeName: 'legacy-a', lastRefresh: 1 }));
    refreshCallback?.(makeDashboardData({ changeName: 'legacy-b', lastRefresh: 2 }));

    resolvers[2]?.({ project: fixture.project, binding: fixture.binding, changes: [latest] });
    await Promise.resolve();
    resolvers[0]?.({ project: fixture.project, binding: fixture.binding, changes: [first] });
    resolvers[1]?.({ project: fixture.project, binding: fixture.binding, changes: [first] });
    await Promise.resolve();

    const sidebarMessages = postMessage.mock.calls
      .map(([message]) => message)
      .filter((message) => message.type === 'setContext' && message.view === 'sidebar');
    expect(sidebarMessages.at(-1).data.changes).toEqual([latest]);
    expect(sidebarMessages.some((message) => message.data.changes.includes(first))).toBe(false);
  });

  it('shows a blocking CLI activation diagnostic instead of an empty Project Sidebar', async () => {
    vi.useFakeTimers();
    const fixture = makeProjectFixture();
    const diagnostic = {
      category: 'cli-not-found',
      message: 'OpenSpec CLI unavailable',
      recoveryActions: ['retry'],
      safeDetails: ['spawn failed'],
      copyText: 'category=cli-not-found',
      canRetry: true,
      normalizedMessage: 'openspec cli unavailable',
    };
    const gateway = { loadChanges: vi.fn().mockRejectedValue(new Error('CLI unavailable')) };
    const postMessage = vi.fn();
    const dataManager = makeDataManager({ getCliDiagnostic: vi.fn().mockReturnValue(diagnostic) });
    const provider = makeProjectProvider(dataManager, gateway, fixture);

    provider.resolveWebviewView(makeWebviewView(makeWebview(postMessage)) as any, {} as any, {} as any);
    await vi.runAllTimersAsync();

    expect(postMessage).toHaveBeenCalledWith({
      type: 'cliActivationDiagnostic',
      diagnostic,
      mode: 'blocking',
    });
    expect(postMessage.mock.calls.some(([message]) => message.type === 'setContext')).toBe(false);
  });

  it('classifies an uninitialized Project separately from CLI activation failure', async () => {
    vi.useFakeTimers();
    const fixture = makeProjectFixture();
    const gateway = {
      loadChanges: vi.fn().mockRejectedValue({
        name: 'ProjectDataAccessError',
        phase: 'resolve',
        message: 'CLI context is missing root.path',
      }),
    };
    const postMessage = vi.fn();
    const dataManager = makeDataManager({ getCliDiagnostic: vi.fn().mockReturnValue(null) });
    const provider = makeProjectProvider(dataManager, gateway, fixture);

    provider.resolveWebviewView(makeWebviewView(makeWebview(postMessage)) as any, {} as any, {} as any);
    await vi.runAllTimersAsync();

    expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: 'error',
      message: expect.stringContaining('not initialized'),
    }));
    expect(postMessage.mock.calls.some(([message]) => message.type === 'cliActivationDiagnostic')).toBe(false);
  });

  it('opens and reveals one binding-keyed Changes Explorer panel with fresh context', async () => {
    vi.useFakeTimers();
    const fixture = makeProjectFixture();
    const change = makeProjectChange('project-change');
    const gateway = {
      resolveBinding: vi.fn().mockResolvedValue(fixture.binding),
      loadChanges: vi.fn().mockResolvedValue({
        project: fixture.project,
        binding: fixture.binding,
        changes: [change],
      }),
      loadArchivedChanges: vi.fn().mockResolvedValue({
        project: fixture.project,
        binding: fixture.binding,
        archivedChanges: [{ directoryName: '2026-08-19-archived', name: 'archived', archiveDate: '2026-08-19' }],
      }),
    };
    const dataManager = makeDataManager();
    const sidebarWebview = makeWebview();
    const panel = makeEditorPanel();
    const replacementPanel = makeEditorPanel();
    const vscode = await import('vscode');
    vi.mocked(vscode.window.createWebviewPanel).mockReturnValueOnce(panel as any);
    const provider = makeProjectProvider(dataManager, gateway, fixture);

    provider.resolveWebviewView(makeWebviewView(sidebarWebview) as any, {} as any, {} as any);
    await vi.runAllTimersAsync();
    const handler = vi.mocked(sidebarWebview.onDidReceiveMessage).mock.calls[0]?.[0];
    await handler?.({ type: 'openChangesExplorer', project: fixture.project, binding: fixture.binding });
    await vi.runAllTimersAsync();
    await handler?.({ type: 'openChangesExplorer', project: fixture.project, binding: fixture.binding });

    expect(vscode.window.createWebviewPanel).toHaveBeenCalledTimes(1);
    expect(vscode.window.createWebviewPanel).toHaveBeenCalledWith(
      'openspecChangesExplorer',
      'OpenSpec Changes',
      1,
      expect.objectContaining({ retainContextWhenHidden: true })
    );
    expect(panel.reveal).toHaveBeenCalled();
    expect(panel.webview.postMessage).toHaveBeenCalledWith({
      type: 'setContext',
      view: 'changesExplorer',
      data: expect.objectContaining({
        binding: fixture.binding,
        changes: [change],
      }),
    });

    const dispose = vi.mocked(panel.onDidDispose).mock.calls[0]?.[0] as (() => void) | undefined;
    dispose?.();
    vi.mocked(vscode.window.createWebviewPanel).mockReturnValueOnce(replacementPanel as any);
    await handler?.({ type: 'openChangesExplorer', project: fixture.project, binding: fixture.binding });
    expect(vscode.window.createWebviewPanel).toHaveBeenCalledTimes(2);
  });

  it('consumes the initial Changes Explorer message without reloading Sidebar data', async () => {
    vi.useFakeTimers();
    const fixture = makeProjectFixture();
    const change = makeProjectChange('project-change');
    const gateway = {
      resolveBinding: vi.fn().mockResolvedValue(fixture.binding),
      loadChanges: vi.fn().mockResolvedValue({
        project: fixture.project,
        binding: fixture.binding,
        changes: [change],
      }),
      loadArchivedChanges: vi.fn().mockResolvedValue({
        project: fixture.project,
        binding: fixture.binding,
        archivedChanges: [],
      }),
    };
    const panelManager = { open: vi.fn() };
    const sidebarWebview = makeWebview();
    const explorerPanel = makeEditorPanel();
    const vscode = await import('vscode');
    vi.mocked(vscode.window.createWebviewPanel).mockReturnValueOnce(explorerPanel as any);
    const provider = new (DashboardViewProvider as any)(
      makeDataManager(),
      '/ext',
      panelManager,
      undefined,
      fixture.project,
      gateway,
    ) as DashboardViewProvider;

    provider.resolveWebviewView(makeWebviewView(sidebarWebview) as any, {} as any, {} as any);
    const sidebarHandler = vi.mocked(sidebarWebview.onDidReceiveMessage).mock.calls[0]?.[0];
    await sidebarHandler?.({ type: 'openChangesExplorer', project: fixture.project, binding: fixture.binding });
    const explorerHandler = vi.mocked(explorerPanel.webview.onDidReceiveMessage).mock.calls[0]?.[0];

    await explorerHandler?.({ type: 'getProjectSidebarData' });
    const dispose = vi.mocked(explorerPanel.onDidDispose).mock.calls[0]?.[0] as (() => void) | undefined;
    dispose?.();
    const initialMessages = explorerPanel.webview.postMessage.mock.calls.map(([message]) => message);
    const initialLoadChangesCalls = gateway.loadChanges.mock.calls.length;

    await explorerHandler?.({
      type: 'openChangeDetailInEditor',
      changeName: change.name,
      project: fixture.project,
      binding: fixture.binding,
    });
    expect(panelManager.open).toHaveBeenCalledWith(change.name, expect.objectContaining({ binding: fixture.binding }));
    expect(initialMessages).toHaveLength(1);
    expect(initialMessages[0]).toEqual(expect.objectContaining({
      type: 'setContext',
      view: 'changesExplorer',
      data: expect.objectContaining({ changes: [change] }),
    }));
    expect(initialMessages).not.toContainEqual(expect.objectContaining({ type: 'setContext', view: 'sidebar' }));
    expect(gateway.loadChanges).toHaveBeenCalledTimes(initialLoadChangesCalls);
  });

  it('replays the pending Changes Explorer context on a consecutive initialization request', async () => {
    vi.useFakeTimers();
    const fixture = makeProjectFixture();
    const change = makeProjectChange('project-change');
    const gateway = {
      resolveBinding: vi.fn().mockResolvedValue(fixture.binding),
      loadChanges: vi.fn().mockResolvedValue({
        project: fixture.project,
        binding: fixture.binding,
        changes: [change],
      }),
      loadArchivedChanges: vi.fn().mockResolvedValue({
        project: fixture.project,
        binding: fixture.binding,
        archivedChanges: [],
      }),
    };
    const sidebarWebview = makeWebview();
    const explorerPanel = makeEditorPanel();
    const vscode = await import('vscode');
    vi.mocked(vscode.window.createWebviewPanel).mockReturnValueOnce(explorerPanel as any);
    const provider = makeProjectProvider(makeDataManager(), gateway, fixture);

    provider.resolveWebviewView(makeWebviewView(sidebarWebview) as any, {} as any, {} as any);
    const sidebarHandler = vi.mocked(sidebarWebview.onDidReceiveMessage).mock.calls[0]?.[0];
    await sidebarHandler?.({ type: 'openChangesExplorer', project: fixture.project, binding: fixture.binding });
    const explorerHandler = vi.mocked(explorerPanel.webview.onDidReceiveMessage).mock.calls[0]?.[0];

    await explorerHandler?.({ type: 'getProjectSidebarData' });
    await vi.advanceTimersByTimeAsync(100);
    const loadChangesCallsBeforeReplay = gateway.loadChanges.mock.calls.length;
    await explorerHandler?.({ type: 'getProjectSidebarData' });

    const contextMessages = explorerPanel.webview.postMessage.mock.calls
      .map(([message]) => message)
      .filter((message) => message?.type === 'setContext');
    expect(contextMessages).toHaveLength(2);
    expect(contextMessages[0]).toEqual(contextMessages[1]);
    expect(contextMessages).not.toContainEqual(expect.objectContaining({ view: 'sidebar' }));
    expect(gateway.loadChanges).toHaveBeenCalledTimes(loadChangesCallsBeforeReplay);
  });

  it('opens a separate Specs Explorer panel and keeps project/store groups separate', async () => {
    vi.useFakeTimers();
    const fixture = makeProjectFixture();
    const gateway = {
      resolveBinding: vi.fn().mockResolvedValue(fixture.binding),
      loadChanges: vi.fn().mockResolvedValue({ project: fixture.project, binding: fixture.binding, changes: [] }),
      loadCanonicalSpecs: vi.fn().mockResolvedValue({
        project: fixture.project,
        binding: fixture.binding,
        specs: [{ id: 'project-spec', requirementCount: 1 }],
      }),
      loadReferencedStoreSpecs: vi.fn().mockResolvedValue({
        project: fixture.project,
        binding: fixture.binding,
        groups: [{ storeId: 'team-store', specs: [{ id: 'store-spec', requirementCount: 2 }] }],
      }),
    };
    const dataManager = makeDataManager();
    const sidebarWebview = makeWebview();
    const panel = makeEditorPanel();
    const vscode = await import('vscode');
    vi.mocked(vscode.window.createWebviewPanel).mockReturnValueOnce(panel as any);
    const provider = makeProjectProvider(dataManager, gateway, fixture);

    provider.resolveWebviewView(makeWebviewView(sidebarWebview) as any, {} as any, {} as any);
    await vi.runAllTimersAsync();
    const handler = vi.mocked(sidebarWebview.onDidReceiveMessage).mock.calls[0]?.[0];
    await handler?.({ type: 'openSpecsExplorer', project: fixture.project, binding: fixture.binding });
    await vi.runAllTimersAsync();

    expect(vscode.window.createWebviewPanel).toHaveBeenCalledWith(
      'openspecSpecsExplorer',
      'OpenSpec Specs',
      1,
      expect.objectContaining({ retainContextWhenHidden: true })
    );
    expect(panel.webview.postMessage).toHaveBeenCalledWith({
      type: 'setContext',
      view: 'specsExplorer',
      data: expect.objectContaining({
        projectSpecs: [{ id: 'project-spec', requirementCount: 1 }],
        referencedStoreSpecs: [{ storeId: 'team-store', specs: [{ id: 'store-spec', requirementCount: 2 }] }],
      }),
    });
  });

  it('consumes the initial Specs Explorer message without reloading Sidebar data', async () => {
    vi.useFakeTimers();
    const fixture = makeProjectFixture();
    const gateway = {
      resolveBinding: vi.fn().mockResolvedValue(fixture.binding),
      loadChanges: vi.fn().mockResolvedValue({ project: fixture.project, binding: fixture.binding, changes: [] }),
      loadCanonicalSpecs: vi.fn().mockResolvedValue({
        project: fixture.project,
        binding: fixture.binding,
        specs: [{ id: 'project-spec', requirementCount: 1 }],
      }),
      loadReferencedStoreSpecs: vi.fn().mockResolvedValue({
        project: fixture.project,
        binding: fixture.binding,
        groups: [],
      }),
    };
    const dataManager = makeDataManager({
      readSpec: vi.fn().mockResolvedValue('project spec content'),
    }) as Record<string, any>;
    const sidebarWebview = makeWebview();
    const explorerPanel = makeEditorPanel();
    const specPanel = makeEditorPanel();
    const vscode = await import('vscode');
    vi.mocked(vscode.window.createWebviewPanel)
      .mockReturnValueOnce(explorerPanel as any)
      .mockReturnValueOnce(specPanel as any);
    const provider = makeProjectProvider(dataManager, gateway, fixture);

    provider.resolveWebviewView(makeWebviewView(sidebarWebview) as any, {} as any, {} as any);
    const sidebarHandler = vi.mocked(sidebarWebview.onDidReceiveMessage).mock.calls[0]?.[0];
    await sidebarHandler?.({ type: 'openSpecsExplorer', project: fixture.project, binding: fixture.binding });
    const explorerHandler = vi.mocked(explorerPanel.webview.onDidReceiveMessage).mock.calls[0]?.[0];

    await explorerHandler?.({ type: 'getProjectSidebarData' });
    await explorerHandler?.({ type: 'getProjectSidebarData' });
    const dispose = vi.mocked(explorerPanel.onDidDispose).mock.calls[0]?.[0] as (() => void) | undefined;
    dispose?.();
    const initialMessages = explorerPanel.webview.postMessage.mock.calls.map(([message]) => message);

    await explorerHandler?.({
      type: 'openSpecInEditor',
      specId: 'project-spec',
      project: fixture.project,
      binding: fixture.binding,
    });
    expect(dataManager.readSpec).toHaveBeenCalledWith(
      'project-spec',
      expect.objectContaining({ rootPath: fixture.binding.rootPath }),
    );
    expect(initialMessages).toHaveLength(2);
    expect(initialMessages[0]).toEqual(expect.objectContaining({
      type: 'setContext',
      view: 'specsExplorer',
      data: expect.objectContaining({ projectSpecs: [{ id: 'project-spec', requirementCount: 1 }] }),
    }));
    expect(initialMessages[1]).toEqual(initialMessages[0]);
    expect(initialMessages).not.toContainEqual(expect.objectContaining({ type: 'setContext', view: 'sidebar' }));
    expect(gateway.loadChanges).not.toHaveBeenCalled();
  });

  it('opens a referenced duplicate Spec from the Store binding carried by the Explorer group', async () => {
    vi.useFakeTimers();
    const fixture = makeProjectFixture();
    const storeBinding: OpenSpecRootBinding = {
      ...fixture.binding,
      rootPath: '/stores/team-store',
      rootSource: 'store',
      storeId: 'team-store',
    };
    const gateway = {
      resolveBinding: vi.fn((_project: ProjectContext, storeId?: string) => (
        Promise.resolve(storeId ? storeBinding : fixture.binding)
      )),
      loadChanges: vi.fn().mockResolvedValue({
        project: fixture.project,
        binding: fixture.binding,
        changes: [],
      }),
      loadCanonicalSpecs: vi.fn().mockResolvedValue({
        project: fixture.project,
        binding: fixture.binding,
        specs: [{ id: 'shared', requirementCount: 1 }],
      }),
      loadReferencedStoreSpecs: vi.fn().mockResolvedValue({
        project: fixture.project,
        binding: fixture.binding,
        groups: [{
          storeId: 'team-store',
          binding: storeBinding,
          specs: [{ id: 'shared', requirementCount: 2 }],
        }],
      }),
    };
    const dataManager = makeDataManager({
      readSpec: vi.fn().mockResolvedValue('store spec content'),
    });
    const sidebarWebview = makeWebview();
    const explorerPanel = makeEditorPanel();
    const specPanel = makeEditorPanel();
    const vscode = await import('vscode');
    vi.mocked(vscode.window.createWebviewPanel)
      .mockReturnValueOnce(explorerPanel as any)
      .mockReturnValueOnce(specPanel as any);
    const provider = makeProjectProvider(dataManager, gateway, fixture);

    provider.resolveWebviewView(makeWebviewView(sidebarWebview) as any, {} as any, {} as any);
    await vi.runAllTimersAsync();
    const sidebarHandler = vi.mocked(sidebarWebview.onDidReceiveMessage).mock.calls[0]?.[0];
    await sidebarHandler?.({ type: 'openSpecsExplorer', project: fixture.project, binding: fixture.binding });
    await vi.runAllTimersAsync();

    const contextMessage = vi.mocked(explorerPanel.webview.postMessage).mock.calls.find(
      ([message]) => message?.type === 'setContext'
    )?.[0] as any;
    const storeGroup = contextMessage.data.referencedStoreSpecs[0];
    const explorerHandler = vi.mocked(explorerPanel.webview.onDidReceiveMessage).mock.calls[0]?.[0];
    await explorerHandler?.({
      type: 'openSpecInEditor',
      specId: 'shared',
      project: fixture.project,
      binding: storeGroup.binding,
    });

    expect(storeGroup.binding).toEqual(storeBinding);
    expect((dataManager as any).readSpec).toHaveBeenCalledWith(
      'shared',
      expect.objectContaining({ rootPath: storeBinding.rootPath, storeId: 'team-store' })
    );

    const specHandler = vi.mocked(specPanel.webview.onDidReceiveMessage).mock.calls[0]?.[0];
    await specHandler?.({ type: 'getProjectSidebarData' });
    await vi.runAllTimersAsync();
    const specMessages = specPanel.webview.postMessage.mock.calls.map(([message]) => message);
    expect(specMessages).toContainEqual({ type: 'specContent', specId: 'shared', content: 'store spec content' });
    expect(specMessages).not.toContainEqual(expect.objectContaining({ type: 'setContext', view: 'sidebar' }));
  });

  it('rejects a binding mismatch before creating a Changes or Specs Explorer panel', async () => {
    const fixture = makeProjectFixture();
    const forgedBinding = { ...fixture.binding, rootPath: '/forged/root' };
    const gateway = {
      resolveBinding: vi.fn().mockResolvedValue(fixture.binding),
      loadChanges: vi.fn().mockResolvedValue({ project: fixture.project, binding: fixture.binding, changes: [] }),
      loadArchivedChanges: vi.fn().mockResolvedValue({ project: fixture.project, binding: fixture.binding, archivedChanges: [] }),
      loadCanonicalSpecs: vi.fn(),
      loadReferencedStoreSpecs: vi.fn(),
    };
    const dataManager = makeDataManager();
    const sidebarWebview = makeWebview();
    const vscode = await import('vscode');
    const provider = makeProjectProvider(dataManager, gateway, fixture);
    provider.resolveWebviewView(makeWebviewView(sidebarWebview) as any, {} as any, {} as any);
    const handler = vi.mocked(sidebarWebview.onDidReceiveMessage).mock.calls[0]?.[0];

    await handler?.({ type: 'openChangesExplorer', project: fixture.project, binding: forgedBinding });
    await handler?.({ type: 'openSpecsExplorer', project: fixture.project, binding: forgedBinding });

    expect(vscode.window.createWebviewPanel).not.toHaveBeenCalled();
    expect(gateway.loadCanonicalSpecs).not.toHaveBeenCalled();
  });

  it('opens same-named bound detail only for the host-verified Project binding', async () => {
    const fixture = makeProjectFixture();
    const panelManager = { open: vi.fn() };
    const gateway = {
      resolveBinding: vi.fn().mockResolvedValue(fixture.binding),
      loadChanges: vi.fn().mockResolvedValue({ project: fixture.project, binding: fixture.binding, changes: [] }),
    };
    const dataManager = makeDataManager();
    const sidebarWebview = makeWebview();
    const provider = new (DashboardViewProvider as any)(
      dataManager,
      '/ext',
      panelManager,
      undefined,
      fixture.project,
      gateway
    ) as DashboardViewProvider;
    provider.resolveWebviewView(makeWebviewView(sidebarWebview) as any, {} as any, {} as any);
    const handler = vi.mocked(sidebarWebview.onDidReceiveMessage).mock.calls[0]?.[0];

    await handler?.({
      type: 'openChangeDetailInEditor',
      changeName: 'same-name',
      project: fixture.project,
      binding: fixture.binding,
    });
    await handler?.({
      type: 'openChangeDetailInEditor',
      changeName: 'same-name',
      project: fixture.project,
      binding: { ...fixture.binding, rootPath: '/forged/root' },
    });

    expect(panelManager.open).toHaveBeenCalledTimes(1);
    expect(panelManager.open).toHaveBeenCalledWith('same-name', expect.objectContaining({
      project: fixture.project,
      binding: fixture.binding,
    }));
  });

  it('opens same-named Project Spec details under separate verified Store bindings', async () => {
    const fixture = makeProjectFixture();
    const storeBinding: OpenSpecRootBinding = {
      ...fixture.binding,
      rootPath: '/stores/team-store',
      rootSource: 'store',
      storeId: 'team-store',
    };
    const gateway = {
      resolveBinding: vi.fn((_project: ProjectContext, storeId?: string) => (
        Promise.resolve(storeId ? storeBinding : fixture.binding)
      )),
      loadChanges: vi.fn().mockResolvedValue({ project: fixture.project, binding: fixture.binding, changes: [] }),
    };
    const dataManager: Record<string, any> = makeDataManager({
      readSpec: vi.fn().mockImplementation((specId: string, scope: any) => Promise.resolve(`${specId}:${scope.rootPath}`)),
      resolveScope: vi.fn(),
    });
    const sidebarWebview = makeWebview();
    const panelA = makeEditorPanel();
    const panelB = makeEditorPanel();
    const vscode = await import('vscode');
    vi.mocked(vscode.window.createWebviewPanel)
      .mockReturnValueOnce(panelA as any)
      .mockReturnValueOnce(panelB as any);
    const provider = makeProjectProvider(dataManager, gateway, fixture);
    provider.resolveWebviewView(makeWebviewView(sidebarWebview) as any, {} as any, {} as any);
    const handler = vi.mocked(sidebarWebview.onDidReceiveMessage).mock.calls[0]?.[0];

    await handler?.({
      type: 'openSpecInEditor',
      specId: 'same-spec',
      project: fixture.project,
      binding: fixture.binding,
    });
    await handler?.({
      type: 'openSpecInEditor',
      specId: 'same-spec',
      project: fixture.project,
      binding: storeBinding,
    });

    expect(vscode.window.createWebviewPanel).toHaveBeenCalledTimes(2);
    expect(dataManager.readSpec).toHaveBeenNthCalledWith(
      1,
      'same-spec',
      expect.objectContaining({ rootPath: fixture.binding.rootPath })
    );
    expect(dataManager.readSpec).toHaveBeenNthCalledWith(
      2,
      'same-spec',
      expect.objectContaining({ rootPath: storeBinding.rootPath, storeId: storeBinding.storeId })
    );
  });

  it('keys same-named active and archived Change details by Project binding', async () => {
    vi.useFakeTimers();
    const fixture = makeProjectFixture();
    const otherBinding = { ...fixture.binding, rootPath: '/planning/other' };
    const panelA = makeEditorPanel();
    const panelB = makeEditorPanel();
    const panelC = makeEditorPanel();
    const vscode = await import('vscode');
    vi.mocked(vscode.window.createWebviewPanel)
      .mockReturnValueOnce(panelA as any)
      .mockReturnValueOnce(panelB as any)
      .mockReturnValueOnce(panelC as any);
    const dataManager = {
      getDashboardData: vi.fn().mockResolvedValue({ changes: [], specs: [] }),
      artifactExists: vi.fn().mockResolvedValue(false),
      resolveScope: vi.fn(),
      getSelectedScope: vi.fn(),
    };
    const manager = new ChangeDetailPanelManager(
      dataManager as any,
      '/ext',
      {} as any
    );

    manager.open('same-name', { project: fixture.project, binding: fixture.binding });
    manager.open('same-name', { project: fixture.project, binding: otherBinding });
    manager.open('archive:2026-08-19-same-name', { project: fixture.project, binding: fixture.binding });
    await vi.runAllTimersAsync();

    expect(vscode.window.createWebviewPanel).toHaveBeenCalledTimes(3);
    expect(panelA.webview.postMessage).toHaveBeenCalledWith(expect.objectContaining({
      view: 'changeDetail',
      binding: fixture.binding,
    }));
    expect(panelB.webview.postMessage).toHaveBeenCalledWith(expect.objectContaining({
      view: 'changeDetail',
      binding: otherBinding,
    }));
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
      const onRefreshCallback = (dataManager.onRefresh as any).mock.calls[0]?.[0] as ((data: any) => void) | undefined;
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
