/** Only the active artifact tab should enter the main viewer loading state. */
export function shouldShowActiveTabLoadingForArtifactFetch(
  activeTab: string,
  artifactType: string,
): boolean {
  return activeTab === artifactType;
}

export function isArchiveNowBlockedByTasksProgress(params: {
  tasksProgressError: string | null;
  tasksProgressUnknown: boolean;
  verifyArchiveTasksLoading: boolean;
}): boolean {
  return params.verifyArchiveTasksLoading
    || params.tasksProgressUnknown
    || params.tasksProgressError !== null;
}

/** Whether a tasks artifact response should end the V&A task-progress loading state. */
export function shouldCompleteVerifyArchiveTasksFetch(params: {
  artifactType: string;
  content: unknown;
  cacheStale: boolean;
}): boolean {
  if (params.artifactType !== 'tasks') {
    return false;
  }
  if (params.cacheStale) {
    return false;
  }
  return typeof params.content === 'string';
}

export function readArtifactCacheStale(cache: unknown): boolean {
  if (!cache || typeof cache !== 'object') {
    return false;
  }
  return (cache as { stale?: boolean }).stale === true;
}
