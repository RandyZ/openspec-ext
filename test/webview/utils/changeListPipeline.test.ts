import { describe, expect, it } from 'vitest';
import type { ChangeInfo, ArchivedChangeInfo } from '../../../src/webview/types/messages';
import {
  buildChangeListItems,
  toActiveListItem,
  toArchivedListItem,
  type ChangeListItemView,
} from '../../../src/webview/types/changeList';
import { DEFAULT_CHANGES_VIEW_STATE } from '../../../src/webview/state/changesViewState';
import {
  buildVisibleChangePage,
  filterByAttention,
  filterByLifecycle,
  paginate,
  searchItems,
  sortItems,
} from '../../../src/webview/utils/changeListPipeline';

function activeChange(overrides: Partial<ChangeInfo> = {}): ChangeInfo {
  return {
    name: 'change',
    completedTasks: 1,
    totalTasks: 3,
    lastModified: '2026-06-10T12:00:00.000Z',
    createdAt: '2026-06-01T09:00:00.000Z',
    status: 'in-progress',
    lifecycleStatus: 'applying',
    artifacts: [{ id: 'proposal', outputPath: 'proposal.md', status: 'done' }],
    ...overrides,
  };
}

function archivedChange(overrides: Partial<ArchivedChangeInfo> = {}): ArchivedChangeInfo {
  return {
    directoryName: '2026-01-01-old-feature',
    name: 'old-feature',
    archiveDate: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('changeList adapters', () => {
  it('normalizes active and archived list items with distinct ids', () => {
    const change = activeChange({ name: 'shared-name' });
    const archive = archivedChange({ name: 'shared-name', directoryName: '2026-shared-name' });

    const activeItem = toActiveListItem(change);
    const archivedItem = toArchivedListItem(archive);

    expect(activeItem).toMatchObject({
      kind: 'active',
      id: 'active:shared-name',
      lifecycleStatus: 'applying',
      readOnly: false,
      change,
    });
    expect(archivedItem).toMatchObject({
      kind: 'archived',
      id: 'archived:2026-shared-name',
      lifecycleStatus: 'archived',
      readOnly: true,
      archive,
    });
    expect(activeItem.id).not.toBe(archivedItem.id);
  });

  it('builds a combined list from active and archived sources', () => {
    const items = buildChangeListItems(
      [activeChange({ name: 'alpha' })],
      [archivedChange({ directoryName: '2026-beta', name: 'beta' })]
    );
    expect(items).toHaveLength(2);
    expect(items.map((item) => item.kind)).toEqual(['active', 'archived']);
  });
});

describe('changeListPipeline', () => {
  it('filters 11 applying changes before paginating with page size 10', () => {
    const applying = Array.from({ length: 11 }, (_, index) =>
      activeChange({
        name: `applying-${index}`,
        lifecycleStatus: 'applying',
        lastModified: `2026-06-${String(index + 1).padStart(2, '0')}T00:00:00.000Z`,
      })
    );
    const other = Array.from({ length: 26 }, (_, index) =>
      activeChange({
        name: `planning-${index}`,
        lifecycleStatus: 'planning',
        lastModified: `2026-05-${String(index + 1).padStart(2, '0')}T00:00:00.000Z`,
      })
    );
    const items = buildChangeListItems([...applying, ...other], []);

    const result = buildVisibleChangePage(items, {
      ...DEFAULT_CHANGES_VIEW_STATE,
      lifecycleStatus: 'applying',
      pageSize: 10,
      page: 1,
    });

    expect(result.totalItems).toBe(11);
    expect(result.items).toHaveLength(10);
    expect(result.totalPages).toBe(2);
    expect(result.page).toBe(1);
    expect(result.startIndex).toBe(1);
    expect(result.endIndex).toBe(10);
  });

  it('runs search after lifecycle status filter', () => {
    const items = buildChangeListItems(
      [
        activeChange({ name: 'alpha-applying', lifecycleStatus: 'applying' }),
        activeChange({ name: 'beta-planning', lifecycleStatus: 'planning' }),
      ],
      []
    );

    const result = buildVisibleChangePage(items, {
      ...DEFAULT_CHANGES_VIEW_STATE,
      lifecycleStatus: 'applying',
      query: 'beta',
    });

    expect(result.totalItems).toBe(0);
    expect(result.items).toEqual([]);
  });

  it('sorts before page slice', () => {
    const items = buildChangeListItems(
      [
        activeChange({ name: 'zulu', lastModified: '2026-06-03T00:00:00.000Z' }),
        activeChange({ name: 'alpha', lastModified: '2026-06-01T00:00:00.000Z' }),
        activeChange({ name: 'mike', lastModified: '2026-06-02T00:00:00.000Z' }),
      ],
      []
    );

    const result = buildVisibleChangePage(items, {
      ...DEFAULT_CHANGES_VIEW_STATE,
      sort: 'name-asc',
      pageSize: 2,
      page: 1,
    });

    expect(result.items.map((item) => item.kind === 'active' && item.change.name)).toEqual([
      'alpha',
      'mike',
    ]);
  });

  it('returns empty pagination metadata for zero results', () => {
    const result = buildVisibleChangePage(buildChangeListItems([], []), {
      ...DEFAULT_CHANGES_VIEW_STATE,
      lifecycleStatus: 'applying',
      query: 'missing',
    });

    expect(result).toEqual({
      items: [],
      totalItems: 0,
      totalPages: 0,
      page: 1,
      startIndex: 0,
      endIndex: 0,
    });
  });

  it('clamps out-of-range page numbers', () => {
    const items = buildChangeListItems(
      Array.from({ length: 12 }, (_, index) =>
        activeChange({ name: `change-${index}`, lifecycleStatus: 'planning' })
      ),
      []
    );

    const result = buildVisibleChangePage(items, {
      ...DEFAULT_CHANGES_VIEW_STATE,
      lifecycleStatus: 'planning',
      pageSize: 10,
      page: 99,
    });

    expect(result.page).toBe(2);
    expect(result.items).toHaveLength(2);
    expect(result.startIndex).toBe(11);
    expect(result.endIndex).toBe(12);
  });

  it('keeps stable ordering for identical timestamps', () => {
    const timestamp = '2026-06-10T12:00:00.000Z';
    const items = buildChangeListItems(
      [
        activeChange({ name: 'first', lastModified: timestamp }),
        activeChange({ name: 'second', lastModified: timestamp }),
        activeChange({ name: 'third', lastModified: timestamp }),
      ],
      []
    );

    const sortedOnce = sortItems(items, 'updated-desc').map((item) =>
      item.kind === 'active' ? item.change.name : item.archive.name
    );
    const sortedTwice = sortItems(items, 'updated-desc').map((item) =>
      item.kind === 'active' ? item.change.name : item.archive.name
    );

    expect(sortedOnce).toEqual(['first', 'second', 'third']);
    expect(sortedTwice).toEqual(sortedOnce);
  });

  it('merges archived items in All view and keeps archived filter read-only', () => {
    const items = buildChangeListItems(
      [activeChange({ name: 'live-change' })],
      [archivedChange({ name: 'done-change', directoryName: '2026-done-change' })]
    );

    const allResult = buildVisibleChangePage(items, {
      ...DEFAULT_CHANGES_VIEW_STATE,
      lifecycleStatus: 'all',
    });
    expect(allResult.totalItems).toBe(2);
    expect(allResult.items.some((item) => item.kind === 'archived')).toBe(true);
    expect(allResult.items.some((item) => item.kind === 'active')).toBe(true);

    const archivedResult = buildVisibleChangePage(items, {
      ...DEFAULT_CHANGES_VIEW_STATE,
      lifecycleStatus: 'archived',
    });
    expect(archivedResult.totalItems).toBe(1);
    expect(archivedResult.items).toEqual([
      expect.objectContaining({ kind: 'archived', readOnly: true }),
    ]);
  });

  it('applies search, sort, and pagination consistently in All and Archived modes', () => {
    const items = buildChangeListItems(
      [
        activeChange({ name: 'alpha-live', lastModified: '2026-06-01T00:00:00.000Z' }),
        activeChange({ name: 'beta-live', lastModified: '2026-06-03T00:00:00.000Z' }),
      ],
      [
        archivedChange({
          name: 'alpha-archived',
          directoryName: '2026-alpha-archived',
          archiveDate: '2026-06-02T00:00:00.000Z',
        }),
        archivedChange({
          name: 'gamma-archived',
          directoryName: '2026-gamma-archived',
          archiveDate: '2026-06-04T00:00:00.000Z',
        }),
      ]
    );

    const allResult = buildVisibleChangePage(items, {
      ...DEFAULT_CHANGES_VIEW_STATE,
      lifecycleStatus: 'all',
      query: 'alpha',
      sort: 'name-asc',
      pageSize: 1,
      page: 1,
    });
    expect(allResult.totalItems).toBe(2);
    expect(allResult.items).toHaveLength(1);
    expect(allResult.items[0]).toMatchObject({
      kind: 'archived',
      archive: { name: 'alpha-archived' },
    });

    const archivedResult = buildVisibleChangePage(items, {
      ...DEFAULT_CHANGES_VIEW_STATE,
      lifecycleStatus: 'archived',
      query: 'alpha',
      sort: 'name-asc',
      pageSize: 1,
      page: 1,
    });
    expect(archivedResult.totalItems).toBe(1);
    expect(archivedResult.items).toEqual([
      expect.objectContaining({
        kind: 'archived',
        readOnly: true,
        archive: expect.objectContaining({ name: 'alpha-archived' }),
      }),
    ]);
  });
});

describe('changeListPipeline helpers', () => {
  it('filters attention-required active changes only', () => {
    const items: ChangeListItemView[] = [
      toActiveListItem(
        activeChange({
          name: 'needs-help',
          attention: { required: true, reasons: ['invalid-task-progress'] },
        })
      ),
      toActiveListItem(activeChange({ name: 'healthy' })),
      toArchivedListItem(archivedChange()),
    ];

    expect(filterByAttention(items, true)).toHaveLength(1);
    expect(filterByAttention(items, true)[0]).toMatchObject({ kind: 'active', readOnly: false });
  });

  it('searches active lifecycle, artifacts, proposal text, and dates', () => {
    const items = buildChangeListItems(
      [
        activeChange({
          name: 'search-target',
          lifecycleStatus: 'ready-to-verify',
          proposalWhySummary: 'Ship faster',
          proposalWhyFullText: 'Ship faster with confidence',
          createdAt: '2026-03-15T00:00:00.000Z',
          lastModified: '2026-04-20T00:00:00.000Z',
          artifacts: [{ id: 'tasks', outputPath: 'tasks.md', status: 'done' }],
        }),
      ],
      []
    );

    expect(searchItems(items, 'ready-to-verify')).toHaveLength(1);
    expect(searchItems(items, 'tasks done')).toHaveLength(1);
    expect(searchItems(items, 'ship faster')).toHaveLength(1);
    expect(searchItems(items, '2026-03-15')).toHaveLength(1);
    expect(searchItems(items, '2026-04-20')).toHaveLength(1);
  });

  it('searches archived name, directory, date, and literal archived status', () => {
    const items = buildChangeListItems(
      [],
      [
        archivedChange({
          name: 'retired-feature',
          directoryName: '2026-retired-feature',
          archiveDate: '2026-02-01T12:00:00.000Z',
        }),
      ]
    );

    expect(searchItems(items, 'retired-feature')).toHaveLength(1);
    expect(searchItems(items, '2026-retired-feature')).toHaveLength(1);
    expect(searchItems(items, '2026-02-01')).toHaveLength(1);
    expect(searchItems(items, 'archived')).toHaveLength(1);
  });

  it('places missing dates after valid values when sorting', () => {
    const items = buildChangeListItems(
      [
        activeChange({ name: 'dated', lastModified: '2026-06-02T00:00:00.000Z' }),
        activeChange({ name: 'missing', lastModified: '' }),
      ],
      []
    );

    const sorted = sortItems(items, 'updated-desc').map((item) =>
      item.kind === 'active' ? item.change.name : item.archive.name
    );
    expect(sorted).toEqual(['dated', 'missing']);
  });

  it('uses archiveDate as updated/created fallback for archived items', () => {
    const items = buildChangeListItems(
      [],
      [
        archivedChange({
          name: 'older',
          directoryName: 'older',
          archiveDate: '2026-01-01T00:00:00.000Z',
        }),
        archivedChange({
          name: 'newer',
          directoryName: 'newer',
          archiveDate: '2026-06-01T00:00:00.000Z',
        }),
      ]
    );

    const sorted = sortItems(items, 'updated-desc').map((item) =>
      item.kind === 'archived' ? item.archive.name : ''
    );
    expect(sorted).toEqual(['newer', 'older']);
  });

  it('paginates with validated page size boundaries', () => {
    const items = buildChangeListItems(
      Array.from({ length: 5 }, (_, index) => activeChange({ name: `item-${index}` })),
      []
    );

    expect(paginate(items, 1, 2)).toMatchObject({
      totalItems: 5,
      totalPages: 3,
      page: 1,
      startIndex: 1,
      endIndex: 2,
    });
  });

  it('filters lifecycle statuses including archived-only view', () => {
    const items = buildChangeListItems(
      [activeChange({ lifecycleStatus: 'planning' })],
      [archivedChange()]
    );

    expect(filterByLifecycle(items, 'all')).toHaveLength(2);
    expect(filterByLifecycle(items, 'archived')).toHaveLength(1);
    expect(filterByLifecycle(items, 'planning')).toHaveLength(1);
  });
});
