import { describe, expect, it } from 'vitest';
import { isArchiveNowAllowed } from '../../../src/webview/utils/changeDetailArchiveGating';

describe('changeDetailArchiveGating', () => {
  it('never enables Archive Now while task progress refetch is pending', () => {
    expect(isArchiveNowAllowed(true, true, false)).toBe(false);
    expect(isArchiveNowAllowed(true, false, false)).toBe(true);
    expect(isArchiveNowAllowed(false, false, false)).toBe(false);
    expect(isArchiveNowAllowed(true, false, true)).toBe(false);
  });

  it('blocks Archive Now when resolver would allow but counts are stale during loading', () => {
    const staleShowsComplete = { completedTasks: 3, totalTasks: 3 };
    const resolverWouldAllow = staleShowsComplete.completedTasks >= staleShowsComplete.totalTasks;
    expect(resolverWouldAllow).toBe(true);
    expect(isArchiveNowAllowed(resolverWouldAllow, true, false)).toBe(false);
  });
});
