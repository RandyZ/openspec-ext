# Task 5. Archived 一级状态迁移

<!-- covers: Task 5.1, Task 5.2, Task 5.3, Task 5.4, Task 5.5 -->

## Objective

将 Archived 从旧的底部 accordion 迁移为与生命周期状态并列的只读列表项，同时保持 Root 隔离和详情打开能力。

### Task 5.1: 将 Archived 数据接入 `ChangeListItemView`

**Spec coverage:** dashboard Archived first-class list requirement.
**Dependencies / order:** after Tasks 2.3 and 3.1; before Archived filtering.
**Files:** Modify `src/webview/components/ChangesSection.tsx`, `src/webview/types/changeList.ts`; Test `test/webview/utils/changeListPipeline.test.ts`.
**Implementation notes:** adapt `DashboardData.archivedChanges` into the same list model with lifecycle `archived` and `readOnly: true`.
**Verification:** archived fixture appears in the All pipeline without a second data fetch.
**Risks / edge cases:** missing archive date uses the documented fallback label, never the current date.
- [ ] Step 1: Add a failing archived-adapter test.
- [ ] Step 2: Run `pnpm test -- test/webview/utils/changeListPipeline.test.ts`; expect FAIL.
- [ ] Step 3: Implement the adapter and include it in the list source.
- [ ] Step 4: Re-run; expect PASS with `readOnly` set.

### Task 5.2: 在 `All` 和 `Archived` 状态中支持归档名称/日期搜索、排序和分页

**Spec coverage:** dashboard Archived search, sort, and pagination scenarios.
**Dependencies / order:** after Tasks 3.3–3.6 and 5.1.
**Files:** Modify `src/webview/utils/changeListPipeline.ts`; Test `test/webview/utils/changeListPipeline.test.ts`.
**Implementation notes:** All merges active and archived before filtering; Archived selects only archived entries and uses name/date fields for search and sort.
**Verification:** mixed fixture asserts identical pipeline ordering rules in both modes.
**Risks / edge cases:** pagination is applied after the merged/filtered set, never per source array.
- [ ] Step 1: Add failing mixed-mode search/sort/page tests.
- [ ] Step 2: Run focused tests; expect FAIL on merged ordering.
- [ ] Step 3: Correct mode selection and field adapters.
- [ ] Step 4: Re-run; expect PASS for All and Archived.

### Task 5.3: 保留归档详情打开行为并确保所有归档卡片只读

**Spec coverage:** dashboard Archived read-only and detail-opening scenarios.
**Dependencies / order:** after Tasks 5.1–5.2 and before removing the old section.
**Files:** Modify `src/webview/components/ChangeCard.tsx`, `src/webview/components/ChangesSection.tsx`; Test `test/webview/components/changeCard.test.tsx`.
**Implementation notes:** clicking an archived card still opens its detail route; hide task toggles, archive, and workflow write actions.
**Verification:** component test asserts navigation callback and absence of write controls.
**Risks / edge cases:** opening details is read-only navigation and must remain available.
- [ ] Step 1: Add failing read-only card tests.
- [ ] Step 2: Run focused test; expect FAIL on action visibility.
- [ ] Step 3: Gate write controls on `readOnly` while preserving navigation.
- [ ] Step 4: Re-run; expect PASS for both behaviors.

### Task 5.4: 删除 ChangesSection 底部旧 Archived accordion

**Spec coverage:** dashboard Archived migration scenario.
**Dependencies / order:** after Task 5.3; only remove code once the new list path is covered.
**Files:** Modify `src/webview/components/ChangesSection.tsx`; Test `test/webview/components/changesSection.test.tsx`.
**Implementation notes:** remove the legacy accordion markup, state, and duplicate empty handling; retain the first-class Archived selector.
**Verification:** test asserts no legacy accordion label while Archived selector remains.
**Risks / edge cases:** avoid deleting shared detail-opening or refresh callbacks used by active cards.
- [ ] Step 1: Add failing regression assertion for the old accordion.
- [ ] Step 2: Run focused test; expect FAIL while legacy markup exists.
- [ ] Step 3: Remove only the obsolete accordion branch.
- [ ] Step 4: Re-run; expect PASS with new Archived path intact.

### Task 5.5: 增加 Local Root 与 Store Root 归档隔离测试

**Spec coverage:** dashboard Root-scoped Archived isolation scenario.
**Dependencies / order:** last Archived task; after Scope-aware refresh work.
**Files:** Test `test/extension/services/openspecScope.test.ts`, `test/webview/components/changesSection.test.tsx`.
**Implementation notes:** use two explicit Root snapshots and assert neither archived list nor counts leak across scopes.
**Verification:** `pnpm test -- test/extension/services/openspecScope.test.ts test/webview/components/changesSection.test.tsx` passes.
**Risks / edge cases:** stale asynchronous refresh results must not repopulate the previous Root.
- [ ] Step 1: Add failing two-Root archived isolation tests.
- [ ] Step 2: Run both focused files; expect FAIL on leakage.
- [ ] Step 3: Fix scope binding or test fixtures at the owning layer.
- [ ] Step 4: Re-run; expect PASS with isolated archived data.
