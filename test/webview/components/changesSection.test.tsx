import React, { isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ChangesSection } from '../../../src/webview/components/ChangesSection';
import { ChangeStatusFilter } from '../../../src/webview/components/ChangeStatusFilter';
import type { ChangeStatusCounts } from '../../../src/shared/changeLifecycle';
import type { ArchivedChangeInfo, ChangeInfo } from '../../../src/webview/types/messages';
import type { ChangesViewState } from '../../../src/webview/state/changesViewState';
import {
  changesViewReducer,
  DEFAULT_CHANGES_VIEW_STATE,
  maybeClampChangesViewPage,
} from '../../../src/webview/state/changesViewState';
import { buildChangeListItems } from '../../../src/webview/types/changeList';
import { buildVisibleChangePage } from '../../../src/webview/utils/changeListPipeline';

const HOST_COUNTS: ChangeStatusCounts = {
  all: 17,
  planning: 5,
  readyToApply: 3,
  applying: 4,
  readyToVerify: 2,
  archived: 3,
  needsAttention: 2,
};

function makeChange(
  name: string,
  lifecycleStatus: ChangeInfo['lifecycleStatus'],
  overrides: Partial<ChangeInfo> = {}
): ChangeInfo {
  return {
    name,
    completedTasks: 0,
    totalTasks: 0,
    lastModified: '2026-06-14T12:00:00.000Z',
    createdAt: '2026-06-10T12:00:00.000Z',
    status: 'draft',
    lifecycleStatus,
    ...overrides,
  };
}

function makeArchive(name: string, archiveDate = '2026-06-01'): ArchivedChangeInfo {
  return {
    directoryName: `${archiveDate}-${name}`,
    name,
    archiveDate,
  };
}

const SAMPLE_CHANGES: ChangeInfo[] = [
  makeChange('plan-a', 'planning'),
  makeChange('plan-b', 'planning'),
  makeChange('ready-a', 'ready-to-apply'),
  makeChange('apply-a', 'applying', {
    completedTasks: 1,
    totalTasks: 3,
    attention: { required: true, reasons: ['validation-failed'] },
  }),
  makeChange('apply-b', 'applying', { completedTasks: 1, totalTasks: 2 }),
  makeChange('verify-a', 'ready-to-verify', { completedTasks: 2, totalTasks: 2 }),
];

const SAMPLE_ARCHIVES: ArchivedChangeInfo[] = [
  makeArchive('old-one'),
  makeArchive('old-two'),
  makeArchive('old-three'),
];

function renderSection(
  overrides: Partial<React.ComponentProps<typeof ChangesSection>> = {},
  viewState?: Partial<ChangesViewState>
) {
  return renderToStaticMarkup(
    <ChangesSection
      changes={SAMPLE_CHANGES}
      archivedItems={SAMPLE_ARCHIVES}
      changeStatusCounts={HOST_COUNTS}
      onRequestNewChange={vi.fn()}
      onOpenChange={vi.fn()}
      onOpenArchivedChange={vi.fn()}
      viewState={{ ...DEFAULT_CHANGES_VIEW_STATE, ...viewState }}
      {...overrides}
    />
  );
}

function walkElements(node: ReactNode, visit: (el: ReactElement) => void): void {
  if (node == null || typeof node === 'boolean') return;
  if (Array.isArray(node)) {
    node.forEach((child) => walkElements(child, visit));
    return;
  }
  if (!isValidElement(node)) return;
  visit(node);
  walkElements((node.props as { children?: ReactNode }).children, visit);
}

describe('ChangesSection root-scoped empty states', () => {
  it('names the selected root when no changes exist', () => {
    const html = renderToStaticMarkup(
      <ChangesSection
        changes={[]}
        archivedItems={[]}
        changeStatusCounts={{
          all: 0,
          planning: 0,
          readyToApply: 0,
          applying: 0,
          readyToVerify: 0,
          archived: 0,
          needsAttention: 0,
        }}
        rootLabel="Store: team-plans"
        onRequestNewChange={vi.fn()}
      />
    );

    expect(html).toContain('No changes in Store: team-plans');
    expect(html).toContain('Create New Change');
    expect(html).not.toContain('Local Root');
  });

  it('names the selected root when archived filter is empty', () => {
    const html = renderToStaticMarkup(
      <ChangesSection
        changes={[]}
        archivedItems={[]}
        changeStatusCounts={{
          all: 0,
          planning: 0,
          readyToApply: 0,
          applying: 0,
          readyToVerify: 0,
          archived: 0,
          needsAttention: 0,
        }}
        rootLabel="Store: team-plans"
        viewState={{ ...DEFAULT_CHANGES_VIEW_STATE, lifecycleStatus: 'archived' }}
        onRequestNewChange={vi.fn()}
      />
    );

    expect(html).toContain('No Archived changes in Store: team-plans');
    expect(html).not.toContain('Create New Change');
  });
});

