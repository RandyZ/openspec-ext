# Task 4. Compatibility and performance regression

<!-- covers: Task 4.1, Task 4.2, Task 4.3 -->

### Task 4.1: Add RED regressions for active Project switching, same-named Project/Store Specs, and legacy scope-only behavior.

**Spec coverage:** `project-sidebar-tabs` / Cache is binding-scoped. `referenced-store-specs` / Project and Store contain Specs with the same id. `workset-cli-open` / Project picker selects a member.

**Dependencies / order:** Tasks 1–3 interfaces must be stable enough to express binding assertions.

**Implementation notes:** Prefer regression tests at the existing provider/Gateway boundaries over new test-only abstractions.

**Files:**
- Modify: `test/extension/providers/dashboardViewProvider.test.ts`
- Modify: `test/extension/services/projectDataGateway.test.ts`
- Modify: `test/extension/services/dataManager.test.ts`
- Modify: `test/webview/components/dashboard.test.tsx`

- [ ] **Step 1: Add same-name isolation tests**
  - Create Project and Store fixtures with the same Spec id and assert separate bindings and content requests.
- [ ] **Step 2: Add Project switch tests**
  - Switch to a Workset Project, verify watcher/data target changes, then return and verify previous root content is restored.
- [ ] **Step 3: Add legacy compatibility tests**
  - Assert scope-only Dashboard/Store management and existing detail workflows still route through their original messages.
- [ ] **Step 4: Run focused tests — expect FAIL**
  - Run: `pnpm test -- test/extension/providers/dashboardViewProvider.test.ts test/extension/services/projectDataGateway.test.ts test/extension/services/dataManager.test.ts test/webview/components/dashboard.test.tsx`
  - Expected: FAIL only where the new payload/tab routing is not yet wired.

**Verification:** RED covers root isolation and compatibility, not visual snapshots alone.

**Risks / edge cases:** A failed Project switch must leave the previous watcher and visible data intact.

---

### Task 4.2: Remove duplicate Project-first Explorer loading while preserving detail panels, watcher routing, and legacy management flows.

**Spec coverage:** `dashboard` / Existing cache avoids click-time reload. `project-sidebar-tabs` / list browsing and detail behavior.

**Dependencies / order:** Tasks 1–3 implementation and RED tests.

**Implementation notes:** Delete only duplicate Project-first list loading; retain shared detail panels, watcher routing, and legacy management paths.

**Files:**
- Modify: `src/extension/providers/dashboardViewProvider.ts`
- Modify: `src/webview/types/messages.ts`
- Modify: `src/webview/context/AppContext.tsx` only if local tab context needs a typed state update
- Modify: `src/extension/providers/webviewMessageHandler.ts` only to preserve legacy/detail routing

- [ ] **Step 1: Route Project-first Header actions locally**
  - Ensure Changes/Specs tab actions never call `openExplorerPanel`.
- [ ] **Step 2: Retain detail panel paths**
  - Keep Change Detail and Spec Detail handlers binding-aware and reachable from Sidebar rows.
- [ ] **Step 3: Preserve watcher and legacy flows**
  - Do not change selected Project watcher retargeting or legacy Stores/Worksets management messages.
- [ ] **Step 4: Run focused regressions**
  - Run: `pnpm test -- test/extension/providers/dashboardViewProvider.test.ts test/webview/components/dashboard.test.tsx test/extension/providers/webviewMessageHandler.test.ts`
  - Expected: PASS.

**Verification:** No new list panels are created for Project-first tab navigation; detail and legacy paths remain covered.

**Risks / edge cases:** Do not delete shared Explorer components until all remaining non-Project-first callers are confirmed by tests.

---

### Task 4.3: Add GREEN command-count, cache, error-state, and message-routing coverage for the complete Sidebar path.

**Spec coverage:** all `project-sidebar-tabs`, `referenced-store-specs`, `workset-cli-open`, and modified `dashboard`/`cli-integration` requirements.

**Dependencies / order:** Task 4.2.

**Implementation notes:** Measure command reuse with deterministic spies and cover failure paths without introducing timing-sensitive benchmarks.

**Files:**
- Modify: `test/extension/providers/dashboardViewProvider.test.ts`
- Modify: `test/extension/services/projectDataGateway.test.ts`
- Modify: `test/webview/components/dashboard.test.tsx`
- Modify: `test/webview/components/worksetsPage.test.tsx`

- [ ] **Step 1: Assert command reuse**
  - Count root resolution and Store selector calls during one Project payload load.
  - Assert tab changes do not increment those counts.
- [ ] **Step 2: Assert failure states**
  - Exercise Store failure, fresh payload failure, invalid cache identity, and Workset CLI error.
  - Verify Project content remains usable and error text is safe.
- [ ] **Step 3: Run the combined focused suite**
  - Run: `pnpm test -- test/extension/providers/dashboardViewProvider.test.ts test/extension/services/projectDataGateway.test.ts test/webview/components/dashboard.test.tsx test/webview/components/worksetsPage.test.tsx`
  - Expected: PASS.

**Verification:** The suite proves the user-visible latency path no longer repeats full scans on tab clicks and all fail-soft boundaries remain intact.

**Risks / edge cases:** Keep tests deterministic by mocking process launch; reserve real CLI process checks for Task 5.
