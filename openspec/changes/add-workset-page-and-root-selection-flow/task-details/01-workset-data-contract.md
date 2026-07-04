# Task 1. Workset And Project Root Data Contract

<!-- covers: Task 1.1, Task 1.2, Task 1.3, Task 1.4 -->

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

### Task 1.2: Discover all OpenSpec project roots in multi-folder workspaces

**Spec coverage:** `dashboard` / `OpenSpec Root Selector Separates Projects And Stores` / `Multi-folder workspace exposes all project roots`

**Dependencies / order:** Follows Task 1.1; must complete before Task 2 renders root selector groups.

**Files:**
- Modify: `src/extension/utils/workspaceRoot.ts`
- Modify: `src/extension/extension.ts`
- Modify: `src/extension/services/openspecScope.ts`
- Modify: `src/extension/services/dataManager.ts`
- Test: `test/extension/services/openspecScope.test.ts`
- Test: `test/extension/services/dataManager.test.ts`

**Implementation notes:**
- Add a helper that discovers all `vscode.workspace.workspaceFolders` containing `openspec/config.yaml`.
- Preserve the first discovered root as the activation/default local root.
- Pass the discovered project roots into `DataManager` or `OpenSpecScopeManager`.
- Create project-like scopes for additional roots using existing `source: 'declared'` unless implementation introduces a compatible clearer source.
- Label additional project roots with folder names or paths so users can distinguish FastGPT from Server_DotNetCore.

**Verification:**
- Run `zsh -lc 'source ~/.zshrc && rtk pnpm test -- --run test/extension/services/openspecScope.test.ts test/extension/services/dataManager.test.ts'`.
- Expected: scope options contain all project roots from the simulated multi-folder workspace plus registered stores.

**Risks / edge cases:**
- A workspace folder can contain no OpenSpec config. It must not become a project root option.
- Two folders can share the same basename. Labels need enough path context or secondary metadata to disambiguate.

- [ ] **Step 1: Write the failing multi-root discovery test**

Add tests that simulate three workspace folders where two contain `openspec/config.yaml`; assert both appear as project scopes and the folder without config is excluded.

- [ ] **Step 2: Run test and expect FAIL**

Run `zsh -lc 'source ~/.zshrc && rtk pnpm test -- --run test/extension/services/openspecScope.test.ts test/extension/services/dataManager.test.ts'`.
Expected: current single-root behavior fails the new multi-root assertion.

- [ ] **Step 3: Implement project-root discovery and scope creation**

Add the discovery helper and plumb discovered roots into the scope manager so additional roots appear as project-like scopes.

- [ ] **Step 4: Run targeted tests and expect PASS**

Run `zsh -lc 'source ~/.zshrc && rtk pnpm test -- --run test/extension/services/openspecScope.test.ts test/extension/services/dataManager.test.ts'`.
Expected: project root discovery tests pass.

---

### Task 1.3: Run project-scoped OpenSpec commands from the selected project root

**Spec coverage:** `dashboard` / `OpenSpec Root Selector Separates Projects And Stores` / `Selecting a project root runs local OpenSpec commands from that root`, `Selecting a project or store scopes dashboard data`

**Dependencies / order:** Follows Task 1.2; must complete before root selector UI can be considered correct.

**Files:**
- Modify: `src/extension/services/openspecCli.ts`
- Modify: `src/extension/services/dataManager.ts`
- Modify: `src/extension/services/stateReader.ts` only if gateway routing requires a narrower type
- Test: `test/extension/services/openspecCli.test.ts`
- Test: `test/extension/services/dataManager.test.ts`

**Implementation notes:**
- Store scopes continue to use `--store <id>`.
- Non-store project scopes must run local OpenSpec commands with `cwd` equal to `scope.rootPath`.
- Choose either a scoped `OpenSpecCliService(scope.rootPath)` per project root or an execution option that overrides cwd for non-store scopes.
- Keep cache and content access rooted to `scope.rootPath` for selected project scopes.

**Verification:**
- Run `zsh -lc 'source ~/.zshrc && rtk pnpm test -- --run test/extension/services/openspecCli.test.ts test/extension/services/dataManager.test.ts'`.
- Expected: CLI calls for an additional project root use that root as cwd; store calls still append `--store <id>`.

**Risks / edge cases:**
- Running non-store commands from the activation root would show the wrong changes/specs for A/B project workflows.
- Reusing a single CLI service is acceptable only if each call can override cwd safely.

- [ ] **Step 1: Write the failing scoped-cwd test**

Add tests asserting a selected additional project scope causes `openspec list --json` or equivalent dashboard loading commands to execute from that scope root.

- [ ] **Step 2: Run test and expect FAIL**

Run `zsh -lc 'source ~/.zshrc && rtk pnpm test -- --run test/extension/services/openspecCli.test.ts test/extension/services/dataManager.test.ts'`.
Expected: current commands run from the activation root and fail the cwd assertion.

- [ ] **Step 3: Implement scoped command execution**

Update CLI routing so non-store project scopes use the selected scope root as cwd while preserving existing store `--store` behavior.

- [ ] **Step 4: Run targeted tests and expect PASS**

Run `zsh -lc 'source ~/.zshrc && rtk pnpm test -- --run test/extension/services/openspecCli.test.ts test/extension/services/dataManager.test.ts'`.
Expected: project-scope and store-scope CLI routing tests pass.

---

### Task 1.4: Add tests for defensive workset parsing and primary-member order

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
