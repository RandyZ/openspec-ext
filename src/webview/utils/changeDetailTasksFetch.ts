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
