import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as vscode from 'vscode';
import * as fsPromises from 'fs/promises';
import { DashboardViewProvider } from '@extension/providers/dashboardViewProvider';
import { ChangeDetailPanelManager } from '@extension/providers/changeDetailPanelManager';
import { logger } from '@extension/utils/logger';
import type {
  ExtensionMessage,
  ProjectChangesExplorerData,
  ProjectSidebarData,
  ProjectSpecsExplorerData,
} from '../../../src/webview/types/messages';
import type { OpenSpecRootBinding, ProjectContext } from '@extension/services/types';

const adapterFillChat = vi.hoisted(() => vi.fn());

// realpath is the Host's canonicalization step for Workset member paths. The
// fake fixture paths do not exist on disk, so the identity implementation is
// mocked in; per-test `mockImplementationOnce` chains simulate symlink
// resolution and unresolvable folders.
vi.mock('fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs/promises')>();
  return { ...actual, realpath: vi.fn(async (value: unknown) => value) };
});

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
      showOpenDialog: vi.fn(),
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
  it('uses one unified Project Sidebar payload instead of tab-specific loaders', async () => {
    vi.useFakeTimers();
    const fixture = makeProjectFixture();
    const payload = {
      project: fixture.project,
      binding: fixture.binding,
      changes: [makeProjectChange('project-change')],
      archivedChanges: [],
      projectSpecs: [{ id: 'project-spec', requirementCount: 1 }],
      referencedStoreSpecs: [],
      lastRefresh: 1,
    };
    const gateway = {
      loadProjectSidebarData: vi.fn().mockResolvedValue(payload),
    };
    const postMessage = vi.fn();
    const provider = makeProjectProvider(makeDataManager(), gateway, fixture);

    provider.resolveWebviewView(makeWebviewView(makeWebview(postMessage)) as any, {} as any, {} as any);
    await vi.runAllTimersAsync();

    expect(gateway.loadProjectSidebarData).toHaveBeenCalledTimes(1);
    expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: 'setContext',
      view: 'sidebar',
      data: expect.objectContaining({
        archivedChanges: [],
        projectSpecs: [{ id: 'project-spec', requirementCount: 1 }],
      }),
    }));
  });

  it('publishes the accepted Project snapshot to Dashboard without a second Gateway load', async () => {
    vi.useFakeTimers();
    const fixture = makeProjectFixture();
    const payload = {
      project: fixture.project,
      binding: fixture.binding,
      changes: [makeProjectChange('project-change')],
      archivedChanges: [],
      projectSpecs: [{ id: 'project-spec', requirementCount: 1 }],
      referencedStoreSpecs: [],
      lastRefresh: 1,
    };
    const gateway = {
      loadProjectSidebarData: vi.fn().mockResolvedValue(payload),
    };
    const sidebarPostMessage = vi.fn();
    const panel = makeEditorPanel();
    const vscode = await import('vscode');
    vi.mocked(vscode.window.createWebviewPanel).mockReturnValue(panel as any);
    const provider = makeProjectProvider(makeDataManager(), gateway, fixture);

    provider.resolveWebviewView(makeWebviewView(makeWebview(sidebarPostMessage)) as any, {} as any, {} as any);
    await vi.runAllTimersAsync();
    const loadCount = gateway.loadProjectSidebarData.mock.calls.length;

    provider.openInEditor();
    await vi.advanceTimersByTimeAsync(100);
    await Promise.resolve();

    const dashboardMessage = panel.webview.postMessage.mock.calls
      .map(([message]) => message)
      .find((message) => message.type === 'setContext' && message.view === 'dashboard');
    const sidebarMessage = sidebarPostMessage.mock.calls
      .map(([message]) => message)
      .find((message) => message.type === 'setContext' && message.view === 'sidebar');

    expect(gateway.loadProjectSidebarData).toHaveBeenCalledTimes(loadCount);
    expect(dashboardMessage).toEqual(expect.objectContaining({
      type: 'setContext',
      view: 'dashboard',
      data: expect.objectContaining({ project: fixture.project }),
    }));
    expect(dashboardMessage.data.project).toBe(sidebarMessage.data.project);
    expect(dashboardMessage.data.changes).toBe(sidebarMessage.data.changes);
  });

  it('routes the Project Dashboard request to the existing Editor entry point', async () => {
    vi.useFakeTimers();
    const fixture = makeProjectFixture();
    const gateway = {
      loadProjectSidebarData: vi.fn().mockResolvedValue({
        project: fixture.project,
        binding: fixture.binding,
        changes: [],
        archivedChanges: [],
        projectSpecs: [],
        referencedStoreSpecs: [],
      }),
    };
    const webview = makeWebview();
    const provider = makeProjectProvider(makeDataManager(), gateway, fixture);
    const openInEditor = vi.spyOn(provider, 'openInEditor');

    provider.resolveWebviewView(makeWebviewView(webview) as any, {} as any, {} as any);
    await vi.runAllTimersAsync();
    const handler = vi.mocked(webview.onDidReceiveMessage).mock.calls[0]?.[0];

    await handler?.({ type: 'openProjectDashboard' });

    expect(openInEditor).toHaveBeenCalledTimes(1);
  });

  it('creates one Project Dashboard panel and reveals it on a warm second open', async () => {
    vi.useFakeTimers();
    const fixture = makeProjectFixture();
    const gateway = {
      loadProjectSidebarData: vi.fn().mockResolvedValue({
        project: fixture.project,
        binding: fixture.binding,
        changes: [],
        archivedChanges: [],
        projectSpecs: [],
        referencedStoreSpecs: [],
      }),
    };
    const panel = makeEditorPanel();
    const vscode = await import('vscode');
    vi.mocked(vscode.window.createWebviewPanel).mockReturnValue(panel as any);
    const provider = makeProjectProvider(makeDataManager(), gateway, fixture);

    provider.openInEditor();
    await vi.runAllTimersAsync();
    const loadCount = gateway.loadProjectSidebarData.mock.calls.length;
    panel.webview.postMessage.mockClear();

    provider.openInEditor();
    await vi.runAllTimersAsync();

    expect(vscode.window.createWebviewPanel).toHaveBeenCalledTimes(1);
    expect(panel.reveal).toHaveBeenCalledTimes(1);
    expect(gateway.loadProjectSidebarData).toHaveBeenCalledTimes(loadCount);
    expect(panel.webview.postMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: 'setContext',
      view: 'dashboard',
      data: expect.objectContaining({ project: fixture.project }),
    }));
  });

  it('rejects a warm Project Dashboard snapshot from another Project binding', async () => {
    vi.useFakeTimers();
    const fixture = makeProjectFixture();
    const otherProject: ProjectContext = {
      id: '/projects/other',
      label: 'Other Project',
      projectPath: '/projects/other',
    };
    const otherBinding: OpenSpecRootBinding = {
      ...fixture.binding,
      projectId: otherProject.id,
      commandCwd: otherProject.projectPath,
      rootPath: '/planning/other',
    };
    const gateway = {
      loadProjectSidebarData: vi.fn().mockResolvedValue({
        project: fixture.project,
        binding: fixture.binding,
        changes: [makeProjectChange('current-project-change')],
        archivedChanges: [],
        projectSpecs: [],
        referencedStoreSpecs: [],
      }),
    };
    const panel = makeEditorPanel();
    const vscode = await import('vscode');
    vi.mocked(vscode.window.createWebviewPanel).mockReturnValue(panel as any);
    const provider = makeProjectProvider(makeDataManager(), gateway, fixture) as any;
    provider.currentProjectBinding = otherBinding;
    provider.cachedProjectSidebarData = {
      project: otherProject,
      binding: otherBinding,
      changes: [makeProjectChange('wrong-project-change')],
      archivedChanges: [],
      projectSpecs: [],
      referencedStoreSpecs: [],
      lastRefresh: 1,
    };

    provider.openInEditor();
    await vi.runAllTimersAsync();

    const dashboardMessages = panel.webview.postMessage.mock.calls
      .map(([message]) => message)
      .filter((message) => message.type === 'setContext' && message.view === 'dashboard');
    expect(dashboardMessages.some((message) => message.data.project.id === otherProject.id)).toBe(false);
    expect(dashboardMessages.at(-1)).toEqual(expect.objectContaining({
      view: 'dashboard',
      data: expect.objectContaining({ project: fixture.project }),
    }));
  });

  it('publishes one fresh Project snapshot to both open Project surfaces', async () => {
    vi.useFakeTimers();
    const fixture = makeProjectFixture();
    const first = {
      project: fixture.project,
      binding: fixture.binding,
      changes: [makeProjectChange('first-change')],
      archivedChanges: [],
      projectSpecs: [],
      referencedStoreSpecs: [],
    };
    const second = { ...first, changes: [makeProjectChange('second-change')] };
    const gateway = {
      loadProjectSidebarData: vi.fn().mockResolvedValueOnce(first).mockResolvedValueOnce(second),
    };
    const sidebarPostMessage = vi.fn();
    const panel = makeEditorPanel();
    const vscode = await import('vscode');
    vi.mocked(vscode.window.createWebviewPanel).mockReturnValue(panel as any);
    const dataManager = makeDataManager();
    const provider = makeProjectProvider(dataManager, gateway, fixture);
    const sidebarWebview = makeWebview(sidebarPostMessage);

    provider.resolveWebviewView(makeWebviewView(sidebarWebview) as any, {} as any, {} as any);
    await vi.runAllTimersAsync();
    provider.openInEditor();
    await vi.advanceTimersByTimeAsync(100);
    await Promise.resolve();
    sidebarPostMessage.mockClear();
    panel.webview.postMessage.mockClear();

    const refreshCallback = (dataManager.onRefresh as any).mock.calls[0]?.[0] as (() => void) | undefined;
    refreshCallback?.();
    await vi.runAllTimersAsync();

    expect(sidebarPostMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: 'setContext',
      view: 'sidebar',
      data: expect.objectContaining({ changes: [second.changes[0] ] }),
    }));
    expect(panel.webview.postMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: 'setContext',
      view: 'dashboard',
      data: expect.objectContaining({ changes: [second.changes[0] ] }),
    }));
  });

  it('publishes Workset Project selection only to the Sidebar', async () => {
    vi.useFakeTimers();
    const current = makeProjectFixture();
    const selectedProject: ProjectContext = {
      id: '/projects/server-dotnetcore',
      label: 'server-dotnetcore',
      projectPath: '/projects/server-dotnetcore',
    };
    const selectedBinding: OpenSpecRootBinding = {
      projectId: selectedProject.id,
      commandCwd: selectedProject.projectPath,
      rootPath: '/planning/server-dotnetcore',
      rootSource: 'nearest',
    };
    const gateway = {
      loadProjectSidebarData: vi.fn(async (project: ProjectContext) => ({
        project,
        binding: project.id === current.project.id ? current.binding : selectedBinding,
        changes: [makeProjectChange(project.id === current.project.id ? 'current-change' : 'server-change')],
        archivedChanges: [],
        projectSpecs: [],
        referencedStoreSpecs: [],
      })),
      resolveWorksetProject: vi.fn().mockResolvedValue(selectedProject),
      resolveBinding: vi.fn().mockResolvedValue(selectedBinding),
    };
    const sidebarPostMessage = vi.fn();
    const panel = makeEditorPanel();
    const vscode = await import('vscode');
    vi.mocked(vscode.window.createWebviewPanel).mockReturnValue(panel as any);
    const provider = makeProjectProvider(makeDataManager(), gateway, current);
    const sidebarWebview = makeWebview(sidebarPostMessage);

    provider.resolveWebviewView(makeWebviewView(sidebarWebview) as any, {} as any, {} as any);
    await vi.runAllTimersAsync();
    provider.openInEditor();
    await vi.runAllTimersAsync();
    panel.webview.postMessage.mockClear();

    const handler = vi.mocked(sidebarWebview.onDidReceiveMessage).mock.calls[0]?.[0];
    await handler?.({
      type: 'selectWorksetProject',
      worksetName: 'shared-workset',
      memberPath: selectedProject.projectPath,
    });

    expect(sidebarPostMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: 'setContext',
      view: 'sidebar',
      data: expect.objectContaining({ project: selectedProject, binding: selectedBinding }),
    }));
    expect(panel.webview.postMessage).not.toHaveBeenCalled();
  });

  it('does not render a legacy Project cache payload missing unified fields', async () => {
    vi.useFakeTimers();
    const fixture = makeProjectFixture();
    let resolveFresh: ((value: unknown) => void) | undefined;
    const gateway = {
      resolveBinding: vi.fn().mockResolvedValue(fixture.binding),
      loadProjectSidebarData: vi.fn(() => new Promise((resolve) => { resolveFresh = resolve; })),
    };
    const cacheService = {
      readProjectPage: vi.fn().mockResolvedValue({
        payload: {
          project: fixture.project,
          binding: fixture.binding,
          changes: [],
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

    provider.resolveWebviewView(makeWebviewView(makeWebview(postMessage)) as any, {} as any, {} as any);
    await vi.advanceTimersByTimeAsync(100);
    await Promise.resolve();
    await Promise.resolve();

    expect(postMessage.mock.calls.some(([message]) => (
      message.type === 'setContext' && message.view === 'sidebar'
    ))).toBe(false);
    resolveFresh?.({
      project: fixture.project,
      binding: fixture.binding,
      changes: [],
      archivedChanges: [],
      projectSpecs: [],
      referencedStoreSpecs: [],
    });
  });

  it('short-circuits matching memory cache but refreshes after disk warm-open', async () => {
    vi.useFakeTimers();
    const fixture = makeProjectFixture();
    const memoryData = {
      project: fixture.project,
      binding: fixture.binding,
      changes: [makeProjectChange('memory-change')],
      archivedChanges: [],
      projectSpecs: [],
      referencedStoreSpecs: [],
      lastRefresh: 1,
    };
    const memoryGateway = {
      resolveBinding: vi.fn(),
      loadProjectSidebarData: vi.fn(),
    };
    const memoryPanel = makeEditorPanel();
    const vscode = await import('vscode');
    vi.mocked(vscode.window.createWebviewPanel).mockReturnValueOnce(memoryPanel as any);
    const memoryProvider = makeProjectProvider(makeDataManager(), memoryGateway, fixture) as any;
    memoryProvider.currentProjectBinding = fixture.binding;
    memoryProvider.cachedProjectSidebarData = memoryData;

    memoryProvider.openInEditor();
    await vi.runAllTimersAsync();

    expect(memoryGateway.resolveBinding).not.toHaveBeenCalled();
    expect(memoryGateway.loadProjectSidebarData).not.toHaveBeenCalled();
    expect(memoryPanel.webview.postMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: 'setContext',
      view: 'dashboard',
      data: expect.objectContaining({ cache: { source: 'memory', stale: true, generatedAt: 1 } }),
    }));

    const freshData = {
      ...memoryData,
      changes: [makeProjectChange('fresh-change')],
      lastRefresh: 2,
    };
    const diskGateway = {
      resolveBinding: vi.fn().mockResolvedValue(fixture.binding),
      loadProjectSidebarData: vi.fn().mockResolvedValue(freshData),
    };
    const diskCache = {
      readProjectPage: vi.fn().mockResolvedValue({ payload: memoryData, metadata: { generatedAt: 1 } }),
      writeProjectPage: vi.fn().mockResolvedValue(undefined),
    };
    const diskPanel = makeEditorPanel();
    vi.mocked(vscode.window.createWebviewPanel).mockReturnValueOnce(diskPanel as any);
    const diskProvider = new (DashboardViewProvider as any)(
      makeDataManager({ cacheService: diskCache }),
      '/ext',
      undefined,
      undefined,
      fixture.project,
      diskGateway,
      diskCache,
    ) as DashboardViewProvider;

    diskProvider.openInEditor();
    await vi.runAllTimersAsync();

    expect(diskGateway.loadProjectSidebarData).toHaveBeenCalledTimes(1);
    const diskMessages = diskPanel.webview.postMessage.mock.calls
      .map(([message]) => message)
      .filter((message) => message.type === 'setContext' && message.view === 'dashboard');
    expect(diskMessages[0]).toEqual(expect.objectContaining({
      data: expect.objectContaining({ cache: { source: 'disk', stale: true, generatedAt: 1 } }),
    }));
    expect(diskMessages.at(-1)).toEqual(expect.objectContaining({
      data: expect.objectContaining({
        changes: [freshData.changes[0]],
        cache: { source: 'fresh', stale: false },
      }),
    }));
  });

  it('rejects a Project cache snapshot with a missing lifecycle status', async () => {
    vi.useFakeTimers();
    const fixture = makeProjectFixture();
    let resolveFresh: ((value: unknown) => void) | undefined;
    const gateway = {
      resolveBinding: vi.fn().mockResolvedValue(fixture.binding),
      loadProjectSidebarData: vi.fn(() => new Promise((resolve) => { resolveFresh = resolve; })),
    };
    const cacheService = {
      readProjectPage: vi.fn().mockResolvedValue({
        payload: {
          project: fixture.project,
          binding: fixture.binding,
          changes: [{
            name: 'legacy-change',
            completedTasks: 0,
            totalTasks: 1,
            lastModified: '2026-08-19T00:00:00.000Z',
            status: 'draft',
          }],
          archivedChanges: [],
          projectSpecs: [],
          referencedStoreSpecs: [],
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

    provider.resolveWebviewView(makeWebviewView(makeWebview(postMessage)) as any, {} as any, {} as any);
    await vi.advanceTimersByTimeAsync(100);
    await Promise.resolve();
    await Promise.resolve();

    expect(postMessage.mock.calls.some(([message]) => (
      message.type === 'setContext' && message.view === 'sidebar'
    ))).toBe(false);
    expect(gateway.loadProjectSidebarData).toHaveBeenCalledTimes(1);

    resolveFresh?.({
      project: fixture.project,
      binding: fixture.binding,
      changes: [makeProjectChange('fresh-change')],
      archivedChanges: [],
      projectSpecs: [],
      referencedStoreSpecs: [],
    });
  });

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
      // Runtime default: the resolved CLI supports Worksets. Tests exercising
      // the unavailable-capability paths override this with worksets: false.
      getCapabilities: vi.fn().mockReturnValue({
        stores: true,
        context: true,
        doctor: true,
        worksets: true,
        diagnostics: [],
      }),
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

  function makeNavigationPayload(
    fixture: ReturnType<typeof makeProjectFixture>,
    worksetNames: string[],
  ) {
    return {
      project: fixture.project,
      binding: fixture.binding,
      changes: [makeProjectChange('project-change')],
      archivedChanges: [],
      projectSpecs: [],
      referencedStoreSpecs: [],
      worksetNavigation: {
        project: fixture.project,
        worksets: worksetNames.map((name) => ({
          name,
          members: [{
            name: fixture.project.label,
            path: fixture.project.projectPath,
            role: 'project' as const,
            selectable: true,
            project: fixture.project,
          }],
        })),
      },
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

  it('validates Workset Project selection before replacing the Project and watcher target', async () => {
    vi.useFakeTimers();
    const current = makeProjectFixture('/planning/current');
    const other: ProjectContext = {
      id: '/projects/other',
      label: 'Other Project',
      projectPath: '/projects/other',
    };
    const otherBinding: OpenSpecRootBinding = {
      projectId: other.id,
      commandCwd: other.projectPath,
      rootPath: '/planning/other',
      rootSource: 'nearest',
    };
    const navigationFor = (project: ProjectContext) => ({
      project,
      worksets: [{
        name: 'shared-workset',
        members: [
          { name: project.label, path: project.projectPath, role: 'project', selectable: true, project },
          { name: 'Other Project', path: other.projectPath, role: 'project', selectable: true, project: other },
        ],
      }],
    });
    const gateway = {
      loadChanges: vi.fn(async (project: ProjectContext) => ({
        project,
        binding: project.id === current.project.id ? current.binding : otherBinding,
        changes: [makeProjectChange(project.id === current.project.id ? 'current-change' : 'other-change')],
      })),
      loadWorksetNavigation: vi.fn(async (project: ProjectContext) => navigationFor(project)),
      resolveWorksetProject: vi.fn(async (_project: ProjectContext, _name: string, memberPath: string) => (
        memberPath === other.projectPath ? other : undefined
      )),
      resolveBinding: vi.fn(async (project: ProjectContext) => (
        project.id === current.project.id ? current.binding : otherBinding
      )),
    };
    const setWatchedProjectRoot = vi.fn();
    const dataManager = makeDataManager({ setWatchedProjectRoot });
    const postMessage = vi.fn();
    const webview = makeWebview(postMessage);
    const provider = makeProjectProvider(dataManager, gateway, current);

    provider.resolveWebviewView(makeWebviewView(webview) as any, {} as any, {} as any);
    await vi.runAllTimersAsync();
    const handler = vi.mocked(webview.onDidReceiveMessage).mock.calls[0]?.[0];

    await handler?.({ type: 'selectWorksetProject', worksetName: 'shared-workset', memberPath: other.projectPath });
    expect(setWatchedProjectRoot).toHaveBeenCalledWith(other.projectPath);
    const selectedSidebarMessage = postMessage.mock.calls
      .map(([message]) => message)
      .filter((message) => message.type === 'setContext' && message.view === 'sidebar')
      .at(-1);
    expect(selectedSidebarMessage).toEqual(expect.objectContaining({
      type: 'setContext',
      view: 'sidebar',
      data: expect.objectContaining({
        project: other,
        binding: otherBinding,
        changes: [makeProjectChange('other-change')],
      }),
    }));

    const callsBeforeForged = gateway.resolveWorksetProject.mock.calls.length;
    await handler?.({ type: 'selectWorksetProject', worksetName: 'shared-workset', memberPath: '/forged/store' });
    expect(gateway.resolveWorksetProject).toHaveBeenCalledTimes(callsBeforeForged + 1);
    expect(setWatchedProjectRoot).toHaveBeenCalledTimes(1);

    gateway.resolveBinding.mockResolvedValueOnce(current.binding);
    await handler?.({ type: 'selectCurrentProject' });
    expect(setWatchedProjectRoot).toHaveBeenLastCalledWith(current.project.projectPath);
    const restoredSidebarMessage = postMessage.mock.calls
      .map(([message]) => message)
      .filter((message) => message.type === 'setContext' && message.view === 'sidebar')
      .at(-1);
    expect(restoredSidebarMessage).toEqual(expect.objectContaining({
      type: 'setContext',
      view: 'sidebar',
      data: expect.objectContaining({ project: current.project, binding: current.binding }),
    }));
  });

  it('activates an explicitly selected Workset Store only after full validation', async () => {
    vi.useFakeTimers();
    const fixture = makeProjectFixture('/planning/current');
    const storeBinding: OpenSpecRootBinding = {
      projectId: fixture.project.id,
      commandCwd: fixture.project.projectPath,
      rootPath: '/stores/team-store',
      rootSource: 'store',
      storeId: 'team-store',
    };
    const payloadFor = (binding: OpenSpecRootBinding) => ({
      project: fixture.project,
      binding,
      changes: [makeProjectChange(binding.storeId ? 'store-change' : 'project-change')],
      archivedChanges: [],
      projectSpecs: [],
      referencedStoreSpecs: [],
    });
    const gateway = {
      loadProjectSidebarData: vi.fn(async (_project: ProjectContext, storeId?: string) => (
        storeId ? payloadFor(storeBinding) : payloadFor(fixture.binding)
      )),
      resolveWorksetStore: vi.fn().mockResolvedValue({
        storeId: 'team-store',
        canonicalRoot: '/stores/team-store',
      }),
    };
    const postMessage = vi.fn();
    const webview = makeWebview(postMessage);
    const provider = makeProjectProvider(makeDataManager(), gateway, fixture);
    provider.resolveWebviewView(makeWebviewView(webview) as any, {} as any, {} as any);
    await vi.runAllTimersAsync();
    expect(gateway.loadProjectSidebarData).toHaveBeenLastCalledWith(fixture.project, undefined);
    postMessage.mockClear();
    const handler = vi.mocked(webview.onDidReceiveMessage).mock.calls[0]?.[0];

    await handler?.({ type: 'selectWorksetStore', worksetName: 'team', memberPath: '/stores/team-store' });
    await vi.runAllTimersAsync();

    expect(gateway.resolveWorksetStore).toHaveBeenCalledWith(fixture.project, 'team', '/stores/team-store');
    expect(gateway.loadProjectSidebarData).toHaveBeenLastCalledWith(fixture.project, 'team-store');
    const storeMessage = postMessage.mock.calls
      .map(([message]) => message)
      .filter((message) => message.type === 'setContext' && message.view === 'sidebar')
      .at(-1);
    expect(storeMessage).toEqual(expect.objectContaining({
      data: expect.objectContaining({
        binding: storeBinding,
        changes: [makeProjectChange('store-change')],
        cache: { source: 'fresh', stale: false },
      }),
    }));

    // The accepted selector keeps driving later reloads of the same Project.
    postMessage.mockClear();
    await handler?.({ type: 'getProjectSidebarData' });
    await vi.runAllTimersAsync();
    expect(gateway.loadProjectSidebarData).toHaveBeenLastCalledWith(fixture.project, 'team-store');
  });

  it('rejects a forged or stale Workset Store request without publishing or activating a selector', async () => {
    vi.useFakeTimers();
    const fixture = makeProjectFixture('/planning/current');
    const gateway = {
      loadProjectSidebarData: vi.fn().mockResolvedValue({
        project: fixture.project,
        binding: fixture.binding,
        changes: [makeProjectChange('project-change')],
        archivedChanges: [],
        projectSpecs: [],
        referencedStoreSpecs: [],
      }),
      resolveWorksetStore: vi.fn().mockRejectedValue({
        name: 'ProjectDataAccessError',
        phase: 'resolve',
        message: 'Workset member is not a registered Planning Store',
      }),
    };
    const postMessage = vi.fn();
    const webview = makeWebview(postMessage);
    const provider = makeProjectProvider(makeDataManager(), gateway, fixture);
    provider.resolveWebviewView(makeWebviewView(webview) as any, {} as any, {} as any);
    await vi.runAllTimersAsync();
    const initialLoadCalls = gateway.loadProjectSidebarData.mock.calls.length;
    postMessage.mockClear();
    const handler = vi.mocked(webview.onDidReceiveMessage).mock.calls[0]?.[0];

    await handler?.({ type: 'selectWorksetStore', worksetName: 'team', memberPath: '/forged/store' });
    await vi.runAllTimersAsync();

    expect(gateway.resolveWorksetStore).toHaveBeenCalledTimes(1);
    expect(gateway.loadProjectSidebarData).toHaveBeenCalledTimes(initialLoadCalls);
    expect(postMessage.mock.calls.some(([message]) => message.type === 'setContext')).toBe(false);

    // No selector was activated: the next plain reload stays selector-free.
    await handler?.({ type: 'getProjectSidebarData' });
    await vi.runAllTimersAsync();
    expect(gateway.loadProjectSidebarData).toHaveBeenLastCalledWith(fixture.project, undefined);
  });

  it('discards a Store selection whose resolved binding misses the validated Store context', async () => {
    vi.useFakeTimers();
    const fixture = makeProjectFixture('/planning/current');
    const mismatchedBinding: OpenSpecRootBinding = {
      projectId: fixture.project.id,
      commandCwd: fixture.project.projectPath,
      rootPath: '/stores/other-root',
      rootSource: 'store',
      storeId: 'team-store',
    };
    const gateway = {
      loadProjectSidebarData: vi.fn(async (_project: ProjectContext, storeId?: string) => ({
        project: fixture.project,
        binding: storeId ? mismatchedBinding : fixture.binding,
        changes: [],
        archivedChanges: [],
        projectSpecs: [],
        referencedStoreSpecs: [],
      })),
      resolveWorksetStore: vi.fn().mockResolvedValue({
        storeId: 'team-store',
        canonicalRoot: '/stores/team-store',
      }),
    };
    const postMessage = vi.fn();
    const webview = makeWebview(postMessage);
    const provider = makeProjectProvider(makeDataManager(), gateway, fixture);
    provider.resolveWebviewView(makeWebviewView(webview) as any, {} as any, {} as any);
    await vi.runAllTimersAsync();
    postMessage.mockClear();
    const handler = vi.mocked(webview.onDidReceiveMessage).mock.calls[0]?.[0];

    await handler?.({ type: 'selectWorksetStore', worksetName: 'team', memberPath: '/stores/team-store' });
    await vi.runAllTimersAsync();

    expect(gateway.loadProjectSidebarData).toHaveBeenLastCalledWith(fixture.project, 'team-store');
    expect(postMessage.mock.calls.some(([message]) => (
      message.type === 'setContext' && message.data?.binding?.rootPath === '/stores/other-root'
    ))).toBe(false);

    // The selector never became active because the canonical root mismatched.
    await handler?.({ type: 'getProjectSidebarData' });
    await vi.runAllTimersAsync();
    expect(gateway.loadProjectSidebarData).toHaveBeenLastCalledWith(fixture.project, undefined);
  });

  it('keeps the previous Project snapshot when a Store selection load fails', async () => {
    vi.useFakeTimers();
    const fixture = makeProjectFixture('/planning/current');
    const initialPayload = {
      project: fixture.project,
      binding: fixture.binding,
      changes: [makeProjectChange('project-change')],
      archivedChanges: [],
      projectSpecs: [],
      referencedStoreSpecs: [],
    };
    const gateway = {
      loadProjectSidebarData: vi.fn(async (_project: ProjectContext, storeId?: string) => {
        if (storeId) throw new Error('store context unavailable');
        return initialPayload;
      }),
      resolveWorksetStore: vi.fn().mockResolvedValue({
        storeId: 'team-store',
        canonicalRoot: '/stores/team-store',
      }),
    };
    const postMessage = vi.fn();
    const webview = makeWebview(postMessage);
    const provider = makeProjectProvider(makeDataManager(), gateway, fixture);
    provider.resolveWebviewView(makeWebviewView(webview) as any, {} as any, {} as any);
    await vi.runAllTimersAsync();
    const acceptedMessages = postMessage.mock.calls
      .map(([message]) => message)
      .filter((message) => message.type === 'setContext');
    expect(acceptedMessages.length).toBeGreaterThan(0);
    postMessage.mockClear();
    const handler = vi.mocked(webview.onDidReceiveMessage).mock.calls[0]?.[0];

    await handler?.({ type: 'selectWorksetStore', worksetName: 'team', memberPath: '/stores/team-store' });
    await vi.runAllTimersAsync();

    expect(gateway.loadProjectSidebarData).toHaveBeenLastCalledWith(fixture.project, 'team-store');
    expect(postMessage.mock.calls.some(([message]) => message.type === 'setContext')).toBe(false);
    expect((provider as any).cachedProjectSidebarData.changes).toEqual(initialPayload.changes);
    expect((provider as any).currentProjectBinding).toEqual(fixture.binding);

    await handler?.({ type: 'getProjectSidebarData' });
    await vi.runAllTimersAsync();
    expect(gateway.loadProjectSidebarData).toHaveBeenLastCalledWith(fixture.project, undefined);
  });

  it('posts exactly one recoverable error when a Workset Store selection is rejected', async () => {
    vi.useFakeTimers();
    const fixture = makeProjectFixture('/planning/current');
    const initialPayload = {
      project: fixture.project,
      binding: fixture.binding,
      changes: [makeProjectChange('project-change')],
      archivedChanges: [],
      projectSpecs: [],
      referencedStoreSpecs: [],
    };
    const gateway = {
      loadProjectSidebarData: vi.fn().mockResolvedValue(initialPayload),
      resolveWorksetStore: vi.fn().mockRejectedValue({
        name: 'ProjectDataAccessError',
        phase: 'resolve',
        message: 'Workset member is not a registered Planning Store',
      }),
    };
    const postMessage = vi.fn();
    const webview = makeWebview(postMessage);
    const provider = makeProjectProvider(makeDataManager(), gateway, fixture);
    provider.resolveWebviewView(makeWebviewView(webview) as any, {} as any, {} as any);
    await vi.runAllTimersAsync();
    postMessage.mockClear();
    const handler = vi.mocked(webview.onDidReceiveMessage).mock.calls[0]?.[0];

    await handler?.({ type: 'selectWorksetStore', worksetName: 'team', memberPath: '/forged/store' });
    await vi.runAllTimersAsync();

    const errorMessages = postMessage.mock.calls
      .map(([message]) => message)
      .filter((message) => message.type === 'error');
    expect(errorMessages).toHaveLength(1);
    expect(errorMessages[0].message).toContain('not a registered Planning Store');
    // Fail-closed: no snapshot publish, and the previous state is preserved.
    expect(postMessage.mock.calls.some(([message]) => message.type === 'setContext')).toBe(false);
    expect((provider as any).explicitProjectStoreId).toBeUndefined();
    expect((provider as any).currentProjectBinding).toEqual(fixture.binding);
    expect((provider as any).cachedProjectSidebarData.changes).toEqual(initialPayload.changes);
  });

  it('posts exactly one recoverable error when an accepted Store selection load fails', async () => {
    vi.useFakeTimers();
    const fixture = makeProjectFixture('/planning/current');
    const initialPayload = {
      project: fixture.project,
      binding: fixture.binding,
      changes: [makeProjectChange('project-change')],
      archivedChanges: [],
      projectSpecs: [],
      referencedStoreSpecs: [],
    };
    const gateway = {
      loadProjectSidebarData: vi.fn()
        .mockResolvedValueOnce(initialPayload)
        .mockImplementation(async (_project: ProjectContext, storeId?: string) => {
          if (storeId) throw new Error('store context unavailable');
          return initialPayload;
        }),
      resolveWorksetStore: vi.fn().mockResolvedValue({
        storeId: 'team-store',
        canonicalRoot: '/stores/team-store',
      }),
    };
    const postMessage = vi.fn();
    const webview = makeWebview(postMessage);
    const provider = makeProjectProvider(makeDataManager(), gateway, fixture);
    provider.resolveWebviewView(makeWebviewView(webview) as any, {} as any, {} as any);
    await vi.runAllTimersAsync();
    postMessage.mockClear();
    const handler = vi.mocked(webview.onDidReceiveMessage).mock.calls[0]?.[0];

    await handler?.({ type: 'selectWorksetStore', worksetName: 'team', memberPath: '/stores/team-store' });
    await vi.runAllTimersAsync();

    const errorMessages = postMessage.mock.calls
      .map(([message]) => message)
      .filter((message) => message.type === 'error');
    expect(errorMessages).toHaveLength(1);
    expect(errorMessages[0].message).toContain('store context unavailable');
    expect(postMessage.mock.calls.some(([message]) => message.type === 'setContext')).toBe(false);
    expect((provider as any).explicitProjectStoreId).toBeUndefined();
    expect((provider as any).currentProjectBinding).toEqual(fixture.binding);
  });

  it('posts exactly one recoverable error when the default-root restore fails', async () => {
    vi.useFakeTimers();
    const fixture = makeProjectFixture('/planning/current');
    const storePayload = {
      project: fixture.project,
      binding: {
        projectId: fixture.project.id,
        commandCwd: fixture.project.projectPath,
        rootPath: '/stores/team-store',
        rootSource: 'store',
        storeId: 'team-store',
      } satisfies OpenSpecRootBinding,
      changes: [makeProjectChange('store-change')],
      archivedChanges: [],
      projectSpecs: [],
      referencedStoreSpecs: [],
    };
    const gateway = {
      loadProjectSidebarData: vi.fn()
        .mockResolvedValueOnce({
          project: fixture.project,
          binding: fixture.binding,
          changes: [makeProjectChange('project-change')],
          archivedChanges: [],
          projectSpecs: [],
          referencedStoreSpecs: [],
        })
        .mockImplementation(async (_project: ProjectContext, storeId?: string) => {
          if (storeId) return storePayload;
          throw new Error('project default root unavailable');
        }),
      resolveWorksetStore: vi.fn().mockResolvedValue({
        storeId: 'team-store',
        canonicalRoot: '/stores/team-store',
      }),
    };
    const postMessage = vi.fn();
    const webview = makeWebview(postMessage);
    const provider = makeProjectProvider(makeDataManager(), gateway, fixture);
    provider.resolveWebviewView(makeWebviewView(webview) as any, {} as any, {} as any);
    await vi.runAllTimersAsync();
    const handler = vi.mocked(webview.onDidReceiveMessage).mock.calls[0]?.[0];
    await handler?.({ type: 'selectWorksetStore', worksetName: 'team', memberPath: '/stores/team-store' });
    await vi.runAllTimersAsync();
    postMessage.mockClear();

    await handler?.({ type: 'selectProjectDefaultRoot' });
    await vi.runAllTimersAsync();

    const errorMessages = postMessage.mock.calls
      .map(([message]) => message)
      .filter((message) => message.type === 'error');
    expect(errorMessages).toHaveLength(1);
    expect(errorMessages[0].message).toContain('project default root unavailable');
    expect(postMessage.mock.calls.some(([message]) => message.type === 'setContext')).toBe(false);
    expect((provider as any).explicitProjectStoreId).toBe('team-store');
  });

  it('logs expected-versus-actual context when the acceptance gate drops a refresh', async () => {
    vi.useFakeTimers();
    const fixture = makeProjectFixture('/planning/current');
    const mismatchedBinding: OpenSpecRootBinding = {
      projectId: fixture.project.id,
      commandCwd: fixture.project.projectPath,
      rootPath: '/stores/other-root',
      rootSource: 'store',
      storeId: 'team-store',
    };
    const gateway = {
      loadProjectSidebarData: vi.fn(async (_project: ProjectContext, storeId?: string) => ({
        project: fixture.project,
        binding: storeId ? mismatchedBinding : fixture.binding,
        changes: [],
        archivedChanges: [],
        projectSpecs: [],
        referencedStoreSpecs: [],
      })),
      resolveWorksetStore: vi.fn().mockResolvedValue({
        storeId: 'team-store',
        canonicalRoot: '/stores/team-store',
      }),
    };
    const postMessage = vi.fn();
    const webview = makeWebview(postMessage);
    const provider = makeProjectProvider(makeDataManager(), gateway, fixture);
    provider.resolveWebviewView(makeWebviewView(webview) as any, {} as any, {} as any);
    await vi.runAllTimersAsync();
    vi.mocked(logger.warn).mockClear();
    postMessage.mockClear();
    const handler = vi.mocked(webview.onDidReceiveMessage).mock.calls[0]?.[0];

    await handler?.({ type: 'selectWorksetStore', worksetName: 'team', memberPath: '/stores/team-store' });
    await vi.runAllTimersAsync();

    expect(postMessage.mock.calls.some(([message]) => message.type === 'setContext' && message.data?.binding?.rootPath === '/stores/other-root')).toBe(false);
    const gateWarnings = vi.mocked(logger.warn).mock.calls
      .map(([message]) => String(message))
      .filter((message) => message.includes('acceptance gate'));
    expect(gateWarnings).toHaveLength(1);
    // The warning carries enough context to diagnose the permanently-dropped
    // refresh: the validated expectation and the mismatching actual values.
    expect(gateWarnings[0]).toContain('/stores/team-store');
    expect(gateWarnings[0]).toContain('/stores/other-root');
    expect(gateWarnings[0]).toContain('team-store');
  });

  it('discards a Store selection response superseded by a newer request generation', async () => {
    vi.useFakeTimers();
    const fixture = makeProjectFixture('/planning/current');
    const storeBinding: OpenSpecRootBinding = {
      projectId: fixture.project.id,
      commandCwd: fixture.project.projectPath,
      rootPath: '/stores/team-store',
      rootSource: 'store',
      storeId: 'team-store',
    };
    const resolvers: Array<(value: unknown) => void> = [];
    const gateway = {
      loadProjectSidebarData: vi.fn((_project: ProjectContext, storeId?: string) => (
        storeId
          ? new Promise((resolve) => resolvers.push(resolve))
          : Promise.resolve({
            project: fixture.project,
            binding: fixture.binding,
            changes: [makeProjectChange('project-change')],
            archivedChanges: [],
            projectSpecs: [],
            referencedStoreSpecs: [],
          })
      )),
      resolveWorksetStore: vi.fn().mockResolvedValue({
        storeId: 'team-store',
        canonicalRoot: '/stores/team-store',
      }),
    };
    const postMessage = vi.fn();
    const webview = makeWebview(postMessage);
    const provider = makeProjectProvider(makeDataManager(), gateway, fixture);
    provider.resolveWebviewView(makeWebviewView(webview) as any, {} as any, {} as any);
    await vi.runAllTimersAsync();
    postMessage.mockClear();
    const handler = vi.mocked(webview.onDidReceiveMessage).mock.calls[0]?.[0];

    const staleSelection = handler?.({ type: 'selectWorksetStore', worksetName: 'team', memberPath: '/stores/team-store' });
    for (let tick = 0; tick < 10; tick += 1) {
      await Promise.resolve();
    }
    expect(resolvers).toHaveLength(1);
    await handler?.({ type: 'getProjectSidebarData' });
    await vi.runAllTimersAsync();
    resolvers[0]?.({
      project: fixture.project,
      binding: storeBinding,
      changes: [makeProjectChange('store-change')],
      archivedChanges: [],
      projectSpecs: [],
      referencedStoreSpecs: [],
    });
    await staleSelection;
    await Promise.resolve();

    expect(postMessage.mock.calls.some(([message]) => (
      message.type === 'setContext' && message.data?.binding?.storeId === 'team-store'
    ))).toBe(false);
    expect((provider as any).currentProjectBinding).toEqual(fixture.binding);

    // The superseded selection never committed its selector.
    await handler?.({ type: 'getProjectSidebarData' });
    await vi.runAllTimersAsync();
    expect(gateway.loadProjectSidebarData).toHaveBeenLastCalledWith(fixture.project, undefined);
  });

  it('restores the Project default Planning root only after a selector-free binding resolves', async () => {
    vi.useFakeTimers();
    const fixture = makeProjectFixture('/planning/current');
    const storeBinding: OpenSpecRootBinding = {
      projectId: fixture.project.id,
      commandCwd: fixture.project.projectPath,
      rootPath: '/stores/team-store',
      rootSource: 'store',
      storeId: 'team-store',
    };
    const payloadFor = (binding: OpenSpecRootBinding) => ({
      project: fixture.project,
      binding,
      changes: [makeProjectChange(binding.storeId ? 'store-change' : 'project-change')],
      archivedChanges: [],
      projectSpecs: [],
      referencedStoreSpecs: [],
    });
    const gateway = {
      loadProjectSidebarData: vi.fn(async (_project: ProjectContext, storeId?: string) => (
        storeId ? payloadFor(storeBinding) : payloadFor(fixture.binding)
      )),
      resolveWorksetStore: vi.fn().mockResolvedValue({
        storeId: 'team-store',
        canonicalRoot: '/stores/team-store',
      }),
    };
    const postMessage = vi.fn();
    const webview = makeWebview(postMessage);
    const provider = makeProjectProvider(makeDataManager(), gateway, fixture);
    provider.resolveWebviewView(makeWebviewView(webview) as any, {} as any, {} as any);
    await vi.runAllTimersAsync();
    const handler = vi.mocked(webview.onDidReceiveMessage).mock.calls[0]?.[0];

    await handler?.({ type: 'selectWorksetStore', worksetName: 'team', memberPath: '/stores/team-store' });
    await vi.runAllTimersAsync();
    expect(gateway.loadProjectSidebarData).toHaveBeenLastCalledWith(fixture.project, 'team-store');
    postMessage.mockClear();

    await handler?.({ type: 'selectProjectDefaultRoot' });
    await vi.runAllTimersAsync();

    expect(gateway.loadProjectSidebarData).toHaveBeenLastCalledWith(fixture.project, undefined);
    const restoredMessage = postMessage.mock.calls
      .map(([message]) => message)
      .filter((message) => message.type === 'setContext' && message.view === 'sidebar')
      .at(-1);
    expect(restoredMessage).toEqual(expect.objectContaining({
      data: expect.objectContaining({
        binding: fixture.binding,
        changes: [makeProjectChange('project-change')],
        cache: { source: 'fresh', stale: false },
      }),
    }));

    // The selector stays cleared for later reloads.
    await handler?.({ type: 'getProjectSidebarData' });
    await vi.runAllTimersAsync();
    expect(gateway.loadProjectSidebarData).toHaveBeenLastCalledWith(fixture.project, undefined);

    // Without an active selector the restore action is a fail-closed no-op.
    const loadCallsBeforeNoop = gateway.loadProjectSidebarData.mock.calls.length;
    postMessage.mockClear();
    await handler?.({ type: 'selectProjectDefaultRoot' });
    await vi.runAllTimersAsync();
    expect(gateway.loadProjectSidebarData).toHaveBeenCalledTimes(loadCallsBeforeNoop);
    expect(postMessage.mock.calls.some(([message]) => message.type === 'setContext')).toBe(false);
  });

  it('publishes whether an explicit Store selector drove the accepted snapshot', async () => {
    vi.useFakeTimers();
    const fixture = makeProjectFixture('/planning/current');
    const storeBinding: OpenSpecRootBinding = {
      projectId: fixture.project.id,
      commandCwd: fixture.project.projectPath,
      rootPath: '/stores/team-store',
      rootSource: 'store',
      storeId: 'team-store',
    };
    const payloadFor = (binding: OpenSpecRootBinding, explicitStoreSelector: boolean) => ({
      project: fixture.project,
      binding,
      explicitStoreSelector,
      changes: [makeProjectChange(binding.storeId ? 'store-change' : 'project-change')],
      archivedChanges: [],
      projectSpecs: [],
      referencedStoreSpecs: [],
    });
    const gateway = {
      loadProjectSidebarData: vi.fn(async (_project: ProjectContext, storeId?: string) => (
        storeId ? payloadFor(storeBinding, true) : payloadFor(fixture.binding, false)
      )),
      resolveWorksetStore: vi.fn().mockResolvedValue({
        storeId: 'team-store',
        canonicalRoot: '/stores/team-store',
      }),
    };
    const postMessage = vi.fn();
    const webview = makeWebview(postMessage);
    const provider = makeProjectProvider(makeDataManager(), gateway, fixture);
    provider.resolveWebviewView(makeWebviewView(webview) as any, {} as any, {} as any);
    await vi.runAllTimersAsync();
    const handler = vi.mocked(webview.onDidReceiveMessage).mock.calls[0]?.[0];

    await handler?.({ type: 'selectWorksetStore', worksetName: 'team', memberPath: '/stores/team-store' });
    await vi.runAllTimersAsync();
    expect(postMessage.mock.calls
      .map(([message]) => message)
      .filter((message) => message.type === 'setContext' && message.view === 'sidebar')
      .at(-1))
      .toEqual(expect.objectContaining({
        data: expect.objectContaining({ explicitStoreSelector: true }),
      }));

    // The selector keeps marking later selector-driven reloads as explicit.
    postMessage.mockClear();
    await handler?.({ type: 'getProjectSidebarData' });
    await vi.runAllTimersAsync();
    expect(postMessage.mock.calls
      .map(([message]) => message)
      .filter((message) => message.type === 'setContext' && message.view === 'sidebar')
      .at(-1))
      .toEqual(expect.objectContaining({
        data: expect.objectContaining({ explicitStoreSelector: true }),
      }));

    // Returning to the Project default root clears the flag.
    postMessage.mockClear();
    await handler?.({ type: 'selectProjectDefaultRoot' });
    await vi.runAllTimersAsync();
    expect(postMessage.mock.calls
      .map(([message]) => message)
      .filter((message) => message.type === 'setContext' && message.view === 'sidebar')
      .at(-1))
      .toEqual(expect.objectContaining({
        data: expect.objectContaining({ explicitStoreSelector: false }),
      }));
  });

  it('treats a CLI-declared default Store root as selector-free in the published snapshot', async () => {
    vi.useFakeTimers();
    const fixture = makeProjectFixture('/planning/current');
    // The project default root IS a Store root: the selector-free binding
    // carries a storeId from the CLI's root.store_id, but no explicit selector
    // is active, so the published flag must stay false.
    const declaredStoreBinding: OpenSpecRootBinding = {
      projectId: fixture.project.id,
      commandCwd: fixture.project.projectPath,
      rootPath: '/stores/declared-store',
      rootSource: 'store',
      storeId: 'declared-store',
    };
    const gateway = {
      loadProjectSidebarData: vi.fn(async () => ({
        project: fixture.project,
        binding: declaredStoreBinding,
        explicitStoreSelector: false,
        changes: [makeProjectChange('declared-store-change')],
        archivedChanges: [],
        projectSpecs: [],
        referencedStoreSpecs: [],
      })),
    };
    const postMessage = vi.fn();
    const webview = makeWebview(postMessage);
    const provider = makeProjectProvider(makeDataManager(), gateway, fixture);
    provider.resolveWebviewView(makeWebviewView(webview) as any, {} as any, {} as any);
    await vi.runAllTimersAsync();

    const published = postMessage.mock.calls
      .map(([message]) => message)
      .filter((message) => message.type === 'setContext' && message.view === 'sidebar')
      .at(-1);
    expect(published).toEqual(expect.objectContaining({
      data: expect.objectContaining({
        binding: expect.objectContaining({ storeId: 'declared-store' }),
        explicitStoreSelector: false,
      }),
    }));
  });

  it('retargets the watcher to the restored binding root when the default root is itself a Store root', async () => {
    vi.useFakeTimers();
    const fixture = makeProjectFixture('/planning/current');
    const selectedStoreBinding: OpenSpecRootBinding = {
      projectId: fixture.project.id,
      commandCwd: fixture.project.projectPath,
      rootPath: '/stores/team-store',
      rootSource: 'store',
      storeId: 'team-store',
    };
    // The selector-free default still resolves to a Store root via the CLI's
    // root.store_id: the watcher must follow the restored binding root, not the
    // Project path, or store-root edits would never auto-refresh.
    const declaredStoreBinding: OpenSpecRootBinding = {
      projectId: fixture.project.id,
      commandCwd: fixture.project.projectPath,
      rootPath: '/stores/declared-store',
      rootSource: 'store',
      storeId: 'declared-store',
    };
    const payloadFor = (binding: OpenSpecRootBinding) => ({
      project: fixture.project,
      binding,
      changes: [makeProjectChange(binding.storeId ? 'store-change' : 'project-change')],
      archivedChanges: [],
      projectSpecs: [],
      referencedStoreSpecs: [],
    });
    const gateway = {
      loadProjectSidebarData: vi.fn(async (_project: ProjectContext, storeId?: string) => (
        storeId ? payloadFor(selectedStoreBinding) : payloadFor(declaredStoreBinding)
      )),
      resolveWorksetStore: vi.fn().mockResolvedValue({
        storeId: 'team-store',
        canonicalRoot: '/stores/team-store',
      }),
    };
    const setWatchedProjectRoot = vi.fn();
    const dataManager = makeDataManager({ setWatchedProjectRoot });
    const postMessage = vi.fn();
    const webview = makeWebview(postMessage);
    const provider = makeProjectProvider(dataManager, gateway, fixture);
    provider.resolveWebviewView(makeWebviewView(webview) as any, {} as any, {} as any);
    await vi.runAllTimersAsync();
    const handler = vi.mocked(webview.onDidReceiveMessage).mock.calls[0]?.[0];

    await handler?.({ type: 'selectWorksetStore', worksetName: 'team', memberPath: '/stores/team-store' });
    await vi.runAllTimersAsync();
    expect(setWatchedProjectRoot).toHaveBeenLastCalledWith('/stores/team-store');

    await handler?.({ type: 'selectProjectDefaultRoot' });
    await vi.runAllTimersAsync();

    expect(setWatchedProjectRoot).toHaveBeenCalledTimes(2);
    expect(setWatchedProjectRoot).toHaveBeenLastCalledWith('/stores/declared-store');
    expect(setWatchedProjectRoot).not.toHaveBeenCalledWith(fixture.project.projectPath);
  });

  it('drops a Store selection whose resolve is superseded by a faster Store selection', async () => {
    vi.useFakeTimers();
    const fixture = makeProjectFixture('/planning/current');
    const bindingFor = (storeId: string): OpenSpecRootBinding => ({
      projectId: fixture.project.id,
      commandCwd: fixture.project.projectPath,
      rootPath: `/stores/${storeId}`,
      rootSource: 'store',
      storeId,
    });
    const payloadFor = (storeId?: string) => ({
      project: fixture.project,
      binding: storeId ? bindingFor(storeId) : fixture.binding,
      changes: [makeProjectChange(storeId ?? 'project-change')],
      archivedChanges: [],
      projectSpecs: [],
      referencedStoreSpecs: [],
    });
    const resolveStore: Array<(value: { storeId: string; canonicalRoot: string }) => void> = [];
    const gateway = {
      loadProjectSidebarData: vi.fn(async (_project: ProjectContext, storeId?: string) => payloadFor(storeId)),
      resolveWorksetStore: vi.fn(() => new Promise<{ storeId: string; canonicalRoot: string }>((resolve) => {
        resolveStore.push(resolve);
      })),
    };
    const postMessage = vi.fn();
    const webview = makeWebview(postMessage);
    const provider = makeProjectProvider(makeDataManager(), gateway, fixture);
    provider.resolveWebviewView(makeWebviewView(webview) as any, {} as any, {} as any);
    await vi.runAllTimersAsync();
    postMessage.mockClear();
    const handler = vi.mocked(webview.onDidReceiveMessage).mock.calls[0]?.[0];

    // Click Store A first: its fresh-inventory resolve stays pending.
    const slowSelection = handler?.({
      type: 'selectWorksetStore',
      worksetName: 'team',
      memberPath: '/stores/store-a',
    });
    expect(resolveStore).toHaveLength(1);
    // Click Store B: it resolves fast and commits.
    const fastSelection = handler?.({
      type: 'selectWorksetStore',
      worksetName: 'team',
      memberPath: '/stores/store-b',
    });
    resolveStore[1]?.({ storeId: 'store-b', canonicalRoot: '/stores/store-b' });
    await fastSelection;
    await vi.runAllTimersAsync();

    const loadCallsAfterB = gateway.loadProjectSidebarData.mock.calls.length;
    const contextMessages = () => postMessage.mock.calls
      .map(([message]) => message)
      .filter((message) => message.type === 'setContext');
    expect(contextMessages().at(-1)).toEqual(expect.objectContaining({
      data: expect.objectContaining({ binding: bindingFor('store-b') }),
    }));
    expect((provider as any).explicitProjectStoreId).toBe('store-b');

    // Store A's late resolve must be dropped: no reload, no publish, no selector flip.
    resolveStore[0]?.({ storeId: 'store-a', canonicalRoot: '/stores/store-a' });
    await slowSelection;
    await vi.runAllTimersAsync();

    expect(gateway.loadProjectSidebarData).toHaveBeenCalledTimes(loadCallsAfterB);
    expect(gateway.loadProjectSidebarData.mock.calls.some(([, storeId]) => storeId === 'store-a')).toBe(false);
    expect(contextMessages().at(-1)).toEqual(expect.objectContaining({
      data: expect.objectContaining({ binding: bindingFor('store-b') }),
    }));
    expect((provider as any).explicitProjectStoreId).toBe('store-b');
  });

  it('drops a Store selection whose resolve is superseded by a return to the Project default root', async () => {
    vi.useFakeTimers();
    const fixture = makeProjectFixture('/planning/current');
    const bindingFor = (storeId: string): OpenSpecRootBinding => ({
      projectId: fixture.project.id,
      commandCwd: fixture.project.projectPath,
      rootPath: `/stores/${storeId}`,
      rootSource: 'store',
      storeId,
    });
    const payloadFor = (storeId?: string) => ({
      project: fixture.project,
      binding: storeId ? bindingFor(storeId) : fixture.binding,
      changes: [makeProjectChange(storeId ?? 'project-change')],
      archivedChanges: [],
      projectSpecs: [],
      referencedStoreSpecs: [],
    });
    const resolveStore: Array<(value: { storeId: string; canonicalRoot: string }) => void> = [];
    const gateway = {
      loadProjectSidebarData: vi.fn(async (_project: ProjectContext, storeId?: string) => payloadFor(storeId)),
      resolveWorksetStore: vi.fn(() => new Promise<{ storeId: string; canonicalRoot: string }>((resolve) => {
        resolveStore.push(resolve);
      })),
    };
    const postMessage = vi.fn();
    const webview = makeWebview(postMessage);
    const provider = makeProjectProvider(makeDataManager(), gateway, fixture);
    provider.resolveWebviewView(makeWebviewView(webview) as any, {} as any, {} as any);
    await vi.runAllTimersAsync();
    const handler = vi.mocked(webview.onDidReceiveMessage).mock.calls[0]?.[0];

    // Activate Store B first so the default-root action has a selector to clear.
    const activateB = handler?.({
      type: 'selectWorksetStore',
      worksetName: 'team',
      memberPath: '/stores/store-b',
    });
    resolveStore[0]?.({ storeId: 'store-b', canonicalRoot: '/stores/store-b' });
    await activateB;
    await vi.runAllTimersAsync();
    expect((provider as any).explicitProjectStoreId).toBe('store-b');
    postMessage.mockClear();

    // Click Store A: its resolve stays pending while the user returns to default.
    const slowSelection = handler?.({
      type: 'selectWorksetStore',
      worksetName: 'team',
      memberPath: '/stores/store-a',
    });
    expect(resolveStore).toHaveLength(2);
    await handler?.({ type: 'selectProjectDefaultRoot' });
    await vi.runAllTimersAsync();

    const loadCallsAfterDefault = gateway.loadProjectSidebarData.mock.calls.length;
    const contextMessages = () => postMessage.mock.calls
      .map(([message]) => message)
      .filter((message) => message.type === 'setContext');
    expect(contextMessages().at(-1)).toEqual(expect.objectContaining({
      data: expect.objectContaining({ binding: fixture.binding }),
    }));
    expect((provider as any).explicitProjectStoreId).toBeUndefined();

    // Store A's late resolve must not overturn the explicit return-to-default.
    resolveStore[1]?.({ storeId: 'store-a', canonicalRoot: '/stores/store-a' });
    await slowSelection;
    await vi.runAllTimersAsync();

    expect(gateway.loadProjectSidebarData).toHaveBeenCalledTimes(loadCallsAfterDefault);
    expect(gateway.loadProjectSidebarData.mock.calls.some(([, storeId]) => storeId === 'store-a')).toBe(false);
    expect(contextMessages().at(-1)).toEqual(expect.objectContaining({
      data: expect.objectContaining({ binding: fixture.binding }),
    }));
    expect((provider as any).explicitProjectStoreId).toBeUndefined();

    // The selector stays cleared for later reloads.
    await handler?.({ type: 'getProjectSidebarData' });
    await vi.runAllTimersAsync();
    expect(gateway.loadProjectSidebarData).toHaveBeenLastCalledWith(fixture.project, undefined);
  });

  it('drops a Workset Project selection superseded by a newer committed request', async () => {
    vi.useFakeTimers();
    const current = makeProjectFixture('/planning/current');
    const other: ProjectContext = {
      id: '/projects/other',
      label: 'Other Project',
      projectPath: '/projects/other',
    };
    const otherBinding: OpenSpecRootBinding = {
      projectId: other.id,
      commandCwd: other.projectPath,
      rootPath: '/planning/other',
      rootSource: 'nearest',
    };
    const storeBinding: OpenSpecRootBinding = {
      projectId: current.project.id,
      commandCwd: current.project.projectPath,
      rootPath: '/stores/team-store',
      rootSource: 'store',
      storeId: 'team-store',
    };
    const payloadFor = (project: ProjectContext, binding: OpenSpecRootBinding) => ({
      project,
      binding,
      changes: [makeProjectChange(binding.storeId ?? project.label)],
      archivedChanges: [],
      projectSpecs: [],
      referencedStoreSpecs: [],
    });
    const projectResolvers: Array<(value: ProjectContext | undefined) => void> = [];
    const gateway = {
      loadProjectSidebarData: vi.fn(async (project: ProjectContext, storeId?: string) => (
        storeId ? payloadFor(project, storeBinding) : payloadFor(project, project.id === current.project.id ? current.binding : otherBinding)
      )),
      resolveWorksetProject: vi.fn(() => new Promise<ProjectContext | undefined>((resolve) => {
        projectResolvers.push(resolve);
      })),
      resolveWorksetStore: vi.fn().mockResolvedValue({
        storeId: 'team-store',
        canonicalRoot: '/stores/team-store',
      }),
      resolveBinding: vi.fn(),
    };
    const setWatchedProjectRoot = vi.fn();
    const dataManager = makeDataManager({ setWatchedProjectRoot });
    const postMessage = vi.fn();
    const webview = makeWebview(postMessage);
    const provider = makeProjectProvider(dataManager, gateway, current);
    provider.resolveWebviewView(makeWebviewView(webview) as any, {} as any, {} as any);
    await vi.runAllTimersAsync();
    postMessage.mockClear();
    const handler = vi.mocked(webview.onDidReceiveMessage).mock.calls[0]?.[0];

    const supersededSelection = handler?.({
      type: 'selectWorksetProject',
      worksetName: 'shared-workset',
      memberPath: other.projectPath,
    });
    expect(projectResolvers).toHaveLength(1);

    // A newer Store selection resolves fast and commits while the Project resolve pends.
    await handler?.({ type: 'selectWorksetStore', worksetName: 'team', memberPath: '/stores/team-store' });
    await vi.runAllTimersAsync();
    expect((provider as any).explicitProjectStoreId).toBe('team-store');

    projectResolvers[0]?.(other);
    await supersededSelection;
    await vi.runAllTimersAsync();

    expect(gateway.resolveBinding).not.toHaveBeenCalled();
    expect(setWatchedProjectRoot).not.toHaveBeenCalledWith(other.projectPath);
    expect(gateway.loadProjectSidebarData.mock.calls.some(([project]) => project?.id === other.id)).toBe(false);
    expect((provider as any).projectContext).toEqual(current.project);
    expect((provider as any).explicitProjectStoreId).toBe('team-store');
  });

  it('retargets the watcher to the accepted Store root and back to the Project root', async () => {
    vi.useFakeTimers();
    const fixture = makeProjectFixture('/planning/current');
    const storeBinding: OpenSpecRootBinding = {
      projectId: fixture.project.id,
      commandCwd: fixture.project.projectPath,
      rootPath: '/stores/team-store',
      rootSource: 'store',
      storeId: 'team-store',
    };
    const payloadFor = (binding: OpenSpecRootBinding) => ({
      project: fixture.project,
      binding,
      changes: [makeProjectChange(binding.storeId ? 'store-change' : 'project-change')],
      archivedChanges: [],
      projectSpecs: [],
      referencedStoreSpecs: [],
    });
    const gateway = {
      loadProjectSidebarData: vi.fn(async (_project: ProjectContext, storeId?: string) => (
        storeId ? payloadFor(storeBinding) : payloadFor(fixture.binding)
      )),
      resolveWorksetStore: vi.fn().mockResolvedValue({
        storeId: 'team-store',
        canonicalRoot: '/stores/team-store',
      }),
    };
    const setWatchedProjectRoot = vi.fn();
    const dataManager = makeDataManager({ setWatchedProjectRoot });
    const postMessage = vi.fn();
    const webview = makeWebview(postMessage);
    const provider = makeProjectProvider(dataManager, gateway, fixture);
    provider.resolveWebviewView(makeWebviewView(webview) as any, {} as any, {} as any);
    await vi.runAllTimersAsync();
    expect(setWatchedProjectRoot).not.toHaveBeenCalled();
    const handler = vi.mocked(webview.onDidReceiveMessage).mock.calls[0]?.[0];

    await handler?.({ type: 'selectWorksetStore', worksetName: 'team', memberPath: '/stores/team-store' });
    await vi.runAllTimersAsync();
    expect(setWatchedProjectRoot).toHaveBeenCalledTimes(1);
    expect(setWatchedProjectRoot).toHaveBeenCalledWith('/stores/team-store');

    await handler?.({ type: 'selectProjectDefaultRoot' });
    await vi.runAllTimersAsync();
    expect(setWatchedProjectRoot).toHaveBeenCalledTimes(2);
    expect(setWatchedProjectRoot).toHaveBeenLastCalledWith(fixture.project.projectPath);
  });

  it('keeps the watcher on the accepted binding root while an explicit Store selector stays active', async () => {
    vi.useFakeTimers();
    const current = makeProjectFixture();
    const other: ProjectContext = {
      id: '/projects/other',
      label: 'Other Project',
      projectPath: '/projects/other',
    };
    const currentStoreBinding: OpenSpecRootBinding = {
      projectId: current.project.id,
      commandCwd: current.project.projectPath,
      rootPath: '/stores/team-store',
      rootSource: 'store',
      storeId: 'team-store',
    };
    const otherStoreBinding: OpenSpecRootBinding = {
      projectId: other.id,
      commandCwd: other.projectPath,
      rootPath: '/stores/team-store',
      rootSource: 'store',
      storeId: 'team-store',
    };
    const payloadFor = (project: ProjectContext, binding: OpenSpecRootBinding) => ({
      project,
      binding,
      changes: [makeProjectChange('member-change')],
      archivedChanges: [],
      projectSpecs: [],
      referencedStoreSpecs: [],
    });
    const gateway = {
      loadProjectSidebarData: vi.fn(async (project: ProjectContext, storeId?: string) => (
        storeId
          ? payloadFor(project, project.id === current.project.id ? currentStoreBinding : otherStoreBinding)
          : payloadFor(project, current.binding)
      )),
      resolveWorksetStore: vi.fn().mockResolvedValue({
        storeId: 'team-store',
        canonicalRoot: '/stores/team-store',
      }),
      resolveWorksetProject: vi.fn().mockResolvedValue(other),
      resolveBinding: vi.fn(async (project: ProjectContext, storeId?: string) => (
        storeId
          ? (project.id === current.project.id ? currentStoreBinding : otherStoreBinding)
          : { ...current.binding, projectId: project.id, commandCwd: project.projectPath }
      )),
    };
    const setWatchedProjectRoot = vi.fn();
    const dataManager = makeDataManager({ setWatchedProjectRoot });
    const postMessage = vi.fn();
    const webview = makeWebview(postMessage);
    const provider = makeProjectProvider(dataManager, gateway, current);
    provider.resolveWebviewView(makeWebviewView(webview) as any, {} as any, {} as any);
    await vi.runAllTimersAsync();
    const handler = vi.mocked(webview.onDidReceiveMessage).mock.calls[0]?.[0];

    // Activate the explicit Store selector first.
    await handler?.({ type: 'selectWorksetStore', worksetName: 'team', memberPath: '/stores/team-store' });
    await vi.runAllTimersAsync();
    expect((provider as any).explicitProjectStoreId).toBe('team-store');
    expect(setWatchedProjectRoot).toHaveBeenLastCalledWith('/stores/team-store');
    setWatchedProjectRoot.mockClear();

    // A Project switch under the active selector must retarget the watcher to
    // the accepted binding root (the store root), not the Project path.
    await handler?.({ type: 'selectWorksetProject', worksetName: 'shared-workset', memberPath: other.projectPath });
    await vi.runAllTimersAsync();
    expect(setWatchedProjectRoot).toHaveBeenCalledTimes(1);
    expect(setWatchedProjectRoot).toHaveBeenLastCalledWith(otherStoreBinding.rootPath);
    expect(setWatchedProjectRoot).not.toHaveBeenCalledWith(other.projectPath);
    setWatchedProjectRoot.mockClear();

    // Restoring the Current Project under the same selector follows the same rule.
    await handler?.({ type: 'selectCurrentProject' });
    await vi.runAllTimersAsync();
    expect(setWatchedProjectRoot).toHaveBeenCalledTimes(1);
    expect(setWatchedProjectRoot).toHaveBeenLastCalledWith(currentStoreBinding.rootPath);
    expect(setWatchedProjectRoot).not.toHaveBeenCalledWith(current.project.projectPath);
  });

  it('leaves the watcher target untouched when a Store selection fails to resolve', async () => {
    vi.useFakeTimers();
    const fixture = makeProjectFixture('/planning/current');
    const gateway = {
      loadProjectSidebarData: vi.fn().mockResolvedValue({
        project: fixture.project,
        binding: fixture.binding,
        changes: [makeProjectChange('project-change')],
        archivedChanges: [],
        projectSpecs: [],
        referencedStoreSpecs: [],
      }),
      resolveWorksetStore: vi.fn().mockRejectedValue({
        name: 'ProjectDataAccessError',
        phase: 'resolve',
        message: 'Workset member is not a registered Planning Store',
      }),
    };
    const setWatchedProjectRoot = vi.fn();
    const dataManager = makeDataManager({ setWatchedProjectRoot });
    const postMessage = vi.fn();
    const webview = makeWebview(postMessage);
    const provider = makeProjectProvider(dataManager, gateway, fixture);
    provider.resolveWebviewView(makeWebviewView(webview) as any, {} as any, {} as any);
    await vi.runAllTimersAsync();
    const handler = vi.mocked(webview.onDidReceiveMessage).mock.calls[0]?.[0];

    await handler?.({ type: 'selectWorksetStore', worksetName: 'team', memberPath: '/forged/store' });
    await vi.runAllTimersAsync();

    expect(setWatchedProjectRoot).not.toHaveBeenCalled();
    expect((provider as any).explicitProjectStoreId).toBeUndefined();
  });

  it('opens the native folder picker and posts canonical absolute member paths', async () => {
    vi.useFakeTimers();
    const fixture = makeProjectFixture('/planning/current');
    const gateway = {
      loadProjectSidebarData: vi.fn().mockResolvedValue({
        project: fixture.project,
        binding: fixture.binding,
        changes: [],
        archivedChanges: [],
        projectSpecs: [],
        referencedStoreSpecs: [],
      }),
    };
    const postMessage = vi.fn();
    const webview = makeWebview(postMessage);
    const provider = makeProjectProvider(makeDataManager(), gateway, fixture);
    provider.resolveWebviewView(makeWebviewView(webview) as any, {} as any, {} as any);
    await vi.runAllTimersAsync();
    const handler = vi.mocked(webview.onDidReceiveMessage).mock.calls[0]?.[0];
    const vscode = await import('vscode');
    vi.mocked(vscode.window.showOpenDialog).mockResolvedValueOnce([
      { fsPath: '/repos/docs-link' },
      { fsPath: '/repos/other' },
    ] as any);
    // Cross-platform canonicalization is the Host's job: a symlinked pick must
    // come back as its real path, and two picks resolving to the same canonical
    // root collapse into one entry.
    vi.mocked(fsPromises.realpath)
      .mockImplementationOnce(async () => '/repos/docs-real')
      .mockImplementationOnce(async () => '/repos/docs-real');
    postMessage.mockClear();

    await handler?.({ type: 'pickWorksetMembers' });
    await vi.runAllTimersAsync();

    expect(vscode.window.showOpenDialog).toHaveBeenCalledWith({
      canSelectFolders: true,
      canSelectMany: true,
    });
    expect(postMessage).toHaveBeenCalledWith({
      type: 'worksetMembersPicked',
      paths: ['/repos/docs-real'],
    });
  });

  it('posts nothing when the native folder picker is dismissed', async () => {
    vi.useFakeTimers();
    const fixture = makeProjectFixture('/planning/current');
    const gateway = {
      loadProjectSidebarData: vi.fn().mockResolvedValue({
        project: fixture.project,
        binding: fixture.binding,
        changes: [],
        archivedChanges: [],
        projectSpecs: [],
        referencedStoreSpecs: [],
      }),
    };
    const postMessage = vi.fn();
    const webview = makeWebview(postMessage);
    const provider = makeProjectProvider(makeDataManager(), gateway, fixture);
    provider.resolveWebviewView(makeWebviewView(webview) as any, {} as any, {} as any);
    await vi.runAllTimersAsync();
    const handler = vi.mocked(webview.onDidReceiveMessage).mock.calls[0]?.[0];
    // Default showOpenDialog mock resolves undefined (dismissed picker).
    postMessage.mockClear();

    await handler?.({ type: 'pickWorksetMembers' });
    await vi.runAllTimersAsync();

    expect(postMessage).not.toHaveBeenCalled();
  });

  it('drops picked paths that cannot be canonicalized instead of posting them', async () => {
    vi.useFakeTimers();
    const fixture = makeProjectFixture('/planning/current');
    const gateway = {
      loadProjectSidebarData: vi.fn().mockResolvedValue({
        project: fixture.project,
        binding: fixture.binding,
        changes: [],
        archivedChanges: [],
        projectSpecs: [],
        referencedStoreSpecs: [],
      }),
    };
    const postMessage = vi.fn();
    const webview = makeWebview(postMessage);
    const provider = makeProjectProvider(makeDataManager(), gateway, fixture);
    provider.resolveWebviewView(makeWebviewView(webview) as any, {} as any, {} as any);
    await vi.runAllTimersAsync();
    const handler = vi.mocked(webview.onDidReceiveMessage).mock.calls[0]?.[0];
    const vscode = await import('vscode');
    vi.mocked(vscode.window.showOpenDialog).mockResolvedValueOnce([
      { fsPath: '/repos/ok' },
      { fsPath: '/repos/gone' },
    ] as any);
    vi.mocked(fsPromises.realpath)
      .mockImplementationOnce(async () => '/repos/ok')
      .mockRejectedValueOnce(new Error('ENOENT'));
    postMessage.mockClear();

    await handler?.({ type: 'pickWorksetMembers' });
    await vi.runAllTimersAsync();

    expect(postMessage).toHaveBeenCalledTimes(1);
    expect(postMessage).toHaveBeenCalledWith({
      type: 'worksetMembersPicked',
      paths: ['/repos/ok'],
      droppedPaths: ['/repos/gone'],
    });
  });

  it('reports Host-dropped picks recoverably even when every pick is unrealpath-able', async () => {
    vi.useFakeTimers();
    const fixture = makeProjectFixture('/planning/current');
    const gateway = {
      loadProjectSidebarData: vi.fn().mockResolvedValue({
        project: fixture.project,
        binding: fixture.binding,
        changes: [],
        archivedChanges: [],
        projectSpecs: [],
        referencedStoreSpecs: [],
      }),
    };
    const postMessage = vi.fn();
    const webview = makeWebview(postMessage);
    const provider = makeProjectProvider(makeDataManager(), gateway, fixture);
    provider.resolveWebviewView(makeWebviewView(webview) as any, {} as any, {} as any);
    await vi.runAllTimersAsync();
    const handler = vi.mocked(webview.onDidReceiveMessage).mock.calls[0]?.[0];
    const vscode = await import('vscode');
    vi.mocked(vscode.window.showOpenDialog).mockResolvedValueOnce([
      { fsPath: '/repos/gone-a' },
      { fsPath: '/repos/gone-b' },
    ] as any);
    vi.mocked(fsPromises.realpath)
      .mockRejectedValueOnce(new Error('ENOENT'))
      .mockRejectedValueOnce(new Error('ENOENT'));
    postMessage.mockClear();

    await handler?.({ type: 'pickWorksetMembers' });
    await vi.runAllTimersAsync();

    // Empty add plus the dropped paths for a recoverable notice — no error banner.
    expect(postMessage).toHaveBeenCalledTimes(1);
    expect(postMessage).toHaveBeenCalledWith({
      type: 'worksetMembersPicked',
      paths: [],
      droppedPaths: ['/repos/gone-a', '/repos/gone-b'],
    });
    expect(postMessage.mock.calls.some(([message]) => message.type === 'error')).toBe(false);
  });

  it('posts one recoverable error when the native folder picker rejects', async () => {
    vi.useFakeTimers();
    const fixture = makeProjectFixture('/planning/current');
    const gateway = {
      loadProjectSidebarData: vi.fn().mockResolvedValue({
        project: fixture.project,
        binding: fixture.binding,
        changes: [],
        archivedChanges: [],
        projectSpecs: [],
        referencedStoreSpecs: [],
      }),
    };
    const postMessage = vi.fn();
    const webview = makeWebview(postMessage);
    const provider = makeProjectProvider(makeDataManager(), gateway, fixture);
    provider.resolveWebviewView(makeWebviewView(webview) as any, {} as any, {} as any);
    await vi.runAllTimersAsync();
    const handler = vi.mocked(webview.onDidReceiveMessage).mock.calls[0]?.[0];
    const vscode = await import('vscode');
    vi.mocked(vscode.window.showOpenDialog).mockRejectedValueOnce(new Error('Throwing Thenable'));
    postMessage.mockClear();

    await handler?.({ type: 'pickWorksetMembers' });
    await vi.runAllTimersAsync();

    const errorMessages = postMessage.mock.calls
      .map(([message]) => message)
      .filter((message) => message.type === 'error');
    expect(errorMessages).toHaveLength(1);
    expect(typeof errorMessages[0].message).toBe('string');
    expect(errorMessages[0].message).toBeTruthy();
    expect(postMessage.mock.calls.some(([message]) => message.type === 'worksetMembersPicked')).toBe(false);
  });

  it('suppresses the selection error when a rejected Store resolve is superseded by a newer request', async () => {
    vi.useFakeTimers();
    const fixture = makeProjectFixture('/planning/current');
    const rejectors: Array<(error: Error) => void> = [];
    const gateway = {
      loadProjectSidebarData: vi.fn().mockResolvedValue({
        project: fixture.project,
        binding: fixture.binding,
        changes: [makeProjectChange('project-change')],
        archivedChanges: [],
        projectSpecs: [],
        referencedStoreSpecs: [],
      }),
      resolveWorksetStore: vi.fn(() => new Promise<never>((_, reject) => {
        rejectors.push(reject);
      })),
    };
    const postMessage = vi.fn();
    const webview = makeWebview(postMessage);
    const provider = makeProjectProvider(makeDataManager(), gateway, fixture);
    provider.resolveWebviewView(makeWebviewView(webview) as any, {} as any, {} as any);
    await vi.runAllTimersAsync();
    const handler = vi.mocked(webview.onDidReceiveMessage).mock.calls[0]?.[0];

    // The slow selection's resolve rejects only after a newer request committed.
    const slowSelection = handler?.({
      type: 'selectWorksetStore',
      worksetName: 'team',
      memberPath: '/stores/team-store',
    });
    expect(rejectors).toHaveLength(1);
    await handler?.({ type: 'getProjectSidebarData' });
    await vi.runAllTimersAsync();
    postMessage.mockClear();

    rejectors[0]?.(new Error('stale resolve rejection'));
    await slowSelection;
    await vi.runAllTimersAsync();

    // The superseded rejection stays silent: no recoverable error is posted.
    expect(postMessage.mock.calls.some(([message]) => message.type === 'error')).toBe(false);
  });

  it('rejects malformed Workset creation input before invoking the CLI', async () => {
    vi.useFakeTimers();
    const fixture = makeProjectFixture('/planning/current');
    const gateway = {
      loadProjectSidebarData: vi.fn().mockResolvedValue(
        makeNavigationPayload(fixture, ['planning']),
      ),
    };
    const createWorkset = vi.fn();
    const dataManager = makeDataManager({ createWorkset });
    const postMessage = vi.fn();
    const webview = makeWebview(postMessage);
    const provider = makeProjectProvider(dataManager, gateway, fixture);
    provider.resolveWebviewView(makeWebviewView(webview) as any, {} as any, {} as any);
    await vi.runAllTimersAsync();
    const handler = vi.mocked(webview.onDidReceiveMessage).mock.calls[0]?.[0];
    postMessage.mockClear();

    const malformed: Record<string, unknown>[] = [
      { name: 42, members: ['/projects/current'] },
      { name: '   ', members: ['/projects/current'] },
      { name: '--store', members: ['/projects/current'] },
      { name: 'ok', members: 'not-an-array' },
      { name: 'ok', members: [] },
      { name: 'ok', members: ['/projects/current', 'relative/path'] },
      { name: 'ok', members: ['/projects/current'], tool: 7 },
      { name: 'ok', members: ['/projects/current'], tool: '--json' },
    ];
    for (const message of malformed) {
      await handler?.({ type: 'createWorkset', ...message });
    }
    await vi.runAllTimersAsync();

    expect(createWorkset).not.toHaveBeenCalled();
    const results = postMessage.mock.calls
      .map(([message]) => message)
      .filter((message) => message.type === 'worksetCreateResult');
    expect(results).toHaveLength(malformed.length);
    expect(results.every((result) => result.success === false)).toBe(true);
    expect(results.every((result) => typeof result.message === 'string' && result.message)).toBe(true);
  });

  it('rejects creation when a submitted member cannot be canonicalized', async () => {
    vi.useFakeTimers();
    const fixture = makeProjectFixture('/planning/current');
    const gateway = {
      loadProjectSidebarData: vi.fn().mockResolvedValue(
        makeNavigationPayload(fixture, ['planning']),
      ),
    };
    const createWorkset = vi.fn();
    const dataManager = makeDataManager({ createWorkset });
    const postMessage = vi.fn();
    const webview = makeWebview(postMessage);
    const provider = makeProjectProvider(dataManager, gateway, fixture);
    provider.resolveWebviewView(makeWebviewView(webview) as any, {} as any, {} as any);
    await vi.runAllTimersAsync();
    const handler = vi.mocked(webview.onDidReceiveMessage).mock.calls[0]?.[0];
    vi.mocked(fsPromises.realpath)
      .mockImplementationOnce(async (value: Parameters<typeof fsPromises.realpath>[0]) => String(value))
      .mockRejectedValueOnce(new Error('ENOENT'));
    postMessage.mockClear();

    await handler?.({
      type: 'createWorkset',
      name: 'feature',
      members: ['/projects/current', '/repos/gone'],
    });
    await vi.runAllTimersAsync();

    expect(createWorkset).not.toHaveBeenCalled();
    const results = postMessage.mock.calls
      .map(([message]) => message)
      .filter((message) => message.type === 'worksetCreateResult');
    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(false);
  });

  it('rejects Workset creation when the Workset capability is unavailable', async () => {
    vi.useFakeTimers();
    const fixture = makeProjectFixture('/planning/current');
    const gateway = {
      loadProjectSidebarData: vi.fn().mockResolvedValue({
        project: fixture.project,
        binding: fixture.binding,
        changes: [],
        archivedChanges: [],
        projectSpecs: [],
        referencedStoreSpecs: [],
      }),
    };
    const createWorkset = vi.fn();
    const dataManager = makeDataManager({ createWorkset });
    const postMessage = vi.fn();
    const webview = makeWebview(postMessage);
    const provider = makeProjectProvider(dataManager, gateway, fixture);
    provider.resolveWebviewView(makeWebviewView(webview) as any, {} as any, {} as any);
    await vi.runAllTimersAsync();
    const handler = vi.mocked(webview.onDidReceiveMessage).mock.calls[0]?.[0];
    postMessage.mockClear();

    await handler?.({
      type: 'createWorkset',
      name: 'feature',
      members: ['/projects/current'],
    });
    await vi.runAllTimersAsync();

    expect(createWorkset).not.toHaveBeenCalled();
    const results = postMessage.mock.calls
      .map(([message]) => message)
      .filter((message) => message.type === 'worksetCreateResult');
    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(false);
    expect(results[0].message).toContain('not supported');
  });

  it('creates selector-free, reloads officially, and posts success only after the fresh snapshot contains the name', async () => {
    vi.useFakeTimers();
    const fixture = makeProjectFixture('/planning/current');
    const gateway = {
      loadProjectSidebarData: vi.fn()
        .mockResolvedValueOnce(makeNavigationPayload(fixture, ['planning']))
        .mockResolvedValue(makeNavigationPayload(fixture, ['planning', 'feature'])),
    };
    const createWorkset = vi.fn().mockResolvedValue({ name: 'feature' });
    const dataManager = makeDataManager({ createWorkset });
    const postMessage = vi.fn();
    const webview = makeWebview(postMessage);
    const provider = makeProjectProvider(dataManager, gateway, fixture);
    provider.resolveWebviewView(makeWebviewView(webview) as any, {} as any, {} as any);
    await vi.runAllTimersAsync();
    const handler = vi.mocked(webview.onDidReceiveMessage).mock.calls[0]?.[0];
    postMessage.mockClear();

    await handler?.({
      type: 'createWorkset',
      name: '  feature  ',
      members: ['/projects/current', '/repos/docs'],
      tool: ' cursor ',
    });
    await vi.runAllTimersAsync();

    // Selector-free official creation: exactly the validated payload, no store
    // selector argument ever reaches the DataManager method.
    expect(createWorkset).toHaveBeenCalledTimes(1);
    expect(createWorkset).toHaveBeenCalledWith('feature', ['/projects/current', '/repos/docs'], 'cursor');
    // The official reload happened and published the fresh navigation.
    const freshContext = postMessage.mock.calls
      .map(([message]) => message)
      .filter((message) => message.type === 'setContext' && message.view === 'sidebar')
      .at(-1);
    expect(freshContext?.data?.worksetNavigation?.worksets.some((workset: { name: string }) => (
      workset.name === 'feature'
    ))).toBe(true);
    // Success is posted only after that fresh snapshot contained the name.
    const results = postMessage.mock.calls
      .map(([message]) => message)
      .filter((message) => message.type === 'worksetCreateResult');
    expect(results).toEqual([{ type: 'worksetCreateResult', success: true, name: 'feature' }]);
  });

  it('posts a recoverable failure and keeps the previous snapshot when the CLI rejects creation', async () => {
    vi.useFakeTimers();
    const fixture = makeProjectFixture('/planning/current');
    const initialPayload = makeNavigationPayload(fixture, ['planning']);
    const gateway = {
      loadProjectSidebarData: vi.fn().mockResolvedValue(initialPayload),
    };
    const createWorkset = vi.fn().mockRejectedValue(new Error('workset already exists'));
    const dataManager = makeDataManager({ createWorkset });
    const postMessage = vi.fn();
    const webview = makeWebview(postMessage);
    const provider = makeProjectProvider(dataManager, gateway, fixture);
    provider.resolveWebviewView(makeWebviewView(webview) as any, {} as any, {} as any);
    await vi.runAllTimersAsync();
    const initialLoadCalls = gateway.loadProjectSidebarData.mock.calls.length;
    postMessage.mockClear();
    const handler = vi.mocked(webview.onDidReceiveMessage).mock.calls[0]?.[0];

    await handler?.({
      type: 'createWorkset',
      name: 'feature',
      members: ['/projects/current'],
    });
    await vi.runAllTimersAsync();

    expect(createWorkset).toHaveBeenCalledTimes(1);
    const results = postMessage.mock.calls
      .map(([message]) => message)
      .filter((message) => message.type === 'worksetCreateResult');
    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(false);
    expect(results[0].message).toContain('workset already exists');
    // No reload and no optimistic publish: the cached snapshot stays untouched.
    expect(gateway.loadProjectSidebarData).toHaveBeenCalledTimes(initialLoadCalls);
    expect((provider as any).cachedProjectSidebarData.worksetNavigation.worksets)
      .toEqual(initialPayload.worksetNavigation.worksets);
    expect(postMessage.mock.calls.some(([message]) => (
      message.type === 'setContext'
      && message.data?.worksetNavigation?.worksets.some((workset: { name: string }) => workset.name === 'feature')
    ))).toBe(false);
  });

  it('reports failure without fabricating a detail when the refreshed snapshot lacks the created Workset', async () => {
    vi.useFakeTimers();
    const fixture = makeProjectFixture('/planning/current');
    const gateway = {
      loadProjectSidebarData: vi.fn().mockResolvedValue(makeNavigationPayload(fixture, ['planning'])),
    };
    const createWorkset = vi.fn().mockResolvedValue({ name: 'feature' });
    const dataManager = makeDataManager({ createWorkset });
    const postMessage = vi.fn();
    const webview = makeWebview(postMessage);
    const provider = makeProjectProvider(dataManager, gateway, fixture);
    provider.resolveWebviewView(makeWebviewView(webview) as any, {} as any, {} as any);
    await vi.runAllTimersAsync();
    const initialLoadCalls = gateway.loadProjectSidebarData.mock.calls.length;
    postMessage.mockClear();
    const handler = vi.mocked(webview.onDidReceiveMessage).mock.calls[0]?.[0];

    await handler?.({
      type: 'createWorkset',
      name: 'feature',
      members: ['/projects/current'],
    });
    await vi.runAllTimersAsync();

    expect(createWorkset).toHaveBeenCalledTimes(1);
    // The official reload ran, but the fresh navigation still lacks the name.
    expect(gateway.loadProjectSidebarData.mock.calls.length).toBe(initialLoadCalls + 1);
    const results = postMessage.mock.calls
      .map(([message]) => message)
      .filter((message) => message.type === 'worksetCreateResult');
    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(false);
    expect(typeof results[0].message).toBe('string');
    expect(results[0].message).toBeTruthy();
    expect(postMessage.mock.calls.some(([message]) => (
      message.type === 'worksetCreateResult' && message.success === true
    ))).toBe(false);
  });

  it('replies to a duplicate creation submission with one recoverable in-progress result', async () => {
    vi.useFakeTimers();
    const fixture = makeProjectFixture('/planning/current');
    const gateway = {
      loadProjectSidebarData: vi.fn()
        .mockResolvedValueOnce(makeNavigationPayload(fixture, ['planning']))
        .mockResolvedValue(makeNavigationPayload(fixture, ['planning', 'feature'])),
    };
    let resolveCreate: ((value: unknown) => void) | undefined;
    const createWorkset = vi.fn(() => new Promise((resolve) => {
      resolveCreate = resolve;
    }));
    const dataManager = makeDataManager({ createWorkset });
    const postMessage = vi.fn();
    const webview = makeWebview(postMessage);
    const provider = makeProjectProvider(dataManager, gateway, fixture);
    provider.resolveWebviewView(makeWebviewView(webview) as any, {} as any, {} as any);
    await vi.runAllTimersAsync();
    const handler = vi.mocked(webview.onDidReceiveMessage).mock.calls[0]?.[0];
    postMessage.mockClear();

    const first = handler?.({
      type: 'createWorkset',
      name: 'feature',
      members: ['/projects/current'],
    });
    const duplicate = handler?.({
      type: 'createWorkset',
      name: 'feature',
      members: ['/projects/current'],
    });
    await vi.runAllTimersAsync();
    resolveCreate?.({ name: 'feature' });
    await first;
    await duplicate;
    await vi.runAllTimersAsync();

    // Single-flight holds: exactly one CLI create. Both requests get exactly
    // one result each — the duplicate is a recoverable in-progress failure.
    expect(createWorkset).toHaveBeenCalledTimes(1);
    const results = postMessage.mock.calls
      .map(([message]) => message)
      .filter((message) => message.type === 'worksetCreateResult');
    expect(results).toHaveLength(2);
    expect(results[0]).toEqual(expect.objectContaining({
      type: 'worksetCreateResult',
      success: false,
      name: 'feature',
    }));
    expect(typeof results[0].message).toBe('string');
    expect(results[0].message).toBeTruthy();
    expect(results[1]).toEqual({ type: 'worksetCreateResult', success: true, name: 'feature' });
  });

  it('reports success when the create reload is superseded by a newer reload that publishes the new name', async () => {
    vi.useFakeTimers();
    const fixture = makeProjectFixture('/planning/current');
    // Deferred loads let the test interleave reloads in a deterministic order.
    const resolvers: Array<(value: unknown) => void> = [];
    const gateway = {
      loadProjectSidebarData: vi.fn(() => new Promise((resolve) => {
        resolvers.push(resolve);
      })),
    };
    const createWorkset = vi.fn().mockResolvedValue({ name: 'feature' });
    const dataManager = makeDataManager({ createWorkset });
    const postMessage = vi.fn();
    const webview = makeWebview(postMessage);
    const provider = makeProjectProvider(dataManager, gateway, fixture);
    provider.resolveWebviewView(makeWebviewView(webview) as any, {} as any, {} as any);
    await vi.runAllTimersAsync();
    const handler = vi.mocked(webview.onDidReceiveMessage).mock.calls[0]?.[0];
    resolvers[0]?.(makeNavigationPayload(fixture, ['planning']));
    await vi.runAllTimersAsync();
    postMessage.mockClear();

    // Create succeeds; its official reload (load #2) stays pending.
    const submit = handler?.({
      type: 'createWorkset',
      name: 'feature',
      members: ['/projects/current'],
    });
    await vi.runAllTimersAsync();
    // A newer surface request supersedes it with reload #3.
    const newer = handler?.({ type: 'getProjectSidebarData' });
    await vi.runAllTimersAsync();
    expect(resolvers).toHaveLength(3);

    // The superseded create reload resolves without the name; the newer reload
    // publishes a snapshot that contains it.
    resolvers[1]?.(makeNavigationPayload(fixture, ['planning']));
    resolvers[2]?.(makeNavigationPayload(fixture, ['planning', 'feature']));
    await submit;
    await newer;
    await vi.runAllTimersAsync();

    expect(createWorkset).toHaveBeenCalledTimes(1);
    const results = postMessage.mock.calls
      .map(([message]) => message)
      .filter((message) => message.type === 'worksetCreateResult');
    expect(results).toEqual([{ type: 'worksetCreateResult', success: true, name: 'feature' }]);
  });

  it('reports failure when the create reload is superseded by a newer reload that lacks the new name', async () => {
    vi.useFakeTimers();
    const fixture = makeProjectFixture('/planning/current');
    const resolvers: Array<(value: unknown) => void> = [];
    const gateway = {
      loadProjectSidebarData: vi.fn(() => new Promise((resolve) => {
        resolvers.push(resolve);
      })),
    };
    const createWorkset = vi.fn().mockResolvedValue({ name: 'feature' });
    const dataManager = makeDataManager({ createWorkset });
    const postMessage = vi.fn();
    const webview = makeWebview(postMessage);
    const provider = makeProjectProvider(dataManager, gateway, fixture);
    provider.resolveWebviewView(makeWebviewView(webview) as any, {} as any, {} as any);
    await vi.runAllTimersAsync();
    const handler = vi.mocked(webview.onDidReceiveMessage).mock.calls[0]?.[0];
    resolvers[0]?.(makeNavigationPayload(fixture, ['planning']));
    await vi.runAllTimersAsync();
    postMessage.mockClear();

    const submit = handler?.({
      type: 'createWorkset',
      name: 'feature',
      members: ['/projects/current'],
    });
    await vi.runAllTimersAsync();
    const newer = handler?.({ type: 'getProjectSidebarData' });
    await vi.runAllTimersAsync();

    // The finally-published snapshot still does not contain the new name.
    resolvers[1]?.(makeNavigationPayload(fixture, ['planning']));
    resolvers[2]?.(makeNavigationPayload(fixture, ['planning']));
    await submit;
    await newer;
    await vi.runAllTimersAsync();

    const results = postMessage.mock.calls
      .map(([message]) => message)
      .filter((message) => message.type === 'worksetCreateResult');
    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(false);
    expect(typeof results[0].message).toBe('string');
    expect(results[0].message).toBeTruthy();
    expect(postMessage.mock.calls.some(([message]) => (
      message.type === 'worksetCreateResult' && message.success === true
    ))).toBe(false);
  });

  it('reports a recoverable failure when the create reload is superseded by a newer reload that fails', async () => {
    vi.useFakeTimers();
    const fixture = makeProjectFixture('/planning/current');
    const resolvers: Array<(value: unknown) => void> = [];
    const gateway = {
      loadProjectSidebarData: vi.fn(() => new Promise((resolve) => {
        resolvers.push(resolve);
      })),
    };
    const createWorkset = vi.fn().mockResolvedValue({ name: 'feature' });
    const dataManager = makeDataManager({ createWorkset });
    const postMessage = vi.fn();
    const webview = makeWebview(postMessage);
    const provider = makeProjectProvider(dataManager, gateway, fixture);
    provider.resolveWebviewView(makeWebviewView(webview) as any, {} as any, {} as any);
    await vi.runAllTimersAsync();
    const handler = vi.mocked(webview.onDidReceiveMessage).mock.calls[0]?.[0];
    resolvers[0]?.(makeNavigationPayload(fixture, ['planning']));
    await vi.runAllTimersAsync();
    postMessage.mockClear();

    const submit = handler?.({
      type: 'createWorkset',
      name: 'feature',
      members: ['/projects/current'],
    });
    await vi.runAllTimersAsync();
    const newer = handler?.({ type: 'getProjectSidebarData' });
    await vi.runAllTimersAsync();

    // The superseded create load resolves; the terminal newer load fails.
    resolvers[1]?.(makeNavigationPayload(fixture, ['planning']));
    resolvers[2]?.(new Error('sidebar load failed'));
    await submit;
    await newer;
    await vi.runAllTimersAsync();

    expect(createWorkset).toHaveBeenCalledTimes(1);
    const results = postMessage.mock.calls
      .map(([message]) => message)
      .filter((message) => message.type === 'worksetCreateResult');
    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(false);
    expect(typeof results[0].message).toBe('string');
    expect(results[0].message).toBeTruthy();
    // Accepted dual-surface semantics: the create flow reports its reload
    // failure itself as exactly one result, while the newer (non-suppressed)
    // reload's generic error is the one and only error message posted.
    const errorMessages = postMessage.mock.calls
      .map(([message]) => message)
      .filter((message) => message.type === 'error');
    expect(errorMessages).toHaveLength(1);
    expect(postMessage.mock.calls.some(([message]) => (
      message.type === 'worksetCreateResult' && message.success === true
    ))).toBe(false);
  });

  it('suppresses the generic reload error when creation succeeds but the refresh fails', async () => {
    vi.useFakeTimers();
    const fixture = makeProjectFixture('/planning/current');
    const gateway = {
      loadProjectSidebarData: vi.fn()
        .mockResolvedValueOnce(makeNavigationPayload(fixture, ['planning']))
        .mockRejectedValue(new Error('sidebar load failed')),
    };
    const createWorkset = vi.fn().mockResolvedValue({ name: 'feature' });
    const dataManager = makeDataManager({ createWorkset });
    const postMessage = vi.fn();
    const webview = makeWebview(postMessage);
    const provider = makeProjectProvider(dataManager, gateway, fixture);
    provider.resolveWebviewView(makeWebviewView(webview) as any, {} as any, {} as any);
    await vi.runAllTimersAsync();
    const handler = vi.mocked(webview.onDidReceiveMessage).mock.calls[0]?.[0];
    postMessage.mockClear();

    await handler?.({
      type: 'createWorkset',
      name: 'feature',
      members: ['/projects/current'],
    });
    await vi.runAllTimersAsync();

    // Exactly one createResult failure and zero generic error messages: the
    // reload failure belongs to the create flow, which reports it itself.
    const results = postMessage.mock.calls
      .map(([message]) => message)
      .filter((message) => message.type === 'worksetCreateResult');
    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(false);
    expect(typeof results[0].message).toBe('string');
    expect(results[0].message).toBeTruthy();
    expect(postMessage.mock.calls.some(([message]) => message.type === 'error')).toBe(false);
  });

  it('includes a sanitized single-line CLI stderr excerpt in the failure result', async () => {
    vi.useFakeTimers();
    const fixture = makeProjectFixture('/planning/current');
    const gateway = {
      loadProjectSidebarData: vi.fn().mockResolvedValue(makeNavigationPayload(fixture, ['planning'])),
    };
    const cliFailure = Object.assign(
      new Error('Command failed with code 1'),
      { stderr: 'Error: workset already exists\n  at createWorkset (cli.ts:12:3)\n\nhint: choose another name' },
    );
    const createWorkset = vi.fn().mockRejectedValue(cliFailure);
    const dataManager = makeDataManager({ createWorkset });
    const postMessage = vi.fn();
    const webview = makeWebview(postMessage);
    const provider = makeProjectProvider(dataManager, gateway, fixture);
    provider.resolveWebviewView(makeWebviewView(webview) as any, {} as any, {} as any);
    await vi.runAllTimersAsync();
    const handler = vi.mocked(webview.onDidReceiveMessage).mock.calls[0]?.[0];
    postMessage.mockClear();

    await handler?.({
      type: 'createWorkset',
      name: 'feature',
      members: ['/projects/current'],
    });
    await vi.runAllTimersAsync();

    const results = postMessage.mock.calls
      .map(([message]) => message)
      .filter((message) => message.type === 'worksetCreateResult');
    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(false);
    expect(results[0].message).toContain('Command failed with code 1');
    expect(results[0].message).toContain('workset already exists');
    // Sanitized: single line, bounded length, no raw CLI stack lines.
    expect(results[0].message).not.toMatch(/[\r\n]/);
    expect(results[0].message.length).toBeLessThanOrEqual(300);
  });

  it('rejects Workset creation before any CLI call when the capability is unavailable even with present navigation', async () => {
    vi.useFakeTimers();
    const fixture = makeProjectFixture('/planning/current');
    // Present-but-empty navigation: the Gateway swallows CLI capability errors
    // into an empty list, so navigation shape alone cannot gate creation.
    const gateway = {
      loadProjectSidebarData: vi.fn().mockResolvedValue(makeNavigationPayload(fixture, [])),
    };
    const createWorkset = vi.fn();
    const dataManager = makeDataManager({
      createWorkset,
      getCapabilities: vi.fn().mockReturnValue({
        stores: true,
        context: true,
        doctor: true,
        worksets: false,
        diagnostics: [],
      }),
    });
    const postMessage = vi.fn();
    const webview = makeWebview(postMessage);
    const provider = makeProjectProvider(dataManager, gateway, fixture);
    provider.resolveWebviewView(makeWebviewView(webview) as any, {} as any, {} as any);
    await vi.runAllTimersAsync();
    const handler = vi.mocked(webview.onDidReceiveMessage).mock.calls[0]?.[0];
    postMessage.mockClear();

    await handler?.({
      type: 'createWorkset',
      name: 'feature',
      members: ['/projects/current'],
    });
    await vi.runAllTimersAsync();

    expect(createWorkset).not.toHaveBeenCalled();
    const results = postMessage.mock.calls
      .map(([message]) => message)
      .filter((message) => message.type === 'worksetCreateResult');
    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(false);
    expect(results[0].message).toContain('not supported');
  });

  it('publishes the Workset capability flag with an empty navigation for the first-creation surface', async () => {
    vi.useFakeTimers();
    const fixture = makeProjectFixture('/planning/current');
    const gateway = {
      loadProjectSidebarData: vi.fn().mockResolvedValue(makeNavigationPayload(fixture, [])),
    };
    const postMessage = vi.fn();
    const webview = makeWebview(postMessage);
    const provider = makeProjectProvider(makeDataManager(), gateway, fixture);
    provider.resolveWebviewView(makeWebviewView(webview) as any, {} as any, {} as any);
    await vi.runAllTimersAsync();

    const freshContext = postMessage.mock.calls
      .map(([message]) => message)
      .filter((message) => message.type === 'setContext' && message.view === 'sidebar')
      .at(-1);
    // Empty navigation publishes (the Create entry lives on the empty list)
    // together with the authoritative capability fact.
    expect(freshContext?.data?.worksetNavigation).toEqual(
      expect.objectContaining({ worksets: [] }),
    );
    expect(freshContext?.data?.worksetCapabilityAvailable).toBe(true);
  });

  it('marks the published snapshot capability-unavailable when CLI detection lacks worksets', async () => {
    vi.useFakeTimers();
    const fixture = makeProjectFixture('/planning/current');
    const gateway = {
      loadProjectSidebarData: vi.fn().mockResolvedValue(makeNavigationPayload(fixture, [])),
    };
    const dataManager = makeDataManager({
      getCapabilities: vi.fn().mockReturnValue({
        stores: true,
        context: true,
        doctor: true,
        worksets: false,
        diagnostics: [],
      }),
    });
    const postMessage = vi.fn();
    const webview = makeWebview(postMessage);
    const provider = makeProjectProvider(dataManager, gateway, fixture);
    provider.resolveWebviewView(makeWebviewView(webview) as any, {} as any, {} as any);
    await vi.runAllTimersAsync();

    const freshContext = postMessage.mock.calls
      .map(([message]) => message)
      .filter((message) => message.type === 'setContext' && message.view === 'sidebar')
      .at(-1);
    expect(freshContext?.data?.worksetCapabilityAvailable).toBe(false);
  });

  it('leaves the watcher target untouched when an accepted Store selection load fails', async () => {
    vi.useFakeTimers();
    const fixture = makeProjectFixture('/planning/current');
    const initialPayload = {
      project: fixture.project,
      binding: fixture.binding,
      changes: [makeProjectChange('project-change')],
      archivedChanges: [],
      projectSpecs: [],
      referencedStoreSpecs: [],
    };
    const gateway = {
      loadProjectSidebarData: vi.fn()
        .mockResolvedValueOnce(initialPayload)
        .mockImplementation(async (_project: ProjectContext, storeId?: string) => {
          if (storeId) throw new Error('store context unavailable');
          return initialPayload;
        }),
      resolveWorksetStore: vi.fn().mockResolvedValue({
        storeId: 'team-store',
        canonicalRoot: '/stores/team-store',
      }),
    };
    const setWatchedProjectRoot = vi.fn();
    const dataManager = makeDataManager({ setWatchedProjectRoot });
    const postMessage = vi.fn();
    const webview = makeWebview(postMessage);
    const provider = makeProjectProvider(dataManager, gateway, fixture);
    provider.resolveWebviewView(makeWebviewView(webview) as any, {} as any, {} as any);
    await vi.runAllTimersAsync();
    const handler = vi.mocked(webview.onDidReceiveMessage).mock.calls[0]?.[0];

    await handler?.({ type: 'selectWorksetStore', worksetName: 'team', memberPath: '/stores/team-store' });
    await vi.runAllTimersAsync();

    expect(gateway.loadProjectSidebarData).toHaveBeenLastCalledWith(fixture.project, 'team-store');
    expect(setWatchedProjectRoot).not.toHaveBeenCalled();
    expect((provider as any).explicitProjectStoreId).toBeUndefined();
    expect((provider as any).currentProjectBinding).toEqual(fixture.binding);
  });

  it('loads store-scoped data on a watcher-triggered refresh while a selector is active', async () => {
    vi.useFakeTimers();
    const fixture = makeProjectFixture('/planning/current');
    const storeBinding: OpenSpecRootBinding = {
      projectId: fixture.project.id,
      commandCwd: fixture.project.projectPath,
      rootPath: '/stores/team-store',
      rootSource: 'store',
      storeId: 'team-store',
    };
    const payloadFor = (binding: OpenSpecRootBinding) => ({
      project: fixture.project,
      binding,
      changes: [makeProjectChange(binding.storeId ? 'store-change' : 'project-change')],
      archivedChanges: [],
      projectSpecs: [],
      referencedStoreSpecs: [],
    });
    const gateway = {
      loadProjectSidebarData: vi.fn(async (_project: ProjectContext, storeId?: string) => (
        storeId ? payloadFor(storeBinding) : payloadFor(fixture.binding)
      )),
      resolveWorksetStore: vi.fn().mockResolvedValue({
        storeId: 'team-store',
        canonicalRoot: '/stores/team-store',
      }),
    };
    const dataManager = makeDataManager();
    const postMessage = vi.fn();
    const webview = makeWebview(postMessage);
    const provider = makeProjectProvider(dataManager, gateway, fixture);
    provider.resolveWebviewView(makeWebviewView(webview) as any, {} as any, {} as any);
    await vi.runAllTimersAsync();
    const handler = vi.mocked(webview.onDidReceiveMessage).mock.calls[0]?.[0];
    await handler?.({ type: 'selectWorksetStore', worksetName: 'team', memberPath: '/stores/team-store' });
    await vi.runAllTimersAsync();
    expect((provider as any).explicitProjectStoreId).toBe('team-store');
    postMessage.mockClear();

    // A watcher event fires the DataManager refresh callback.
    const refreshCallback = (dataManager.onRefresh as any).mock.calls[0]?.[0] as ((data: any) => void) | undefined;
    refreshCallback?.(makeDashboardData({ changeName: 'legacy-refresh', lastRefresh: 3 }));
    await vi.runAllTimersAsync();

    expect(gateway.loadProjectSidebarData).toHaveBeenLastCalledWith(fixture.project, 'team-store');
    const contextMessages = postMessage.mock.calls
      .map(([message]) => message)
      .filter((message) => message.type === 'setContext');
    expect(contextMessages.at(-1)).toEqual(expect.objectContaining({
      data: expect.objectContaining({ binding: storeBinding }),
    }));
  });

  it('keeps the active selector and snapshot when the default-root restore fails', async () => {
    vi.useFakeTimers();
    const fixture = makeProjectFixture('/planning/current');
    const storeBinding: OpenSpecRootBinding = {
      projectId: fixture.project.id,
      commandCwd: fixture.project.projectPath,
      rootPath: '/stores/team-store',
      rootSource: 'store',
      storeId: 'team-store',
    };
    const storePayload = {
      project: fixture.project,
      binding: storeBinding,
      changes: [makeProjectChange('store-change')],
      archivedChanges: [],
      projectSpecs: [],
      referencedStoreSpecs: [],
    };
    const gateway = {
      loadProjectSidebarData: vi.fn()
        .mockResolvedValueOnce({
          project: fixture.project,
          binding: fixture.binding,
          changes: [makeProjectChange('project-change')],
          archivedChanges: [],
          projectSpecs: [],
          referencedStoreSpecs: [],
        })
        .mockImplementation(async (_project: ProjectContext, storeId?: string) => {
          if (storeId) return storePayload;
          throw new Error('project default root unavailable');
        }),
      resolveWorksetStore: vi.fn().mockResolvedValue({
        storeId: 'team-store',
        canonicalRoot: '/stores/team-store',
      }),
    };
    const postMessage = vi.fn();
    const webview = makeWebview(postMessage);
    const provider = makeProjectProvider(makeDataManager(), gateway, fixture);
    provider.resolveWebviewView(makeWebviewView(webview) as any, {} as any, {} as any);
    await vi.runAllTimersAsync();
    const handler = vi.mocked(webview.onDidReceiveMessage).mock.calls[0]?.[0];
    await handler?.({ type: 'selectWorksetStore', worksetName: 'team', memberPath: '/stores/team-store' });
    await vi.runAllTimersAsync();
    expect((provider as any).explicitProjectStoreId).toBe('team-store');
    const snapshotBefore = (provider as any).cachedProjectSidebarData;
    const bindingBefore = (provider as any).currentProjectBinding;
    postMessage.mockClear();

    await handler?.({ type: 'selectProjectDefaultRoot' });
    await vi.runAllTimersAsync();

    expect(gateway.loadProjectSidebarData).toHaveBeenLastCalledWith(fixture.project, undefined);
    expect(postMessage.mock.calls.some(([message]) => message.type === 'setContext')).toBe(false);
    expect((provider as any).explicitProjectStoreId).toBe('team-store');
    expect((provider as any).cachedProjectSidebarData).toBe(snapshotBefore);
    expect((provider as any).currentProjectBinding).toBe(bindingBefore);

    // The selector survives the failed restore and keeps driving later reloads.
    await handler?.({ type: 'getProjectSidebarData' });
    await vi.runAllTimersAsync();
    expect(gateway.loadProjectSidebarData).toHaveBeenLastCalledWith(fixture.project, 'team-store');
  });

  it('carries an active Planning Store selector into Current Project restoration', async () => {
    vi.useFakeTimers();
    const current = makeProjectFixture('/planning/current');
    const selectedProject: ProjectContext = {
      id: '/projects/server-dotnetcore',
      label: 'server-dotnetcore',
      projectPath: '/projects/server-dotnetcore',
    };
    const currentStoreBinding: OpenSpecRootBinding = {
      projectId: current.project.id,
      commandCwd: current.project.projectPath,
      rootPath: '/stores/team-store',
      rootSource: 'store',
      storeId: 'team-store',
    };
    const selectedStoreBinding: OpenSpecRootBinding = {
      projectId: selectedProject.id,
      commandCwd: selectedProject.projectPath,
      rootPath: '/stores/team-store',
      rootSource: 'store',
      storeId: 'team-store',
    };
    const payloadFor = (project: ProjectContext, binding: OpenSpecRootBinding) => ({
      project,
      binding,
      changes: [makeProjectChange(binding.storeId ? 'store-change' : 'project-change')],
      archivedChanges: [],
      projectSpecs: [],
      referencedStoreSpecs: [],
    });
    const gateway = {
      loadProjectSidebarData: vi.fn(async (project: ProjectContext, storeId?: string) => (
        storeId
          ? payloadFor(project, project.id === current.project.id ? currentStoreBinding : selectedStoreBinding)
          : payloadFor(project, {
            projectId: project.id,
            commandCwd: project.projectPath,
            rootPath: '/planning/current',
            rootSource: 'nearest',
          })
      )),
      resolveWorksetStore: vi.fn().mockResolvedValue({
        storeId: 'team-store',
        canonicalRoot: '/stores/team-store',
      }),
      resolveWorksetProject: vi.fn().mockResolvedValue(selectedProject),
      resolveBinding: vi.fn(async (project: ProjectContext, storeId?: string) => (
        storeId
          ? (project.id === current.project.id ? currentStoreBinding : selectedStoreBinding)
          : {
            projectId: project.id,
            commandCwd: project.projectPath,
            rootPath: '/planning/current',
            rootSource: 'nearest',
          }
      )),
    };
    const postMessage = vi.fn();
    const webview = makeWebview(postMessage);
    const provider = makeProjectProvider(makeDataManager(), gateway, current);
    provider.resolveWebviewView(makeWebviewView(webview) as any, {} as any, {} as any);
    await vi.runAllTimersAsync();
    const handler = vi.mocked(webview.onDidReceiveMessage).mock.calls[0]?.[0];

    await handler?.({ type: 'selectWorksetStore', worksetName: 'team', memberPath: '/stores/team-store' });
    await vi.runAllTimersAsync();
    await handler?.({
      type: 'selectWorksetProject',
      worksetName: 'shared-workset',
      memberPath: selectedProject.projectPath,
    });
    await vi.runAllTimersAsync();
    expect(gateway.resolveBinding).toHaveBeenLastCalledWith(selectedProject, 'team-store');
    postMessage.mockClear();

    await handler?.({ type: 'selectCurrentProject' });
    await vi.runAllTimersAsync();

    expect(gateway.resolveBinding).toHaveBeenLastCalledWith(current.project, 'team-store');
    expect(gateway.loadProjectSidebarData).toHaveBeenLastCalledWith(current.project, 'team-store');
    const restoredMessage = postMessage.mock.calls
      .map(([message]) => message)
      .filter((message) => message.type === 'setContext' && message.view === 'sidebar')
      .at(-1);
    expect(restoredMessage).toEqual(expect.objectContaining({
      data: expect.objectContaining({ project: current.project, binding: currentStoreBinding }),
    }));
    expect((provider as any).explicitProjectStoreId).toBe('team-store');
  });

  it('carries an active Planning Store selector into Workset Project navigation', async () => {
    vi.useFakeTimers();
    const current = makeProjectFixture('/planning/current');
    const selectedProject: ProjectContext = {
      id: '/projects/server-dotnetcore',
      label: 'server-dotnetcore',
      projectPath: '/projects/server-dotnetcore',
    };
    const currentStoreBinding: OpenSpecRootBinding = {
      projectId: current.project.id,
      commandCwd: current.project.projectPath,
      rootPath: '/stores/team-store',
      rootSource: 'store',
      storeId: 'team-store',
    };
    const selectedStoreBinding: OpenSpecRootBinding = {
      projectId: selectedProject.id,
      commandCwd: selectedProject.projectPath,
      rootPath: '/stores/team-store',
      rootSource: 'store',
      storeId: 'team-store',
    };
    const payloadFor = (project: ProjectContext, binding: OpenSpecRootBinding) => ({
      project,
      binding,
      changes: [makeProjectChange(binding.storeId ? 'store-change' : 'project-change')],
      archivedChanges: [],
      projectSpecs: [],
      referencedStoreSpecs: [],
    });
    const gateway = {
      loadProjectSidebarData: vi.fn(async (project: ProjectContext, storeId?: string) => {
        if (!storeId) {
          return payloadFor(project, {
            projectId: project.id,
            commandCwd: project.projectPath,
            rootPath: '/planning/current',
            rootSource: 'nearest',
          });
        }
        return payloadFor(
          project,
          project.id === current.project.id ? currentStoreBinding : selectedStoreBinding
        );
      }),
      resolveWorksetStore: vi.fn().mockResolvedValue({
        storeId: 'team-store',
        canonicalRoot: '/stores/team-store',
      }),
      resolveWorksetProject: vi.fn().mockResolvedValue(selectedProject),
      resolveBinding: vi.fn().mockResolvedValue(selectedStoreBinding),
    };
    const postMessage = vi.fn();
    const webview = makeWebview(postMessage);
    const provider = makeProjectProvider(makeDataManager(), gateway, current);
    provider.resolveWebviewView(makeWebviewView(webview) as any, {} as any, {} as any);
    await vi.runAllTimersAsync();
    const handler = vi.mocked(webview.onDidReceiveMessage).mock.calls[0]?.[0];

    await handler?.({ type: 'selectWorksetStore', worksetName: 'team', memberPath: '/stores/team-store' });
    await vi.runAllTimersAsync();
    postMessage.mockClear();

    await handler?.({
      type: 'selectWorksetProject',
      worksetName: 'shared-workset',
      memberPath: selectedProject.projectPath,
    });
    await vi.runAllTimersAsync();

    expect(gateway.resolveBinding).toHaveBeenLastCalledWith(selectedProject, 'team-store');
    expect(gateway.loadProjectSidebarData).toHaveBeenLastCalledWith(selectedProject, 'team-store');
    const selectedMessage = postMessage.mock.calls
      .map(([message]) => message)
      .filter((message) => message.type === 'setContext' && message.view === 'sidebar')
      .at(-1);
    expect(selectedMessage).toEqual(expect.objectContaining({
      data: expect.objectContaining({ project: selectedProject, binding: selectedStoreBinding }),
    }));
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
          archivedChanges: [],
          projectSpecs: [],
          referencedStoreSpecs: [],
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

  it('replays Spec content when the Project-first webview becomes ready after the initial post', async () => {
    vi.useFakeTimers();
    const fixture = makeProjectFixture();
    const gateway = {
      resolveBinding: vi.fn().mockResolvedValue(fixture.binding),
      loadChanges: vi.fn().mockResolvedValue({ project: fixture.project, binding: fixture.binding, changes: [] }),
    };
    const dataManager = makeDataManager({
      readSpec: vi.fn().mockResolvedValue('late-ready spec content'),
    });
    const sidebarWebview = makeWebview();
    const specPanel = makeEditorPanel();
    const vscode = await import('vscode');
    vi.mocked(vscode.window.createWebviewPanel).mockReturnValueOnce(specPanel as any);
    const provider = makeProjectProvider(dataManager, gateway, fixture);

    provider.resolveWebviewView(makeWebviewView(sidebarWebview) as any, {} as any, {} as any);
    const sidebarHandler = vi.mocked(sidebarWebview.onDidReceiveMessage).mock.calls[0]?.[0];
    await sidebarHandler?.({ type: 'openSpecInEditor', specId: 'late-ready', project: fixture.project, binding: fixture.binding });
    await vi.runAllTimersAsync();

    const specHandler = vi.mocked(specPanel.webview.onDidReceiveMessage).mock.calls[0]?.[0];
    await specHandler?.({ type: 'getProjectSidebarData' });
    const specMessages = specPanel.webview.postMessage.mock.calls.map(([message]) => message);

    expect(specMessages.filter((message) => message?.type === 'specContent')).toHaveLength(2);
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

  it('does not let Project-first same-named detail requests fall back to a legacy scope', async () => {
    const fixture = makeProjectFixture();
    const panelManager = { open: vi.fn() };
    const dataManager = makeDataManager({
      readSpec: vi.fn().mockResolvedValue('# legacy Store spec'),
    });
    const gateway = {
      resolveBinding: vi.fn().mockResolvedValue(fixture.binding),
      loadChanges: vi.fn().mockResolvedValue({ project: fixture.project, binding: fixture.binding, changes: [] }),
    };
    const sidebarWebview = makeWebview();
    const provider = new (DashboardViewProvider as any)(
      dataManager,
      '/ext',
      panelManager,
      undefined,
      fixture.project,
      gateway,
    ) as DashboardViewProvider;
    provider.resolveWebviewView(makeWebviewView(sidebarWebview) as any, {} as any, {} as any);
    const handler = vi.mocked(sidebarWebview.onDidReceiveMessage).mock.calls[0]?.[0];

    await handler?.({
      type: 'openChangeDetailInEditor',
      changeName: 'same-name',
      scopeId: 'store:legacy',
    });
    await handler?.({
      type: 'openSpecInEditor',
      specId: 'same-spec',
      scopeId: 'store:legacy',
    });

    expect(panelManager.open).not.toHaveBeenCalled();
    expect(dataManager.readSpec).not.toHaveBeenCalled();
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
