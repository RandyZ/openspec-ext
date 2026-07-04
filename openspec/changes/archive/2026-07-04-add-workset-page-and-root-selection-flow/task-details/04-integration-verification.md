# Task 4. Integration And Verification

<!-- covers: Task 4.1, Task 4.2, Task 4.3 -->

### Task 4.1: Update i18n strings for root and workset semantics

**Spec coverage:** `dashboard` / `OpenSpec Root Selector Separates Projects And Stores`; `Workset And Root Semantics Are Clear`

**Dependencies / order:** Runs after UI text decisions in Task 2 and Task 3.

**Files:**
- Modify: `src/i18n/locales/en.json`
- Modify: `src/i18n/locales/zh-cn.json`
- Test: `test/i18n/i18n.test.ts`

**Implementation notes:**
- Add concise labels for Project roots, Store roots, Worksets page, Primary member, member count, and the explanation that worksets open editor views while root selection controls OpenSpec data.
- Keep strings operational and short for sidebar width.

**Verification:**
- Run `zsh -lc 'source ~/.zshrc && rtk pnpm test -- --run test/i18n/i18n.test.ts'`.
- Expected: locale key parity tests pass.

**Risks / edge cases:**
- Long Chinese labels can overflow buttons. Favor short nouns and put longer explanations in page body text.

- [ ] **Step 1: Add or update i18n keys**

Add matching English and Chinese keys for every new visible label introduced in Task 2 and Task 3.

- [ ] **Step 2: Run i18n test and expect PASS**

Run `zsh -lc 'source ~/.zshrc && rtk pnpm test -- --run test/i18n/i18n.test.ts'`.
Expected: no missing locale keys.

---

### Task 4.2: Verify root-scoped data remains separate from workset launching

**Spec coverage:** `dashboard` / `OpenSpec Root Selector Separates Projects And Stores` / `Selecting a project or store scopes dashboard data`; `Worksets Workspace Page` / `Workset open action launches workspace view`; `Workset And Root Semantics Are Clear` / all scenarios

**Dependencies / order:** Runs after Task 2 and Task 3.

**Files:**
- Modify: `test/webview/components/dashboard.test.tsx`
- Modify: `test/extension/providers/webviewMessageHandler.test.ts` if message handler coverage is missing
- Modify: `src/extension/providers/webviewMessageHandler.ts` only if behavior needs adjustment

**Implementation notes:**
- Dashboard test should confirm selecting a root uses `selectScope`, while opening a workset uses `openWorkset`.
- Message handler test should confirm `openWorkset` calls `DataManager.openWorkset(name)` and does not select a scope.

**Verification:**
- Run `zsh -lc 'source ~/.zshrc && rtk pnpm test -- --run test/webview/components/dashboard.test.tsx test/extension/providers/webviewMessageHandler.test.ts'`.
- Expected: workset launching and root selection remain separate in tests.

**Risks / edge cases:**
- Existing dashboard tests may mock a simplified message bridge. Keep the test at the lowest layer that can prove separation without over-mocking React internals.

- [ ] **Step 1: Add separation regression tests**

Write tests proving root selection and workset opening emit different message types or callbacks.

- [ ] **Step 2: Run tests and expect FAIL if behavior is currently mixed**

Run `zsh -lc 'source ~/.zshrc && rtk pnpm test -- --run test/webview/components/dashboard.test.tsx test/extension/providers/webviewMessageHandler.test.ts'`.
Expected: any conflated behavior is exposed.

- [ ] **Step 3: Fix message or callback wiring**

Adjust webview callback wiring or message handling so workset actions never call `selectScope`.

- [ ] **Step 4: Run targeted tests and expect PASS**

Run `zsh -lc 'source ~/.zshrc && rtk pnpm test -- --run test/webview/components/dashboard.test.tsx test/extension/providers/webviewMessageHandler.test.ts'`.
Expected: separation tests pass.

---

### Task 4.3: Run targeted tests, full test suite, and build

**Spec coverage:** All requirements and scenarios in `openspec/changes/add-workset-page-and-root-selection-flow/specs/dashboard/spec.md`

**Dependencies / order:** Final task after all implementation tasks.

**Files:**
- Test: `test/webview/components/scopeBar.test.tsx`
- Test: `test/webview/components/worksetsPage.test.tsx` or `test/webview/components/worksetsPanel.test.tsx`
- Test: `test/webview/components/storesAndWorksetsPanel.test.tsx`
- Test: `test/extension/services/dataManager.test.ts`
- Test: `test/extension/providers/webviewMessageHandler.test.ts`

**Implementation notes:**
- Use pnpm because this project is configured for pnpm.
- Use zsh with `source ~/.zshrc` per local environment instructions.
- Stop any dev server if one was started for manual QA.

**Verification:**
- Run `zsh -lc 'source ~/.zshrc && rtk pnpm test'`.
- Run `zsh -lc 'source ~/.zshrc && rtk pnpm run build'`.
- Expected: test suite and build pass.

**Risks / edge cases:**
- ESLint has known pre-existing global issues per AGENTS.md. Do not use `npx eslint .`; if linting is needed, use `npx eslint src/` and report pre-existing issues separately.

- [ ] **Step 1: Run all targeted tests**

Run component and extension tests touched by this change in one command if practical.
Expected: all targeted tests pass.

- [ ] **Step 2: Run full unit test suite**

Run `zsh -lc 'source ~/.zshrc && rtk pnpm test'`.
Expected: all Vitest tests pass.

- [ ] **Step 3: Run production build**

Run `zsh -lc 'source ~/.zshrc && rtk pnpm run build'`.
Expected: extension and webview build successfully.

- [ ] **Step 4: Manual sidebar QA if a VS Code extension host is available**

Open the dashboard in an Extension Development Host, verify root selector labels, open the Worksets page, inspect member rendering, trigger Open on a safe test workset, and confirm selected root data does not change in the current webview.
