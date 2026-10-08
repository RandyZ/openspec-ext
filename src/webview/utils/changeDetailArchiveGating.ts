/** Archive Now stays disabled while task progress for V&A is loading or refetching. */
export function isArchiveNowAllowed(
  resolverAllowsArchiveNow: boolean,
  verifyArchiveTasksLoading: boolean,
): boolean {
  return resolverAllowsArchiveNow && !verifyArchiveTasksLoading;
}
