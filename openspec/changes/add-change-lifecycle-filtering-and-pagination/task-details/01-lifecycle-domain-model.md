# Task 1. 生命周期领域模型

<!-- covers: Task 1.1, Task 1.2, Task 1.3, Task 1.4, Task 1.5 -->

## Objective

建立 Change 生命周期的唯一领域模型，使 Dashboard 状态标签、筛选和 workflow 快捷操作不再各自推导。

## Files

```text
src/shared/changeLifecycle.ts
src/extension/services/types.ts
src/webview/types/messages.ts
test/shared/changeLifecycle.test.ts
```

## Required Types

```ts
export type ActiveChangeLifecycleStatus =
  | 'planning'
  | 'ready-to-apply'
  | 'applying'
  | 'ready-to-verify';

export type ChangeLifecycleStatus =
  | ActiveChangeLifecycleStatus
  | 'archived';

export type ChangeAttentionReason =
  | 'invalid-task-progress'
  | 'invalid-artifact-status'
  | 'invalid-artifact-path'
  | 'metadata-read-failed'
  | 'validation-failed'
  | 'root-write-unavailable';

export interface ChangeAttention {
  required: boolean;
  reasons: ChangeAttentionReason[];
}
```

## Lifecycle Rules

| Condition | Result |
| --- | --- |
| Artifact list empty | planning |
| Any Schema Artifact not done | planning |
| totalTasks = 0 | planning |
| all artifacts done, totalTasks > 0, completed = 0 | ready-to-apply |
| 0 < completed < total | applying |
| total > 0, completed = total | ready-to-verify |
| archived input | archived |

## Defensive Rules

- `completedTasks < 0` → clamp for display, Attention `invalid-task-progress`, lifecycle `planning`.
- `completedTasks > totalTasks` → Attention `invalid-task-progress`, lifecycle `planning`.
- Unknown Artifact status → normalize conservatively, Attention `invalid-artifact-status`.
- Artifact id must not influence lifecycle.
- `blocked` alone must not generate Attention.

## Workflow Mapping

| Lifecycle | Actions |
| --- | --- |
| planning | Continue, FF |
| ready-to-apply | Apply |
| applying | Apply |
| ready-to-verify | Verify |
| archived | none |

Verify must route to the existing interactive `Verify & Archive` experience.

## Tests

Use table-driven tests for every boundary:

```text
0/0
0/N
1/N
N/N
N+1/N
empty artifacts
custom artifact ids
ready and blocked artifacts
unknown status
archived
```

## Done When

- No React component contains a second lifecycle derivation.
- Pure functions have full boundary coverage.
- Existing legacy `status` remains compile-compatible.

## Execution details

### Task 1.1: 在 `src/shared/changeLifecycle.ts` 定义 `ChangeLifecycleStatus`、`ActiveChangeLifecycleStatus`、`ChangeAttention`、`ChangeAttentionReason` 和 `ChangeStatusCounts`

**Spec coverage:** dashboard lifecycle model; workflow-control lifecycle mapping.
**Dependencies / order:** first; establishes types consumed by Tasks 1.2–1.5.
**Files:** Create `src/shared/changeLifecycle.ts`; Test `test/shared/changeLifecycle.test.ts`.
**Implementation notes:** use string unions matching the delta spec and keep `archived` out of `ActiveChangeLifecycleStatus`.
**Verification:** `pnpm test -- test/shared/changeLifecycle.test.ts`; expected PASS after the type-level fixture compiles.
**Risks / edge cases:** avoid duplicating legacy `draft/in-progress/complete` as new lifecycle values.
- [ ] Step 1: Add a failing compile/test fixture importing every required type.
- [ ] Step 2: Run `pnpm test -- test/shared/changeLifecycle.test.ts`; expect FAIL because the module is absent.
- [ ] Step 3: Implement the unions and interfaces with exported names.
- [ ] Step 4: Re-run the focused test; expect PASS and no TypeScript diagnostics.

