# Task 6. Sidebar and Dashboard action-first surfaces

<!-- covers: Task 6.1, Task 6.2, Task 6.3 -->

### Task 6.1: Implement compact Sidebar action summaries and Detail handoff with TDD

**Spec coverage:** `dashboard` / `Sidebar Change summaries are compact and action-oriented` / all scenarios; `workflow-control` / `Shared workflow action resolution` / `All surfaces consume the same resolved action semantics`

**Dependencies / order:** Requires shared resolver and bound Detail flow from Tasks 2 and 4.

**Files:**
- Modify: `src/webview/components/ChangeCard.tsx`, the existing Sidebar change-list container, `src/webview/types/changeList.ts`
- Test: `test/webview/components/changeCard.test.tsx`, `test/webview/utils/changeListPipeline.test.ts`

**Implementation notes:** Keep name, lifecycle, recommended next action, task progress, and additional-action count. Remove the requirement for four fixed artifact badges; Verify/Archive hand off to bound Detail.

**Verification:** Focused tests must cover custom schema, parallel ready, task progress, keyboard focus, and high-impact handoff.

**Risks / edge cases:** Narrow width, long action labels, legacy card data without snapshot, and archived cards.

- [ ] **Step 1:** Add failing card tests for compact content, extra-action count, and Detail handoff.
- [ ] **Step 2:** Run focused tests and confirm RED on fixed artifact badges and independent actions.
- [ ] **Step 3:** Render the shared resolved summary using existing card/navigation components.
- [ ] **Step 4:** Re-run and confirm compact keyboard-accessible behavior in narrow width fixtures.

---

### Task 6.2: Implement action-first Dashboard priority sections with TDD

**Spec coverage:** `dashboard` / `Dashboard prioritizes actionable Change state` / all scenarios

**Dependencies / order:** Requires Tasks 2 and 5 so priorities can include resolver and failed receipt state.

**Files:**
- Modify: `src/webview/components/Dashboard.tsx`, existing Dashboard summary components
- Test: `test/webview/components/dashboard.test.tsx`

**Implementation notes:** Derive Needs attention, Ready to verify, and Recommended actions from loaded snapshots/receipts with local filtering. Place them before existing analytics; do not add a new board or chart package.

**Verification:** Dashboard tests must assert priority order, reasons, bound Detail routing, and preservation of existing KPI/chart sections.

**Risks / edge cases:** A Change appearing in multiple categories, empty sections, stale cache, and many active Changes.

- [ ] **Step 1:** Add failing Dashboard tests for each priority section, order, and analytics preservation.
- [ ] **Step 2:** Run the focused test and confirm RED because the action sections do not exist.
- [ ] **Step 3:** Add minimal filtered sections using existing Change data and shared resolver output.
- [ ] **Step 4:** Re-run and confirm no Kanban/timeline infrastructure was introduced.

---

### Task 6.3: Preserve explicit Project, Planning root, and panel binding semantics with TDD

**Spec coverage:** `dashboard` / `Workflow surfaces expose explicit planning context` / all scenarios

**Dependencies / order:** Requires bound snapshot propagation and both UI surfaces.

**Files:**
- Modify: `src/webview/components/Dashboard.tsx`, `src/webview/components/ChangeDetail.tsx`, `src/extension/providers/dashboardViewProvider.ts`, `src/extension/providers/changeDetailPanelManager.ts`
- Test: `test/webview/components/dashboard.test.tsx`, `test/extension/providers/dashboardViewProvider.test.ts`, `test/extension/providers/changeDetailPanelManager.test.ts`

**Implementation notes:** Display existing Project and binding fields; label Local/Store. Workset remains navigation data only. Sidebar Project switching must not mutate an existing wide Dashboard or Detail binding.

**Verification:** Focused tests must cover Store labels, Workset membership neutrality, Project switch, return, and same-name Change panel isolation.

**Risks / edge cases:** Declared Store source, missing friendly label, reused panel key, and project path truncation.

- [ ] **Step 1:** Add failing provider/UI tests for explicit context and immutable existing panels.
- [ ] **Step 2:** Run focused tests and confirm RED on missing context or unintended rebinding.
- [ ] **Step 3:** Wire existing binding metadata into labels and keep picker updates scoped to Sidebar state.
- [ ] **Step 4:** Re-run and confirm same-name Changes cannot cross panel bindings.
