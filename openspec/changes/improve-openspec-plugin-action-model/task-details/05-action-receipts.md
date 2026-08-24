# Task 5. Workflow action receipts

<!-- covers: Task 5.1, Task 5.2, Task 5.3 -->

### Task 5.1: Extend workflow messages with request and binding correlation with TDD

**Spec coverage:** `agent-command-routing` / `Workflow action receipts report observable delivery state` / `Stale receipt is ignored`; `cli-integration` / `Status-backed Change workflow snapshot` / `Snapshot remains bound to producing root`

**Dependencies / order:** Requires Task 1 binding DTO and Task 2 resolved action ids.

**Files:**
- Modify: `src/shared/changeWorkflow.ts`, `src/webview/types/messages.ts`, `src/extension/providers/webviewMessageHandler.ts`
- Test: `test/extension/providers/webviewMessageHandler.test.ts`, `test/webview/components/changeDetailRouting.test.ts`

**Implementation notes:** Add `requestId` and `bindingKey` to launch messages and receipts. Validate the bound scope before launch; echo correlation fields on every success/failure path.

**Verification:** Focused tests must reject missing/mismatched binding, preserve request ids, and ignore receipts for a replaced request.

**Risks / edge cases:** Old Webview messages during extension reload, duplicate request ids, and same-name Changes in two panels.

- [ ] **Step 1:** Add failing type/handler tests for correlation and stale-binding rejection.
- [ ] **Step 2:** Run focused tests and confirm RED because current messages have no request or binding identity.
- [ ] **Step 3:** Extend the existing discriminated union and handler with required correlation fields.
- [ ] **Step 4:** Re-run and confirm every receipt is attributable to one bound action.

---

### Task 5.2: Map existing adapter and execution results to observable receipt states with TDD

**Spec coverage:** `agent-command-routing` / `Workflow action receipts report observable delivery state` / `Chat prefill is delivered rather than completed`, `Clipboard copy is reported explicitly`, `Adapter fallback is not silent`, `Observable process completion is reported`; `Action labels reflect actual behavior` / all scenarios

**Dependencies / order:** Requires Task 5.1 message correlation.

**Files:**
- Modify: `src/extension/providers/webviewMessageHandler.ts`, existing adapter result types under `src/extension/adapters/`, `src/shared/changeWorkflow.ts`
- Test: `test/extension/providers/webviewMessageHandler.test.ts`, existing adapter-focused tests under `test/extension/`

**Implementation notes:** Adapt current success/message results; do not replace adapters. Map Chat to delivered, Clipboard to copied, native-to-clipboard to fallback, and observable exit results to completed/failed.

**Verification:** Focused mocks must assert exact target/status/message combinations and prove launch success alone is never completed.

**Risks / edge cases:** Adapters that internally copy before opening, partial native launch, cancelled terminal, and exceptions before pending receipt.

- [ ] **Step 1:** Add failing adapter-result matrix tests for Chat, Clipboard, fallback, process success, and process failure.
- [ ] **Step 2:** Run focused tests and confirm RED because results are currently not posted to Webview.
- [ ] **Step 3:** Add the smallest result-to-receipt mapper around existing launch paths.
- [ ] **Step 4:** Re-run and confirm observable-state semantics without claiming Agent completion.

---

### Task 5.3: Render inline receipts and suppress duplicate pending actions with TDD

**Spec coverage:** `agent-command-routing` / `Workflow action receipts report observable delivery state` / `Pending action prevents duplicate launch`, `Stale receipt is ignored`; `Action labels reflect actual behavior` / all scenarios

**Dependencies / order:** Requires Tasks 5.1–5.2 receipts.

**Files:**
- Modify: `src/webview/components/ActionBar.tsx`, `src/webview/components/ChangeDetail.tsx`, `src/i18n/locales/en.json`, `src/i18n/locales/zh-cn.json`
- Test: `test/webview/components/actionBar.test.ts`, `test/webview/components/changeDetailRouting.test.ts`

**Implementation notes:** Keep transient receipt state local to the bound panel. Mark pending before post, disable only the matching action, and replace it only with a matching host receipt.

**Verification:** Focused component tests must prove duplicate clicks emit one launch and stale receipts do not overwrite the current result.

**Risks / edge cases:** Rapid action switching, component unmount, repeated action after terminal state, and screen-reader announcement noise.

- [ ] **Step 1:** Add failing interaction tests for pending disable, inline status, duplicate click, and stale receipt.
- [ ] **Step 2:** Run focused tests and confirm RED because current actions have no correlated UI state.
- [ ] **Step 3:** Add minimal local receipt state and accessible live feedback near the action group.
- [ ] **Step 4:** Re-run and confirm one launch per pending request and accurate final copy.
