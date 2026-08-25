import { realpathSync, rmSync } from 'fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DataManager } from '@extension/services/dataManager';
import { TaskExecutorService } from '@extension/services/taskExecutorService';
import type { ArchivedChangeInfo, ChangeInfo, SpecInfo } from '@extension/services/types';

vi.mock('vscode', () => ({
  Disposable: class {
    constructor(private readonly disposeFn: () => void) {}
    dispose(): void {
      this.disposeFn();
    }
  },
  workspace: {
    getConfiguration: vi.fn(() => ({
      get: vi.fn(() => false),
    })),
    createFileSystemWatcher: vi.fn(() => ({
      onDidCreate: vi.fn(),
      onDidChange: vi.fn(),
      onDidDelete: vi.fn(),
      dispose: vi.fn(),
    })),
  },
  window: {
    createOutputChannel: () => ({
      appendLine: vi.fn(),
      show: vi.fn(),
      dispose: vi.fn(),
    }),
    showErrorMessage: vi.fn(() => Promise.resolve()),
    showInformationMessage: vi.fn(() => Promise.resolve()),
  },
  env: {
    openExternal: vi.fn(() => Promise.resolve()),
  },
  commands: {
    executeCommand: vi.fn(() => Promise.resolve()),
  },
  Uri: {
    file: (fsPath: string) => ({ fsPath }),
  },
  RelativePattern: class {
    constructor(
      public readonly base: string,
      public readonly pattern: string
    ) {}
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

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function createManager() {
  const manager = new DataManager('/tmp/openspec-ext-test-workspace');
  const changesDeferred = createDeferred<ChangeInfo[]>();
  const specsDeferred = createDeferred<SpecInfo[]>();
  const stateReader = {
    listChanges: vi.fn(() => changesDeferred.promise),
    listSpecs: vi.fn(() => specsDeferred.promise),
    listArchivedChanges: vi.fn().mockResolvedValue([]),
  };

  Object.assign(manager as any, {
    stateReader,
    cliAvailable: true,
    contentAccess: {
      readArtifact: vi.fn(),
      getChangeOpenspecYamlPath: vi.fn((changeName: string) => `/tmp/${changeName}/.openspec.yaml`),
    },
    cliService: {
      checkAvailability: vi.fn().mockResolvedValue(true),
      getVersion: vi.fn().mockResolvedValue('1.0.0'),
      showCliNotFoundError: vi.fn(),
      createChange: vi.fn().mockResolvedValue(undefined),
      getCliActivationDiagnostic: vi.fn().mockReturnValue(null),
      runJson: vi.fn().mockResolvedValue({ stores: [] }),
      getResolver: vi.fn().mockReturnValue({
        resolveRuntime: vi.fn().mockResolvedValue({ source: 'installed' }),
      }),
    },
    fileWatcher: {
      start: vi.fn(),
      stop: vi.fn(),
    },
  });

  return { manager, stateReader, changesDeferred, specsDeferred };
}

function makeCacheServiceFake() {
  return {
    readDashboard: vi.fn(),
    writeDashboard: vi.fn().mockResolvedValue(undefined),
    readArtifactContent: vi.fn(),
    writeArtifactContent: vi.fn(),
    invalidateScope: vi.fn().mockResolvedValue(undefined),
    invalidateArtifact: vi.fn(),
    getCacheRootPath: vi.fn().mockReturnValue('/tmp/openspec-cache-root'),
    getCacheStats: vi.fn().mockResolvedValue({
      rootPath: '/tmp/openspec-cache-root',
      totalBytes: 1024,
      fileCount: 2,
      calculatedAt: 123,
      isCalculating: false,
    }),
    clearAll: vi.fn().mockResolvedValue(undefined),
  };
}

function makeLocalScope() {
  return {
    id: 'local:/tmp/openspec-ext-test-workspace',
    label: 'Local Root',
    rootPath: '/tmp/openspec-ext-test-workspace',
    source: 'local',
    runtimeSource: 'installed',
    capabilities: { diagnostics: [] },
  };
}

function makeDataManagerWithSuccessfulRefresh({ cacheService }: { cacheService: ReturnType<typeof makeCacheServiceFake> }) {
  const manager = new DataManager('/tmp/openspec-ext-test-workspace', { cacheService } as any);
  const scope = makeLocalScope();

  Object.assign(manager as any, {
    cliAvailable: true,
    capabilities: {},
    scopeManager: {
      getSelectedScope: vi.fn(() => scope),
      getScopeOptions: vi.fn(() => [scope]),
    },
    stateReader: {
      listChanges: vi.fn().mockResolvedValue([]),
      listSpecs: vi.fn().mockResolvedValue([]),
      listArchivedChanges: vi.fn().mockResolvedValue([]),
    },
    contentAccess: {
      readArtifact: vi.fn().mockResolvedValue(''),
      getChangeOpenspecYamlPath: vi.fn((changeName: string) => `/tmp/${changeName}/.openspec.yaml`),
    },
    cliService: {
      getCliActivationDiagnostic: vi.fn().mockReturnValue(null),
      runJson: vi.fn().mockResolvedValue({}),
    },
  });

  return manager;
}

function makeDataManagerWithTaskFixture({ cacheService }: { cacheService: ReturnType<typeof makeCacheServiceFake> }) {
  const manager = new DataManager('/tmp/openspec-ext-test-workspace', { cacheService } as any);
  const scope = makeLocalScope();

  Object.assign(manager as any, {
    scopeManager: {
      getSelectedScope: vi.fn(() => scope),
      getScopeOptions: vi.fn(() => [scope]),
    },
    contentAccess: {
      toggleTask: vi.fn().mockResolvedValue(undefined),
      autoCompleteParents: vi.fn().mockResolvedValue(undefined),
      getChangeOpenspecYamlPath: vi.fn((changeName: string) => `/tmp/${changeName}/.openspec.yaml`),
    },
  });
  vi.spyOn(manager, 'refresh').mockResolvedValue({
    changes: [],
    specs: [],
    lastRefresh: 1,
    scope,
  } as any);

  return manager;
}

describe('DataManager dashboard data loading', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses a Project-bound root for task execution and execution-state IO', async () => {
    const activationRoot = '/tmp/openspec-p1-selected-store-root';
    const projectRoot = '/tmp/openspec-p1-project-root';
    const projectYamlPath = `${projectRoot}/openspec/changes/same-name/.openspec.yaml`;
    const activationYamlPath = `${activationRoot}/openspec/changes/same-name/.openspec.yaml`;
    const projectScope = {
      id: 'project:/projects/current:/projects/current:nearest:',
      rootPath: projectRoot,
      source: 'declared',
    };
    const activationContent = {
      getChangeOpenspecYamlPath: vi.fn().mockReturnValue(activationYamlPath),
    };
    const projectContent = {
      getChangeOpenspecYamlPath: vi.fn().mockReturnValue(projectYamlPath),
    };
    const manager = new DataManager(activationRoot);
    const scopedServices = vi.fn().mockReturnValue({
      stateReader: {},
      contentAccess: projectContent,
      rootPath: projectRoot,
      scope: projectScope,
    });
    const executeSpy = vi.spyOn(TaskExecutorService.prototype, 'execute').mockResolvedValue({ success: true });

    Object.assign(manager as any, {
      contentAccess: activationContent,
      getScopedServices: scopedServices,
    });

    try {
      await (manager as any).executeTaskRequest('same-name', 0, 'Task', projectScope);
      await (manager as any).setTaskExecutionState('same-name', 0, true, projectScope);
      await (manager as any).getTaskExecutionState('same-name', projectScope);

      expect((executeSpy.mock.instances[0] as any).workspaceRoot).toBe(projectRoot);
      expect(scopedServices).toHaveBeenCalledWith(projectScope);
      expect(projectContent.getChangeOpenspecYamlPath).toHaveBeenCalledTimes(2);
      expect(activationContent.getChangeOpenspecYamlPath).not.toHaveBeenCalled();
    } finally {
      executeSpy.mockRestore();
      rmSync(activationRoot, { recursive: true, force: true });
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  it('includes the canonical workspace root in watcher artifact events', async () => {
    const manager = new DataManager('/tmp');
    const start = vi.fn();
    const artifactChanged = vi.fn();
    Object.assign(manager as any, {
      cliService: {
        checkAvailability: vi.fn().mockResolvedValue(false),
        getCliActivationDiagnostic: vi.fn().mockReturnValue(null),
      },
      contentAccess: {
        autoCompleteParents: vi.fn().mockResolvedValue(undefined),
      },
      fileWatcher: { start, stop: vi.fn() },
    });
    vi.spyOn(manager as any, 'migrateExecutionStateFromGlobalFile').mockResolvedValue(undefined);
    vi.spyOn(manager as any, 'warmDashboardData').mockImplementation(() => undefined);
    vi.spyOn(manager, 'refresh').mockResolvedValue({} as any);
    manager.onArtifactChanged(artifactChanged);

    await manager.initialize();
    const watcherCallback = start.mock.calls[0][0];
    watcherCallback([{
      uri: { fsPath: '/tmp/openspec/changes/same-change/tasks.md' },
    }]);

    expect(artifactChanged).toHaveBeenCalledWith({
      changeName: 'same-change',
      artifactTypes: ['tasks'],
      rootPath: realpathSync('/tmp'),
    });
  });

  it('accepts an optional cache service dependency', () => {
    const cacheService = {
      readDashboard: vi.fn(),
      writeDashboard: vi.fn(),
      readArtifactContent: vi.fn(),
      writeArtifactContent: vi.fn(),
      invalidateScope: vi.fn(),
      invalidateArtifact: vi.fn(),
    };

    const manager = new DataManager('/workspace', { cacheService } as any);

    expect(manager).toBeInstanceOf(DataManager);
    expect((manager as any).cacheService).toBe(cacheService);
  });

  it('writes fresh dashboard data to the selected scope cache after refresh', async () => {
    const cacheService = makeCacheServiceFake();
    const manager = makeDataManagerWithSuccessfulRefresh({ cacheService });

    const data = await manager.refresh();

    expect(cacheService.writeDashboard).toHaveBeenCalledWith(
      expect.objectContaining({ id: data.scope?.id }),
      data
    );
  });

  it('archives through the current scope, invalidates cache, and refreshes after CLI success', async () => {
    const cacheService = makeCacheServiceFake();
    const manager = makeDataManagerWithSuccessfulRefresh({ cacheService });
    const archiveChange = vi.fn().mockResolvedValue(undefined);
    (manager as any).cliService.archiveChange = archiveChange;
    const refreshSpy = vi.spyOn(manager, 'refresh').mockResolvedValue({
      changes: [],
      specs: [],
      archivedChanges: [],
      lastRefresh: 2,
    } as any);
    const scope = manager.getSelectedScope();

    await manager.archiveChange('demo-change', scope);

    expect(archiveChange).toHaveBeenCalledWith('demo-change', scope);
    expect(cacheService.invalidateScope).toHaveBeenCalledWith(scope);
    expect(refreshSpy).toHaveBeenCalledTimes(1);
  });

  it('does not invalidate or refresh when the archive CLI fails', async () => {
    const cacheService = makeCacheServiceFake();
    const manager = makeDataManagerWithSuccessfulRefresh({ cacheService });
    (manager as any).cliService.archiveChange = vi.fn().mockRejectedValue(new Error('archive failed'));
    const refreshSpy = vi.spyOn(manager, 'refresh');

    await expect(manager.archiveChange('demo-change')).rejects.toThrow('archive failed');

    expect(cacheService.invalidateScope).not.toHaveBeenCalled();
    expect(refreshSpy).not.toHaveBeenCalled();
  });

  it('invalidates the selected scope cache after task mutation', async () => {
    const cacheService = makeCacheServiceFake();
    const manager = makeDataManagerWithTaskFixture({ cacheService });

    await manager.toggleTask('change-a', 0);

    expect(cacheService.invalidateScope).toHaveBeenCalledWith(
      expect.objectContaining({ id: expect.any(String) })
    );
  });

  it('invalidates task artifact cache after toggling a task', async () => {
    const cacheService = makeCacheServiceFake();
    const manager = makeDataManagerWithTaskFixture({ cacheService });

    await manager.toggleTask('change-a', 0);

    expect(cacheService.invalidateArtifact).toHaveBeenCalledWith(expect.objectContaining({
      changeName: 'change-a',
      artifactType: 'tasks',
    }));
  });

  it('reads cached artifact content through the scope-aware cache service', async () => {
    const cacheService = makeCacheServiceFake();
    cacheService.readArtifactContent.mockResolvedValue({
      payload: 'cached tasks',
      metadata: { generatedAt: 123 },
    });
    const manager = new DataManager('/tmp/openspec-ext-test-workspace', { cacheService } as any);
    const scope = makeLocalScope();

    await expect(manager.getCachedArtifactContent({
      changeName: 'change-a',
      artifactType: 'tasks',
      scope,
    } as any)).resolves.toEqual({
      content: 'cached tasks',
      source: 'disk',
      generatedAt: 123,
    });
    expect(cacheService.readArtifactContent).toHaveBeenCalledWith(expect.objectContaining({
      scope,
      changeName: 'change-a',
      artifactType: 'tasks',
    }));
  });

  it('writes artifact content through the scope-aware cache service', async () => {
    const cacheService = makeCacheServiceFake();
    const manager = new DataManager('/tmp/openspec-ext-test-workspace', { cacheService } as any);
    const scope = makeLocalScope();

    await manager.writeArtifactContentCache({
      changeName: 'change-a',
      artifactType: 'tasks',
      scope,
      content: 'fresh tasks',
    } as any);

    expect(cacheService.writeArtifactContent).toHaveBeenCalledWith(expect.objectContaining({
      scope,
      changeName: 'change-a',
      artifactType: 'tasks',
    }), 'fresh tasks');
  });

  it('exposes cache root, stats, and clear operations through a facade', async () => {
    const cacheService = makeCacheServiceFake();
    const manager = new DataManager('/tmp/openspec-ext-test-workspace', { cacheService } as any);

    expect(manager.getCacheRootPath()).toBe('/tmp/openspec-cache-root');
    await expect(manager.getCacheStats()).resolves.toEqual({
      rootPath: '/tmp/openspec-cache-root',
      totalBytes: 1024,
      fileCount: 2,
      calculatedAt: 123,
      isCalculating: false,
    });

    await manager.clearCache();

    expect(cacheService.getCacheStats).toHaveBeenCalledOnce();
    expect(cacheService.clearAll).toHaveBeenCalledOnce();
  });

  it('coalesces concurrent dashboard data requests into a single refresh', async () => {
    const { manager, stateReader, changesDeferred, specsDeferred } = createManager();

    const first = manager.getDashboardData();
    const second = manager.getDashboardData();

    expect(stateReader.listChanges).toHaveBeenCalledTimes(1);
    expect(stateReader.listSpecs).toHaveBeenCalledTimes(1);

    changesDeferred.resolve([]);
    specsDeferred.resolve([]);

    await expect(Promise.all([first, second])).resolves.toEqual([
      expect.objectContaining({ changes: [], specs: [], archivedChanges: [], lastRefresh: expect.any(Number) }),
      expect.objectContaining({ changes: [], specs: [], archivedChanges: [], lastRefresh: expect.any(Number) }),
    ]);
  });

  it('warms dashboard data after initialize without blocking activation', async () => {
    const { manager, stateReader, changesDeferred, specsDeferred } = createManager();

    await manager.initialize();

    expect(stateReader.listChanges).toHaveBeenCalledTimes(1);
    expect(stateReader.listSpecs).toHaveBeenCalledTimes(1);

    const dashboardData = manager.getDashboardData();
    expect(stateReader.listChanges).toHaveBeenCalledTimes(1);
    expect(stateReader.listSpecs).toHaveBeenCalledTimes(1);

    changesDeferred.resolve([]);
    specsDeferred.resolve([]);

    // After initialize() the scope manager is wired, so DashboardData now carries a
    // populated scope snapshot (rootPath/runtimeSource). Assert core fields without
    // coupling to the full scope shape.
    await expect(dashboardData).resolves.toMatchObject({
      changes: [],
      specs: [],
      lastRefresh: expect.any(Number),
      scope: expect.objectContaining({
        id: 'local:/tmp/openspec-ext-test-workspace',
        rootPath: '/tmp/openspec-ext-test-workspace',
        runtimeSource: 'installed',
      }),
    });
  });

  it('runs a fresh refresh after a mutation while dashboard loading is already in flight', async () => {
    const { manager, stateReader, changesDeferred, specsDeferred } = createManager();
    const secondChangesDeferred = createDeferred<ChangeInfo[]>();
    const secondSpecsDeferred = createDeferred<SpecInfo[]>();
    const oldChange: ChangeInfo = {
      name: 'old-change',
      completedTasks: 0,
      totalTasks: 1,
      lastModified: '2026-01-01',
      status: 'draft',
        lifecycleStatus: 'planning',
    };
    const newChange: ChangeInfo = {
      name: 'new-change',
      completedTasks: 0,
      totalTasks: 1,
      lastModified: '2026-01-02',
      status: 'draft',
        lifecycleStatus: 'planning',
    };
    const createSettled = vi.fn();

    stateReader.listChanges
      .mockImplementationOnce(() => changesDeferred.promise)
      .mockImplementationOnce(() => secondChangesDeferred.promise);
    stateReader.listSpecs
      .mockImplementationOnce(() => specsDeferred.promise)
      .mockImplementationOnce(() => secondSpecsDeferred.promise);

    const initialLoad = manager.getDashboardData();
    const createChange = manager.createChange('new-change').then(createSettled);

    await Promise.resolve();

    expect(stateReader.listChanges).toHaveBeenCalledTimes(1);
    expect(stateReader.listSpecs).toHaveBeenCalledTimes(1);

    changesDeferred.resolve([oldChange]);
    specsDeferred.resolve([]);

    await vi.waitFor(() => {
      expect(stateReader.listChanges).toHaveBeenCalledTimes(2);
      expect(stateReader.listSpecs).toHaveBeenCalledTimes(2);
    });
    expect(createSettled).not.toHaveBeenCalled();

    secondChangesDeferred.resolve([newChange]);
    secondSpecsDeferred.resolve([]);

    await expect(initialLoad).resolves.toMatchObject({ changes: [oldChange] });
    await expect(createChange).resolves.toBeUndefined();
    await expect(manager.getDashboardData()).resolves.toMatchObject({ changes: [newChange] });
  });

  it('does not publish an old in-flight scope refresh after the selected scope changes', async () => {
    const manager = new DataManager('/tmp/openspec-ext-test-workspace');
    const localScope = makeLocalScope();
    const storeScope = {
      id: 'store:team-plans',
      label: 'team-plans',
      rootPath: '/stores/team-plans',
      source: 'store',
      storeId: 'team-plans',
      runtimeSource: 'installed',
      capabilities: { diagnostics: [] },
    };
    let selectedScope = localScope;
    const localChangesDeferred = createDeferred<ChangeInfo[]>();
    const localSpecsDeferred = createDeferred<SpecInfo[]>();
    const storeChangesDeferred = createDeferred<ChangeInfo[]>();
    const storeSpecsDeferred = createDeferred<SpecInfo[]>();
    const localChange: ChangeInfo = {
      name: 'local-old',
      completedTasks: 0,
      totalTasks: 1,
      lastModified: '2026-01-01',
      status: 'draft',
        lifecycleStatus: 'planning',
    };
    const storeChange: ChangeInfo = {
      name: 'store-fresh',
      completedTasks: 0,
      totalTasks: 1,
      lastModified: '2026-01-02',
      status: 'draft',
        lifecycleStatus: 'planning',
    };
    const refreshCallback = vi.fn();

    Object.assign(manager as any, {
      cliAvailable: true,
      capabilities: {},
      cachedData: undefined,
      scopeManager: {
        getSelectedScope: vi.fn(() => selectedScope),
        getScopeOptions: vi.fn(() => [localScope, storeScope]),
        selectScope: vi.fn((scopeId: string) => {
          selectedScope = scopeId === storeScope.id ? storeScope as any : localScope;
        }),
      },
      getScopedServices: vi.fn((scope: typeof localScope | typeof storeScope) => {
        const isStore = scope?.id === storeScope.id;
        return {
          stateReader: {
            listChanges: vi.fn(() => isStore ? storeChangesDeferred.promise : localChangesDeferred.promise),
            listSpecs: vi.fn(() => isStore ? storeSpecsDeferred.promise : localSpecsDeferred.promise),
            listArchivedChanges: vi.fn().mockResolvedValue([]),
          },
          contentAccess: {
            readArtifact: vi.fn().mockResolvedValue(''),
            getChangeOpenspecYamlPath: vi.fn(),
          },
          rootPath: scope?.rootPath ?? '/tmp/openspec-ext-test-workspace',
          scope,
        };
      }),
      cliService: {
        getCliActivationDiagnostic: vi.fn().mockReturnValue(null),
        runJson: vi.fn().mockResolvedValue({}),
      },
    });
    vi.spyOn(manager as any, 'enrichChangesWithProposalWhy').mockImplementation(async (changes) => changes);
    (manager as any).refreshCallbacks.add(refreshCallback);

    const localRefresh = manager.refresh();
    manager.selectScope(storeScope.id);
    const storeRefresh = manager.refresh();

    localChangesDeferred.resolve([localChange]);
    localSpecsDeferred.resolve([]);

    await vi.waitFor(() => {
      expect((manager as any).getScopedServices).toHaveBeenCalledWith(storeScope);
    });

    expect(refreshCallback).not.toHaveBeenCalledWith(expect.objectContaining({
      scope: expect.objectContaining({ id: localScope.id }),
    }));
    expect((manager as any).cachedData).toBeUndefined();

    storeChangesDeferred.resolve([storeChange]);
    storeSpecsDeferred.resolve([]);

    await expect(localRefresh).resolves.toMatchObject({
      changes: [expect.objectContaining({ name: localChange.name })],
      scope: expect.objectContaining({ id: localScope.id }),
    });
    await expect(storeRefresh).resolves.toMatchObject({
      changes: [expect.objectContaining({ name: storeChange.name })],
      scope: expect.objectContaining({ id: storeScope.id }),
    });
    expect(refreshCallback).toHaveBeenCalledTimes(1);
    expect(refreshCallback).toHaveBeenCalledWith(expect.objectContaining({
      changes: [expect.objectContaining({ name: storeChange.name })],
      scope: expect.objectContaining({ id: storeScope.id }),
    }));
    expect((manager as any).cachedData).toMatchObject({
      changes: [expect.objectContaining({ name: storeChange.name })],
      scope: expect.objectContaining({ id: storeScope.id }),
    });
  });

  it('queues another refresh when a second mutation happens while a queued refresh is running', async () => {
    const { manager, stateReader, changesDeferred, specsDeferred } = createManager();
    const secondChangesDeferred = createDeferred<ChangeInfo[]>();
    const secondSpecsDeferred = createDeferred<SpecInfo[]>();
    const thirdChangesDeferred = createDeferred<ChangeInfo[]>();
    const thirdSpecsDeferred = createDeferred<SpecInfo[]>();
    const oldChange: ChangeInfo = {
      name: 'old-change',
      completedTasks: 0,
      totalTasks: 1,
      lastModified: '2026-01-01',
      status: 'draft',
        lifecycleStatus: 'planning',
    };
    const firstMutationChange: ChangeInfo = {
      name: 'first-mutation',
      completedTasks: 0,
      totalTasks: 1,
      lastModified: '2026-01-02',
      status: 'draft',
        lifecycleStatus: 'planning',
    };
    const secondMutationChange: ChangeInfo = {
      name: 'second-mutation',
      completedTasks: 0,
      totalTasks: 1,
      lastModified: '2026-01-03',
      status: 'draft',
        lifecycleStatus: 'planning',
    };
    const firstCreateSettled = vi.fn();
    const secondCreateSettled = vi.fn();

    stateReader.listChanges
      .mockImplementationOnce(() => changesDeferred.promise)
      .mockImplementationOnce(() => secondChangesDeferred.promise)
      .mockImplementationOnce(() => thirdChangesDeferred.promise);
    stateReader.listSpecs
      .mockImplementationOnce(() => specsDeferred.promise)
      .mockImplementationOnce(() => secondSpecsDeferred.promise)
      .mockImplementationOnce(() => thirdSpecsDeferred.promise);

    const initialLoad = manager.getDashboardData();
    const firstCreateChange = manager.createChange('first-mutation').then(firstCreateSettled);

    changesDeferred.resolve([oldChange]);
    specsDeferred.resolve([]);

    await vi.waitFor(() => {
      expect(stateReader.listChanges).toHaveBeenCalledTimes(2);
      expect(stateReader.listSpecs).toHaveBeenCalledTimes(2);
    });

    const secondCreateChange = manager.createChange('second-mutation').then(secondCreateSettled);

    await Promise.resolve();
    expect(stateReader.listChanges).toHaveBeenCalledTimes(2);
    expect(stateReader.listSpecs).toHaveBeenCalledTimes(2);
    expect(secondCreateSettled).not.toHaveBeenCalled();

    secondChangesDeferred.resolve([firstMutationChange]);
    secondSpecsDeferred.resolve([]);

    await vi.waitFor(() => {
      expect(stateReader.listChanges).toHaveBeenCalledTimes(3);
      expect(stateReader.listSpecs).toHaveBeenCalledTimes(3);
    });
    expect(secondCreateSettled).not.toHaveBeenCalled();

    thirdChangesDeferred.resolve([secondMutationChange]);
    thirdSpecsDeferred.resolve([]);

    await expect(initialLoad).resolves.toMatchObject({ changes: [oldChange] });
    await expect(firstCreateChange).resolves.toBeUndefined();
    await expect(secondCreateChange).resolves.toBeUndefined();
    await expect(manager.getDashboardData()).resolves.toMatchObject({
      changes: [secondMutationChange],
    });
  });

  it('uses filesystem birthtime as createdAt fallback without changing status', async () => {
    const { manager } = createManager();
    const birthtime = new Date('2026-06-01T09:00:00.000Z');
    const mtime = new Date('2026-06-10T12:00:00.000Z');

    const fs = await import('fs');
    vi.spyOn(fs.promises, 'readdir').mockResolvedValue([
      { name: 'polish-ui', isDirectory: () => true },
    ] as any);
    vi.spyOn(fs.promises, 'stat').mockResolvedValue({
      birthtime,
      ctime: birthtime,
      mtime,
      birthtimeMs: birthtime.getTime(),
    } as any);

    const contentAccess = manager['contentAccess'] as any;
    contentAccess.readTasks = vi.fn().mockResolvedValue([
      { done: true },
      { done: false },
    ]);
    vi.spyOn(manager as any, 'getFilesystemArtifactStatuses').mockResolvedValue([]);

    const changes = await (manager as any).listChangesFromFilesystem({
      contentAccess,
      rootPath: manager.getWorkspaceRoot(),
    });

    expect(changes).toEqual([
      expect.objectContaining({
        name: 'polish-ui',
        createdAt: '2026-06-01T09:00:00.000Z',
        lastModified: '2026-06-10T12:00:00.000Z',
        status: 'in-progress',
        lifecycleStatus: 'planning',
      }),
    ]);
  });

  it('omits createdAt when filesystem fallback time is not available', async () => {
    const { manager } = createManager();
    const fs = await import('fs');

    vi.spyOn(fs.promises, 'readdir').mockResolvedValue([
      { name: 'missing-time', isDirectory: () => true },
    ] as any);
    vi.spyOn(fs.promises, 'stat').mockRejectedValue(new Error('stat failed'));

    const contentAccess = manager['contentAccess'] as any;
    contentAccess.readTasks = vi.fn().mockResolvedValue([]);
    vi.spyOn(manager as any, 'getFilesystemArtifactStatuses').mockResolvedValue([]);

    const changes = await (manager as any).listChangesFromFilesystem({
      contentAccess,
      rootPath: manager.getWorkspaceRoot(),
    });

    expect(changes[0]).toMatchObject({
      name: 'missing-time',
      status: 'draft',
        lifecycleStatus: 'planning',
      lastModified: expect.any(String),
    });
    expect(changes[0].createdAt).toBeUndefined();
  });
});
describe('DataManager CLI activation diagnostic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('stores cli activation diagnostic when initialization detects unavailable CLI', async () => {
    const manager = new DataManager('/workspace');
    const diagnostic = {
      category: 'cli-not-found' as const,
      message: 'OpenSpec CLI executable could not be resolved',
      recoveryActions: ['open-docs', 'open-settings', 'retry', 'copy-diagnostics'] as string[],
      safeDetails: ['extension host PATH: failed ENOENT'],
      copyText: 'category=cli-not-found',
      canRetry: true,
      normalizedMessage: 'openspec cli executable could not be resolved',
    };

    vi.spyOn((manager as any).cliService, 'checkAvailability').mockResolvedValue(false);
    vi.spyOn((manager as any).cliService, 'getCliActivationDiagnostic').mockReturnValue(diagnostic);
    vi.spyOn(manager as any, 'migrateExecutionStateFromGlobalFile').mockResolvedValue(undefined);
    vi.spyOn(manager as any, 'warmDashboardData').mockImplementation(() => undefined);
    (manager as any).fileWatcher = { start: vi.fn(), stop: vi.fn() };

    await manager.initialize();

    expect(manager.getCliDiagnostic()).toEqual(diagnostic);
  });

  it('clears cli activation diagnostic after successful refresh', async () => {
    const manager = new DataManager('/workspace');
    (manager as any).cliDiagnostic = {
      category: 'cli-not-found',
      message: 'missing',
      recoveryActions: [],
      safeDetails: [],
      copyText: 'missing',
      canRetry: true,
      normalizedMessage: 'missing',
    };
    vi.spyOn(manager as any, 'listChangesWithFallback').mockResolvedValue([]);
    vi.spyOn((manager as any).stateReader, 'listSpecs').mockResolvedValue([]);
    vi.spyOn((manager as any).stateReader, 'listArchivedChanges').mockResolvedValue([]);

    await manager.refresh();

    expect(manager.getCliDiagnostic()).toBeNull();
  });

  it('throws blocking cli diagnostic instead of returning filesystem fallback when there is no cached data', async () => {
    const manager = new DataManager('/workspace');
    const diagnostic = {
      category: 'cli-not-found' as const,
      message: 'missing',
      recoveryActions: ['open-docs', 'open-settings', 'retry', 'copy-diagnostics'] as string[],
      safeDetails: ['extension host PATH: failed ENOENT'],
      copyText: 'category=cli-not-found',
      canRetry: true,
      normalizedMessage: 'missing',
    };

    vi.spyOn((manager as any).stateReader, 'listChanges').mockRejectedValue(new Error('missing cli'));
    vi.spyOn((manager as any).stateReader, 'listSpecs').mockResolvedValue([]);
    vi.spyOn((manager as any).stateReader, 'listArchivedChanges').mockResolvedValue([]);
    vi.spyOn((manager as any).cliService, 'getCliActivationDiagnostic').mockReturnValue(diagnostic);
    vi.spyOn(manager as any, 'listChangesFromFilesystem').mockResolvedValue([
      {
        name: 'from-files',
        completedTasks: 0,
        totalTasks: 0,
        lastModified: 'now',
        status: 'draft',
        lifecycleStatus: 'planning',
      },
    ]);
    (manager as any).cliAvailable = true;

    await expect(manager.refresh()).rejects.toThrow('missing cli');
    expect(manager.getCliDiagnostic()).toEqual(diagnostic);
    expect((manager as any).listChangesFromFilesystem).not.toHaveBeenCalled();
  });

  it('keeps cached data and records warning diagnostic when refresh fails later', async () => {
    const manager = new DataManager('/workspace');
    const cached = { changes: [], specs: [], archivedChanges: [], lastRefresh: 123 };
    const diagnostic = {
      category: 'cli-not-found' as const,
      message: 'missing',
      recoveryActions: ['open-docs', 'open-settings', 'retry', 'copy-diagnostics'] as string[],
      safeDetails: ['extension host PATH: failed ENOENT'],
      copyText: 'category=cli-not-found',
      canRetry: true,
      normalizedMessage: 'missing',
    };
    (manager as any).cachedData = cached;
    vi.spyOn((manager as any).stateReader, 'listChanges').mockRejectedValue(new Error('missing cli'));
    vi.spyOn((manager as any).stateReader, 'listSpecs').mockResolvedValue([]);
    vi.spyOn((manager as any).stateReader, 'listArchivedChanges').mockResolvedValue([]);
    vi.spyOn((manager as any).cliService, 'getCliActivationDiagnostic').mockReturnValue(diagnostic);
    vi.spyOn(manager as any, 'listChangesFromFilesystem').mockResolvedValue([]);
    (manager as any).cliAvailable = true;

    await expect(manager.refresh()).resolves.toBe(cached);
    expect(manager.getCliDiagnostic()).toEqual(diagnostic);
    expect((manager as any).listChangesFromFilesystem).not.toHaveBeenCalled();
  });
});

describe('DataManager scope-aware features', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function createManagerWithMockedCli() {
    const manager = new DataManager('/tmp/openspec-ext-test-workspace');

    Object.assign(manager as any, {
      cliAvailable: true,
      contentAccess: {
        readArtifact: vi.fn().mockResolvedValue(''),
        getChangeOpenspecYamlPath: vi.fn((name: string) => `/tmp/${name}/.openspec.yaml`),
        toggleTask: vi.fn().mockResolvedValue(undefined),
        autoCompleteParents: vi.fn().mockResolvedValue(undefined),
      },
      cliService: {
        checkAvailability: vi.fn().mockResolvedValue(true),
        getVersion: vi.fn().mockResolvedValue('1.0.0'),
        showCliNotFoundError: vi.fn(),
        createChange: vi.fn().mockResolvedValue(undefined),
        getCliActivationDiagnostic: vi.fn().mockReturnValue(null),
        runJson: vi.fn().mockResolvedValue({ stores: [] }),
        getResolver: vi.fn().mockReturnValue({
          resolveRuntime: vi.fn().mockResolvedValue({ source: 'installed' }),
        }),
      },
      fileWatcher: {
        start: vi.fn(),
        stop: vi.fn(),
      },
    });

    return manager;
  }

  function createStoreScope() {
    return {
      id: 'store:team-plans',
      label: 'team-plans',
      rootPath: '/stores/team-plans',
      source: 'store',
      storeId: 'team-plans',
      runtimeSource: 'installed',
      capabilities: {},
      diagnostics: [],
    } as any;
  }

  it('initializeScopeManager creates local scope and detects capabilities', async () => {
    const manager = createManagerWithMockedCli();

    await manager.initializeScopeManager();

    expect(manager.getCapabilities()).toBeDefined();
    // runJson mocked to return { stores: [] } for all probe calls, so all features are detected
    expect(manager.getCapabilities()?.stores).toBe(true);

    const scope = manager.getSelectedScope();
    expect(scope).toBeDefined();
    expect(scope?.source).toBe('local');
    expect(scope?.label).toBe('Local Root');
    expect(scope?.rootPath).toBe('/tmp/openspec-ext-test-workspace');
  });

  it('scopedContentAccess caches per scope and resolves to scoped FileManagerService', async () => {
    const manager = createManagerWithMockedCli();

    await manager.initializeScopeManager();

    const scope = manager.getSelectedScope()!;
    // Mock getContentAccessForScope to avoid real filesystem access
    const mockScopedAccess = {
      readArtifact: vi.fn().mockResolvedValue('scoped content'),
    };
    const getContentAccessSpy = vi
      .spyOn(manager as any, 'getContentAccessForScope')
      .mockReturnValue(mockScopedAccess);

    // First call creates and caches
    await manager.readArtifact('test-change', 'proposal', scope);
    expect(getContentAccessSpy).toHaveBeenCalledWith(scope);

    // Second call should also hit the method (spy intercepts, not real cache)
    await manager.readArtifact('test-change', 'proposal', scope);
    expect(getContentAccessSpy).toHaveBeenCalledTimes(2);

    // Restore the real method and pre-populate the scopedContentAccess map
    getContentAccessSpy.mockRestore();

    // Pre-populate the cache with a mock entry
    const mockCachedAccess = {
      readArtifact: vi.fn().mockResolvedValue('cached content'),
    };
    const scopedMap = (manager as any).scopedContentAccess as Map<string, unknown>;
    scopedMap.set(scope.id, mockCachedAccess);

    // This call should use the cached entry without creating a new FileManagerService
    const result = await manager.readArtifact('test-change', 'proposal', scope);
    expect(result).toBe('cached content');
    expect(mockCachedAccess.readArtifact).toHaveBeenCalledWith('test-change', 'proposal');
  });

  it('readArtifact without scope uses default contentAccess', async () => {
    const manager = createManagerWithMockedCli();

    await manager.initializeScopeManager();

    const contentAccess = (manager as any).contentAccess;
    await manager.readArtifact('test-change', 'proposal');
    expect(contentAccess.readArtifact).toHaveBeenCalledWith('test-change', 'proposal');
  });

  it('readArtifact with scope uses scoped content access', async () => {
    const manager = createManagerWithMockedCli();

    await manager.initializeScopeManager();
    const scope = manager.getSelectedScope()!;

    // Replace the scoped content access to verify it is used
    const scopedAccess = {
      readArtifact: vi.fn().mockResolvedValue('scoped content'),
    };
    (manager as any).scopedContentAccess.set(scope.id, scopedAccess);

    const result = await manager.readArtifact('test-change', 'proposal', scope);
    expect(result).toBe('scoped content');
    expect(scopedAccess.readArtifact).toHaveBeenCalledWith('test-change', 'proposal');
    // Default contentAccess should NOT be called
    expect((manager as any).contentAccess.readArtifact).not.toHaveBeenCalled();
  });

  it('toggleTask without scope uses default contentAccess', async () => {
    const manager = createManagerWithMockedCli();

    await manager.initializeScopeManager();

    vi.spyOn(manager as any, 'refresh').mockResolvedValue(undefined);
    const contentAccess = (manager as any).contentAccess;

    await manager.toggleTask('test-change', 0);
    expect(contentAccess.toggleTask).toHaveBeenCalledWith('test-change', 0);
    expect(contentAccess.autoCompleteParents).toHaveBeenCalledWith('test-change');
  });

  it('toggleTask with scope uses scoped content access', async () => {
    const manager = createManagerWithMockedCli();

    await manager.initializeScopeManager();
    const scope = manager.getSelectedScope()!;

    vi.spyOn(manager as any, 'refresh').mockResolvedValue(undefined);

    const scopedAccess = {
      toggleTask: vi.fn().mockResolvedValue(undefined),
      autoCompleteParents: vi.fn().mockResolvedValue(undefined),
    };
    (manager as any).scopedContentAccess.set(scope.id, scopedAccess);

    await manager.toggleTask('test-change', 2, scope);
    expect(scopedAccess.toggleTask).toHaveBeenCalledWith('test-change', 2);
    expect(scopedAccess.autoCompleteParents).toHaveBeenCalledWith('test-change');
    // Default contentAccess should NOT be called
    expect((manager as any).contentAccess.toggleTask).not.toHaveBeenCalled();
  });

  it('artifactExists passes store scope to the scoped state reader', async () => {
    const manager = createManagerWithMockedCli();
    const scope = createStoreScope();
    const scopedReader = {
      artifactExists: vi.fn().mockResolvedValue(true),
    };

    (manager as any).scopedContentAccess.set(scope.id, {});
    (manager as any).scopedStateReaders.set(scope.id, scopedReader);

    const exists = await manager.artifactExists('same-name-change', 'proposal', scope);

    expect(exists).toBe(true);
    expect(scopedReader.artifactExists).toHaveBeenCalledWith('same-name-change', 'proposal', scope);
  });

  it('readTasks passes store scope to the scoped state reader', async () => {
    const manager = createManagerWithMockedCli();
    const scope = createStoreScope();
    const scopedReader = {
      getTasks: vi.fn().mockResolvedValue([{ done: false, text: 'Scoped task' }]),
    };

    (manager as any).scopedContentAccess.set(scope.id, {});
    (manager as any).scopedStateReaders.set(scope.id, scopedReader);

    const tasks = await manager.readTasks('same-name-change', scope);

    expect(tasks).toEqual([{ done: false, text: 'Scoped task' }]);
    expect(scopedReader.getTasks).toHaveBeenCalledWith('same-name-change', scope);
  });

  it('getDashboardData includes scope info when scope manager is initialized', async () => {
    const manager = createManagerWithMockedCli();

    await manager.initializeScopeManager();

    vi.spyOn(manager as any, 'stateReader', 'get').mockReturnValue({
      listChanges: vi.fn().mockResolvedValue([]),
      listSpecs: vi.fn().mockResolvedValue([]),
      listArchivedChanges: vi.fn().mockResolvedValue([]),
    });
    vi.spyOn(manager as any, 'enrichChangesWithProposalWhy').mockResolvedValue([]);

    const data = await manager.refresh();

    expect(data.scope).toBeDefined();
    expect(data.scope?.id).toBe('local:/tmp/openspec-ext-test-workspace');
    expect(data.scope?.source).toBe('local');
    expect(data.scope?.label).toBe('Local Root');
    expect(data.scope?.capabilities).toBeDefined();
  });

  it('selectScope changes selected scope and triggers change listener', async () => {
    const manager = createManagerWithMockedCli();

    await manager.initializeScopeManager();

    // Mock stores being available
    vi.spyOn((manager as any).cliService, 'runJson').mockResolvedValue({
      stores: [{ id: 'my-store', root: '/tmp/store-root' }],
    });

    // Reload scope options to pick up store
    await manager.getScopeManager()?.loadScopeOptions();

    // Initially local
    expect(manager.getSelectedScope()?.source).toBe('local');

    // Select store scope
    manager.selectScope('store:my-store');
    expect(manager.getSelectedScope()?.source).toBe('store');
    expect(manager.getSelectedScope()?.storeId).toBe('my-store');
  });

  it('refresh after selectScope reads store scope snapshot and scope options', async () => {
    const manager = createManagerWithMockedCli();
    await manager.initializeScopeManager();

    // Provide a store option, then select it.
    vi.spyOn((manager as any).cliService, 'runJson').mockResolvedValue({
      stores: [{ id: 'team-plans', root: '/stores/team-plans' }],
    });
    await manager.getScopeManager()?.loadScopeOptions();
    manager.selectScope('store:team-plans');

    // Drive refresh through the store scope. resolveScope must return the store scope
    // and the projected DashboardData.scope must reflect the store root + runtimeSource.
    const data = await manager.refresh();

    expect(data.scope?.source).toBe('store');
    expect(data.scope?.storeId).toBe('team-plans');
    expect(data.scope?.rootPath).toBe('/stores/team-plans');
    expect(data.scope?.runtimeSource).toBe('installed');
    // Scope options list must include both local and the store.
    expect(data.scopes?.map((s) => s.id)).toEqual(
      expect.arrayContaining(['local:/tmp/openspec-ext-test-workspace', 'store:team-plans'])
    );
  });

  it('resolveScope returns the store scope by id and falls back to selected scope', async () => {
    const manager = createManagerWithMockedCli();
    await manager.initializeScopeManager();

    vi.spyOn((manager as any).cliService, 'runJson').mockResolvedValue({
      stores: [{ id: 'team-plans', root: '/stores/team-plans' }],
    });
    await manager.getScopeManager()?.loadScopeOptions();

    const byId = manager.resolveScope('store:team-plans');
    expect(byId?.source).toBe('store');
    expect(byId?.rootPath).toBe('/stores/team-plans');

    // Unknown id falls back to the currently selected (local) scope.
    expect(manager.resolveScope('store:does-not-exist')?.source).toBe('local');
  });

  it('registerStore calls the OpenSpec CLI, reloads scopes, selects the new store, and returns refreshed data', async () => {
    const manager = createManagerWithMockedCli();
    await manager.initializeScopeManager();
    const runJson = (manager as any).cliService.runJson;
    const refreshedData = {
      changes: [],
      specs: [],
      lastRefresh: 1,
    };
    const refreshSpy = vi.spyOn(manager, 'refresh').mockResolvedValue({
      ...refreshedData,
    });

    runJson.mockReset();
    runJson
      .mockResolvedValueOnce({
        store: { id: 'team-plans', root: '/stores/team-plans' },
      })
      .mockResolvedValueOnce({
        stores: [{ id: 'team-plans', root: '/stores/team-plans' }],
      });

    const result = await manager.registerStore('/stores/team-plans');

    expect(runJson).toHaveBeenNthCalledWith(1, [
      'store',
      'register',
      '/stores/team-plans',
      '--yes',
      '--json',
    ]);
    expect(runJson).toHaveBeenNthCalledWith(2, ['store', 'list', '--json']);
    expect(manager.getSelectedScope()?.id).toBe('store:team-plans');
    expect(refreshSpy).toHaveBeenCalled();
    expect(result).toEqual(refreshedData);
  });

  it('setupStore calls the OpenSpec CLI with id and path, reloads scopes, selects the new store, and returns refreshed data', async () => {
    const manager = createManagerWithMockedCli();
    await manager.initializeScopeManager();
    const runJson = (manager as any).cliService.runJson;
    const refreshedData = {
      changes: [],
      specs: [],
      lastRefresh: 1,
    };
    const refreshSpy = vi.spyOn(manager, 'refresh').mockResolvedValue({
      ...refreshedData,
    });

    runJson.mockReset();
    runJson
      .mockResolvedValueOnce({
        store: { id: 'team-plans', root: '/stores/team-plans' },
      })
      .mockResolvedValueOnce({
        stores: [{ id: 'team-plans', root: '/stores/team-plans' }],
      });

    const result = await manager.setupStore('team-plans', '/stores/team-plans');

    expect(runJson).toHaveBeenNthCalledWith(1, [
      'store',
      'setup',
      'team-plans',
      '--path',
      '/stores/team-plans',
      '--json',
    ]);
    expect(runJson).toHaveBeenNthCalledWith(2, ['store', 'list', '--json']);
    expect(manager.getSelectedScope()?.id).toBe('store:team-plans');
    expect(refreshSpy).toHaveBeenCalled();
    expect(result).toEqual(refreshedData);
  });

  it('does not pass --store to workset list because OpenSpec workset commands are not store-scoped', async () => {
    const manager = createManagerWithMockedCli();
    await manager.initializeScopeManager();
    const runJson = (manager as any).cliService.runJson;

    runJson.mockResolvedValue({ stores: [{ id: 'team-plans', root: '/stores/team-plans' }] });
    await manager.getScopeManager()?.loadScopeOptions();
    manager.selectScope('store:team-plans');

    runJson.mockClear();
    runJson.mockImplementation(async (args: string[]) => {
      if (args[0] === 'store') return { stores: [{ id: 'team-plans', root: '/stores/team-plans' }] };
      if (args[0] === 'workset') return { worksets: [] };
      if (args[0] === 'context') return { references: [] };
      if (args[0] === 'doctor') return { root: { path: '/stores/team-plans', healthy: true, status: [] } };
      return {};
    });

    await manager.refresh();

    expect(runJson).toHaveBeenCalledWith(['workset', 'list', '--json']);
    expect(runJson).not.toHaveBeenCalledWith([
      'workset',
      'list',
      '--json',
      '--store',
      'team-plans',
    ]);
  });
});

