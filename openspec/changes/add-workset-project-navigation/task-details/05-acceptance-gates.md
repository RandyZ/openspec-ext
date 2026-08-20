# Task 5. CLI fixture, GUI acceptance, and final gates

<!-- covers: Task 5.1, Task 5.2, Task 5.3 -->

### Task 5.1: Build and clean an isolated XDG CLI fixture with two Worksets, two Projects, a same-repo worktree, and a registered Store member.

**Spec coverage:** `workset-project-navigation` / Official Workset membership discovery, Project-only Workset selection, and same-repository Git worktree; `openspec-scope-management` / Store member and metadata boundaries.

**Dependencies / order:** Tasks 1–4 implementation and focused tests.

**Files:**
- Create: temporary directories outside the repository only, with an explicit cleanup trap
- Modify: none in the repository unless an existing fixture helper is needed
- Test: recorded CLI JSON assertions and DataGateway smoke invocation

**Implementation notes:**
- Determine the installed CLI's supported isolated data directory variables from its help/source before any write. Set only task-local XDG/config variables and create temporary Project/Store/worktree directories.
- Register one temporary Store, create two Worksets whose member lists include the current Project, another Project, a same-repository worktree, and the Store member; do not touch the real global registry.
- Run real `openspec workset list --json`, `openspec store list --json`, and `openspec context --json` from the fixture; verify the extension parser recognizes both memberships, selectable Projects, and Planning Store classification.
- Always remove temporary registry, worksets, Projects, Store, worktree, and environment-specific files in a `finally`/trap block.

**Verification:**
- Primary command: `XDG_CONFIG_HOME=<temp-config> XDG_DATA_HOME=<temp-data> openspec workset list --json` plus the fixture's parser smoke command
- Expected result: both Worksets and the registered Store appear only in the isolated JSON output; the real user's registry remains byte-for-byte untouched.

**Risks / edge cases:**
- If the CLI has no provable isolated state directory, stop this task before writes and report the exact help/source evidence; do not substitute mocks for real fixture acceptance.
- Worktree creation must not alter the repository's current branch or worktree.

- [ ] **Step 1: Inspect CLI help/source for isolated registry/config variables**

- [ ] **Step 2: Create the temporary fixture only after isolation is proven**

- [ ] **Step 3: Run real CLI JSON commands and assert two Worksets, Store member, and worktree paths**

- [ ] **Step 4: Remove every temporary resource and verify the real registry/workset output is unchanged**

---

### Task 5.2: Verify real Extension Development Host navigation, empty/keyboard/narrow-sidebar behavior, and Project/Store binding evidence with same-viewport screenshots.

**Spec coverage:** `dashboard` / Project-first Workset navigation scene / all scenarios; `workset-project-navigation` / Project view reuse, keyboard path, Store exclusion, binding isolation, and watcher semantics.

**Dependencies / order:** Task 5.1 isolated fixture and Tasks 2–4 GREEN tests.

**Files:**
- Create: temporary launch/fixture files only, cleaned after smoke
- Modify: none in committed source unless a real defect is found; any defect requires a new RED test first
- Test: real `[Extension Development Host]` GUI actions and screenshots

**Implementation notes:**
- Start a clean Extension Development Host against the isolated fixture and first locate/focus the correct `[Extension Development Host]` window before each action; do not disturb the user's other windows.
- Capture same-width/viewport before/after screenshots for Current Project → Workset picker → other Project → Changes/Specs/Detail → back. Include empty Workset, keyboard-only traversal, narrow sidebar, Store non-selectability, and same-named Change/Spec binding evidence.
- Confirm watcher behavior by changing only the selected Project's OpenSpec file in the fixture and observing refresh; do not trigger write-side workflow actions.
- If the host is locked or GUI automation cannot reach the correct window, preserve the blocker screenshot/log and leave Task 5.2 unchecked.

**Verification:**
- Primary command: real Extension Development Host smoke with screenshot evidence under `/Users/randy/.codex/visualizations/2026/08/20/openspec-ext-workset-navigation/`
- Expected result: all listed navigation and isolation assertions are visibly confirmed at the same viewport width; no unverified pixel-perfect claim.

**Risks / edge cases:**
- Never click Create/Apply/Sync/Verify/Archive. Stop if focus moves to the user's non-test window and re-locate the Extension Development Host.
- Clean the Host process, temporary fixture, launch overrides, and screenshots only after evidence is copied to the task output directory.

- [ ] **Step 1: Launch and focus the correct clean Extension Development Host window**

- [ ] **Step 2: Perform the no-write navigation path and capture before/after screenshots**

- [ ] **Step 3: Perform keyboard/narrow/empty/Store-member checks and capture evidence**

- [ ] **Step 4: Stop Host and clean temporary resources; record any blocked GUI step without claiming success**

---

### Task 5.3: Run full tests, lint, build, strict OpenSpec validation, diff checks, and final artifact/task status review.

**Spec coverage:** all Change requirements and scenarios; OpenSpec artifact/task integrity.

**Dependencies / order:** Tasks 1–5.2; Task 5.2 remains unchecked if real GUI acceptance is blocked.

**Files:**
- Create: none
- Modify: `openspec/changes/add-workset-project-navigation/tasks.md` checkboxes only after verified completion
- Test: repository-wide gates and CLI status/list/instructions JSON

**Implementation notes:**
- Run focused tests again, then `pnpm test`, `npx eslint src/`, `pnpm run build`, `openspec validate --strict`, `git diff --check`.
- Run final `openspec list --json`, `openspec status --change add-workset-project-navigation --json`, and `openspec instructions apply --change add-workset-project-navigation --json`; use CLI state as the completion authority.
- Mark only completed Task N.M checkboxes, re-run task-details validator and strict validation, inspect the complete diff, then commit the verified worktree as requested by the user.

**Verification:**
- Primary command: `pnpm test && npx eslint src/ && pnpm run build && rtk openspec validate add-workset-project-navigation --strict && rtk git diff --check`
- Expected result: all commands pass; OpenSpec status reports every task done only if Task 5.2 has real evidence.

**Risks / edge cases:**
- Do not mark 5.2 complete from unit tests or mock fixtures. If GUI is blocked, report incomplete acceptance and do not claim 15/15.
- Do not archive, push, merge, or modify the main checkout.

- [ ] **Step 1: Run focused and full automated gates**

- [ ] **Step 2: Run strict OpenSpec validation and task-details validator**

- [ ] **Step 3: Perform final read-only diff/status review and update only verified checkboxes**

- [ ] **Step 4: Create the requested local commit on `codex/add-workset-project-navigation` after all required gates pass**
