# Task 4. Binding isolation and legacy compatibility

<!-- covers: Task 4.1, Task 4.2, Task 4.3 -->

### Task 4.1: Add RED tests for same-named Change/Spec isolation across Projects and unchanged legacy scope-only Workset behavior.

**Spec coverage:** `workset-project-navigation` / Host-validated Project switching / same-named Change or Spec; `openspec-scope-management` / Project binding refreshed after navigation; `workset-project-navigation` / Project view reuse.

**Dependencies / order:** Tasks 1.2 and 2.2.

**Files:**
- Modify: `test/extension/providers/dashboardViewProvider.test.ts`, `test/extension/providers/changeDetailPanelManager.test.ts`, `test/extension/providers/webviewMessageHandler.test.ts`, `test/webview/components/changesExplorer.test.tsx`, `test/webview/components/specsExplorer.test.tsx`
- Test: the files above

**Implementation notes:**
- Add two Projects with the same Change and Spec ids but different roots/bindings; assert open Change/Spec requests resolve to the selected Project binding and never to the legacy selected Store scope.
- Add a legacy scope-only message test for `openWorkset`/management behavior and ensure it still routes through the existing DataManager path.
- Include a stale/forged binding test that fails closed instead of opening a same-named artifact from the wrong root.

**Verification:**
- Primary command: `pnpm exec vitest run test/extension/providers/dashboardViewProvider.test.ts test/extension/providers/changeDetailPanelManager.test.ts test/extension/providers/webviewMessageHandler.test.ts test/webview/components/changesExplorer.test.tsx test/webview/components/specsExplorer.test.tsx -t "binding|same.*name|scope|workset"`
- Expected result: FAIL for the new cross-Project assertions before the complete navigation path is wired.

**Risks / edge cases:**
- Keep panel keys and bound scopes immutable per panel; a Sidebar Project switch must not retarget an existing Change Detail panel.

- [ ] **Step 1: Write the failing cross-root and legacy compatibility tests**

- [ ] **Step 2: Run focused verification — expect FAIL**

Run the command above and record the first incorrect root or missing message assertion.

- [ ] **Step 3: Confirm the failing path is the new Project navigation path**

Do not weaken existing legacy scope-only expectations to make the RED test pass.

- [ ] **Step 4: Preserve the RED evidence before Task 4.2**

---

### Task 4.2: Route all Project-first navigation and content actions through the current Host binding without altering legacy management or adapter flows.

**Spec coverage:** `workset-project-navigation` / Host-validated Project switching and same-named isolation; `openspec-scope-management` / Workset Project and Planning Store boundaries; `dashboard` / switching Project reuses content navigation.

**Dependencies / order:** Task 4.1 RED evidence; Tasks 2.2 and 3.2.

**Files:**
- Create: none
- Modify: `src/extension/providers/dashboardViewProvider.ts`, `src/extension/providers/changeDetailPanelManager.ts`, `src/extension/providers/webviewMessageHandler.ts`, `src/webview/types/messages.ts`
- Test: focused provider/message/panel tests

**Implementation notes:**
- Ensure Sidebar actions use `projectSidebarBoundScope()` derived from `currentProjectBinding`; webview `scopeId`, rootPath, and binding fields cannot redirect Project-first actions.
- Keep existing `verifyProjectBinding`/full binding equality and `createProjectBoundScope` path for Change Detail, Spec Detail, Explorer, task, and workflow operations.
- Ensure current Project return and next Project selection refresh the Sidebar navigation payload, while existing panel bindings remain isolated.

**Verification:**
- Primary command: `pnpm exec vitest run test/extension/providers/dashboardViewProvider.test.ts test/extension/providers/changeDetailPanelManager.test.ts test/extension/providers/webviewMessageHandler.test.ts -t "Project|binding|scope|workset"`
- Expected result: PASS.

**Risks / edge cases:**
- Do not make `selectedScope` a hidden fallback for a Project-first action when the current binding is temporarily unavailable; reject or show existing error behavior instead.

- [ ] **Step 1: Implement the smallest binding propagation and stale-request guards**

- [ ] **Step 2: Run focused verification — expect PASS**

- [ ] **Step 3: Re-run the RED isolation tests**

Expected: PASS for both Project roots and for legacy scope-only messages.

- [ ] **Step 4: Review adapter calls for unchanged workflow delivery semantics**

No new adapter, prompt, or workflow command format is allowed in this Change.

---

### Task 4.3: Run focused integration regressions for Change Detail, Spec Detail, Explorer, workflow, and watcher root isolation.

**Spec coverage:** all `workset-project-navigation` binding/watcher scenarios; `dashboard` Project-first navigation; `openspec-scope-management` Project binding semantics.

**Dependencies / order:** Task 4.2.

**Files:**
- Create: none
- Modify: tests only if a regression assertion is missing
- Test: `test/extension/providers/dashboardViewProvider.test.ts`, `test/extension/providers/changeDetailPanelManager.test.ts`, `test/extension/providers/webviewMessageHandler.test.ts`, `test/extension/services/dataManager.test.ts`, `test/webview/components/dashboard.test.tsx`

**Implementation notes:**
- Run the exact focused set and inspect failures by root identity, not only by matching Change name.
- Verify a Store member is never passed to `createProjectContext` as a Project selection and that current Project navigation remains usable when Workset metadata disappears.

**Verification:**
- Primary command: `pnpm exec vitest run test/extension/providers/dashboardViewProvider.test.ts test/extension/providers/changeDetailPanelManager.test.ts test/extension/providers/webviewMessageHandler.test.ts test/extension/services/dataManager.test.ts test/webview/components/dashboard.test.tsx`
- Expected result: PASS.

**Risks / edge cases:**
- A passing build without root assertions is insufficient; inspect the test output and changed call sites for every Project-bound operation.

- [ ] **Step 1: Run the focused integration set**

- [ ] **Step 2: Fix only failures caused by this Change**

- [ ] **Step 3: Re-run the focused integration set — expect PASS**

- [ ] **Step 4: Record any pre-existing warnings separately from new failures**
