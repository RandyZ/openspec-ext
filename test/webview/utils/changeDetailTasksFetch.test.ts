import { describe, expect, it } from 'vitest';
import {
  readArtifactCacheStale,
  shouldCompleteVerifyArchiveTasksFetch,
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
});