describe('DataManager refresh cache', () => {
  it('includes archived changes in refreshed dashboard snapshots', async () => {
    const changes: ChangeInfo[] = [
      {
        name: 'active-change',
        completedTasks: 0,
        totalTasks: 1,
        lastModified: '2026-07-02T00:00:00.000Z',
        status: 'in-progress',
        lifecycleStatus: 'planning',
        artifacts: [],
      },
    ];
    const archivedChanges: ArchivedChangeInfo[] = [
      {
        directoryName: '2026-07-02-archived-change',
        name: 'archived-change',
        archiveDate: '2026-07-02',
      },
    ];

    const manager = new DataManager('/workspace') as any;
    manager.cliAvailable = true;
    manager.stateReader = {
      listChanges: vi.fn().mockResolvedValue(changes),
      listSpecs: vi.fn().mockResolvedValue([]),
      listArchivedChanges: vi.fn().mockResolvedValue(archivedChanges),
    };
    manager.contentAccess = {
      readArtifact: vi.fn().mockResolvedValue('# Proposal\n\n## Why\nKeep the dashboard fresh.'),
      getChangeOpenspecYamlPath: vi.fn((changeName: string) => `/workspace/${changeName}/.openspec.yaml`),
    };
    manager.cliService = {
      getCliActivationDiagnostic: vi.fn().mockReturnValue(null),
    };

    const onRefresh = vi.fn();
    manager.onRefresh(onRefresh);

    const data = await manager.refresh();

    expect(data.archivedChanges).toEqual(archivedChanges);
    expect(onRefresh).toHaveBeenCalledWith(
      expect.objectContaining({
        archivedChanges,
      })
    );
  });
});