### Task 1.2: 实现 `deriveChangeLifecycleStatus()`，覆盖 planning、ready-to-apply、applying、ready-to-verify

**Spec coverage:** dashboard Requirement lifecycle status / all four active scenarios.
**Dependencies / order:** after Task 1.1; before Host enrichment.
**Files:** Modify `src/shared/changeLifecycle.ts`; Test `test/shared/changeLifecycle.test.ts`.
**Implementation notes:** evaluate schema Artifact completion before task progress, then return the four active states in the design order.
**Verification:** table-driven test covers empty, all-done/zero, partial, and all-task-complete inputs.
**Risks / edge cases:** `totalTasks === 0` must remain `planning`, even when artifacts are complete.
- [ ] Step 1: Write failing table rows for each lifecycle boundary.
- [ ] Step 2: Run the focused test and confirm at least one row fails.
- [ ] Step 3: Implement the smallest pure conditional function.
- [ ] Step 4: Re-run the table; expect all rows PASS.

### Task 1.3: 实现非法任务进度和非法 Artifact 数据的保守回退与 Attention reason

**Spec coverage:** dashboard Requirement attention / malformed progress and Artifact scenarios.
**Dependencies / order:** after Task 1.2; shares validators with the derivation function.
**Files:** Modify `src/shared/changeLifecycle.ts`; Test `test/shared/changeLifecycle.test.ts`.
**Implementation notes:** return `planning` plus stable reason codes for negative/overflow progress, unknown Artifact status, empty id, and invalid outputPath.
**Verification:** assertions check both lifecycle fallback and exact reason code set.
**Risks / edge cases:** ordinary Artifact `blocked` is not an Attention reason unless the spec explicitly marks it malformed.
- [ ] Step 1: Add failing malformed-input cases and reason assertions.
- [ ] Step 2: Run the focused test; expect FAIL on fallback/reasons.
- [ ] Step 3: Add validation helpers and conservative fallback branches.
- [ ] Step 4: Re-run; expect PASS without throwing on malformed data.

### Task 1.4: 实现 `getWorkflowActionsForLifecycle()`，建立生命周期到 workflow 操作的唯一映射

**Spec coverage:** workflow-control Requirement lifecycle action mapping.
**Dependencies / order:** after status types; consumed by ChangeCard.
**Files:** Modify `src/shared/changeLifecycle.ts`; Test `test/shared/changeLifecycle.test.ts`.
**Implementation notes:** return immutable action descriptors for Planning, Ready to Apply, Applying, Ready to Verify, and Archived; Archived returns no write action.
**Verification:** exact action arrays are asserted for every lifecycle value.
**Risks / edge cases:** keep `Verify & Archive` as one path for Ready to Verify.
- [ ] Step 1: Write failing mapping table with expected labels/commands.
- [ ] Step 2: Run the focused test; expect FAIL because mapping is absent.
- [ ] Step 3: Implement one mapping table and return a defensive copy.
- [ ] Step 4: Re-run; expect PASS for all lifecycle values.

### Task 1.5: 为生命周期边界、动态 Artifact id、非法数据和 workflow 映射编写表驱动单元测试

**Spec coverage:** dashboard and workflow-control boundary scenarios.
**Dependencies / order:** last in domain group; gates Host work.
**Files:** Test `test/shared/changeLifecycle.test.ts`.
**Implementation notes:** use fixtures with dynamic Artifact ids and include valid and malformed payloads.
**Verification:** `pnpm test -- test/shared/changeLifecycle.test.ts` passes with no snapshot-only assertions.
**Risks / edge cases:** tests must not assume a fixed Artifact filename or DOM behavior.
- [ ] Step 1: Expand the failing table with dynamic ids and malformed combinations.
- [ ] Step 2: Run focused tests and record the failing rows.
- [ ] Step 3: Adjust only test fixtures/helpers needed to express the contract.
- [ ] Step 4: Re-run focused tests; expect all domain rows PASS.
