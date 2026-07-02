# Task 3. Worksets Workspace Page

<!-- covers: Task 3.1, Task 3.2, Task 3.3 -->

### Task 3.1: Add a dedicated Worksets workspace page

**Spec coverage:** `dashboard` / `Worksets Workspace Page` / `Workset list shows CLI metadata`, `Empty workset list`; `Workset And Root Semantics Are Clear` / `Current root remains visible while managing worksets`

**Dependencies / order:** Follows Task 1 and can run in parallel with Task 2 after data shape is stable.

**Files:**
- Create or modify: `src/webview/components/WorksetsPage.tsx`
- Modify: `src/webview/components/Dashboard.tsx`
- Modify: `src/webview/App.tsx` if dashboard-level view state belongs there
- Test: `test/webview/components/worksetsPage.test.tsx` or update `test/webview/components/worksetsPanel.test.tsx`

**Implementation notes:**
- Use a small local view state such as `'overview' | 'worksets'` rather than adding a full router.
- Keep `ScopeBar` visible in dashboard context; if the page is a child of Dashboard, ensure the status rail remains above it.
- Provide a clear back action to the current root overview.

**Verification:**
- Run `zsh -lc 'source ~/.zshrc && rtk pnpm test -- --run test/webview/components/dashboard.test.tsx test/webview/components/worksetsPage.test.tsx'`.
- Expected: dashboard can navigate to Worksets page and back while current root context remains visible.

**Risks / edge cases:**
- If the current Dashboard component already owns too much state, keep the first version local and avoid introducing app-wide routing complexity.

- [ ] **Step 1: Write the failing page navigation test**

Add or update a webview component test that renders Dashboard with worksets, clicks the workspace/worksets entry, and expects a Worksets page heading plus current root label.

- [ ] **Step 2: Run test and expect FAIL**

Run `zsh -lc 'source ~/.zshrc && rtk pnpm test -- --run test/webview/components/dashboard.test.tsx'`.
Expected: Worksets page assertions fail before the page exists.

- [ ] **Step 3: Implement the Worksets page component**

Create the page component or expand the existing panel into a page component with a heading, short semantic explanation, back action, and a list area.

- [ ] **Step 4: Wire dashboard navigation**

Add a workspace entry from the overview to the Worksets page without changing existing change/spec workflows.

- [ ] **Step 5: Run navigation tests and expect PASS**

Run `zsh -lc 'source ~/.zshrc && rtk pnpm test -- --run test/webview/components/dashboard.test.tsx test/webview/components/worksetsPage.test.tsx'`.
Expected: navigation and current root visibility tests pass.

---

### Task 3.2: Render workset metadata, primary member, empty state, and open action

**Spec coverage:** `dashboard` / `Worksets Workspace Page` / `Workset list shows CLI metadata`, `First workset member is primary`, `Workset open action launches workspace view`, `Empty workset list`; `Workset And Root Semantics Are Clear` / `Workset page explains root selection remains explicit`

**Dependencies / order:** Follows Task 3.1.

**Files:**
- Modify: `src/webview/components/WorksetsPage.tsx` or `src/webview/components/WorksetsPanel.tsx`
- Modify: `src/webview/types/messages.ts` only if action payloads need expansion
- Test: `test/webview/components/worksetsPage.test.tsx` or `test/webview/components/worksetsPanel.test.tsx`

**Implementation notes:**
- Show `workset.name`, `workset.tool`, `workset.members.length`, and each `member.name/path`.
- Mark `workset.members[0]` as Primary.
- Invoke existing `onOpenWorkset(name)` for the Open action.
- Do not call `onSelectScope` from the Worksets page.

**Verification:**
- Run `zsh -lc 'source ~/.zshrc && rtk pnpm test -- --run test/webview/components/worksetsPage.test.tsx test/webview/components/worksetsPanel.test.tsx'`.
- Expected: metadata, primary member, empty state, and open action tests pass.

**Risks / edge cases:**
- Long member paths can overflow narrow sidebars. Use truncation with title text for full paths.
- Worksets with duplicate member names should remain distinguishable by path.

- [ ] **Step 1: Write metadata rendering tests**

Add tests with a workset containing two members and assert name, tool, member count, primary label, and both paths render.

- [ ] **Step 2: Write open-action test**

Add a test that triggers the Open button and asserts `onOpenWorkset` receives only the workset name.

- [ ] **Step 3: Run tests and expect FAIL**

Run `zsh -lc 'source ~/.zshrc && rtk pnpm test -- --run test/webview/components/worksetsPage.test.tsx test/webview/components/worksetsPanel.test.tsx'`.
Expected: page metadata/open-action assertions fail before implementation.

- [ ] **Step 4: Implement metadata and action UI**

Render the workset cards/list rows with stable dimensions, primary-member marker, path truncation, and an Open action.

- [ ] **Step 5: Run targeted tests and expect PASS**

Run `zsh -lc 'source ~/.zshrc && rtk pnpm test -- --run test/webview/components/worksetsPage.test.tsx test/webview/components/worksetsPanel.test.tsx'`.
Expected: all Worksets UI tests pass.

---

### Task 3.3: Refactor duplicate inline workset UI into navigation or remove it

**Spec coverage:** `dashboard` / `Workset And Root Semantics Are Clear` / `Store and project maintenance is separate from workset launching`

**Dependencies / order:** Follows Task 3.1 and Task 3.2.

**Files:**
- Modify: `src/webview/components/StoresAndWorksetsPanel.tsx`
- Modify: `src/webview/components/WorksetsPanel.tsx` if it remains as an entry component
- Modify: `test/webview/components/storesAndWorksetsPanel.test.tsx`
- Modify: `test/webview/components/worksetsPanel.test.tsx` if the component changes role

**Implementation notes:**
- Keep store setup/register and references in the store/root management surface.
- Replace inline workset rows with a compact Worksets entry that opens the dedicated page, or remove the duplicated panel entirely if Dashboard navigation already provides the entry.
- Preserve existing store/reference tests by updating expected labels, not by weakening assertions.

**Verification:**
- Run `zsh -lc 'source ~/.zshrc && rtk pnpm test -- --run test/webview/components/storesAndWorksetsPanel.test.tsx test/webview/components/worksetsPanel.test.tsx'`.
- Expected: store/reference management remains covered and duplicate inline workset list is gone or converted to navigation.

**Risks / edge cases:**
- Removing the old panel abruptly may hide store actions. Keep store/register/setup affordances visible from the workspace/store management area.

- [ ] **Step 1: Update tests for separated surfaces**

Adjust tests so `StoresAndWorksetsPanel` no longer expects full inline workset rows, and instead expects store/reference actions plus a Worksets navigation affordance if that component remains.

- [ ] **Step 2: Run tests and expect FAIL**

Run `zsh -lc 'source ~/.zshrc && rtk pnpm test -- --run test/webview/components/storesAndWorksetsPanel.test.tsx'`.
Expected: tests fail until duplicate inline UI is refactored.

- [ ] **Step 3: Refactor component composition**

Move full workset rendering to the dedicated page and leave only navigation or no workset content in the store/root panel.

- [ ] **Step 4: Run targeted tests and expect PASS**

Run `zsh -lc 'source ~/.zshrc && rtk pnpm test -- --run test/webview/components/storesAndWorksetsPanel.test.tsx test/webview/components/worksetsPanel.test.tsx'`.
Expected: separated-surface tests pass.
