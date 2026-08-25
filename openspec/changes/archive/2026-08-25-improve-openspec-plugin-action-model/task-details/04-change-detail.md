# Task 4. Change Detail interaction model

<!-- covers: Task 4.1, Task 4.2, Task 4.3 -->

### Task 4.1: Replace the fixed stepper and tabs with status-driven artifact presentation with TDD

**Spec coverage:** `artifact-viewing` / `Artifact List Display` / all scenarios; `Artifact Navigation` / `Tab-based navigation`; removed `workflow-control` / `Workflow Step Indicator`

**Dependencies / order:** Requires Tasks 2 and 3.

**Files:**
- Modify: `src/webview/components/ChangeDetail.tsx`, `src/webview/components/WorkflowStepIndicator.tsx`, `src/webview/components/ArtifactViewer.tsx`
- Test: `test/webview/components/changeDetailRouting.test.ts`, `test/webview/utils/workflowState.test.ts`

**Implementation notes:** Render Completed, Available now, Blocked, and Skipped from snapshot order. Only status-declared artifacts enter navigation; a missing output displays state explanation, not a fixed empty tab.

**Verification:** Focused tests must render a nonstandard schema, parallel-ready groups, blocked dependencies, and skipped artifacts with keyboard-selectable dynamic navigation.

**Risks / edge cases:** No artifacts, all blocked, selected artifact disappears on refresh, and narrow panel overflow.

- [ ] **Step 1:** Add failing component tests for custom ids and the four state groups.
- [ ] **Step 2:** Run focused tests and confirm RED because fixed tabs/stepper are rendered.
- [ ] **Step 3:** Replace active Change navigation with snapshot-driven groups and selection state.
- [ ] **Step 4:** Re-run and confirm fixed missing tabs and fabricated archive completion are absent.

---

### Task 4.2: Implement one primary action, accessible alternatives, and explicit context with TDD

**Spec coverage:** `workflow-control` / `Workflow action hierarchy remains safe` / `One primary action with accessible alternatives`, `Header utilities do not become workflow actions`; `dashboard` / `Workflow surfaces expose explicit planning context` / `Project and Planning root are visible`

**Dependencies / order:** Requires Task 4.1 layout and Task 2 resolved actions.

**Files:**
- Modify: `src/webview/components/ChangeDetail.tsx`, `src/webview/components/ActionBar.tsx`, `src/i18n/locales/en.json`, `src/i18n/locales/zh-cn.json`
- Test: `test/webview/components/actionBar.test.ts`, `test/webview/components/changeDetailRouting.test.ts`

**Implementation notes:** Show Change/schema/Project/Planning root in header, exactly one emphasized action, and keyboard-accessible alternatives. Keep copy/open/refresh in the header utility group.

**Verification:** Focused tests must assert one primary button, target-aware accessible names, disclosure keyboard access, and visible Local/Store context.

**Risks / edge cases:** Long Change/root labels, no recommended action, high contrast mode, and missing project display metadata.

- [ ] **Step 1:** Add failing accessibility and context assertions for primary/secondary/header groups.
- [ ] **Step 2:** Run focused tests and confirm RED on current ActionBar/context structure.
- [ ] **Step 3:** Implement the smallest grouped layout using existing theme tokens and controls.
- [ ] **Step 4:** Re-run and confirm one primary action and non-color state labels.

---

### Task 4.3: Route complex and high-impact actions through their dedicated flows with TDD

**Spec coverage:** `workflow-control` / `Workflow action hierarchy remains safe` / `Verify and Archive retain dedicated handling`; `dashboard` / `Dashboard prioritizes actionable Change state` / `Recommended actions use shared resolution`

**Dependencies / order:** Requires Task 4.2 action hierarchy.

**Files:**
- Modify: `src/webview/components/ChangeDetail.tsx`, `src/webview/components/ActionBar.tsx`, `src/webview/components/VerifyArchivePanel.tsx`, `src/extension/providers/webviewMessageHandler.ts`
- Test: `test/webview/components/actionBar.test.ts`, `test/webview/components/changeDetailRouting.test.ts`, `test/extension/providers/webviewMessageHandler.test.ts`

**Implementation notes:** Continue/FF/Apply use existing routing. Verify/Archive reveal the existing interactive/confirmation flow; Dashboard or Sidebar handoff opens bound Detail instead of executing directly.

**Verification:** Focused tests must assert Verify/Archive never launch from a normal navigation click and archived Changes expose no writes.

**Risks / edge cases:** Direct archive escape path, existing terminal sessions, and Detail opened on a hidden tab.

- [ ] **Step 1:** Add failing route assertions for Verify, Archive, complex Dashboard actions, and archived Changes.
- [ ] **Step 2:** Run focused tests and confirm unsafe direct paths fail expectations.
- [ ] **Step 3:** Reuse the existing VerifyArchivePanel/terminal and confirmation routes for resolver actions.
- [ ] **Step 4:** Re-run and confirm dedicated flow reveal with no duplicate execution.
