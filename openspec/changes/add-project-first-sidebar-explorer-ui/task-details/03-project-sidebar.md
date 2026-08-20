# Task 3. Compact Project Sidebar

<!-- covers: Task 3.1, Task 3.2, Task 3.3 -->

### Task 3.1: Render current Project identity, active Changes, and persistent Explorer entry points

**Spec coverage:** `project-first-explorers` / `Project-first Sidebar Home` / both scenarios; `dashboard` / `Change List Display` / `Sidebar shows only current-project active work`, `No active changes still keeps entry points`, `Empty state`, `Change card shows created and updated metadata`, `Missing created time falls back gracefully`, `Proposal Why summary display`, `Missing Proposal Why summary`; `dashboard` / `Dashboard Actions` / `Create new change`, `Entry points open explorer pages`.

**Dependencies / order:** Depends on Task 2.1 host payload and Task 1.1 messages. Complete before Tasks 3.2-3.3.

**Files:**
- Create: none
- Modify: `src/webview/context/AppContext.tsx`, `src/webview/components/Dashboard.tsx`, `src/webview/components/Header.tsx`, `src/webview/components/ChangesSection.tsx`, `src/webview/types/messages.ts`
- Test: `test/webview/components/dashboard.test.tsx`, `test/webview/components/changesSection.test.tsx`, `test/webview/components/changeCard.test.tsx`

**Implementation notes:**
- Keep `Dashboard` as the Sidebar component to minimize churn, but feed it `ProjectSidebarData` and render the Project label/root-source summary as its primary identity.
- Render only active/unarchived Changes already selected by the host. Keep existing Change card metadata, accessible Why tooltip, progress, hover/focus actions, and New Change action.
- Add always-visible All Changes and Specs controls above or below the active list. They remain enabled in the no-active-Changes state and send the typed binding-carrying open messages.
- Reuse `ChangesSection`/`ChangeCard` through a compact mode prop only if needed; do not fork card rendering or reimplement lifecycle helpers.
- Use existing VS Code theme tokens and i18n keys. New icon-only controls require accessible labels/tooltips; no new UI dependency.

**Verification:** Sidebar shows Project identity and active cards only; archived/complete archive entries are absent; All Changes, Specs, and New Change stay reachable when the list is empty; keyboard/card behavior remains intact.

**Risks / edge cases:** A completed-but-not-archived Change may still be unarchived and must follow the host's existing lifecycle definition of “active/unarchived,” not a new webview guess. Long Project labels must not overflow narrow sidebars.

- [ ] **Step 1 (RED): Write failing Sidebar render tests**

Cover active plus archived input, empty active input, long Project label, missing timestamps/Why, persistent entry points, and keyboard activation.

- [ ] **Step 2 (RED): Run the focused tests**

Run: `rtk pnpm exec vitest run test/webview/components/dashboard.test.tsx test/webview/components/changesSection.test.tsx test/webview/components/changeCard.test.tsx -t "Project Sidebar|Explorer entry|active work"`

Expected: FAIL because Dashboard still renders the mixed root-scoped experience.

- [ ] **Step 3 (GREEN): Reshape the existing Dashboard minimally**

Consume `ProjectSidebarData`, enable compact rendering on reused components, and add the two typed entry controls.

- [ ] **Step 4 (GREEN): Re-run the focused tests**

Run: `rtk pnpm exec vitest run test/webview/components/dashboard.test.tsx test/webview/components/changesSection.test.tsx test/webview/components/changeCard.test.tsx -t "Project Sidebar|Explorer entry|active work"`

Expected: PASS; compact Sidebar content remains usable at narrow width.

---

### Task 3.2: Preserve workflow actions, CLI diagnostics, cache feedback, and accessible empty states

**Spec coverage:** `dashboard` / `Change Navigation` / `Quick actions do not steal card navigation`, `Hover and focus reveal workflow actions`; `dashboard` / `Cache-aware dashboard rendering` / `Open sidebar with cached current-project data`, `Fresh sidebar data replaces cache`, `Open dashboard with cached data`, `Fresh dashboard data replaces cache`; `dashboard` / `Dashboard Actions` / `Workflow quick actions route through shared launch settings`, `Copy-command quick action generates a clipboard-safe command`, `Verify and Archive open the interactive workflow`, `Copy opsx command`, `Open workflow command from quick action through launch settings`, `Cursor quick action uses hyphen command when adapter launch is selected`, `Default dashboard quick action is clipboard safe`, `Dashboard Verify quick action opens interactive workflow`, `Dashboard Archive quick action opens interactive workflow`; `dashboard` / `CLI Activation Failure State` / all retained diagnostic scenarios.

**Dependencies / order:** Depends on Task 3.1 compact render and Task 2.3 bound detail opens. Task 5.2 performs the broader regression pass.

**Files:**
- Create: none
- Modify: `src/webview/context/AppContext.tsx`, `src/webview/components/Dashboard.tsx`, `src/webview/components/ChangeCard.tsx`
- Test: `test/webview/components/dashboard.test.tsx`, `test/webview/components/changeCard.test.tsx`, `test/webview/utils/workflowLaunchLabels.test.ts`

