import { describe, expect, it } from 'vitest';
import { filterChanges } from '../../../src/webview/utils/filterChanges';
import type { ChangeInfo } from '../../../src/webview/types/messages';

const baseChange: ChangeInfo = {
  name: 'base-change',
  completedTasks: 0,
  totalTasks: 0,
  lastModified: '2026-04-30T00:00:00.000Z',
  status: 'draft',
  artifacts: [],
};

function change(overrides: Partial<ChangeInfo>): ChangeInfo {
  return { ...baseChange, ...overrides };
}

describe('filterChanges', () => {
  const changes: ChangeInfo[] = [
    change({
      name: 'add-search',
      status: 'in-progress',
      artifacts: [{ id: 'proposal', outputPath: 'proposal.md', status: 'done' }],
      proposalWhySummary: 'Find changes quickly from the sidebar',
      proposalWhyFullText: 'Find changes quickly from the sidebar and inspect context.',
      searchText: 'find changes quickly from the sidebar and inspect context proposal done',
    }),
    change({
      name: 'archive-old-flow',
      status: 'complete',
      artifacts: [{ id: 'tasks', outputPath: 'tasks.md', status: 'done' }],
      proposalWhySummary: 'Archive completed workflows',
      proposalWhyFullText: 'Archive completed workflows',
      searchText: 'archive completed workflows tasks done',
    }),
  ];

  it('returns all changes for an empty query', () => {
    expect(filterChanges(changes, '')).toEqual(changes);
    expect(filterChanges(changes, '   ')).toEqual(changes);
  });

  it('matches name, status, artifact metadata, and proposal why text', () => {
    expect(filterChanges(changes, 'add-search')).toEqual([changes[0]]);
    expect(filterChanges(changes, 'complete')).toEqual([changes[1]]);
    expect(filterChanges(changes, 'proposal')).toEqual([changes[0]]);
    expect(filterChanges(changes, 'inspect context')).toEqual([changes[0]]);
  });

  it('returns an empty array when no loaded metadata matches', () => {
    expect(filterChanges(changes, 'missing term')).toEqual([]);
  });
});
