# Task 2. Host Project switching and watcher retargeting

<!-- covers: Task 2.1, Task 2.2, Task 2.3 -->

### Task 2.1: Add RED provider and watcher tests for valid selection, forged/stale member rejection, return-to-current, and single-root retargeting.

**Spec coverage:** `workset-project-navigation` / Host-validated Project switching / valid and forged selection; `workset-project-navigation` / Single selected-Project watcher / retarget and failed switch; `dashboard` / Project-first Workset navigation scene.

**Dependencies / order:** Task 1.2; gateway API must be available to inject in provider tests.

**Files:**
- Create: none
- Modify: `test/extension/providers/dashboardViewProvider.test.ts`, `test/extension/services/fileWatcher.test.ts`, `test/extension/services/dataManager.test.ts`
- Test: the three files above

**Implementation notes:**
- Extend provider fixtures with current Project, eligible Workset member, forged path, a different Project with the same Change name, and a selected legacy Store scope.
- Capture the Webview message handler and assert a valid select message invokes host validation and reloads the selected Project; forged/expired requests must not call binding resolution or watcher retarget.
- Add watcher tests proving only one set of patterns exists after retarget and the old target is disposed.

**Verification:**
- Primary command: `pnpm exec vitest run test/extension/providers/dashboardViewProvider.test.ts test/extension/services/fileWatcher.test.ts test/extension/services/dataManager.test.ts -t "workset|Project.*switch|retarget|selected Project"`
- Expected result: FAIL before the host switch and retarget methods exist.

**Risks / edge cases:**
- Keep the original Project context available for the return action; do not derive it from a Webview payload.

- [ ] **Step 1: Write the failing provider and watcher tests**

- [ ] **Step 2: Run focused verification — expect FAIL**

Run the command above and retain the assertion showing the missing message/retarget behavior.

- [ ] **Step 3: Check that the failure is at the host boundary, not a malformed fixture**

Verify the injected gateway returns canonical member and binding data before implementation.

- [ ] **Step 4: Leave the worktree at the RED checkpoint before Task 2.2**

Do not implement production code in this task.

---

### Task 2.2: Implement fresh membership validation, ProjectContext/OpenSpecRootBinding replacement, and single selected-Project watcher retargeting.

**Spec coverage:** `workset-project-navigation` / Host-validated Project switching; `workset-project-navigation` / Project view reuse and return navigation; `workset-project-navigation` / Single selected-Project watcher; `openspec-scope-management` / Project binding refreshed after navigation.

**Dependencies / order:** Task 2.1 RED evidence and Task 1.2 gateway implementation.

**Files:**
- Create: none
- Modify: `src/extension/providers/dashboardViewProvider.ts`, `src/extension/services/dataManager.ts`, `src/extension/services/fileWatcher.ts`, `src/webview/types/messages.ts`
- Test: provider/DataManager/FileWatcher focused tests

**Implementation notes:**
- Add typed `selectWorksetProject` and `selectCurrentProject` messages. The provider must call a fresh gateway resolver, not trust submitted binding/root fields.
- Update `projectContext` and `currentProjectBinding` only after membership and binding checks pass; clear old project cache state as needed, retarget the watcher once, then reload/post the normal Sidebar payload.
- Add a host-owned origin Project field for return navigation. A failure must leave context, binding, watcher, and visible data unchanged.
- Keep `createProjectBoundScope` and existing Project-first workflow/content paths as the binding bridge; do not add router/session/global registry.

**Verification:**
- Primary command: `pnpm exec vitest run test/extension/providers/dashboardViewProvider.test.ts test/extension/services/fileWatcher.test.ts test/extension/services/dataManager.test.ts -t "workset|Project.*switch|retarget|selected Project"`
- Expected result: PASS for valid switch, return, reject, and one-watcher behavior.

**Risks / edge cases:**
- A selected Project may resolve to a different root or CLI-declared Store; retain the returned binding exactly and never replace it with the selected legacy scope.
- Existing open panels keep their own binding; do not mutate their panel scopes during Sidebar navigation.

- [ ] **Step 1: Implement the minimal typed message and provider switch path**

- [ ] **Step 2: Implement watcher retarget with disposal-before-create and tracked relative root**

- [ ] **Step 3: Run focused verification — expect PASS**

Run the command above. Expected: PASS.

- [ ] **Step 4: Inspect the resulting message path for stale binding and selected Store fallback**

The provider must not call `DataManager.resolveScope(message.scopeId)` for Project navigation.

---

### Task 2.3: Add GREEN provider regression coverage for binding identity, failed-switch preservation, and Project-first refresh routing.

**Spec coverage:** `workset-project-navigation` / Host-validated Project switching / same-named isolation precondition; `dashboard` / Project-first Workset navigation scene; `openspec-scope-management` / metadata unavailable.

**Dependencies / order:** Task 2.2.

**Files:**
- Create: none
- Modify: `test/extension/providers/dashboardViewProvider.test.ts`, `test/extension/services/dataManager.test.ts`
- Test: the files above

**Implementation notes:**
- Assert the posted Sidebar payload changes to the selected Project and contains the newly resolved binding, then returns to the origin Project with no old data leak.
- Assert gateway/CLI failure posts the existing error/stale behavior without switching watcher or selected legacy Store scope.
- Assert refresh callbacks in Project-first mode continue using the Project gateway rather than legacy DataManager selected scope.

**Verification:**
- Primary command: `pnpm exec vitest run test/extension/providers/dashboardViewProvider.test.ts test/extension/services/dataManager.test.ts -t "Project Sidebar|workset|binding|refresh"`
- Expected result: PASS.

**Risks / edge cases:**
- Do not broaden the test to legacy `StoresAndWorksetsPanel` management; that remains outside this Change.

- [ ] **Step 1: Add post-switch and failure-preservation assertions**

- [ ] **Step 2: Run focused verification — expect PASS**

- [ ] **Step 3: Run the full provider test file**

Run: `pnpm exec vitest run test/extension/providers/dashboardViewProvider.test.ts`

Expected: PASS.

- [ ] **Step 4: Review all host changes for the single watcher invariant**

There must be no per-Workset watcher list or persistent membership file.
