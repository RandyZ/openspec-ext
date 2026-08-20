# Task 3. Official Workset open command

<!-- covers: Task 3.1, Task 3.2, Task 3.3 -->

### Task 3.1: Add RED CLI/DataManager tests proving Workset open is non-JSON and receives the exact Workset name.

**Spec coverage:** `workset-cli-open` / Official Workset open action / Open a saved Workset; Workset open reports an error. `cli-integration` / Command Execution / Open a Workset with ordinary CLI output.

**Dependencies / order:** Independent of Sidebar tab rendering; use existing `OpenSpecCliService` resolver mocks and `DataManager` tests.

**Implementation notes:** Add one ordinary-output execution path beside `runJson`; do not weaken JSON parsing for existing commands.

**Files:**
- Modify: `test/extension/services/openspecCli.test.ts`
- Modify: `test/extension/services/dataManager.test.ts`

- [ ] **Step 1: Write failing CLI test**
  - Spy on the ordinary command executor and assert `workset open <name>` is passed without `--json`.
  - Return ordinary text and verify it is not parsed through `JSON.parse`.
- [ ] **Step 2: Write failing DataManager routing test**
  - Call `openWorkset('ai-self-serve-builder')` and assert the exact Workset name reaches the CLI service.
- [ ] **Step 3: Write failing error test**
  - Return a non-zero CLI error and assert it propagates with diagnostic output available to the caller.
- [ ] **Step 4: Run test — expect FAIL**
  - Run: `pnpm test -- test/extension/services/openspecCli.test.ts test/extension/services/dataManager.test.ts`
  - Expected: FAIL because the current path calls `runJson`.

**Verification:** RED proves the current JSON assumption is the defect.

**Risks / edge cases:** Do not invoke the external opener during unit tests; stub the process executor.

---

### Task 3.2: Implement the ordinary-output CLI execution path and route the Workset management action through it.

**Spec coverage:** `workset-cli-open` / Official Workset open action. `cli-integration` / Command Execution.

**Dependencies / order:** Task 3.1 RED tests.

**Implementation notes:** Reuse resolver, timeout, stderr, and exit-code handling from the current CLI service.

**Files:**
- Modify: `src/extension/services/openspecCli.ts`
- Modify: `src/extension/services/dataManager.ts`
- Modify: `src/extension/providers/webviewMessageHandler.ts` only for user-facing error handling if required

- [ ] **Step 1: Add a public ordinary command method**
  - Reuse the existing runtime resolver, retry policy, timeout, stderr capture, and exit-code handling.
  - Keep `runJson` unchanged for JSON commands.
- [ ] **Step 2: Route `openWorkset`**
  - Execute `['workset', 'open', name]` with no JSON flag and no JSON parsing.
  - Preserve the official CLI's tool selection and generated workspace behavior.
- [ ] **Step 3: Run focused tests — expect PASS**
  - Run: `pnpm test -- test/extension/services/openspecCli.test.ts test/extension/services/dataManager.test.ts`
  - Expected: PASS, including ordinary output and error propagation.

**Verification:** The exact command arguments and non-JSON behavior are asserted.

**Risks / edge cases:** Workset open may launch an external window and return ordinary output; do not block waiting for a JSON payload.

---

### Task 3.3: Rename and test Project picker versus whole-Workset actions so their messages and focus targets are unambiguous.

**Spec coverage:** `workset-cli-open` / Unambiguous Workset action labels / both scenarios; Project picker selection.

**Dependencies / order:** Task 3.2.

**Implementation notes:** Make whole-Workset open and Project-member switch visibly and behaviorally distinct without changing Store rows.

**Files:**
- Modify: `src/webview/components/WorksetsPage.tsx`
- Modify: `src/webview/components/WorksetProjectPicker.tsx`
- Modify: `src/i18n/locales/en.json`
- Modify: `src/i18n/locales/zh-cn.json`
- Modify: `test/webview/components/worksetsPage.test.tsx`
- Modify: `test/webview/components/worksetProjectPicker.test.tsx`

- [ ] **Step 1: Update labels and accessible names**
  - Keep one Worksets page card action for opening the whole Workset.
  - Label Project-first member actions as switching/opening that Project within the Sidebar.
- [ ] **Step 2: Assert message separation**
  - Workset card sends `openWorkset(name)`; Project member sends `selectWorksetProject(worksetName, memberPath)`.
  - Store and invalid rows have no Project action.
- [ ] **Step 3: Run focused tests**
  - Run: `pnpm test -- test/webview/components/worksetsPage.test.tsx test/webview/components/worksetProjectPicker.test.tsx`
  - Expected: PASS.

**Verification:** UI labels, focus targets, and message types make the two granularities explicit.

**Risks / edge cases:** Preserve remove confirmation and Workset capability gating.