describe('DataManager workset data contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Helper: build a DataManager with worksets capability enabled and a CLI that
  // returns the given payload for `openspec workset list --json`.
  function createManagerWithWorksetPayload(worksetPayload: unknown) {
    const manager = new DataManager('/tmp/openspec-ext-test-workspace') as any;
    const scope = makeLocalScope();
    Object.assign(manager, {
      cliAvailable: true,
      capabilities: { worksets: true },
      scopeManager: {
        getSelectedScope: vi.fn(() => scope),
        getScopeOptions: vi.fn(() => [scope]),
      },
      stateReader: {
        listChanges: vi.fn().mockResolvedValue([]),
        listSpecs: vi.fn().mockResolvedValue([]),
        listArchivedChanges: vi.fn().mockResolvedValue([]),
      },
      contentAccess: {
        readArtifact: vi.fn().mockResolvedValue(''),
      },
      cliService: {
        getCliActivationDiagnostic: vi.fn().mockReturnValue(null),
        runJson: vi.fn(async (args: string[]) => {
          if (args[0] === 'workset') return worksetPayload;
          return {};
        }),
      },
    });
    return manager;
  }

  it('preserves workset member order, name, tool, and member name/path from the CLI payload', async () => {
    const manager = createManagerWithWorksetPayload({
      worksets: [
        {
          name: 'platform',
          tool: 'code',
          members: [
            { name: 'team-plans', path: '/stores/team-plans' },
            { name: 'fastgpt', path: '/work/fastgpt' },
          ],
        },
      ],
    });

    const data = await manager.refresh();

    expect(data.worksets).toEqual([
      {
        name: 'platform',
        tool: 'code',
        members: [
          { name: 'team-plans', path: '/stores/team-plans' },
          { name: 'fastgpt', path: '/work/fastgpt' },
        ],
      },
    ]);
    // The first member is the primary member (order preserved from CLI).
    expect(data.worksets?.[0].members[0]).toEqual({
      name: 'team-plans',
      path: '/stores/team-plans',
    });
  });

  it('safely parses a workset with zero members and keeps it renderable', async () => {
    const manager = createManagerWithWorksetPayload({
      worksets: [{ name: 'empty-workset', members: [] }],
    });

    const data = await manager.refresh();

    expect(data.worksets).toEqual([{ name: 'empty-workset', members: [] }]);
  });

  it('omits tool when the CLI payload omits it, without throwing', async () => {
    const manager = createManagerWithWorksetPayload({
      worksets: [{ name: 'no-tool', members: [{ name: 'm1', path: '/p' }] }],
    });

    const data = await manager.refresh();

    // toEqual ignores undefined-valued keys, so the omitted tool compares equal.
    expect(data.worksets).toEqual([
      { name: 'no-tool', members: [{ name: 'm1', path: '/p' }] },
    ]);
    // tool is never surfaced as a concrete string when missing.
    expect(data.worksets?.[0].tool).toBeUndefined();
  });

  it('coerces a non-array members field to an empty array without throwing', async () => {
    const manager = createManagerWithWorksetPayload({
      worksets: [{ name: 'bad-members', tool: 'code', members: 'not-an-array' }],
    });

    const data = await manager.refresh();

    expect(data.worksets).toEqual([{ name: 'bad-members', tool: 'code', members: [] }]);
  });

  it('coerces a missing member name/path to safe empty strings without throwing', async () => {
    const manager = createManagerWithWorksetPayload({
      worksets: [
        {
          name: 'sparse-members',
          members: [{}, { path: '/only-path' }],
        },
      ],
    });

    const data = await manager.refresh();

    expect(data.worksets).toEqual([
      {
        name: 'sparse-members',
        members: [
          { name: '', path: '' },
          { name: '', path: '/only-path' },
        ],
      },
    ]);
  });

  it('returns an empty worksets list (undefined on dashboard) when the CLI payload omits worksets', async () => {
    const manager = createManagerWithWorksetPayload({ status: [] });

    const data = await manager.refresh();

    // No worksets key → parser yields []; dashboard omits the field (no panel).
    expect(data.worksets).toBeUndefined();
  });

  it('never throws when the CLI returns a malformed worksets payload', async () => {
    const manager = createManagerWithWorksetPayload({ worksets: 'totally-malformed' });

    const data = await manager.refresh();

    // Malformed payload must degrade to an empty/hidden panel, never throw.
    expect(data.worksets).toBeUndefined();
  });

  it('opens a Workset with ordinary CLI output and the exact name', async () => {
    const manager = createManagerWithWorksetPayload({ worksets: [] });
    const runJson = (manager as any).cliService.runJson;
    const runCommand = vi.fn().mockResolvedValue('Opened platform\n');
    (manager as any).cliService.runCommand = runCommand;

    await manager.openWorkset('ai-self-serve-builder');

    expect(runCommand).toHaveBeenCalledWith(['workset', 'open', 'ai-self-serve-builder']);
    expect(runJson).not.toHaveBeenCalledWith(['workset', 'open', 'ai-self-serve-builder']);
    expect(runJson.mock.calls.some(([args]) => (
      Array.isArray(args)
      && args[0] === 'workset'
      && args[1] === 'open'
    ))).toBe(false);
  });

  it('propagates Workset open failures without changing scope state', async () => {
    const manager = createManagerWithWorksetPayload({ worksets: [] });
    const runCommand = vi.fn().mockRejectedValue(new Error('workset open failed'));
    (manager as any).cliService.runCommand = runCommand;

    await expect(manager.openWorkset('platform')).rejects.toThrow('workset open failed');
  });

  it('removeWorkset calls `openspec workset remove <name> --yes --json`, invalidates the dashboard cache, and returns refreshed data', async () => {
    const manager = createManagerWithWorksetPayload({ worksets: [] });
    const runJson = (manager as any).cliService.runJson;
    const refreshedData = {
      changes: [],
      specs: [],
      lastRefresh: 1,
      worksets: [],
    };
    const refreshSpy = vi.spyOn(manager, 'refresh').mockResolvedValue({
      ...refreshedData,
    });
    const invalidateSpy = vi.spyOn(manager as any, 'invalidateDashboardCache').mockResolvedValue(undefined);
    const loadScopeOptionsSpy = vi.fn();
    (manager as any).scopeManager = { loadScopeOptions: loadScopeOptionsSpy, getSelectedScope: vi.fn(), getScopeOptions: vi.fn(() => []) };

    runJson.mockReset();
    runJson.mockResolvedValue({});

    const result = await manager.removeWorkset('platform');

    expect(runJson).toHaveBeenCalledWith([
      'workset',
      'remove',
      'platform',
      '--yes',
      '--json',
    ]);
    // Removal is non-destructive to scopes: it must NOT reload scopes.
    expect(loadScopeOptionsSpy).not.toHaveBeenCalled();
    // ...but it MUST invalidate the dashboard cache and refresh so the removed workset disappears.
    expect(invalidateSpy).toHaveBeenCalled();
    expect(refreshSpy).toHaveBeenCalled();
    expect(result).toEqual(refreshedData);
  });

  it('removeWorkset surfaces errors from the CLI without masking them', async () => {
    const manager = createManagerWithWorksetPayload({ worksets: [] });
    const runJson = (manager as any).cliService.runJson;
    vi.spyOn(manager, 'refresh').mockResolvedValue({
      changes: [],
      specs: [],
      lastRefresh: 1,
    });

    runJson.mockReset();
    runJson.mockRejectedValue(new Error('workset not found'));

    await expect(manager.removeWorkset('missing')).rejects.toThrow('workset not found');
  });

  // Regression (Task 1.4): removal must invoke exactly one CLI command with the
  // exact arg vector, and must not run any destructive store/scope mutation.
  it('removeWorkset runs exactly one `workset remove` command and no store/scope mutations', async () => {
    const manager = createManagerWithWorksetPayload({ worksets: [] });
    const runJson = (manager as any).cliService.runJson;
    vi.spyOn(manager, 'refresh').mockResolvedValue({
      changes: [],
      specs: [],
      lastRefresh: 1,
    });
    const loadScopeOptionsSpy = vi.fn();
    (manager as any).scopeManager = {
      loadScopeOptions: loadScopeOptionsSpy,
      getSelectedScope: vi.fn(),
      getScopeOptions: vi.fn(() => []),
    };

    runJson.mockReset();
    runJson.mockResolvedValue({});

    await manager.removeWorkset('platform');

    // Exactly one CLI invocation.
    expect(runJson).toHaveBeenCalledTimes(1);
    // And it is the exact remove arg vector (with --yes for non-interactive + --json).
    expect(runJson).toHaveBeenCalledWith([
      'workset',
      'remove',
      'platform',
      '--yes',
      '--json',
    ]);
    // No scope reload — removal is scope-invariant.
    expect(loadScopeOptionsSpy).not.toHaveBeenCalled();
  });
});

