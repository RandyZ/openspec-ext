# Task 4. 状态筛选与分页 UI

<!-- covers: Task 4.1, Task 4.2, Task 4.3, Task 4.4, Task 4.5, Task 4.6, Task 4.7 -->

## Objective

在 Editor 和 Sidebar 中提供一致、可访问的 Change 状态管理体验。

## Editor Layout

```text
Changes                                  [New Change] [Add Operation]
17 total · Local ./openspec · Healthy

[All 17] [Planning 5] [Ready 3] [Applying 4] [Verify 2] [Archived 3]

[Search changes...] [Sort: Updated desc] [More Filters]

Cards...

Showing 1–10 of 17                      [<] [1] [2] [>]
```

## Sidebar Layout

```text
Changes

[Status: Applying (4) v]
[Search...]
[Sort v] [Filter]

Cards...

1–4 of 4
```

## Components

Recommended split:

```text
ChangeStatusFilter.tsx
ChangeAdvancedFilters.tsx
ChangePagination.tsx
ArchivedChangeCard.tsx
```

`ChangesSection` coordinates them but does not contain lifecycle business rules.

## Interaction Rules

- Lifecycle status is single-select.
- Needs Attention is a combinable boolean filter.
- Selecting status resets page to 1.
- Changing query resets page to 1.
- Changing sort resets page to 1.
- Changing pageSize resets page to 1.
- Status counts come from `DashboardData.changeStatusCounts`.
- Disabled pagination controls must use real `disabled`.
- Selected status uses `aria-current` or `aria-pressed`.
- Compact select must have an accessible label.

## Archived

- Archived card is visibly read-only.
- No workflow action area.
- Click opens archived detail.
- All view may mix Archived with Active cards according to current sort.

## Empty States

Differentiate:

```text
No changes in this Root
No Planning changes
No Ready to Apply changes
No Applying changes
No Ready to Verify changes
No Archived changes
No changes match the current search and filters
```

## Responsive Threshold

Prefer CSS container behavior over hard-coded global window assumptions. If the existing webview does not use container queries, a small responsive breakpoint is acceptable.

## Done When

- Wide and narrow layouts expose the same statuses.
- Status filter is visible without opening More Filters.
- Pagination communicates total filtered results.
- Keyboard-only flow is complete.

## Execution details

### Task 4.1: 在 Editor 宽屏实现生命周期 segmented controls 和全量状态计数

**Spec coverage:** dashboard wide-layout status controls and count scenarios.
**Dependencies / order:** after Tasks 2.2 and 3.2; consumes Host counts and view state.
**Files:** Modify `src/webview/components/ChangesSection.tsx`; Test `test/webview/components/changesSection.test.tsx`.
**Implementation notes:** render All, four active lifecycle states, Archived, and Needs Attention count from `DashboardData.changeStatusCounts`.
**Verification:** wide-layout test selects each segment and observes the corresponding state update.
**Risks / edge cases:** count display must not change when the current page is filtered.
- [ ] Step 1: Add failing render/selection assertions for segmented controls.
- [ ] Step 2: Run focused component test; expect FAIL on missing controls.
- [ ] Step 3: Implement controls wired to `ChangesViewState`.
- [ ] Step 4: Re-run; expect PASS with host-provided counts.

### Task 4.2: 在 Sidebar 窄屏实现紧凑状态 selector

**Spec coverage:** dashboard responsive Sidebar selector scenario.
**Dependencies / order:** after Task 4.1; share the same state actions.
**Files:** Modify `src/webview/components/ChangesSection.tsx`; Test `test/webview/components/changesSection.test.tsx`.
**Implementation notes:** use the existing compact control primitives and preserve all lifecycle options at narrow widths.
**Verification:** responsive test renders one selector without horizontal overflow.
**Risks / edge cases:** do not fork status labels or semantics between Sidebar and Editor.
- [ ] Step 1: Add failing narrow-layout selector test.
- [ ] Step 2: Run it; expect FAIL on responsive rendering.
- [ ] Step 3: Add the compact selector using shared options.
- [ ] Step 4: Re-run; expect PASS and identical selected value.

### Task 4.3: 实现排序控件和 `Needs Attention` 高级筛选

