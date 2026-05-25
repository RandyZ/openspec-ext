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
    contentAccess: {
      readArtifact: vi.fn(),
      getChangeOpenspecYamlPath: vi.fn((changeName: string) => `/tmp/${changeName}/.openspec.yaml`),
    },
    cliService: {
      checkAvailability: vi.fn().mockResolvedValue(true),
      getVersion: vi.fn().mockResolvedValue('1.0.0'),
      showCliNotFoundError: vi.fn(),
      createChange: vi.fn().mockResolvedValue(undefined),
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
});
