# Task 6. ChangeCard 状态与智能操作

<!-- covers: Task 6.1, Task 6.2, Task 6.3, Task 6.4, Task 6.5, Task 6.6 -->

## Objective

让 ChangeCard 只消费 Host 提供的生命周期和共享 workflow 映射，消除卡片内部阶段推导与列表状态分叉。

### Task 6.1: 在 ChangeCard 上展示统一生命周期状态 badge

**Spec coverage:** dashboard lifecycle badge requirement.
**Dependencies / order:** after Tasks 1.1 and 2.1; before action rendering.
**Files:** Modify `src/webview/components/ChangeCard.tsx`; Test `test/webview/components/changeCard.test.tsx`.
**Implementation notes:** render localized label and semantic color from `change.lifecycleStatus`, with an Attention indicator when required.
**Verification:** one fixture per lifecycle renders the expected badge text.
**Risks / edge cases:** legacy fixtures use the adapter once and must not trigger a second derivation.
- [ ] Step 1: Add failing badge assertions for all statuses.
- [ ] Step 2: Run focused component test; expect FAIL on missing lifecycle badge.
- [ ] Step 3: Bind the badge to the shared lifecycle field.
- [ ] Step 4: Re-run; expect PASS for labels and attention marker.

### Task 6.2: 删除或停止使用卡片内部 `getSmartActions()` 的独立阶段推导

**Spec coverage:** workflow-control single-source-of-truth requirement.
**Dependencies / order:** after Task 6.1; before mapping integration.
**Files:** Modify `src/webview/components/ChangeCard.tsx`, `src/webview/utils/workflowState.ts`; Test `test/webview/components/changeCard.test.tsx`.
**Implementation notes:** remove duplicate stage inference and accept action descriptors from `getWorkflowActionsForLifecycle()`.
**Verification:** source-level test or mock proves card behavior changes when lifecycle input changes, not task math inside the card.
**Risks / edge cases:** keep unrelated task progress presentation intact.
- [ ] Step 1: Add a failing test with conflicting legacy status and lifecycle values.
- [ ] Step 2: Run focused test; expect FAIL while the card favors its own inference.
- [ ] Step 3: Delete the duplicate branch and pass shared actions.
- [ ] Step 4: Re-run; expect PASS with lifecycle as the only action source.

### Task 6.3: 使用 `getWorkflowActionsForLifecycle()` 生成快捷操作

**Spec coverage:** workflow-control lifecycle action mapping requirement.
**Dependencies / order:** after Tasks 1.4 and 6.2.
**Files:** Modify `src/webview/components/ChangeCard.tsx`; Test `test/webview/components/changeCard.test.tsx`.
**Implementation notes:** map descriptors to existing command launch callbacks without changing command strings or adapter priority.
**Verification:** each active lifecycle exposes exactly the mapped actions.
**Risks / edge cases:** action labels are localized at render time; descriptors remain locale-neutral.
- [ ] Step 1: Add failing action-array assertions.
- [ ] Step 2: Run focused test; expect FAIL on mismatched actions.
- [ ] Step 3: Wire the shared mapping into the existing callback path.
- [ ] Step 4: Re-run; expect PASS for every active state.

### Task 6.4: 确保 Ready to Verify 进入 `Verify & Archive` 交互路径

**Spec coverage:** workflow-control Ready to Verify scenario.
**Dependencies / order:** after Task 6.3.
**Files:** Modify `src/webview/components/ChangeCard.tsx`, `src/webview/components/VerifyArchivePanel.tsx`; Test `test/webview/components/verifyArchivePanel.test.ts`.
**Implementation notes:** selecting the Ready to Verify action launches the existing verify/archive flow with the current Root scope.
**Verification:** test asserts the launch message and `scopeId`.
**Risks / edge cases:** do not expose a plain Apply action for Ready to Verify.
- [ ] Step 1: Add failing launch assertion for Ready to Verify.
- [ ] Step 2: Run focused test; expect FAIL on route or scope.
- [ ] Step 3: Connect the mapped action to Verify & Archive.
- [ ] Step 4: Re-run; expect PASS with explicit scope.

### Task 6.5: 确保 Archived 卡片不展示任何写操作

**Spec coverage:** workflow-control Archived read-only scenario.
**Dependencies / order:** after Tasks 5.3 and 6.3.
**Files:** Modify `src/webview/components/ChangeCard.tsx`; Test `test/webview/components/changeCard.test.tsx`.
**Implementation notes:** archived mapping returns no write descriptors; card still supports detail navigation and copy/read actions.
**Verification:** archived fixture has zero workflow buttons and no task mutation callback.
**Risks / edge cases:** a missing lifecycle value must not accidentally enable a write action.
- [ ] Step 1: Add failing archived-card action test.
- [ ] Step 2: Run focused test; expect FAIL if legacy smart actions appear.
- [ ] Step 3: Guard all writes behind lifecycle/read-only data.
- [ ] Step 4: Re-run; expect PASS with zero writes.

### Task 6.6: 为状态 badge 与快捷操作一致性编写组件测试

**Spec coverage:** dashboard/workflow-control consistency scenarios.
**Dependencies / order:** last ChangeCard task; gates integration verification.
**Files:** Test `test/webview/components/changeCard.test.tsx`.
**Implementation notes:** table-drive lifecycle inputs and assert badge/action pairs, including Archived and Attention states.
**Verification:** `pnpm test -- test/webview/components/changeCard.test.tsx` passes.
**Risks / edge cases:** avoid snapshots that hide missing accessible labels or extra actions.
- [ ] Step 1: Add failing consistency matrix.
- [ ] Step 2: Run focused tests; expect FAIL for any divergent pair.
- [ ] Step 3: Update fixtures/test helpers to make the contract explicit.
- [ ] Step 4: Re-run; expect PASS for all lifecycle rows.
