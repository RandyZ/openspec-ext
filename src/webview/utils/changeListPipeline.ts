import type { ChangeLifecycleStatus } from '../../shared/changeLifecycle';
import type { ChangesViewState } from '../state/changesViewState';
import type { ChangeListItemView } from '../types/changeList';

export interface PaginatedChangeResult {
  items: ChangeListItemView[];
  totalItems: number;
  totalPages: number;
  page: number;
  startIndex: number;
  endIndex: number;
}

function activeSearchHaystack(item: Extract<ChangeListItemView, { kind: 'active' }>): string {
  const change = item.change;
  const artifacts = (change.artifacts ?? [])
    .map((artifact) => `${artifact.id} ${artifact.status}`)
    .join(' ');

  return [
    change.name,
    change.lifecycleStatus,
    artifacts,
    change.proposalWhySummary,
    change.proposalWhyFullText,
    change.createdAt,
    change.lastModified,
    change.searchText,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function archivedSearchHaystack(item: Extract<ChangeListItemView, { kind: 'archived' }>): string {
  const archive = item.archive;
  return [
    archive.name,
    archive.directoryName,
    archive.archiveDate,
    'archived',
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function itemSearchHaystack(item: ChangeListItemView): string {
  return item.kind === 'active' ? activeSearchHaystack(item) : archivedSearchHaystack(item);
}

function parseDate(value: string | undefined): number | null {
  if (!value) {
    return null;
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function getUpdatedTimestamp(item: ChangeListItemView): number | null {
  if (item.kind === 'active') {
    return parseDate(item.change.lastModified);
  }
  return parseDate(item.archive.archiveDate);
}

function getCreatedTimestamp(item: ChangeListItemView): number | null {
  if (item.kind === 'active') {
    return parseDate(item.change.createdAt) ?? parseDate(item.change.lastModified);
  }
  return parseDate(item.archive.archiveDate);
}

function compareMissingDatesLast(
  left: number | null,
  right: number | null,
  direction: 'asc' | 'desc'
): number {
  if (left === null && right === null) {
    return 0;
  }
  if (left === null) {
    return 1;
  }
  if (right === null) {
    return -1;
  }
  return direction === 'asc' ? left - right : right - left;
}

function compareNames(left: ChangeListItemView, right: ChangeListItemView): number {
  const leftName = left.kind === 'active' ? left.change.name : left.archive.name;
  const rightName = right.kind === 'active' ? right.change.name : right.archive.name;
  return leftName.localeCompare(rightName);
}

export function filterByLifecycle(
  items: readonly ChangeListItemView[],
  lifecycleStatus: ChangeLifecycleStatus | 'all'
): ChangeListItemView[] {
  if (lifecycleStatus === 'all') {
    return [...items];
  }
  return items.filter((item) => item.lifecycleStatus === lifecycleStatus);
}

export function filterByAttention(
  items: readonly ChangeListItemView[],
  attentionOnly: boolean
): ChangeListItemView[] {
  if (!attentionOnly) {
    return [...items];
  }
  return items.filter(
    (item) => item.kind === 'active' && item.change.attention?.required === true
  );
}

export function searchItems(
  items: readonly ChangeListItemView[],
  query: string
): ChangeListItemView[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return [...items];
  }

  const terms = normalizedQuery.split(/\s+/).filter(Boolean);
  return items.filter((item) => {
    const haystack = itemSearchHaystack(item);
    return terms.every((term) => haystack.includes(term));
  });
}

export function sortItems(
  items: readonly ChangeListItemView[],
  sort: ChangesViewState['sort']
): ChangeListItemView[] {
  const indexed = items.map((item, index) => ({ item, index }));

  indexed.sort((left, right) => {
    let comparison = 0;

    switch (sort) {
      case 'updated-desc':
        comparison = compareMissingDatesLast(
          getUpdatedTimestamp(left.item),
          getUpdatedTimestamp(right.item),
          'desc'
        );
        break;
      case 'updated-asc':
        comparison = compareMissingDatesLast(
          getUpdatedTimestamp(left.item),
          getUpdatedTimestamp(right.item),
          'asc'
        );
        break;
      case 'created-desc':
        comparison = compareMissingDatesLast(
          getCreatedTimestamp(left.item),
          getCreatedTimestamp(right.item),
          'desc'
        );
        break;
      case 'name-asc':
        comparison = compareNames(left.item, right.item);
        break;
      default:
        comparison = 0;
    }

    if (comparison !== 0) {
      return comparison;
    }

    return left.index - right.index;
  });

  return indexed.map((entry) => entry.item);
}

export function paginate(
  items: readonly ChangeListItemView[],
  page: number,
  pageSize: number
): PaginatedChangeResult {
  const totalItems = items.length;
  const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / pageSize);

  if (totalItems === 0) {
    return {
      items: [],
      totalItems: 0,
      totalPages: 0,
      page: 1,
      startIndex: 0,
      endIndex: 0,
    };
  }

  const clampedPage = Math.max(1, Math.min(page, totalPages));
  const startOffset = (clampedPage - 1) * pageSize;
  const pageItems = items.slice(startOffset, startOffset + pageSize);

  return {
    items: pageItems,
    totalItems,
    totalPages,
    page: clampedPage,
    startIndex: startOffset + 1,
    endIndex: startOffset + pageItems.length,
  };
}

export function buildVisibleChangePage(
  items: readonly ChangeListItemView[],
  state: ChangesViewState
): PaginatedChangeResult {
  const byStatus = filterByLifecycle(items, state.lifecycleStatus);
  const byAttention = filterByAttention(byStatus, state.attentionOnly);
  const byQuery = searchItems(byAttention, state.query);
  const sorted = sortItems(byQuery, state.sort);
  return paginate(sorted, state.page, state.pageSize);
}
