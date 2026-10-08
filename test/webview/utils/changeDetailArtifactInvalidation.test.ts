import { describe, expect, it, vi } from 'vitest';
import { ArtifactFetchCoordinator } from '../../../src/webview/utils/artifactFetchCoordinator';
import {
  completeArtifactFetchAndStoreContent,
  handleTasksArtifactInvalidated,
  tasksFetchCoordinatorKey,
} from '../../../src/webview/utils/changeDetailArtifactInvalidation';
import { artifactContentCacheKey } from '../../../src/webview/utils/artifactFetchKeys';

describe('changeDetailArtifactInvalidation', () => {
  it('refetches tasks three times in a row on V&A without clearing a stuck in-flight slot', () => {
    vi.useFakeTimers();
    const scopeId = 'scope-ws2';
    const fetchKey = tasksFetchCoordinatorKey(scopeId);
    const coordinator = new ArtifactFetchCoordinator({ debounceMs: 50, isVisible: () => true });
    const contentCache = new Map<string, string>();
    const refetches: number[] = [];
    let verifyArchiveLoadingCount = 0;

    const scheduleTasksRefetch = () => {
      coordinator.schedule(fetchKey, () => {
        refetches.push(refetches.length + 1);
      });
    };

    coordinator.schedule(fetchKey, () => refetches.push(0));
    vi.advanceTimersByTime(50);
    expect(refetches).toEqual([0]);
    expect(coordinator.isInFlight(fetchKey)).toBe(true);

    const path = 'openspec/changes/demo/tasks.md';
    completeArtifactFetchAndStoreContent({
      scopeId,
      artifactType: 'tasks',
      artifactPath: path,
      content: '- [x] a\n- [ ] b',
      coordinator,
      contentCache,
    });
    expect(coordinator.isInFlight(fetchKey)).toBe(false);
    expect(contentCache.get(artifactContentCacheKey(scopeId, 'tasks', path))).toBeDefined();

    for (let edit = 1; edit <= 3; edit += 1) {
      handleTasksArtifactInvalidated({
        scopeId,
        coordinator,
        contentCache,
        resetVerifyArchiveLoadedFlag: () => undefined,
        markVerifyArchiveLoading: () => {
          verifyArchiveLoadingCount += 1;
        },
        scheduleTasksRefetch,
      });
      vi.advanceTimersByTime(50);
      expect(refetches).toHaveLength(edit + 1);
      expect(coordinator.isInFlight(fetchKey)).toBe(true);
      completeArtifactFetchAndStoreContent({
        scopeId,
        artifactType: 'tasks',
        artifactPath: path,
        content: `- [x] edit-${edit}`,
        coordinator,
        contentCache,
      });
      expect(coordinator.isInFlight(fetchKey)).toBe(false);
    }

    expect(verifyArchiveLoadingCount).toBe(3);
    vi.useRealTimers();
  });

  it('recovers when complete used fetch key but an old path key left in-flight', () => {
    vi.useFakeTimers();
    const scopeId = 'scope-1';
    const fetchKey = tasksFetchCoordinatorKey(scopeId);
    const pathKey = artifactContentCacheKey(scopeId, 'tasks', 'tasks.md');
    const coordinator = new ArtifactFetchCoordinator({ debounceMs: 10, isVisible: () => true });
    const runs: string[] = [];

    coordinator.schedule(fetchKey, () => runs.push('initial'));
    vi.advanceTimersByTime(10);
    coordinator.complete(pathKey);
    expect(coordinator.isInFlight(fetchKey)).toBe(true);

    handleTasksArtifactInvalidated({
      scopeId,
      coordinator,
      contentCache: new Map(),
      resetVerifyArchiveLoadedFlag: () => undefined,
      markVerifyArchiveLoading: () => undefined,
      scheduleTasksRefetch: () => {
        coordinator.schedule(fetchKey, () => runs.push('after-invalidate'));
      },
    });
    vi.advanceTimersByTime(10);
    expect(runs).toEqual(['initial', 'after-invalidate']);

    vi.useRealTimers();
  });
});
