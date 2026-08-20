# Task 2. Host navigation and panels

<!-- covers: Task 2.1, Task 2.2, Task 2.3 -->

### Task 2.1: Load and refresh compact Sidebar data for the current workspace Project

**Spec coverage:** `project-first-explorers` / `Project-first Sidebar Home` / `Active work is visible in the sidebar`, `No active changes still shows navigation`; `dashboard` / `Real-time Updates` / `New change created`, `Task completion updates current-project sidebar state`, `Change deleted`, `Sidebar receives refreshed project data`, `Task completion updates status`, `Sidebar receives refreshed dashboard data`; `dashboard` / `Dashboard Actions` / `Refresh data`; `openspec-scope-management` / `Selected OpenSpec scope` / `Local root scope`, `Scope selection clears stale dashboard data`.

**Dependencies / order:** Depends on Task 1.1 and gateway methods from Tasks 1.2-1.3. Complete before rendering the new Sidebar in Task 3.

**Files:**
- Create: none
- Modify: `src/extension/extension.ts`, `src/extension/providers/dashboardViewProvider.ts`
- Test: `test/extension/providers/dashboardViewProvider.test.ts`

**Implementation notes:**
- At activation, create one canonical `ProjectContext` from the same workspace folder/path that initializes the extension; inject that context and `ProjectDataGateway` into `DashboardViewProvider`. Do not infer a Project from Store registration or Workset membership.
- Add one provider loader for `ProjectSidebarData`: resolve the binding through the gateway, load current Project Changes, keep only active/unarchived entries for the compact list, and attach the existing diagnostic/cache/workflow configuration needed by the Sidebar.
- Keep `DataManager` subscribed as the watcher/refresh compatibility spine. On its refresh callback, reload and post the current Project payload; do not expand `DataManager.DashboardData` with the new page fields.
- Reject a completed async result if its Project/root binding no longer matches the provider's current binding. Keep the last matching cached payload visible with a stale/warning state on refresh failure.
- Manual refresh uses the same loader and existing refresh path; it must not create a second watcher or polling loop.

**Verification:** Initial reveal posts current-project active Changes, no archives; watcher/manual refresh posts the same page discriminant with a matching binding; a late response for a previous binding is discarded.

**Risks / edge cases:** Workspace folders may change while a CLI request is in flight. No-workspace and uninitialized-workspace states must remain explicit and must not be rendered as “no active Changes.”

- [ ] **Step 1 (RED): Write failing provider tests**

Cover initial load, active-only filtering, no active Changes, watcher refresh, manual refresh, late stale response, CLI activation failure, and uninitialized workspace classification.

- [ ] **Step 2 (RED): Run the focused tests**

Run: `rtk pnpm exec vitest run test/extension/providers/dashboardViewProvider.test.ts -t "project Sidebar|project refresh"`

Expected: FAIL because the provider still posts only legacy `dashboardData`.

- [ ] **Step 3 (GREEN): Add the single Project loader**

Inject the existing gateway/context, map its result to `ProjectSidebarData`, and reuse the current refresh subscription and diagnostic/cache helpers.

- [ ] **Step 4 (GREEN): Re-run the focused tests**

Run: `rtk pnpm exec vitest run test/extension/providers/dashboardViewProvider.test.ts -t "project Sidebar|project refresh"`

Expected: PASS; all accepted payloads match the current Project/root binding.

---

### Task 2.2: Open binding-keyed Changes and Specs Explorer panels from Sidebar messages

**Spec coverage:** `project-first-explorers` / `Changes Explorer for the Current Project` / `All Changes opens a project-bound explorer`, `Explorer state remains scoped during navigation`; `project-first-explorers` / `Specs Explorer Separates Project and Referenced Store Specs` / both scenarios; `dashboard` / `Dashboard Actions` / `Entry points open explorer pages`.

**Dependencies / order:** Depends on Task 2.1 and all Task 1 gateway data. Task 4 consumes the posted page contexts.

**Files:**
- Create: none
- Modify: `src/extension/providers/dashboardViewProvider.ts`, `src/extension/providers/webviewMessageHandler.ts`, `src/webview/types/messages.ts`
- Test: `test/extension/providers/dashboardViewProvider.test.ts`, `test/extension/providers/webviewMessageHandler.test.ts`

**Implementation notes:**
- Handle `openChangesExplorer` and `openSpecsExplorer` in `DashboardViewProvider`, because it already owns sidebar/editor webviews. Validate the requested binding against the provider-created current binding before opening a panel.
- Keep two explicit panel slots or one map keyed by `pageKind + projectId + rootPath + rootSource + storeId`; reveal an existing matching panel and post fresh context instead of creating duplicates.
- Use `retainContextWhenHidden` and the existing `getWebviewContent()` lifecycle. Post `setContext` with page kind and the matching `ProjectChangesExplorerData` or `ProjectSpecsExplorerData` after webview readiness, following the existing pending-context pattern.
- Preserve explorer local search/filter/sort/page state when a matching panel is revealed. A different binding gets a different panel/data context.
- Do not add React Router, a new panel manager class, a global panel registry, or Workset navigation.

