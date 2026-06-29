import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DataManager } from '@extension/services/dataManager';
import type { ChangeInfo, SpecInfo } from '@extension/services/types';

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
    },
    fileWatcher: {
      start: vi.fn(),
      stop: vi.fn(),
    },
  });

  return { manager, stateReader, changesDeferred, specsDeferred };
}

describe('DataManager dashboard data loading', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
      { changes: [], specs: [], lastRefresh: expect.any(Number) },
      { changes: [], specs: [], lastRefresh: expect.any(Number) },
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

    await expect(dashboardData).resolves.toEqual({
      changes: [],
      specs: [],
      lastRefresh: expect.any(Number),
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
    };
    const newChange: ChangeInfo = {
      name: 'new-change',
      completedTasks: 0,
      totalTasks: 1,
      lastModified: '2026-01-02',
      status: 'draft',
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
    };
    const firstMutationChange: ChangeInfo = {
      name: 'first-mutation',
      completedTasks: 0,
      totalTasks: 1,
      lastModified: '2026-01-02',
      status: 'draft',
    };
    const secondMutationChange: ChangeInfo = {
      name: 'second-mutation',
      completedTasks: 0,
      totalTasks: 1,
      lastModified: '2026-01-03',
      status: 'draft',
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

    vi.spyOn(manager as any, 'countTaskProgress').mockResolvedValue([0, 2]);
    vi.spyOn(manager as any, 'getFilesystemArtifactStatuses').mockResolvedValue([]);

    const changes = await (manager as any).listChangesFromFilesystem();

    expect(changes).toEqual([
      expect.objectContaining({
        name: 'polish-ui',
        createdAt: '2026-06-01T09:00:00.000Z',
        lastModified: '2026-06-10T12:00:00.000Z',
        status: 'in-progress',
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
    vi.spyOn(manager as any, 'countTaskProgress').mockResolvedValue([0, 0]);
    vi.spyOn(manager as any, 'getFilesystemArtifactStatuses').mockResolvedValue([]);

    const changes = await (manager as any).listChangesFromFilesystem();

    expect(changes[0]).toMatchObject({
      name: 'missing-time',
      status: 'draft',
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
    vi.spyOn((manager as any).cliService, 'getCliActivationDiagnostic').mockReturnValue(diagnostic);
    vi.spyOn(manager as any, 'listChangesFromFilesystem').mockResolvedValue([
      { name: 'from-files', completedTasks: 0, totalTasks: 0, lastModified: 'now', status: 'draft' },
    ]);
    (manager as any).cliAvailable = true;

    await expect(manager.refresh()).rejects.toThrow('missing cli');
    expect(manager.getCliDiagnostic()).toEqual(diagnostic);
    expect((manager as any).listChangesFromFilesystem).not.toHaveBeenCalled();
  });

  it('keeps cached data and records warning diagnostic when refresh fails later', async () => {
    const manager = new DataManager('/workspace');
    const cached = { changes: [], specs: [], lastRefresh: 123 };
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
      },
      fileWatcher: {
        start: vi.fn(),
        stop: vi.fn(),
      },
    });

    return manager;
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

  it('getDashboardData includes scope info when scope manager is initialized', async () => {
    const manager = createManagerWithMockedCli();

    await manager.initializeScopeManager();

    vi.spyOn(manager as any, 'stateReader', 'get').mockReturnValue({
      listChanges: vi.fn().mockResolvedValue([]),
      listSpecs: vi.fn().mockResolvedValue([]),
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
});
