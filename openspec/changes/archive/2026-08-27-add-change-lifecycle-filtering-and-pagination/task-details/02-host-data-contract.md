# Task 2. Extension Host 数据契约

<!-- covers: Task 2.1, Task 2.2, Task 2.3, Task 2.4, Task 2.5, Task 2.6 -->

## Objective

由 Extension Host 发布完整、Root 隔离的生命周期状态和状态计数。

## Data Contract

```ts
export interface ChangeStatusCounts {
  all: number;
  planning: number;
  readyToApply: number;
  applying: number;
  readyToVerify: number;
  archived: number;
  needsAttention: number;
}

export interface DashboardData {
  changes: ChangeInfo[];
  archivedChanges: ArchivedChangeInfo[];
  changeStatusCounts: ChangeStatusCounts;
  // existing fields
}
```

## DataManager Flow

```text
list active changes for resolved scope
→ normalize artifacts/tasks
→ derive lifecycle
→ derive attention
→ list archives for same scope
→ count active + archived
→ publish dashboardData
```

## Scope Invariant

The following MUST share one resolved scope:

```text
changes
archivedChanges
changeStatusCounts
specs
```

A stale response from another scope must not overwrite current scope data.

## Filesystem Fallback

Fallback may not know a custom Schema's complete Artifact graph.

Rules:

- use existing fallback artifact list;
- do not infer Ready to Apply unless all known Schema artifacts are confidently done;
- when uncertain, prefer `planning`;
- do not mark uncertainty as an error unless data is structurally invalid.

## Count Function

Implement a pure count function:

```ts
buildChangeStatusCounts(activeChanges, archivedChanges)
```

`all` must equal:

```text
activeChanges.length + archivedChanges.length
```

`needsAttention` counts only Active Change attention in the first release unless archived diagnostics are explicitly available.

## Contract Tests

- current scope active and archived counts;
- local/store same-name Change isolation;
- stale scope response ignored;
- all = sum lifecycle buckets;
- fallback produces conservative state;
- malformed data produces Attention, not crash.

## Done When

- DashboardData always includes counts on production paths.
- Counts and list belong to the same Root.
- Webview does not recalculate lifecycle.

## Execution details

### Task 2.1: 扩展 `ChangeInfo`，新增 `lifecycleStatus` 和可选 `attention`，暂时保留 legacy `status`

**Spec coverage:** dashboard ChangeInfo data contract.
**Dependencies / order:** after Task 1.1; all downstream Host and Webview types depend on it.
**Files:** Modify `src/extension/types.ts` (or the current shared contract owner); Test `test/extension/services/dataManagerCliFallback.test.ts`.
**Implementation notes:** make `lifecycleStatus` required on production data and retain legacy `status` only for compatibility adapters.
**Verification:** contract fixture compiles and serializes both new and legacy fields.
**Risks / edge cases:** do not let Webview infer a missing lifecycle value.
- [ ] Step 1: Add a failing fixture requiring `lifecycleStatus` and `attention`.
- [ ] Step 2: Run the focused contract test; expect FAIL on the old shape.
- [ ] Step 3: Update the canonical interface and compatibility boundary.
- [ ] Step 4: Re-run; expect PASS for CLI and fallback fixtures.

### Task 2.2: 扩展 `DashboardData`，新增 `changeStatusCounts`

**Spec coverage:** dashboard status-count requirement.
**Dependencies / order:** after Task 2.1; before count derivation and message updates.
**Files:** Modify `src/extension/types.ts`, `src/webview/types.ts`; Test `test/webview/components/dashboard.test.tsx`.
**Implementation notes:** define counts for All, five lifecycle states, and Needs Attention; preserve existing fields.
**Verification:** a dashboard fixture renders counts without recomputing them.
**Risks / edge cases:** count keys must be stable across locales and Root changes.
- [ ] Step 1: Add a failing DashboardData fixture with expected count keys.
- [ ] Step 2: Run the focused test; expect FAIL because counts are absent.
- [ ] Step 3: Extend both host and webview message interfaces.
- [ ] Step 4: Re-run; expect PASS and unchanged legacy consumers.

