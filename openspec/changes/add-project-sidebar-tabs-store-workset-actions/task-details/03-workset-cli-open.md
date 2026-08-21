# Task 3. Official Workset open command

<!-- covers: Task 3.1, Task 3.2, Task 3.3 -->

### Task 3.1: Add RED CLI/DataManager tests proving Workset open is non-JSON and receives the exact Workset name.

**Spec coverage:** `workset-cli-open` / Official Workset open action / Open a saved Workset; Workset open reports an error. `cli-integration` / Command Execution / Open a Workset with ordinary CLI output.

**Dependencies / order:** Independent of Dashboard rendering. Use existing `OpenSpecCliService` resolver/process mocks and `DataManager` tests. Must be RED before Task 3.2.

**Implementation notes:** Add an ordinary-output execution path beside `runJson`; do not weaken JSON parsing or selector handling for existing commands.

**Files:**
- Modify: `test/extension/services/openspecCli.test.ts`
- Modify: `test/extension/services/dataManager.test.ts`

- [ ] **Step 1: Write the failing CLI argument test**
  - Spy on the process executor and assert the exact arguments are `['workset', 'open', '<name>']`.
  - Assert no `--json` flag is present.
- [ ] **Step 2: Write ordinary-output and error tests**
  - Return ordinary stdout and assert it is not parsed through `JSON.parse`.
  - Return a non-zero exit with stderr and assert safe diagnostics remain available to the caller.
- [ ] **Step 3: Write the failing DataManager routing test**
  - Call `openWorkset('ai-self-serve-builder')` and assert the exact Workset name reaches the ordinary CLI method.
- [ ] **Step 4: Run the focused RED command**
  - Run: `pnpm test -- test/extension/services/openspecCli.test.ts test/extension/services/dataManager.test.ts`
  - Expected: FAIL because the current route uses the JSON command path.

**Verification:** RED proves the JSON assumption, not an unrelated process-mock failure.

**Risks / edge cases:** Unit tests MUST stub the external opener. Names remain separate process arguments and MUST NOT be shell-concatenated.

---

### Task 3.2: Implement the ordinary-output CLI path and route whole-Workset management through it.

**Spec coverage:** `workset-cli-open` / Official Workset open action / all scenarios. `cli-integration` / Command Execution / Open a Workset with ordinary CLI output.

**Dependencies / order:** Task 3.1 RED tests exist.

**Implementation notes:** Reuse the installed/custom/local runtime resolver, `child_process.spawn`, timeout, UTF-8, stderr, exit-code, and error normalization already used by the CLI service. Keep `runJson` unchanged.

**Files:**
- Modify: `src/extension/services/openspecCli.ts`
- Modify: `src/extension/services/dataManager.ts`
- Modify: `src/extension/providers/webviewMessageHandler.ts` only for user-facing error reporting
- Modify: `test/extension/services/openspecCli.test.ts`
- Modify: `test/extension/services/dataManager.test.ts`

- [ ] **Step 1: Add the smallest public ordinary command method**
  - Accept an argument array and return captured ordinary output or the existing command result shape.
  - Reuse process lifecycle and diagnostic handling; do not add a second resolver or retry policy.
- [ ] **Step 2: Route `openWorkset`**
  - Execute `['workset', 'open', name]` with no selector or JSON flag.
  - Leave tool preference, member filtering, and workspace generation to OpenSpec CLI.
- [ ] **Step 3: Preserve caller-visible failures**
  - Surface non-zero exit and safe stderr/diagnostic context through the existing message error path.
  - Do not relabel ordinary output as a JSON error.
- [ ] **Step 4: Run the focused GREEN command**
  - Run: `pnpm test -- test/extension/services/openspecCli.test.ts test/extension/services/dataManager.test.ts test/extension/providers/webviewMessageHandler.test.ts`
  - Expected: PASS for ordinary success, exact arguments, and failure propagation.

**Verification:** Tests assert the exact command boundary; no real external window is opened during automation.

**Risks / edge cases:** Official Workset open may launch a tool and return quickly or emit only ordinary text. The extension must not wait for a nonexistent JSON payload.

---

### Task 3.3: Test the distinct launcher, Project picker, and whole-Workset action messages and labels.

**Spec coverage:** `workset-cli-open` / Dynamic Worksets launcher / both scenarios. Unambiguous Workset action labels / all scenarios. Official Workset open action / Project picker selects a member.

**Dependencies / order:** Tasks 2.2 and 3.2 provide the local launcher and ordinary whole-Workset route.

**Implementation notes:** Lock the three user intents with different accessible names and messages. Do not change Store row behavior or remove confirmation.

**Files:**
- Modify: `src/webview/components/Dashboard.tsx`
- Modify: `src/webview/components/WorksetsPage.tsx`
- Modify: `src/webview/components/WorksetProjectPicker.tsx`
- Modify: `src/i18n/locales/en.json`
- Modify: `src/i18n/locales/zh-cn.json`
- Modify: `test/webview/components/dashboard.test.tsx`
- Modify: `test/webview/components/worksetsPage.test.tsx`
- Modify: `test/webview/components/worksetProjectPicker.test.tsx`

- [ ] **Step 1: Write/adjust message separation tests**
  - Worksets launcher changes only local view.
  - Project row sends `selectWorksetProject(worksetName, memberPath)`.
  - Management card sends `openWorkset(name)`.
- [ ] **Step 2: Update labels and focus targets**
  - Label launcher as browsing Workset Projects.
  - Label member action as switching to that Project.
  - Label management action as opening the whole Workset.
- [ ] **Step 3: Cover unavailable and invalid rows**
  - No trusted membership keeps launcher unavailable.
  - Store and invalid members remain non-selectable.
  - Remove confirmation and capability gating remain intact.
- [ ] **Step 4: Run the focused GREEN command**
  - Run: `pnpm test -- test/webview/components/dashboard.test.tsx test/webview/components/worksetsPage.test.tsx test/webview/components/worksetProjectPicker.test.tsx`
  - Expected: PASS with exactly one message type per user intent.

**Verification:** Accessible labels, focus order, and message spies prove the three granularities cannot be confused.

**Risks / edge cases:** A Workset containing multiple Projects and Stores must expose only trusted Project members as switch targets; the whole-Workset action always targets the saved Workset name.
