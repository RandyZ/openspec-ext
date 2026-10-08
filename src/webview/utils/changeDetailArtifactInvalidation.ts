import {
  artifactContentCacheKey,
  artifactFetchCoordinatorKey,
} from './artifactFetchKeys';
import type { ArtifactFetchCoordinator } from './artifactFetchCoordinator';

export function tasksFetchCoordinatorKey(scopeId: string | undefined): string {
  return artifactFetchCoordinatorKey(scopeId, 'tasks');
}

export function clearTasksContentCache(
  contentCache: Map<string, string>,
  scopeId: string | undefined,
): void {
  const scopePrefix = scopeId ? `${scopeId}::` : '';
  for (const key of Array.from(contentCache.keys())) {
    const suffix = scopePrefix && key.startsWith(scopePrefix)
      ? key.slice(scopePrefix.length)
      : key;
    if (suffix === 'tasks' || suffix.startsWith('tasks:')) {
      contentCache.delete(key);
    }
  }
}

/** Drop any stuck tasks fetch slot, clear cache, and schedule a refetch. */
export function handleTasksArtifactInvalidated(params: {
  scopeId: string | undefined;
  coordinator: ArtifactFetchCoordinator;
  contentCache: Map<string, string>;
  resetVerifyArchiveLoadedFlag: () => void;
  markVerifyArchiveLoading: () => void;
  scheduleTasksRefetch: () => void;
}): void {
  params.resetVerifyArchiveLoadedFlag();
  params.coordinator.complete(tasksFetchCoordinatorKey(params.scopeId));
  clearTasksContentCache(params.contentCache, params.scopeId);
  params.markVerifyArchiveLoading();
  params.scheduleTasksRefetch();
}

export function completeArtifactFetchAndStoreContent(params: {
  scopeId: string | undefined;
  artifactType: string;
  artifactPath?: string;
  content: string;
  coordinator: ArtifactFetchCoordinator;
  contentCache: Map<string, string>;
}): string {
  const fetchKey = artifactFetchCoordinatorKey(params.scopeId, params.artifactType);
  params.coordinator.complete(fetchKey);
  const storageKey = artifactContentCacheKey(
    params.scopeId,
    params.artifactType,
    params.artifactPath,
  );
  params.contentCache.set(storageKey, params.content);
  return storageKey;
}