### Task 2.3: 在 `DataManager` 中为 CLI 路径和 filesystem fallback 路径统一补充生命周期

**Spec coverage:** dashboard lifecycle enrichment and fallback parity.
**Dependencies / order:** after Tasks 1.2–1.3 and 2.1.
**Files:** Modify `src/extension/services/dataManager.ts`, `src/extension/services/stateReader.ts`; Test `test/extension/services/dataManagerCliFallback.test.ts`.
**Implementation notes:** enrich both paths from the same Artifact/task inputs; never add a second Archived query or server pagination.
**Verification:** equivalent CLI and filesystem fixtures produce identical lifecycle and attention values.
**Risks / edge cases:** malformed CLI output must fall back conservatively without aborting the whole refresh.
- [ ] Step 1: Add a failing parity test for CLI and fallback snapshots.
- [ ] Step 2: Run it; expect FAIL on one path's missing lifecycle field.
- [ ] Step 3: Move enrichment into a shared Host helper used by both paths.
- [ ] Step 4: Re-run; expect PASS for parity and malformed data.

### Task 2.4: 实现当前 Root 的 Active + Archived 全量状态计数

**Spec coverage:** dashboard full-dataset count requirement.
**Dependencies / order:** after Task 2.3; counts must be computed before Webview publication.
**Files:** Modify `src/extension/services/dataManager.ts`; Test `test/extension/services/dataManagerCliFallback.test.ts`.
**Implementation notes:** count from the same in-memory snapshot used for the list, including Archived in All and Archived buckets.
**Verification:** fixture with mixed active/archived records matches all bucket totals and attention count.
**Risks / edge cases:** counts must not reflect a previous Root or a paginated subset.
- [ ] Step 1: Write failing mixed-root/mixed-status count assertions.
- [ ] Step 2: Run the test; expect FAIL on totals or Root isolation.
- [ ] Step 3: Implement one full-snapshot counting pass.
- [ ] Step 4: Re-run; expect PASS for every bucket.

### Task 2.5: 确保 Scope 切换后计数和 Change 数据来自同一个 Root

**Spec coverage:** dashboard Root consistency invariant.
**Dependencies / order:** after Task 2.4; before message contract completion.
**Files:** Modify `src/extension/services/dataManager.ts`, `src/extension/services/openspecScope.ts`; Test `test/extension/services/openspecScope.test.ts`.
**Implementation notes:** bind the refresh snapshot, counts, cache invalidation, and success event to one explicit `scopeId`.
**Verification:** switching between two Roots never combines one Root's counts with another Root's changes.
**Risks / edge cases:** stale asynchronous responses must be ignored after a newer Scope selection.
- [ ] Step 1: Add a failing two-Root race test.
- [ ] Step 2: Run it; expect FAIL when stale data wins.
- [ ] Step 3: Add scope token checks at publish time.
- [ ] Step 4: Re-run; expect PASS with deterministic latest-Root data.

### Task 2.6: 更新 Extension/Webview message types、fixtures 和 contract tests

**Spec coverage:** dashboard host/webview contract scenarios.
**Dependencies / order:** last Host task; gates pipeline integration.
**Files:** Modify `src/shared/messages.ts`, fixtures under `test/fixtures/`; Test `test/webview/components/dashboard.test.tsx`.
**Implementation notes:** update every production message producer and fixture to carry lifecycle and counts explicitly.
**Verification:** `pnpm test -- test/webview/components/dashboard.test.tsx` passes without Webview-side derivation.
**Risks / edge cases:** retain legacy fixture adapter only at the documented compatibility boundary.
- [ ] Step 1: Add a failing message contract assertion for the new fields.
- [ ] Step 2: Run focused tests; expect FAIL on stale fixtures.
- [ ] Step 3: Update producers, types, and fixtures together.
- [ ] Step 4: Re-run focused tests; expect PASS for host-to-webview payloads.
