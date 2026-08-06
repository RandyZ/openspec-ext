# Task Detail 03: Filter and Pagination Pipeline

## Objective

将列表处理顺序收敛为一个纯函数，保证筛选在分页前完成。

## Files

```text
src/webview/utils/changeListPipeline.ts
src/webview/types/changeList.ts
test/webview/changeListPipeline.test.ts
```

## Input

```ts
export interface ChangesViewState {
  lifecycleStatus: ChangeLifecycleStatus | 'all';
  attentionOnly: boolean;
  query: string;
  sort: 'updated-desc' | 'updated-asc' | 'created-desc' | 'name-asc';
  page: number;
  pageSize: 10 | 20 | 50;
}
```

## Required Order

```ts
function buildVisibleChangePage(
  items: ChangeListItemView[],
  state: ChangesViewState
): PaginatedChangeResult {
  const byStatus = filterByLifecycle(items, state.lifecycleStatus);
  const byAttention = filterByAttention(byStatus, state.attentionOnly);
  const byQuery = searchItems(byAttention, state.query);
  const sorted = sortItems(byQuery, state.sort);
  return paginate(sorted, state.page, state.pageSize);
}
```

No caller may slice the full data before this function.

## Search Fields

Active:

- name;
- lifecycle status;
- Artifact id/status;
- Proposal Why summary/full text;
- created/updated text.

Archived:

- name;
- directoryName;
- archiveDate;
- literal status `archived`.

## Sort Rules

- Missing date values sort after valid date values.
- Sorting must be stable.
- Archived `archiveDate` is used as updated/created fallback.
- Name sort uses locale-aware comparison.

## Pagination

Return:

```ts
{
  items,
  totalItems,
  totalPages,
  page,
  startIndex,
  endIndex
}
```

For zero results:

```text
totalPages = 0
page = 1
startIndex = 0
endIndex = 0
```

For out-of-range page:

```text
page = clamp(page, 1, max(1, totalPages))
```

## Tests

- 37 total, 11 Applying, page size 10 → Applying page 1 has 10, total 11.
- Search runs after status filter.
- Sort runs before page slice.
- page resets are reducer tests, not pipeline side effects.
- zero result.
- out-of-range page.
- mixed Active/Archived All view.
- stable sort with identical timestamps.

## Done When

The UI can render any status/page by calling one pure pipeline function.
