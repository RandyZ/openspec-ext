# Task 1. Priority selection and routing

<!-- covers: Task 1.1, Task 1.2, Task 1.3 -->

## Objective

让 Dashboard 的推荐候选互斥、绑定安全，并继续由现有工作流 resolver 决定动作；不新增第二套优先级或路由模型。

### Task 1.1: Add RED tests for mutually exclusive priorities and binding-safe receipts

**Spec coverage:** `Project-first Sidebar presents bounded recommended actions` 的 `Recommended action rail is bounded and prioritized`、`Needs Attention opens a safe review surface`、`Stale or cross-binding receipts do not affect recommendations` 场景。
**Dependencies / order:** first task; establishes the behavior boundary before production changes.
**Files:** Modify `test/webview/components/dashboard.test.tsx`; exercise exports from `src/webview/components/Dashboard.tsx` and existing receipt fixtures.
**Implementation notes:** add cases where one Change qualifies for more than one bucket, where a failed/fallback receipt matches the current binding, and where a receipt has a different binding or older request id. Assert one classification per Change and no cross-binding promotion.
**Verification:** the new assertions fail against the current duplicate/stale behavior for the intended reason.
**Risks / edge cases:** use same-name Changes in different roots so a name-only match cannot satisfy the test; keep receipt freshness rules identical to the existing accepted-receipt contract.
- [ ] Step 1: Add one failing deduplication case and one failing stale/cross-binding receipt case.
- [ ] Step 2: Run `rtk zsh -c 'source ~/.zshrc && pnpm exec vitest run test/webview/components/dashboard.test.tsx'`; expect the new assertions to FAIL.
- [ ] Step 3: Confirm the failure is in priority classification rather than fixture construction.
- [ ] Step 4: Preserve the RED output in the implementation receipt before changing production code.

### Task 1.2: Keep priority selection and CTA routing on the shared resolver

**Spec coverage:** `Recommended CTA uses shared resolution`、`High-impact recommendations preserve the safety boundary`、`Needs Attention opens a safe review surface` 场景。
**Dependencies / order:** after Task 1.1 RED; before rendering the rail.
**Files:** Modify `src/webview/components/Dashboard.tsx`; test `test/webview/components/dashboard.test.tsx`. Modify `src/shared/changeWorkflow.ts` only if the existing resolver cannot express the required result without duplicating policy.
**Implementation notes:** make `getDashboardPriorityChanges` classify in fixed order: accepted receipt/resolver attention, Verify, then regular recommendation. Remove a Change from later buckets once selected. Derive recommendation and high-impact behavior from the latest binding-matching `resolveWorkflowActions()` result. Review opens bound Detail; Verify uses the existing interactive Verify & Archive handler; complex/high-impact actions open bound Detail. Do not add DTOs, caches, messages, or direct archive execution.
**Verification:** Task 1.1 tests become GREEN and existing resolver/receipt tests remain green.
**Risks / edge cases:** archived Changes, stale request ids, missing workflow snapshots, and cross-root same-name Changes must fail closed rather than invent an action.
- [ ] Step 1: Apply the smallest fixed-order exclusion in the existing priority helper.
- [ ] Step 2: Re-run the Task 1.1 focused test; expect the new cases to PASS.
- [ ] Step 3: If a routing case still fails, reuse the existing Detail or workflow handler instead of adding a parallel callback.
- [ ] Step 4: Re-run the focused test after each minimal routing correction.

### Task 1.3: Run the priority and workflow routing focused tests to GREEN

**Spec coverage:** all recommendation routing scenarios in `Project-first Sidebar presents bounded recommended actions`.
**Dependencies / order:** after Tasks 1.1-1.2; gate for Tasks 2-3.
**Files:** Test `test/webview/components/dashboard.test.tsx`, `test/webview/utils/workflowLaunchLabels.test.ts`, and `test/shared/changeWorkflow.test.ts` when shared resolver code changed.
**Implementation notes:** run only the affected suite first; fix the shared cause of any regression. Do not update snapshots or assertions merely to accept changed behavior.
**Verification:** focused command exits 0 with all tests green.
**Risks / edge cases:** a green Dashboard test alone is insufficient if resolver labels or high-impact classification changed.
- [ ] Step 1: Run `rtk zsh -c 'source ~/.zshrc && pnpm exec vitest run test/webview/components/dashboard.test.tsx test/webview/utils/workflowLaunchLabels.test.ts test/shared/changeWorkflow.test.ts'`.
- [ ] Step 2: Inspect any failure for a shared resolver or binding mismatch.
- [ ] Step 3: Make the minimum production or fixture correction that preserves the spec.
- [ ] Step 4: Re-run the same command; expect exit code 0.