describe('Project Sidebar compact active work', () => {
  it('does not render archived cards or explorer filters in compact mode', () => {
    const html = renderToStaticMarkup(
      React.createElement(ChangesSection, {
        changes: SAMPLE_CHANGES,
        archivedItems: SAMPLE_ARCHIVES,
        changeStatusCounts: HOST_COUNTS,
        compact: true,
        onOpenChange: vi.fn(),
        onOpenArchivedChange: vi.fn(),
      } as any),
    );

    expect(html).toContain('plan-a');
    expect(html).not.toContain('old-one');
    expect(html).not.toContain('Filter by lifecycle status');
    expect(html).not.toContain('Search changes');
    expect(html).not.toContain('Items per page');
  });
});

describe('Task 4.1 wide lifecycle segmented controls', () => {
  it('renders All plus five lifecycle segments with Host counts', () => {
    const html = renderSection({}, {});

    expect(html).toContain('All 17');
    expect(html).toContain('Planning 5');
    expect(html).toContain('Ready to Apply 3');
    expect(html).toContain('Applying 4');
    expect(html).toContain('Ready to Verify 2');
    expect(html).toContain('Archived 3');
    expect(html).not.toMatch(/Draft\s+\d/);
    expect(html).not.toContain('In Progress');
    expect(html).not.toContain('Merged');
    expect(html).not.toContain('Add Operation');
    expect(html).toContain('Create New Change');
  });

  it('keeps Host counts even when the visible page is filtered', () => {
    const html = renderSection(
      {},
      { lifecycleStatus: 'applying', query: 'no-match-xyz', page: 1 }
    );

    expect(html).toContain('All 17');
    expect(html).toContain('Applying 4');
    expect(html).toContain('No changes match the current search and filters');
  });

  it('filters the list when a lifecycle segment is selected via view state', () => {
    const applyingHtml = renderSection({}, { lifecycleStatus: 'applying' });
    expect(applyingHtml).toContain('apply-a');
    expect(applyingHtml).toContain('apply-b');
    expect(applyingHtml).not.toContain('plan-a');
    expect(applyingHtml).not.toContain('old-one');

    const archivedHtml = renderSection({}, { lifecycleStatus: 'archived' });
    expect(archivedHtml).toContain('old-one');
    expect(archivedHtml).toContain('data-archived-card');
    expect(archivedHtml).not.toContain('plan-a');
  });

  it('notifies onChange when a wide segment is activated', () => {
    const onChange = vi.fn();
    const tree = ChangeStatusFilter({
      variant: 'segments',
      value: 'all',
      counts: HOST_COUNTS,
      onChange,
    });
    const buttons: ReactElement[] = [];
    walkElements(tree, (el) => {
      if (el.type === 'button' && (el.props as { 'data-lifecycle-status'?: string })['data-lifecycle-status']) {
        buttons.push(el);
      }
    });
    expect(buttons.length).toBe(6);

    for (const button of buttons) {
      const status = (button.props as { 'data-lifecycle-status': string })['data-lifecycle-status'];
      (button.props as { onClick: () => void }).onClick();
      expect(onChange).toHaveBeenCalledWith(status);
    }
  });
});

describe('Task 4.2 narrow compact status selector', () => {
  it('renders a compact selector with the same options and counts', () => {
    const html = renderSection({ layout: 'narrow' });

    expect(html).toContain('aria-label="Filter by lifecycle status"');
    expect(html).toContain('All (17)');
    expect(html).toContain('Planning (5)');
    expect(html).toContain('Ready to Apply (3)');
    expect(html).toContain('Applying (4)');
    expect(html).toContain('Ready to Verify (2)');
    expect(html).toContain('Archived (3)');
  });

  it('keeps the selected value identical to the wide control', () => {
    const onChange = vi.fn();
    const tree = ChangeStatusFilter({
      variant: 'compact',
      value: 'applying',
      counts: HOST_COUNTS,
      onChange,
    });
    let selectEl: ReactElement | null = null;
    walkElements(tree, (el) => {
      if (el.type === 'select') selectEl = el;
    });
    expect(selectEl).not.toBeNull();
    expect((selectEl!.props as { value: string }).value).toBe('applying');
    (selectEl!.props as { onChange: (e: { target: { value: string } }) => void }).onChange({
      target: { value: 'ready-to-verify' },
    });
    expect(onChange).toHaveBeenCalledWith('ready-to-verify');
  });
});

