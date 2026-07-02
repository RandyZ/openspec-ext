# Task 1. Workset Data Contract

<!-- covers: Task 1.1, Task 1.2 -->

### Task 1.1: Preserve workset member metadata from CLI data

**Spec coverage:** `dashboard` / `Worksets Workspace Page` / `Workset list shows CLI metadata`, `First workset member is primary`

**Dependencies / order:** Run before Task 3 so the Worksets page can rely on stable data.

**Files:**
- Modify: `src/webview/types/messages.ts`
- Modify: `src/extension/services/dataManager.ts`
- Test: `test/extension/services/dataManager.test.ts`

**Implementation notes:**
- Keep `WorksetView.members` in the same order returned by `openspec workset list --json`.
- Preserve `name`, `tool`, and `members[].name/path`; add optional fields only if the CLI payload already exposes them and the UI needs them.
- Do not infer store/project root selection from workset members. Classification badges can be UI-only later.

**Verification:**
- Run `zsh -lc 'source ~/.zshrc && rtk pnpm test -- --run test/extension/services/dataManager.test.ts'`.
- Expected: DataManager tests pass and parsed worksets retain member order.

**Risks / edge cases:**
- CLI may omit `members`, `tool`, or member names. Parser must return safe empty strings/arrays without throwing.
- A workset with zero members must remain renderable; the Worksets page handles the empty-member state.

- [ ] **Step 1: Write the failing test**

Add a test in `test/extension/services/dataManager.test.ts` that stubs `cliService.runJson(['workset', 'list', '--json'])` with a workset containing two members and asserts the refreshed dashboard data exposes both members in order.

- [ ] **Step 2: Run test and expect FAIL**

Run `zsh -lc 'source ~/.zshrc && rtk pnpm test -- --run test/extension/services/dataManager.test.ts'`.
Expected: the new assertion fails if the current parser drops or reorders member data.

- [ ] **Step 3: Implement the minimal parser/data shape change**

Update `DataManager.listWorksets()` and `WorksetView` types only as needed to preserve the CLI fields used by the UI.

- [ ] **Step 4: Run test and expect PASS**

Run `zsh -lc 'source ~/.zshrc && rtk pnpm test -- --run test/extension/services/dataManager.test.ts'`.
Expected: the new workset parsing test passes.

---

### Task 1.2: Add tests for defensive workset parsing and primary-member order

**Spec coverage:** `dashboard` / `Worksets Workspace Page` / `Workset list shows CLI metadata`, `First workset member is primary`, `Empty workset list`

**Dependencies / order:** Follows Task 1.1.

**Files:**
- Modify: `test/extension/services/dataManager.test.ts`
- Modify: `test/webview/components/worksetsPanel.test.tsx` or new Worksets page test created in Task 3

**Implementation notes:**
- Cover malformed CLI payloads: missing `worksets`, non-array `members`, missing `tool`.
- Cover primary-member semantics at UI level by asserting the first member is marked primary after Task 3 introduces the page.

**Verification:**
- Run `zsh -lc 'source ~/.zshrc && rtk pnpm test -- --run test/extension/services/dataManager.test.ts test/webview/components/worksetsPanel.test.tsx'`.
- Expected: defensive parsing and UI primary-member tests pass.

**Risks / edge cases:**
- If Task 3 replaces `WorksetsPanel` with `WorksetsPage`, move the component assertion to the new test file instead of keeping a stale test.

- [ ] **Step 1: Write defensive parser tests**

Add tests that call dashboard refresh with CLI workset payload variants and assert the UI-facing data is an empty array or a safely parsed `WorksetView[]`, never an exception.

- [ ] **Step 2: Run tests and expect FAIL if parser is not defensive enough**

Run `zsh -lc 'source ~/.zshrc && rtk pnpm test -- --run test/extension/services/dataManager.test.ts'`.
Expected: any missing defensive branch is exposed.

- [ ] **Step 3: Add or adjust parser guards**

Update `DataManager.listWorksets()` with minimal guards for each failing payload shape.

- [ ] **Step 4: Run targeted tests and expect PASS**

Run `zsh -lc 'source ~/.zshrc && rtk pnpm test -- --run test/extension/services/dataManager.test.ts'`.
Expected: all DataManager workset tests pass.