**Spec coverage:** dashboard attention and sorting requirements.
**Dependencies / order:** after Tasks 3.2–3.3.
**Files:** Modify `src/webview/components/ChangesSection.tsx`; Test `test/webview/components/changesSection.test.tsx`.
**Implementation notes:** expose stable sort choices and a boolean attention toggle; changing either resets page through the reducer.
**Verification:** test checks query parameters passed to the pure pipeline.
**Risks / edge cases:** Attention is orthogonal to lifecycle status and must not replace the selected status.
- [ ] Step 1: Add failing interaction tests for sort and attention.
- [ ] Step 2: Run focused test; expect FAIL on state transitions.
- [ ] Step 3: Wire controls to reducer actions.
- [ ] Step 4: Re-run; expect PASS with page reset.

### Task 4.4: 实现分页、每页数量、结果范围和禁用状态

**Spec coverage:** dashboard pagination controls and range scenarios.
**Dependencies / order:** after Task 3.4.
**Files:** Modify `src/webview/components/ChangesSection.tsx`; Test `test/webview/components/changesSection.test.tsx`.
**Implementation notes:** render current page, page count, page size, `showing X–Y of Z`, and disabled previous/next buttons.
**Verification:** component test covers empty, first, middle, and last pages.
**Risks / edge cases:** controls must remain disabled when `pageCount <= 1`.
- [ ] Step 1: Add failing pagination interaction cases.
- [ ] Step 2: Run focused tests; expect FAIL on range/disabled assertions.
- [ ] Step 3: Connect the pipeline result to controls.
- [ ] Step 4: Re-run; expect PASS for all page boundaries.

### Task 4.5: 状态、Attention、搜索、排序和 pageSize 变化时自动重置到第一页

**Spec coverage:** dashboard state transition requirement.
**Dependencies / order:** after Tasks 3.2 and 4.3–4.4.
**Files:** Modify `src/webview/state/changesViewState.ts`, `src/webview/components/ChangesSection.tsx`; Test `test/webview/components/changesSection.test.tsx`.
**Implementation notes:** reducer actions for status, attention, query, sort, and pageSize all set `page = 1`; page-only actions preserve other fields.
**Verification:** each control interaction asserts page reset.
**Risks / edge cases:** restoring a Root state is not a user filter change and should not reset twice.
- [ ] Step 1: Add failing reducer/component tests for every reset-triggering action.
- [ ] Step 2: Run focused tests; expect FAIL on stale page values.
- [ ] Step 3: Implement centralized reset semantics.
- [ ] Step 4: Re-run; expect PASS for all actions.

### Task 4.6: 为筛选控件和分页补充键盘操作、aria-label、focus 和 tooltip

**Spec coverage:** dashboard accessibility scenarios.
**Dependencies / order:** after controls exist; before final verification.
**Files:** Modify `src/webview/components/ChangesSection.tsx`; Test `test/webview/components/changesSection.test.tsx`.
**Implementation notes:** use semantic buttons/selects, visible focus styles, localized labels, and disabled-state tooltips.
**Verification:** keyboard-only test reaches every control and asserts accessible names.
**Risks / edge cases:** do not rely on color alone to communicate status or disabled state.
- [ ] Step 1: Add failing queries by role/name and keyboard navigation assertions.
- [ ] Step 2: Run focused tests; expect FAIL on missing semantics.
- [ ] Step 3: Add aria labels, focus handling, and tooltip content.
- [ ] Step 4: Re-run; expect PASS for accessibility assertions.

### Task 4.7: 增加各筛选状态的 Root 相关空状态

**Spec coverage:** dashboard empty-state requirement.
**Dependencies / order:** after Tasks 4.1–4.6 and Root state wiring.
**Files:** Modify `src/webview/components/EmptyState.tsx`, `src/webview/components/ChangesSection.tsx`; Test `test/webview/components/changesSection.test.tsx`.
**Implementation notes:** distinguish no changes in Root, no matches for current filters, and no archived entries; include reset-filter action where appropriate.
**Verification:** tests assert localized title, explanation, and action per state.
**Risks / edge cases:** empty Store Root must not mention Local Root data.
- [ ] Step 1: Add failing tests for each empty-state reason.
- [ ] Step 2: Run focused tests; expect FAIL on missing distinctions.
- [ ] Step 3: Implement state-specific empty content.
- [ ] Step 4: Re-run; expect PASS for all Root/filter combinations.
