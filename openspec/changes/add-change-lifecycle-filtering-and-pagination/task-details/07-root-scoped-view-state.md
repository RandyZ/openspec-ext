# Task 7. Root 级视图状态

<!-- covers: Task 7.1, Task 7.2, Task 7.3, Task 7.4, Task 7.5 -->

## Objective

防止 Local Root 和 Store Root 共用同一套筛选、搜索和分页状态。

## State Shape

```ts
export interface PersistedDashboardState {
  changesViews?: Record<string, ChangesViewState>;
}
```

## Stable Root Key

```ts
export function getChangesViewRootKey(scope: OpenSpecScopeView): string {
  return [
    scope.source,
    scope.id,
    scope.storeId ?? '',
    scope.rootPath,
  ].join('::');
}
```

## Default State

```ts
{
  lifecycleStatus: 'all',
  attentionOnly: false,
  query: '',
  sort: 'updated-desc',
  page: 1,
  pageSize: 10
}
```

## Lifecycle

```text
dashboard opens
→ get vscode state
→ resolve current root key
→ restore state or defaults

state changes
→ update current root entry
→ vscode.setState

scope switching
→ current root entry already persisted
→ resolve target root key
→ restore target state
→ clamp page after target data arrives
```

## Race Handling

When scope changes while data is refreshing:

- view state is keyed by the selected target root;
- old scope data must not cause target state to be clamped;
- clamp only when data and scope id match.

## Tests

- Local Applying/page 2 and Store Ready to Verify/page 1 stay independent.
- Reload restores both.
- New Root uses defaults.
- Removed Root state is harmless.
- Refresh reducing item count clamps page.
- Stale old-root response does not mutate target-root state.

## Done When

Switching roots restores each root's last Changes view without cross-contamination.

## Execution details

### Task 7.1: 实现稳定的 Root view-state key

**Spec coverage:** dashboard Root-scoped state key requirement.
**Dependencies / order:** after the list state shape exists; before persistence.
**Files:** Modify `src/webview/state/changesViewState.ts`; Test `test/webview/components/scopeBar.test.tsx`.
**Implementation notes:** derive a deterministic key from the resolved Root identity and Store/local discriminator; do not use display labels alone.
**Verification:** equivalent Root descriptors produce the same key; distinct Roots do not.
**Risks / edge cases:** path normalization and Store ids must not collide.
- [ ] Step 1: Add failing key-collision tests.
- [ ] Step 2: Run focused test; expect FAIL on unstable keys.
- [ ] Step 3: Implement canonical key construction.
- [ ] Step 4: Re-run; expect PASS for same/different Root cases.

### Task 7.2: 使用 VS Code Webview state 保存每个 Root 的筛选、查询、排序、页码和 pageSize

**Spec coverage:** dashboard persistence requirement.
**Dependencies / order:** after Task 7.1 and `ChangesViewState`.
**Files:** Modify `src/webview/hooks/useVscode.ts`, `src/webview/state/changesViewState.ts`; Test `test/webview/components/changesSection.test.tsx`.
**Implementation notes:** persist a map keyed by Root view-state key; serialize only validated state fields.
**Verification:** mocked `setState` receives one Root map and restores it on mount.
**Risks / edge cases:** corrupted persisted JSON must fall back to defaults without breaking render.
- [ ] Step 1: Add failing persistence/restore tests.
- [ ] Step 2: Run focused tests; expect FAIL on absent state writes.
- [ ] Step 3: Implement validated read/write helpers.
- [ ] Step 4: Re-run; expect PASS for persistence and fallback.

### Task 7.3: Root 切换时保存离开状态并恢复目标 Root 状态

**Spec coverage:** dashboard Root switch isolation scenario.
**Dependencies / order:** after Task 7.2; integrate with ScopeBar events.
**Files:** Modify `src/webview/components/Dashboard.tsx`, `src/webview/state/changesViewState.ts`; Test `test/webview/components/scopeBar.test.tsx`.
**Implementation notes:** commit current state before changing the active Root, then load target state or defaults.
**Verification:** two Root fixture switches restore independent query, filter, sort, and page values.
**Risks / edge cases:** switching while a refresh is pending must not overwrite the target state.
- [ ] Step 1: Add failing two-Root reducer/component test.
- [ ] Step 2: Run it; expect FAIL on cross-contamination.
- [ ] Step 3: Sequence save-before-switch and restore-after-switch.
- [ ] Step 4: Re-run; expect PASS for both Root snapshots.

### Task 7.4: 数据刷新后对恢复页码执行 clamp

**Spec coverage:** dashboard refresh/page clamp scenario.
**Dependencies / order:** after Task 7.3 and pipeline clamp helper.
**Files:** Modify `src/webview/components/ChangesSection.tsx`; Test `test/webview/components/changesSection.test.tsx`.
**Implementation notes:** when filtered result count shrinks, clamp restored page and persist the clamped value for that Root.
**Verification:** a restored page beyond `pageCount` renders the last valid page and updates state once.
**Risks / edge cases:** do not reset query or sort when only page is clamped.
- [ ] Step 1: Add failing refresh-with-fewer-items test.
- [ ] Step 2: Run focused test; expect FAIL on out-of-range page.
- [ ] Step 3: Apply pure clamp after pipeline evaluation.
- [ ] Step 4: Re-run; expect PASS with preserved filters.

### Task 7.5: 为两个 Root 的独立筛选和分页状态编写 reducer/组件测试

**Spec coverage:** dashboard Root isolation and refresh scenarios.
**Dependencies / order:** last Root state task; gates final integration.
**Files:** Test `test/webview/components/changesSection.test.tsx`, `test/webview/components/scopeBar.test.tsx`.
**Implementation notes:** cover independent state maps, save/restore order, malformed state, and page clamp.
**Verification:** `pnpm test -- test/webview/components/changesSection.test.tsx test/webview/components/scopeBar.test.tsx` passes.
**Risks / edge cases:** asynchronous stale responses must be ignored by Root key.
- [ ] Step 1: Add failing reducer matrix for two Roots.
- [ ] Step 2: Run focused tests; expect FAIL on at least one isolation case.
- [ ] Step 3: Fix reducer/effect sequencing without changing domain rules.
- [ ] Step 4: Re-run; expect PASS for the complete matrix.
