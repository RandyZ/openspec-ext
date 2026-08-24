# Task 2. Shared action resolver

<!-- covers: Task 2.1, Task 2.2, Task 2.3, Task 2.4 -->

### Task 2.1: Resolve planning artifact readiness and parallel actions with TDD

**Spec coverage:** `workflow-control` / `Shared workflow action resolution` / `First ready artifact is recommended`, `Blocked and skipped artifacts retain distinct meaning`

**Dependencies / order:** Requires Task 1 snapshot DTO.

**Files:**
- Modify: `src/shared/changeWorkflow.ts`
- Test: `test/shared/changeWorkflow.test.ts`

**Implementation notes:** Implement one pure resolver over ordered nodes. Return one recommended planning action, all other ready actions, blocked reasons, and skipped presentation data; do not parse `nextSteps`.

**Verification:** `zsh -c 'source ~/.zshrc && pnpm exec vitest run test/shared/changeWorkflow.test.ts'` must pass deterministic table-driven cases.

**Risks / edge cases:** No ready nodes, multiple ready nodes, duplicate ids, and blocked nodes with empty missingDeps.

- [ ] **Step 1:** Create failing table tests for single ready, parallel ready, blocked, and skipped graphs.
- [ ] **Step 2:** Run the focused test and confirm RED because the shared resolver does not exist.
- [ ] **Step 3:** Implement the smallest pure resolver using CLI order as the tie-breaker.
- [ ] **Step 4:** Re-run and confirm PASS without file, CLI, React, or VS Code dependencies.

---

### Task 2.2: Resolve Apply, Verify, Archive, and Sync boundaries with TDD

**Spec coverage:** `workflow-control` / `Shared workflow action resolution` / `Planning completion recommends Apply`, `Completed tasks recommend Verify without auto-archive`, `Sync Specs is conditional`, `Archived Change remains read-only history`

**Dependencies / order:** Requires Task 2.1 resolver skeleton.

**Files:**
- Modify: `src/shared/changeWorkflow.ts`
- Test: `test/shared/changeWorkflow.test.ts`

**Implementation notes:** Extend resolver context only with task progress, archived state, and delta-spec availability already carried by Change data. Keep Verify/Archive marked high-impact and return no write actions for archived Changes.

**Verification:** Focused resolver tests must pass for incomplete tasks, complete tasks, delta/no-delta, and archive combinations.

**Risks / edge cases:** Zero-task planning Changes, 0/0 progress, incomplete planning with task files, and archived legacy metadata.

- [ ] **Step 1:** Add failing transition tests for Apply, Verify, Archive isolation, Sync visibility, and archived read-only.
- [ ] **Step 2:** Run the focused test and confirm RED on fixed-step behavior.
- [ ] **Step 3:** Add minimal post-planning branches to the same resolver.
- [ ] **Step 4:** Re-run and confirm PASS with no automatic Archive result.

---

### Task 2.3: Replace targeted artifact wording with truthful generic Continue semantics with TDD

**Spec coverage:** `workflow-control` / `Continue planning describes its real capability` / all scenarios; `artifact-viewing` / `Error Handling` / `Artifact file missing`

**Dependencies / order:** Requires Tasks 2.1–2.2 resolved actions.

**Files:**
- Modify: `src/shared/changeWorkflow.ts`, `src/shared/workflowCommand.ts`, `src/webview/components/ActionBar.tsx`, `src/webview/components/ArtifactViewer.tsx`
- Test: `test/shared/changeWorkflow.test.ts`, `test/webview/components/actionBar.test.ts`

**Implementation notes:** Executable label remains generic Continue planning; next/also-ready artifacts are explanatory metadata. Remove any active-artifact path that implies `requestCreateArtifact` can target an id.

**Verification:** Focused resolver and ActionBar tests must assert `/opsx:continue <change>` and reject labels such as `Continue → Specs` or `Create Design`.

**Risks / edge cases:** Locale strings, first artifact named something unfamiliar, and zero ready artifacts.

- [ ] **Step 1:** Add failing command/label tests for one and multiple ready artifacts.
- [ ] **Step 2:** Run focused tests and confirm RED on current targeted labels.
- [ ] **Step 3:** Update resolved action metadata and consumers without changing command generation semantics.
- [ ] **Step 4:** Re-run and confirm truthful labels plus unchanged generic command payload.

---

### Task 2.4: Remove independent lifecycle action derivation from all workflow surfaces with TDD

**Spec coverage:** `workflow-control` / `Shared workflow action resolution` / `All surfaces consume the same resolved action semantics`; removed `Workflow Step Indicator`, `动态 ActionBar`, and `Dashboard ChangeCard 智能操作`

**Dependencies / order:** Requires complete resolver and is prerequisite for Tasks 4 and 6 UI migration.

**Files:**
- Modify: `src/webview/utils/workflowState.ts`, `src/webview/components/ChangeCard.tsx`, `src/webview/components/ChangeDetail.tsx`, `src/webview/components/Dashboard.tsx`
- Test: `test/webview/utils/workflowState.test.ts`, `test/webview/components/changeCard.test.tsx`, `test/webview/components/dashboard.test.tsx`

**Implementation notes:** Convert `workflowState.ts` into a thin compatibility export or delete it after all callers import the shared resolver. Do not keep a hidden fixed array as fallback.

**Verification:** Focused tests must feed one snapshot to all surfaces and observe identical recommended/available/blocked semantics.

**Risks / edge cases:** Legacy Dashboard adapter data without snapshot and tests that construct partial Change objects.

- [ ] **Step 1:** Add failing cross-surface assertions using a parallel-ready custom schema fixture.
- [ ] **Step 2:** Run focused tests and confirm current consumers disagree.
- [ ] **Step 3:** Migrate each consumer to the shared resolver and disable actions for missing snapshots.
- [ ] **Step 4:** Re-run focused tests and confirm no independent fixed lifecycle remains.
