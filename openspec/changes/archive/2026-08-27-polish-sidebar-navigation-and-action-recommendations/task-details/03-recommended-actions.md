# Task 3. Recommended action rail

<!-- covers: Task 3.1, Task 3.2, Task 3.3, Task 3.4 -->

## Objective

把裸文本推荐列表改为最多三条的紧凑动作轨道，明确原因与 CTA，并复用现有绑定安全的 Detail、Verify 与工作流启动路径。

### Task 3.1: Add RED Dashboard tests for priority order, deduplication, and the three-row limit

**Spec coverage:** `Recommended action rail is bounded and prioritized`、`Each action row explains its action` 场景。
**Dependencies / order:** after Task 1 priority behavior is defined.
**Files:** Modify `test/webview/components/dashboard.test.tsx`; exercise `src/webview/components/Dashboard.tsx`.
**Implementation notes:** render enough fixtures to exceed three candidates across all buckets. Assert fixed order Needs Attention, Ready to Verify, Recommended; max three total; no duplicate Change; each row has a reason/status, bounded name, explicit CTA, and keyboard-reachable button.
**Verification:** new rendering assertions fail against the current unstyled recommendation list.
**Risks / edge cases:** apply the three-row cap after priority flattening, not independently per bucket; same-name cross-root fixtures must remain binding-specific.
- [ ] Step 1: Add a failing mixed-priority render case with more than three candidates.
- [ ] Step 2: Add failing semantic assertions for reason, name, CTA, and focusable action.
- [ ] Step 3: Run `rtk zsh -c 'source ~/.zshrc && pnpm exec vitest run test/webview/components/dashboard.test.tsx'`; expect FAIL.
- [ ] Step 4: Confirm failures represent missing rail behavior rather than missing fixture fields.

### Task 3.2: Implement compact action rows with resolver-derived CTA labels

**Spec coverage:** `Recommended action rail is bounded and prioritized`、`Each action row explains its action`、`Recommended CTA uses shared resolution` 场景。
**Dependencies / order:** after Tasks 1.2 and 3.1 RED.
**Files:** Modify `src/webview/components/Dashboard.tsx`; reuse `src/webview/utils/workflowLaunchLabels.ts`; test `test/webview/components/dashboard.test.tsx` and `test/webview/utils/workflowLaunchLabels.test.ts`.
**Implementation notes:** flatten mutually exclusive buckets in fixed order, then `slice(0, 3)`. Render compact theme-native rows with a text/icon status indicator, bounded Change name, and explicit button label from `getWorkflowActionButtonLabel` / existing localized review and verify labels. Use existing VS Code theme variables and focus-visible styles; do not create a generic card system.
**Verification:** Task 3.1 and existing label tests pass.
**Risks / edge cases:** reason text must still communicate meaning without color; long Change names cannot expand Sidebar width; unknown resolver state must not produce a guessed CTA.
- [ ] Step 1: Add the fixed-order flattened view model at the existing Dashboard render boundary.
- [ ] Step 2: Replace bare names with the minimum semantic row markup.
- [ ] Step 3: Reuse label helpers and existing icons/theme tokens.
- [ ] Step 4: Run Dashboard and label focused tests; expect PASS.

### Task 3.3: Route Review, Verify, regular, and high-impact CTAs through existing safe handlers

**Spec coverage:** `Needs Attention opens a safe review surface`、`Ready to Verify uses the interactive route`、`Recommended CTA uses shared resolution`、`High-impact recommendations preserve the safety boundary` 场景。
**Dependencies / order:** after Task 3.2; uses Task 1 routing classification.
**Files:** Modify `src/webview/components/Dashboard.tsx`; test `test/webview/components/dashboard.test.tsx`. Reuse existing message types and handlers unchanged unless a failing test proves a missing existing path.
**Implementation notes:** Review opens binding-aware Change Detail and never retries. Verify calls the existing interactive Verify & Archive route. Regular actions call the existing workflow launch handler/settings. High-impact actions open bound Detail. Sidebar never exposes direct Archive Now. Pass the current accepted binding through every route.
**Verification:** click tests assert the exact existing callback/message and reject direct archive, headless verify, retry, or wrong-binding paths.
**Risks / edge cases:** failed receipt rows must not execute the failed action; stale UI events after root switching must remain rejected by existing binding checks.
- [ ] Step 1: Add or confirm one click assertion for each of the four route classes.
- [ ] Step 2: Run the focused Dashboard test; expect any missing route to FAIL.
- [ ] Step 3: Connect each CTA to the already-existing safe handler with no new protocol.
- [ ] Step 4: Re-run; expect all route assertions to PASS.

### Task 3.4: Run Dashboard and workflow label focused tests to GREEN

**Spec coverage:** all scenarios under `Project-first Sidebar presents bounded recommended actions`.
**Dependencies / order:** after Tasks 3.1-3.3; gate for localization and GUI acceptance.
**Files:** Test `test/webview/components/dashboard.test.tsx`, `test/webview/utils/workflowLaunchLabels.test.ts`, and `test/shared/changeWorkflow.test.ts` if touched.
**Implementation notes:** keep test scope focused until all new behaviors are green, then rely on Task 4 for the full suite.
**Verification:** focused command exits 0 with no changed assertions that weaken binding or high-impact safety.
**Risks / edge cases:** a visual snapshot cannot replace route assertions.
- [ ] Step 1: Run `rtk zsh -c 'source ~/.zshrc && pnpm exec vitest run test/webview/components/dashboard.test.tsx test/webview/utils/workflowLaunchLabels.test.ts test/shared/changeWorkflow.test.ts'`.
- [ ] Step 2: Classify any failure as priority, label, binding, or handler behavior.
- [ ] Step 3: Fix the smallest shared cause.
- [ ] Step 4: Re-run the command; expect exit code 0.