describe('DataManager declared project-root scopes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('runs local OpenSpec commands with cwd = scope.rootPath for a selected declared project root', async () => {
    const activationRoot = '/tmp/openspec-ext-test-workspace';
    const declaredRoot = '/work/fastgpt';
    const manager = new DataManager(activationRoot) as any;

    // Track the workspaceRoot used to construct each OpenSpecCliService so we can
    // prove a per-scope service rooted at the declared root is created.
    const constructedRoots: string[] = [];
    const scopedCliGateway = {
      listChanges: vi.fn().mockResolvedValue([
        {
          name: 'fastgpt-change',
          completedTasks: 0,
          totalTasks: 1,
          lastModified: '2026-01-02',
          status: 'draft',
          lifecycleStatus: 'planning',
        },
      ]),
      listSpecs: vi.fn().mockResolvedValue([]),
      listArchivedChanges: vi.fn().mockResolvedValue([]),
    };

    // A declared (non-store, non-local) scope pointing at a different project root.
    const declaredScope = {
      id: 'declared:/work/fastgpt',
      label: 'FastGPT',
      rootPath: declaredRoot,
      source: 'declared',
      runtimeSource: 'installed',
      capabilities: { worksets: false, diagnostics: [] },
    };

    Object.assign(manager, {
      cliAvailable: true,
      capabilities: { worksets: false },
      scopeManager: {
        getSelectedScope: vi.fn(() => declaredScope),
        getScopeOptions: vi.fn(() => [declaredScope]),
      },
      // Factory the implementation uses to build per-scope CLI services.
      createScopedCliService: vi.fn((root: string) => {
        constructedRoots.push(root);
        return scopedCliGateway;
      }),
      contentAccess: {
        readArtifact: vi.fn().mockResolvedValue(''),
      },
      cliService: {
        getCliActivationDiagnostic: vi.fn().mockReturnValue(null),
        runJson: vi.fn().mockResolvedValue({}),
      },
    });

    const data = await manager.refresh();

    // A per-scope CLI service must be constructed for the declared root (cwd override).
    expect(manager.createScopedCliService).toHaveBeenCalledWith(declaredRoot);
    expect(constructedRoots).toContain(declaredRoot);
    // Changes were read through the scoped gateway, not the activation-root reader.
    expect(scopedCliGateway.listChanges).toHaveBeenCalled();
    expect(data.changes[0].name).toBe('fastgpt-change');
  });
});

