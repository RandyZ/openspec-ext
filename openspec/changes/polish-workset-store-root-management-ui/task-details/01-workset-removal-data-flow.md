<!-- Copy one file per ## Task N group to: openspec/changes/<change>/task-details/NN-<slug>.md -->
<!-- Do NOT duplicate Goal/Architecture from design.md — see openspec-writing-task SKILL -->

# Task 1. Workset Removal Data Flow

<!-- covers: Task 1.1, Task 1.2, Task 1.3, Task 1.4 -->

### Task 1.1: Extend the webview message contract for workset removal

**Spec coverage:** `dashboard` / `Requirement: Workset Remove Flow Is Confirmed And Non-Destructive` / `Scenario: Remove workset asks for confirmation`

**Files:**
- Modify: `src/webview/types/messages.ts`
- Test: `test/extension/providers/webviewMessageHandler.test.ts`

- [ ] **Step 1: Write the failing test**
  Add a message-handler or type-level test expectation that the webview can send `{ type: 'removeWorkset', name }`.

- [ ] **Step 2: Run test — expect FAIL**
  Run: `pnpm test -- --run test/extension/providers/webviewMessageHandler.test.ts`
  Expected: FAIL because the message is not handled or typed yet.

- [ ] **Step 3: Write minimal implementation**
  Add the `removeWorkset` message variant and `sendMessage.removeWorkset(name)` helper.

- [ ] **Step 4: Run test — expect PASS**
  Run: `pnpm test -- --run test/extension/providers/webviewMessageHandler.test.ts`
  Expected: PASS for the new message contract.

---

### Task 1.2: Add a DataManager removeWorkset operation

**Spec coverage:** `dashboard` / `Requirement: Workset Remove Flow Is Confirmed And Non-Destructive` / `Scenario: Confirmed remove deletes only saved workset`

**Files:**
- Modify: `src/extension/services/dataManager.ts`
- Test: `test/extension/services/dataManager.test.ts`

- [ ] **Step 1: Write the failing test**
  Assert that `removeWorkset(name)` calls `openspec workset remove <name> --yes --json`, invalidates cached dashboard/workset data, and refreshes.

- [ ] **Step 2: Run test — expect FAIL**
  Run: `pnpm test -- --run test/extension/services/dataManager.test.ts`
  Expected: FAIL because `removeWorkset` does not exist.

- [ ] **Step 3: Write minimal implementation**
  Implement `DataManager.removeWorkset(name): Promise<DashboardData>` using `this.cliService.runJson(['workset', 'remove', name, '--yes', '--json'])`, then refresh dashboard data.

- [ ] **Step 4: Run test — expect PASS**
  Run: `pnpm test -- --run test/extension/services/dataManager.test.ts`
  Expected: PASS.

---

### Task 1.3: Confirm and execute workset removal in the webview message handler

**Spec coverage:** `dashboard` / `Requirement: Workset Remove Flow Is Confirmed And Non-Destructive` / `Scenario: Remove workset asks for confirmation`, `Scenario: Cancelled remove keeps workset`

**Files:**
- Modify: `src/extension/providers/webviewMessageHandler.ts`
- Modify: `src/i18n/locales/en.json`
- Modify: `src/i18n/locales/zh-cn.json`
- Test: `test/extension/providers/webviewMessageHandler.test.ts`

- [ ] **Step 1: Write the failing test**
  Cover confirm, cancel, success refresh, and error handling for `removeWorkset`.

- [ ] **Step 2: Run test — expect FAIL**
  Run: `pnpm test -- --run test/extension/providers/webviewMessageHandler.test.ts`
  Expected: FAIL because the handler does not support `removeWorkset`.

- [ ] **Step 3: Write minimal implementation**
  Add a handler case that shows a modal warning, names the workset, explains folders are not deleted, calls `DataManager.removeWorkset` only on confirmation, and posts refreshed dashboard data.

- [ ] **Step 4: Run test — expect PASS**
  Run: `pnpm test -- --run test/extension/providers/webviewMessageHandler.test.ts`
  Expected: PASS.

---

### Task 1.4: Cover workset removal with extension-side tests

**Spec coverage:** `dashboard` / `Requirement: Workset Remove Flow Is Confirmed And Non-Destructive`

**Files:**
- Test: `test/extension/services/dataManager.test.ts`
- Test: `test/extension/providers/webviewMessageHandler.test.ts`

- [ ] **Step 1: Write the failing test**
  Add regression checks for command arguments, non-destructive confirmation copy, cancellation, success refresh, and failure message.

- [ ] **Step 2: Run test — expect FAIL**
  Run: `pnpm test -- --run test/extension/services/dataManager.test.ts test/extension/providers/webviewMessageHandler.test.ts`
  Expected: FAIL until Task 1 implementation is complete.

- [ ] **Step 3: Write minimal implementation**
  Complete the DataManager and handler implementation without changing member folder data.

- [ ] **Step 4: Run test — expect PASS**
  Run: `pnpm test -- --run test/extension/services/dataManager.test.ts test/extension/providers/webviewMessageHandler.test.ts`
  Expected: PASS.
