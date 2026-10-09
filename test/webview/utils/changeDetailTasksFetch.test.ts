import { describe, expect, it } from 'vitest';
import { isArchiveNowAllowed } from '../../../src/webview/utils/changeDetailArchiveGating';
import {
  isArchiveNowBlockedByTasksProgress,
  readArtifactCacheStale,
  shouldCompleteVerifyArchiveTasksFetch,
  shouldShowActiveTabLoadingForArtifactFetch,
} from '../../../src/webview/utils/changeDetailTasksFetch';

describe('changeDetailTasksFetch', () => {
  it('completes task progress loading for empty tasks.md content', () => {
    expect(shouldCompleteVerifyArchiveTasksFetch({
      artifactType: 'tasks',
      content: '',
      cacheStale: false,
    })).toBe(true);
  });

  it('does not complete while cache metadata is stale', () => {
    expect(shouldCompleteVerifyArchiveTasksFetch({
      artifactType: 'tasks',
      content: '- [x] done',
      cacheStale: true,
    })).toBe(false);
    expect(readArtifactCacheStale({ stale: true, source: 'memory' })).toBe(true);
  });

  it('does not put the proposal tab into loading when only tasks refetch', () => {
    expect(shouldShowActiveTabLoadingForArtifactFetch('proposal', 'tasks')).toBe(false);
    expect(shouldShowActiveTabLoadingForArtifactFetch('tasks', 'tasks')).toBe(true);
  });

  it('blocks Archive Now when tasks progress failed to load', () => {
    expect(isArchiveNowBlockedByTasksProgress({
      tasksProgressError: 'EACCES: permission denied',
      tasksProgressUnknown: true,
      verifyArchiveTasksLoading: false,
    })).toBe(true);
    expect(isArchiveNowAllowed(true, false, true)).toBe(false);
    expect(isArchiveNowAllowed(true, false, false)).toBe(true);
  });
});