**Verification:** Clicking each Sidebar entry opens/reveals exactly one correctly keyed editor panel; same page under a different binding does not reuse the first panel; disposed panels are removed.

**Risks / edge cases:** Webview readiness can race the first payload, and disposed panels can receive late promises. Reuse the existing pending-context/dispose guards rather than adding timers beyond current patterns.

- [ ] **Step 1 (RED): Write failing panel lifecycle tests**

Cover open/reveal/dispose for both page kinds, binding mismatch rejection, same binding reuse, different binding isolation, and fresh payload posting.

- [ ] **Step 2 (RED): Run the focused tests**

Run: `rtk pnpm exec vitest run test/extension/providers/dashboardViewProvider.test.ts test/extension/providers/webviewMessageHandler.test.ts -t "Changes Explorer panel|Specs Explorer panel|binding mismatch"`

Expected: FAIL because Explorer messages and binding-keyed panels are not implemented.

- [ ] **Step 3 (GREEN): Add minimal provider-owned panels**

Extend the existing provider lifecycle and message switch with two page kinds and one binding-aware key function; reuse existing webview HTML and disposal code.

- [ ] **Step 4 (GREEN): Re-run the focused tests**

Run: `rtk pnpm exec vitest run test/extension/providers/dashboardViewProvider.test.ts test/extension/providers/webviewMessageHandler.test.ts -t "Changes Explorer panel|Specs Explorer panel|binding mismatch"`

Expected: PASS; panel identity follows page plus binding, never resource name alone.

---

### Task 2.3: Preserve Project/root binding when opening Change, archive, and Spec detail views

**Spec coverage:** `project-first-explorers` / `Explicit Project Binding and Isolation` / `Same-named changes remain isolated by binding`; `project-first-explorers` / `Changes Explorer for the Current Project` / `Explorer state remains scoped during navigation`; `dashboard` / `Change Navigation` / `Click to open current-project change`, `Click to open change`, `Quick actions do not steal card navigation`.

**Dependencies / order:** Depends on Task 2.2 panel messages. Complete before Tasks 3.2, 4.2, and 4.3 wire resource clicks.

**Files:**
- Create: none
- Modify: `src/extension/providers/dashboardViewProvider.ts`, `src/extension/providers/changeDetailPanelManager.ts`, `src/extension/providers/webviewMessageHandler.ts`, `src/webview/types/messages.ts`
- Test: `test/extension/providers/dashboardViewProvider.test.ts`, `test/extension/providers/webviewMessageHandler.test.ts`

**Implementation notes:**
- Extend open-Change, open-archived-Change, and open-Spec requests with the originating `ProjectContext`/`OpenSpecRootBinding`; verify the host-created binding before converting it to the existing compatibility scope/read path.
- Key Change Detail by binding plus the current change identifier. Keep `archive:<directoryName>` for archives. Key Spec panels by binding plus `storeId` plus Spec id, so duplicate ids cannot collide.
- Adapt a verified binding to existing `OpenSpecScope`/`FileManagerService` operations at one host boundary. Do not let `ChangeDetailPanelManager.resolveScope()` fall back to mutable `getSelectedScope()` for a Project-first request.
- Preserve the existing detail components, `Verify & Archive` behavior, workflow launch adapters, and legacy scope-only callers. This task changes identity transport, not detail UX.
- On mismatch or unreadable root, fail closed and keep the originating Explorer visible; never retry by name against the selected scope.

**Verification:** Two Projects with the same Change/Spec ids open distinct bound details; archived navigation reads the matching root; legacy callers without a Project binding retain current behavior.

**Risks / edge cases:** Webview payloads are untrusted. Compare canonical host-known binding fields and never accept an arbitrary root path supplied by the webview. Store-referenced Spec identity must include Store id.

- [ ] **Step 1 (RED): Write failing isolation tests**

Add same-named Project A/B Change, archive, Project Spec, and referenced Store Spec cases plus a forged/mismatched binding case and legacy scope regression case.

- [ ] **Step 2 (RED): Run the focused tests**

Run: `rtk pnpm exec vitest run test/extension/providers/dashboardViewProvider.test.ts test/extension/providers/webviewMessageHandler.test.ts -t "bound detail|same-named|forged binding"`

Expected: FAIL because detail opens still resolve primarily by name and mutable scope.

- [ ] **Step 3 (GREEN): Thread the verified binding through existing opens**

Add the binding fields and one host-side verification/adaptation path; retain the existing detail panel/rendering implementations.

- [ ] **Step 4 (GREEN): Re-run the focused tests**

Run: `rtk pnpm exec vitest run test/extension/providers/dashboardViewProvider.test.ts test/extension/providers/webviewMessageHandler.test.ts -t "bound detail|same-named|forged binding"`

Expected: PASS; Project-first details never fall back to another binding, and legacy callers still pass.
