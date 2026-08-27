# Task 3. Change 列表视图模型与管线

<!-- covers: Task 3.1, Task 3.2, Task 3.3, Task 3.4, Task 3.5, Task 3.6 -->

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

## Execution details

### Task 3.1: 新增 `ChangeListItemView`，分别适配 Active Change 和 Archived Change

**Spec coverage:** dashboard active/archived list adapter requirement.
**Dependencies / order:** after Host contract; before pipeline and UI work.
**Files:** Create `src/webview/types/changeList.ts`; Modify `src/webview/components/ChangesSection.tsx`; Test `test/webview/utils/filterChanges.test.ts`.
**Implementation notes:** normalize display title, date, read-only flag, lifecycle, and attention without losing the source change name.
**Verification:** active and archived fixtures produce the same renderable shape with `readOnly` true for Archived.
**Risks / edge cases:** archived records may lack task fields; adapter must supply safe defaults.
- [ ] Step 1: Add failing adapter assertions for both source variants.
- [ ] Step 2: Run focused test; expect FAIL because the view model is absent.
- [ ] Step 3: Implement the two adapters and shared type.
- [ ] Step 4: Re-run; expect PASS for normalized output.

### Task 3.2: 新增 `ChangesViewState` 和默认值

**Spec coverage:** dashboard Root-scoped state and filter defaults.
**Dependencies / order:** after Task 3.1; consumed by all pipeline/UI tasks.
**Files:** Create `src/webview/state/changesViewState.ts`; Test `test/webview/utils/filterChanges.test.ts`.
**Implementation notes:** include status, attention, query, sort, page, and pageSize; default to All, no attention filter, empty query, stable sort, page 1.
**Verification:** default state is serializable and independent for each Root.
**Risks / edge cases:** page and pageSize must be clamped when restoring malformed persisted state.
- [ ] Step 1: Write failing default-state and normalization tests.
- [ ] Step 2: Run focused tests; expect FAIL on missing state helpers.
- [ ] Step 3: Implement typed defaults and normalization.
- [ ] Step 4: Re-run; expect PASS for valid and malformed persisted values.

### Task 3.3: 在 `src/webview/utils/changeListPipeline.ts` 实现状态筛选、Attention、搜索、排序、分页纯函数

**Spec coverage:** dashboard filter pipeline requirement.
**Dependencies / order:** after Tasks 3.1–3.2.
**Files:** Create `src/webview/utils/changeListPipeline.ts`; Test `test/webview/utils/changeListPipeline.test.ts`.
**Implementation notes:** enforce order: status → Needs Attention → search → sort → paginate; keep the function side-effect free.
**Verification:** each stage is observable through returned items and total count.
**Risks / edge cases:** search must cover name/title and Archived date text only where specified.
- [ ] Step 1: Add failing order-sensitive pipeline tests.
- [ ] Step 2: Run the focused test; expect FAIL because the function is absent.
- [ ] Step 3: Implement the smallest composable pipeline.
- [ ] Step 4: Re-run; expect PASS with deterministic output.

### Task 3.4: 实现页码 clamp 和结果范围计算

**Spec coverage:** dashboard pagination boundary scenarios.
**Dependencies / order:** after Task 3.3.
**Files:** Modify `src/webview/utils/changeListPipeline.ts`; Test `test/webview/utils/changeListPipeline.test.ts`.
**Implementation notes:** clamp page to at least 1 and at most `pageCount`; return zero-based start/end only for non-empty results.
**Verification:** empty, exact-boundary, and out-of-range cases return correct range labels.
**Risks / edge cases:** pageSize must be validated before pageCount is calculated.
- [ ] Step 1: Add failing range tests for zero and overflow pages.
- [ ] Step 2: Run focused tests; expect FAIL on boundary assertions.
- [ ] Step 3: Implement clamp/range helpers.
- [ ] Step 4: Re-run; expect PASS for all boundaries.

### Task 3.5: 为“先筛选后分页”、搜索、排序和 pageSize 编写单元测试

**Spec coverage:** dashboard pipeline scenarios for filter order, search, sort, and page size.
**Dependencies / order:** after Tasks 3.3–3.4; before UI integration.
**Files:** Test `test/webview/utils/changeListPipeline.test.ts`.
**Implementation notes:** use datasets larger than one page and assert filtered totals independently from visible items.
**Verification:** `pnpm test -- test/webview/utils/changeListPipeline.test.ts` passes.
**Risks / edge cases:** stable tie-breaking must make repeated runs identical.
- [ ] Step 1: Add failing regression cases for filter-before-page and sort ties.
- [ ] Step 2: Run focused tests; expect FAIL on at least one regression.
- [ ] Step 3: Fix only pipeline/test helpers needed to encode the contract.
- [ ] Step 4: Re-run; expect PASS for all regression cases.

### Task 3.6: 为 All 合并 Archived 和 Archived 只读视图编写单元测试

**Spec coverage:** dashboard All and Archived requirements.
**Dependencies / order:** after Tasks 3.1–3.5.
**Files:** Test `test/webview/utils/changeListPipeline.test.ts`.
**Implementation notes:** All receives active plus archived adapters; Archived filters to read-only archived entries and never emits write actions.
**Verification:** mixed fixtures assert membership, ordering, and `readOnly` semantics.
**Risks / edge cases:** duplicate names across active and archived entries must remain distinct by source identity.
- [ ] Step 1: Add failing mixed active/archived cases.
- [ ] Step 2: Run focused tests; expect FAIL on merge or read-only behavior.
- [ ] Step 3: Correct adapters/pipeline selectors.
- [ ] Step 4: Re-run; expect PASS for All and Archived views.