describe('Task 4.3 sort and Needs Attention filters', () => {
  it('renders sort control and Needs Attention toggle outside the segment bar', () => {
    const html = renderSection();
    expect(html).toContain('aria-label="Sort changes"');
    expect(html).toContain('Needs Attention');
    expect(html).toMatch(/Needs Attention[^]*\(2\)|Needs Attention \(2\)/);
  });

  it('combines Needs Attention with the selected lifecycle status', () => {
    const html = renderSection({}, { lifecycleStatus: 'applying', attentionOnly: true });
    expect(html).toContain('apply-a');
    expect(html).not.toContain('apply-b');
    expect(html).not.toContain('plan-a');
  });

  it('resets page through the reducer when sort or attention changes', () => {
    const base = { ...DEFAULT_CHANGES_VIEW_STATE, page: 3 };
    expect(changesViewReducer(base, { type: 'SET_SORT', sort: 'name-asc' }).page).toBe(1);
    expect(changesViewReducer(base, { type: 'SET_ATTENTION_FILTER', attentionOnly: true }).page).toBe(1);
  });
});

describe('Task 4.4 pagination controls', () => {
  const manyChanges = Array.from({ length: 12 }, (_, i) =>
    makeChange(`change-${String(i).padStart(2, '0')}`, 'planning', {
      lastModified: `2026-06-${String(14 - (i % 10)).padStart(2, '0')}T12:00:00.000Z`,
    })
  );

  it('shows result range, page size options, and disabled prev/next when one page', () => {
    const html = renderSection(
      {
        changes: manyChanges.slice(0, 4),
        archivedItems: [],
        changeStatusCounts: { ...HOST_COUNTS, all: 4, planning: 4, archived: 0 },
      },
      { pageSize: 10 }
    );

    expect(html).toMatch(/Showing 1[–-]4 of 4|1[–-]4 of 4/);
    expect(html).toContain('disabled');
    expect(html).toContain('aria-label="Previous page"');
    expect(html).toContain('aria-label="Next page"');
    expect(html).toContain('aria-label="Items per page"');
  });

  it('shows middle-page range and enabled navigation when multiple pages exist', () => {
    const html = renderSection(
      {
        changes: manyChanges,
        archivedItems: [],
        changeStatusCounts: { ...HOST_COUNTS, all: 12, planning: 12, archived: 0 },
      },
      { page: 2, pageSize: 5 }
    );

    expect(html).toMatch(/Showing 6[–-]10 of 12|6[–-]10 of 12/);
    expect(html).toContain('change-05');
  });
});

describe('Task 4.5 page resets when filters change', () => {
  it('resets page for status, attention, query, sort, and pageSize actions', () => {
    const base = { ...DEFAULT_CHANGES_VIEW_STATE, page: 4 };
    expect(changesViewReducer(base, { type: 'SET_LIFECYCLE_FILTER', lifecycleStatus: 'planning' })).toMatchObject({
      lifecycleStatus: 'planning',
      page: 1,
    });
    expect(changesViewReducer(base, { type: 'SET_ATTENTION_FILTER', attentionOnly: true }).page).toBe(1);
    expect(changesViewReducer(base, { type: 'SET_QUERY', query: 'x' }).page).toBe(1);
    expect(changesViewReducer(base, { type: 'SET_SORT', sort: 'created-desc' }).page).toBe(1);
    expect(changesViewReducer(base, { type: 'SET_PAGE_SIZE', pageSize: 50 }).page).toBe(1);
  });

  it('renders page 1 results after a filter view-state change from a later page', () => {
    const many = Array.from({ length: 15 }, (_, i) =>
      makeChange(`item-${i}`, i < 5 ? 'planning' : 'applying')
    );
    const html = renderSection(
      {
        changes: many,
        archivedItems: [],
        changeStatusCounts: {
          all: 15,
          planning: 5,
          readyToApply: 0,
          applying: 10,
          readyToVerify: 0,
          archived: 0,
          needsAttention: 0,
        },
      },
      { lifecycleStatus: 'planning', page: 1, pageSize: 10 }
    );
    expect(html).toMatch(/Showing 1[–-]5 of 5|1[–-]5 of 5/);
    expect(html).toContain('item-0');
    expect(html).not.toContain('item-9');
  });
});

describe('Task 4.6 accessibility', () => {
  it('exposes accessible names, pressed state, and focusable controls', () => {
    const html = renderSection({}, { lifecycleStatus: 'planning' });

    expect(html).toContain('aria-label="Filter by lifecycle status"');
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('aria-label="Search changes"');
    expect(html).toContain('aria-label="Sort changes"');
    expect(html).toContain('aria-label="Needs Attention filter"');
    expect(html).toContain('aria-label="Previous page"');
    expect(html).toContain('aria-label="Next page"');
    expect(html).toContain('focus:ring');
    expect(html).toContain('title=');
  });
});