describe('DataManager lifecycle data contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('enriches CLI changes with lifecycleStatus and publishes changeStatusCounts', async () => {
    const { manager, stateReader, changesDeferred, specsDeferred } = createManager();
    const archived: ArchivedChangeInfo[] = [
      { directoryName: '2026-01-01-old', name: 'old', archiveDate: '2026-01-01' },
    ];
    stateReader.listArchivedChanges = vi.fn().mockResolvedValue(archived);
    vi.spyOn(manager as any, 'enrichChangesWithProposalWhy').mockImplementation(async (changes) => changes);

    const refreshPromise = manager.refresh();
    changesDeferred.resolve([
      {
        name: 'ready-one',
        completedTasks: 0,
        totalTasks: 3,
        lastModified: '2026-01-01',
        status: 'draft',
        lifecycleStatus: 'planning',
        artifacts: [
          { id: 'proposal', outputPath: 'openspec/changes/ready-one/proposal.md', status: 'done' },
          { id: 'design', outputPath: 'openspec/changes/ready-one/design.md', status: 'done' },
          { id: 'tasks', outputPath: 'openspec/changes/ready-one/tasks.md', status: 'done' },
        ],
      },
      {
        name: 'status-failed',
        completedTasks: 0,
        totalTasks: 2,
        lastModified: '2026-01-02',
        status: 'draft',
        lifecycleStatus: 'planning',
        artifacts: [],
        attention: { required: true, reasons: ['metadata-read-failed'] },
      } as ChangeInfo,
    ]);
    specsDeferred.resolve([]);

    const data = await refreshPromise;

    expect(data.changes[0].lifecycleStatus).toBe('ready-to-apply');
    expect(data.changes[0].attention).toBeUndefined();
    expect(data.changes[1].lifecycleStatus).toBe('planning');
    expect(data.changes[1].attention).toEqual({
      required: true,
      reasons: ['metadata-read-failed'],
    });
    expect(data.changeStatusCounts).toEqual({
      all: 3,
      planning: 1,
      readyToApply: 1,
      applying: 0,
      readyToVerify: 0,
      archived: 1,
      needsAttention: 1,
    });
    expect(data.archivedChanges).toEqual(archived);
  });

  it('keeps stale scope counts from overwriting the selected root snapshot', async () => {
    const manager = new DataManager('/tmp/openspec-ext-test-workspace');
    const localScope = makeLocalScope();
    const storeScope = {
      id: 'store:team-plans',
      label: 'team-plans',
      rootPath: '/stores/team-plans',
      source: 'store',
      storeId: 'team-plans',
      runtimeSource: 'installed',
      capabilities: { diagnostics: [] },
    };
    let selectedScope = localScope;
    const localChangesDeferred = createDeferred<ChangeInfo[]>();
    const localSpecsDeferred = createDeferred<SpecInfo[]>();
    const storeChangesDeferred = createDeferred<ChangeInfo[]>();
    const storeSpecsDeferred = createDeferred<SpecInfo[]>();
    const refreshCallback = vi.fn();

    Object.assign(manager as any, {
      cliAvailable: true,
      capabilities: {},
      cachedData: undefined,
      scopeManager: {
        getSelectedScope: vi.fn(() => selectedScope),
        getScopeOptions: vi.fn(() => [localScope, storeScope]),
        selectScope: vi.fn((scopeId: string) => {
          selectedScope = scopeId === storeScope.id ? (storeScope as any) : localScope;
        }),
      },
      getScopedServices: vi.fn((scope: typeof localScope | typeof storeScope) => {
        const isStore = scope?.id === storeScope.id;
        return {
          stateReader: {
            listChanges: vi.fn(() => (isStore ? storeChangesDeferred.promise : localChangesDeferred.promise)),
            listSpecs: vi.fn(() => (isStore ? storeSpecsDeferred.promise : localSpecsDeferred.promise)),
            listArchivedChanges: vi.fn().mockResolvedValue(
              isStore
                ? [{ directoryName: '2026-01-02-store-arch', name: 'store-arch', archiveDate: '2026-01-02' }]
                : [{ directoryName: '2026-01-01-local-arch', name: 'local-arch', archiveDate: '2026-01-01' }]
            ),
          },
          contentAccess: {
            readArtifact: vi.fn().mockResolvedValue(''),
            getChangeOpenspecYamlPath: vi.fn(),
          },
          rootPath: scope?.rootPath ?? '/tmp/openspec-ext-test-workspace',
          scope,
        };
      }),
      cliService: {
        getCliActivationDiagnostic: vi.fn().mockReturnValue(null),
        runJson: vi.fn().mockResolvedValue({}),
      },
    });
    vi.spyOn(manager as any, 'enrichChangesWithProposalWhy').mockImplementation(async (changes) => changes);
    (manager as any).refreshCallbacks.add(refreshCallback);

    const localRefresh = manager.refresh();
    manager.selectScope(storeScope.id);
    const storeRefresh = manager.refresh();

    localChangesDeferred.resolve([
      {
        name: 'same-name',
        completedTasks: 0,
        totalTasks: 0,
        lastModified: '2026-01-01',
        status: 'draft',
        lifecycleStatus: 'planning',
        artifacts: [],
      },
    ]);
    localSpecsDeferred.resolve([]);

    await vi.waitFor(() => {
      expect((manager as any).getScopedServices).toHaveBeenCalledWith(storeScope);
    });

    storeChangesDeferred.resolve([
      {
        name: 'same-name',
        completedTasks: 1,
        totalTasks: 2,
        lastModified: '2026-01-02',
        status: 'in-progress',
        lifecycleStatus: 'planning',
        artifacts: [
          { id: 'proposal', outputPath: 'openspec/changes/same-name/proposal.md', status: 'done' },
          { id: 'design', outputPath: 'openspec/changes/same-name/design.md', status: 'done' },
          { id: 'tasks', outputPath: 'openspec/changes/same-name/tasks.md', status: 'done' },
        ],
      },
    ]);
    storeSpecsDeferred.resolve([]);

    await localRefresh;
    const storeData = await storeRefresh;

    expect(storeData.scope?.id).toBe(storeScope.id);
    expect(storeData.changes[0].lifecycleStatus).toBe('applying');
    expect(storeData.changeStatusCounts).toEqual({
      all: 2,
      planning: 0,
      readyToApply: 0,
      applying: 1,
      readyToVerify: 0,
      archived: 1,
      needsAttention: 0,
    });
    expect(refreshCallback).toHaveBeenCalledTimes(1);
    expect(refreshCallback).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: expect.objectContaining({ id: storeScope.id }),
        changeStatusCounts: expect.objectContaining({ applying: 1, archived: 1 }),
      })
    );
    expect((manager as any).cachedData.changeStatusCounts.archived).toBe(1);
    expect((manager as any).cachedData.archivedChanges[0].name).toBe('store-arch');
  });
});