**Implementation notes:**
- Keep the existing shared workflow message builders and launch configuration. Continue/FF/Apply/Sync remain delivery actions; Verify/Archive continue opening Change Detail at `Verify & Archive` and never call direct archive/headless execution.
- Keep cached Project data visible while fresh data loads and show the existing stale/refresh feedback. Only accept cache/fresh messages whose binding matches the current page identity.
- Reuse the existing CLI activation diagnostic card and host-sanitized `safeDetails`/recovery actions. Distinguish CLI-unavailable from workspace-not-initialized; never add a filesystem fallback.
- Preserve `stopPropagation`, hover plus focus reveal, readable text alongside color/spinner, reduced-motion behavior, and accessible empty/error/search states.
- Add only missing i18n strings for Project-first wording. Do not redesign workflow delivery or diagnostics.

**Verification:** Existing workflow targets/command formats are unchanged; stale cache and refresh errors keep matching content visible; diagnostic recovery actions remain functional and sanitized; keyboard/reduced-motion tests pass.

**Risks / edge cases:** A refresh failure after cached content must become a warning, not replace the page with a blocking empty state. A click on a quick action must not also open the card.

- [ ] **Step 1 (RED): Add Project-first regression tests**

Cover cached-then-fresh, cached-then-error, mismatched cache rejection, blocking/warning diagnostics, uninitialized workspace, each workflow routing class, event propagation, keyboard focus, and reduced motion.

- [ ] **Step 2 (RED): Run the focused tests**

Run: `rtk pnpm exec vitest run test/webview/components/dashboard.test.tsx test/webview/components/changeCard.test.tsx test/webview/utils/workflowLaunchLabels.test.ts -t "project cache|CLI diagnostic|workflow quick action|keyboard"`

Expected: At least one new Project-binding/cache assertion FAILS before the compact Sidebar preserves these behaviors.

- [ ] **Step 3 (GREEN): Reconnect existing behavior to the new payload**

Adapt existing rendering/message calls to `ProjectSidebarData`; add binding guards but no duplicate workflow or diagnostic implementation.

- [ ] **Step 4 (GREEN): Re-run the focused tests**

Run: `rtk pnpm exec vitest run test/webview/components/dashboard.test.tsx test/webview/components/changeCard.test.tsx test/webview/utils/workflowLaunchLabels.test.ts -t "project cache|CLI diagnostic|workflow quick action|keyboard"`

Expected: PASS; behavior is preserved under the new binding-aware payload.

---

### Task 3.3: Remove root selection and Store/Workset administration from the default Sidebar UI

**Spec coverage:** `dashboard` removed requirements `Scope transition feedback`, `Scope Bar`, `Store selection`, `Root health display`, `Read-only references panel`, `Workset entry points`, `Specs Overview`, `Archive Overview`, `OpenSpec root selector clarity`, `Root-scoped empty states`, `Scoped archive overview`, `Stores and worksets maintenance panel`, `OpenSpec Root Selector Separates Projects And Stores`, `Worksets Workspace Page`, and `Workset And Root Semantics Are Clear`; `openspec-scope-management` / `Selected OpenSpec scope` / `Explicit store scope`.

**Dependencies / order:** Depends on Tasks 3.1-3.2 so replacement Project identity/navigation is present before legacy UI is hidden.

**Files:**
- Create: none
- Modify: `src/webview/components/Dashboard.tsx`, `src/webview/components/Header.tsx`
- Test: `test/webview/components/dashboard.test.tsx`, `test/webview/components/storesAndWorksetsPanel.test.tsx`, `test/webview/components/worksetsPage.test.tsx`

**Implementation notes:**
- Stop rendering the root selector, `StoresAndWorksetsPanel`, Workset entry points, inline canonical Specs overview, and archive overview from the default Sidebar.
- Keep `StoresAndWorksetsPanel`, `WorksetsPage`, Store/Workset messages, `OpenSpecScopeManager`, and `DataManager` compatibility methods in source. This Change removes the default entry, not the services.
- Do not delete i18n keys or tests still used by compatibility surfaces. Update only Dashboard expectations that intentionally change.
- Legacy explicit Store scope may still be used by existing commands/details, but changing it must not redirect an already-open Project-first page.
- Avoid feature flags or configuration for the old layout; rollback remains a source revert, as defined by the design.

**Verification:** Default Sidebar DOM contains no root selector, Stores/Worksets maintenance panel, inline Specs, or archive overview; direct component tests for retained Store/Workset surfaces continue to pass.

**Risks / edge cases:** Removing a render branch can accidentally remove shared diagnostic/cache controls housed nearby. Assert those remain present. Do not delete underlying service subscriptions used outside Dashboard.

- [ ] **Step 1 (RED): Write removal and retention tests**

Assert the default Sidebar omits all retired surfaces while direct `StoresAndWorksetsPanel` and `WorksetsPage` tests still render their supported compatibility behavior.

- [ ] **Step 2 (RED): Run the focused tests**

Run: `rtk pnpm exec vitest run test/webview/components/dashboard.test.tsx test/webview/components/storesAndWorksetsPanel.test.tsx test/webview/components/worksetsPage.test.tsx -t "Project-first default|Store|Workset"`

Expected: FAIL because the legacy administration surfaces still render in Dashboard.

- [ ] **Step 3 (GREEN): Remove only default render paths**

Delete the obsolete Dashboard/Header branches and props; leave component/service implementations available to compatibility callers.

- [ ] **Step 4 (GREEN): Re-run the focused tests**

Run: `rtk pnpm exec vitest run test/webview/components/dashboard.test.tsx test/webview/components/storesAndWorksetsPanel.test.tsx test/webview/components/worksetsPage.test.tsx -t "Project-first default|Store|Workset"`

Expected: PASS; retired UI is absent only from the default Sidebar.