describe('Task 4.7 filter empty states', () => {
  it('shows lifecycle-specific empty copy with New Change for non-archived filters', () => {
    const cases: Array<{ status: ChangesViewState['lifecycleStatus']; message: string }> = [
      { status: 'planning', message: 'No Planning changes' },
      { status: 'ready-to-apply', message: 'No Ready to Apply changes' },
      { status: 'applying', message: 'No Applying changes' },
      { status: 'ready-to-verify', message: 'No Ready to Verify changes' },
    ];

    for (const { status, message } of cases) {
      const html = renderSection(
        {
          changes: [],
          archivedItems: [],
          changeStatusCounts: {
            all: 0,
            planning: 0,
            readyToApply: 0,
            applying: 0,
            readyToVerify: 0,
            archived: 0,
            needsAttention: 0,
          },
        },
        { lifecycleStatus: status }
      );
      expect(html).toContain(message);
      expect(html).toContain('Create New Change');
    }
  });

  it('does not offer create actions for archived empty state', () => {
    const html = renderSection(
      {
        changes: SAMPLE_CHANGES,
        archivedItems: [],
        changeStatusCounts: { ...HOST_COUNTS, archived: 0, all: 14 },
      },
      { lifecycleStatus: 'archived' }
    );
    expect(html).toContain('No Archived changes');
    expect(html).not.toContain('Create New Change');
  });

  it('shows search/filter empty when query matches nothing', () => {
    const html = renderSection({}, { query: 'zzz-no-match' });
    expect(html).toContain('No changes match the current search and filters');
  });

  it('does not render the legacy archived accordion alongside the pipeline', () => {
    const html = renderSection({
      archivedItems: SAMPLE_ARCHIVES,
    });
    expect(html).not.toContain('▶');
    expect(html).toContain('old-one');
  });
});

describe('Task 5.5 root-scoped archived isolation', () => {
  it('shows only archived items from the current root snapshot', () => {
    const localArchives = [makeArchive('local-only')];
    const storeArchives = [makeArchive('store-only')];

    const localHtml = renderSection(
      {
        archivedItems: localArchives,
        rootLabel: 'Local Root',
        changeStatusCounts: { ...HOST_COUNTS, archived: 1, all: 7 },
      },
      { lifecycleStatus: 'archived' }
    );
    expect(localHtml).toContain('local-only');
    expect(localHtml).not.toContain('store-only');

    const storeHtml = renderSection(
      {
        archivedItems: storeArchives,
        rootLabel: 'Store: team-plans',
        changeStatusCounts: { ...HOST_COUNTS, archived: 1, all: 7 },
      },
      { lifecycleStatus: 'archived' }
    );
    expect(storeHtml).toContain('store-only');
    expect(storeHtml).not.toContain('local-only');
  });

  it('keeps host archived counts independent from another root snapshot', () => {
    const html = renderSection({
      archivedItems: [makeArchive('current-root-arch')],
      changeStatusCounts: {
        all: 7,
        planning: 5,
        readyToApply: 3,
        applying: 4,
        readyToVerify: 2,
        archived: 1,
        needsAttention: 2,
      },
    });

    expect(html).toContain('Archived 1');
    expect(html).not.toContain('old-two');
    expect(html).not.toContain('old-three');
  });
});

describe('Task 7 root-scoped view state clamp', () => {
  const manyPlanning = Array.from({ length: 12 }, (_, i) =>
    makeChange(`plan-${String(i).padStart(2, '0')}`, 'planning')
  );

  it('renders the last valid page when restored page is out of range', () => {
    const html = renderSection(
      {
        changes: manyPlanning.slice(0, 3),
        archivedItems: [],
        changeStatusCounts: { ...HOST_COUNTS, all: 3, planning: 3, archived: 0 },
      },
      { page: 5, pageSize: 10, sort: 'name-asc' }
    );

    expect(html).toMatch(/Showing 1[–-]3 of 3|1[–-]3 of 3/);
    expect(html).toContain('plan-00');
    expect(html).not.toContain('No changes match');
  });

  it('computes a clamped page update that preserves filters for matching-scope data', () => {
    const state = {
      ...DEFAULT_CHANGES_VIEW_STATE,
      lifecycleStatus: 'planning' as const,
      query: 'keep-query',
      sort: 'name-asc' as const,
      page: 5,
      pageSize: 10 as const,
    };
    // Fewer matching items than the restored page; clamp preserves query/sort.
    const pageResult = buildVisibleChangePage(
      buildChangeListItems(
        [
          makeChange('keep-query-a', 'planning'),
          makeChange('keep-query-b', 'planning'),
          makeChange('other', 'planning'),
        ],
        []
      ),
      state
    );
    expect(pageResult.page).toBe(1);
    expect(pageResult.totalItems).toBe(2);

    const clamped = maybeClampChangesViewPage(state, pageResult.page, true);
    expect(clamped).toEqual({
      ...state,
      page: 1,
    });

    expect(maybeClampChangesViewPage(state, pageResult.page, false)).toBeNull();
  });
});
