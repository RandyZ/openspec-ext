/** In-flight / debounce key: one fetch slot per scope + artifact kind (not output path). */
export function artifactFetchCoordinatorKey(
  scopeId: string | undefined,
  artifactType: string,
  specId?: string | null,
): string {
  const scopePrefix = scopeId ? `${scopeId}::` : '';
  if (artifactType === 'specs' && specId) {
    return `${scopePrefix}specs:${specId}`;
  }
  return `${scopePrefix}${artifactType}`;
}

/** Content cache key; may include output path or spec id. */
export function artifactContentCacheKey(
  scopeId: string | undefined,
  type: string,
  pathOrSpecId?: string | null,
): string {
  const scopePrefix = scopeId ? `${scopeId}::` : '';
  const suffix =
    type === 'specs' && pathOrSpecId
      ? `specs:${pathOrSpecId}`
      : pathOrSpecId
        ? `${type}:${pathOrSpecId}`
        : type;
  return `${scopePrefix}${suffix}`;
}
