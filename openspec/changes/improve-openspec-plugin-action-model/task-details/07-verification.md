# Task 7. Cache compatibility and end-to-end verification

<!-- covers: Task 7.1, Task 7.2, Task 7.3, Task 7.4 -->

### Task 7.1: Make cache validation refresh snapshots without reviving fixed lifecycle state

**Spec coverage:** `cli-integration` / `Workflow instructions are loaded on demand` / `Change list refresh does not prefetch instructions`; cross-cutting cache behavior for all snapshot-backed requirements

**Dependencies / order:** Requires Tasks 1–6 payload shape to be stable.

**Files:**
- Modify: existing Project Sidebar/Dashboard cache guards in `src/extension/providers/dashboardViewProvider.ts` and related cache types
- Test: `test/extension/providers/dashboardViewProvider.test.ts`

**Implementation notes:** Matching memory snapshots may short-circuit; disk snapshots publish stale then refresh. Old cache without a valid snapshot may show basic read-only Change data but must expose no resolved action.

**Verification:** Focused provider tests must assert memory warm-open, disk stale-then-fresh, old-shape action suppression, and zero instructions N+1.

**Risks / edge cases:** Existing user cache, partial writes, corrupt JSON, and refresh failure after stale display.

- [ ] **Step 1:** Add failing cache lifecycle tests for current, disk, and old payload shapes.
- [ ] **Step 2:** Run the focused test and confirm RED where old shape revives fixed actions or disk skips refresh.
- [ ] **Step 3:** Minimally extend the existing guard and unified fresh reload path.
- [ ] **Step 4:** Re-run and confirm stale data never authorizes workflow execution.

---

### Task 7.2: Complete i18n, theme, keyboard, and accessible status coverage

**Spec coverage:** `workflow-control` / `Workflow action hierarchy remains safe` / `One primary action with accessible alternatives`; `artifact-viewing` / `Artifact List Display` / `Artifact status indication`; `agent-command-routing` / `Action labels reflect actual behavior` / all scenarios; `dashboard` / accessible action summaries

**Dependencies / order:** Requires final UI strings and controls from Tasks 4–6.

**Files:**
- Modify: `src/i18n/locales/en.json`, `src/i18n/locales/zh-cn.json`, affected Webview components
- Test: `test/webview/components/actionBar.test.ts`, `test/webview/components/changeCard.test.tsx`, `test/webview/components/dashboard.test.tsx`, `test/webview/components/changeDetailRouting.test.ts`

**Implementation notes:** Add paired locale keys, visible non-color state text, ARIA names/live receipt copy, controlled truncation, and VS Code theme tokens. Do not add decorative motion.

**Verification:** Focused component tests must pass in default and Chinese locale fixtures with keyboard-only action access.

**Risks / edge cases:** Locale key drift, long translated labels, high contrast themes, and duplicate live announcements.

- [ ] **Step 1:** Add failing assertions for locale parity, accessible names, focus order, and text status.
- [ ] **Step 2:** Run focused tests and confirm missing keys/labels fail.
- [ ] **Step 3:** Add minimal translations and accessible attributes using existing UI primitives.
- [ ] **Step 4:** Re-run and confirm keyboard and non-color semantics across all three surfaces.

---

### Task 7.3: Run focused and full automated quality gates

**Spec coverage:** All delta requirements and scenarios; validates regression safety across CLI, routing, artifact viewing, workflow control, and Dashboard.

**Dependencies / order:** Run only after Tasks 1–7.2 are green.

**Files:**
- Test: all changed test files and the full repository test suite
- Verify: `src/`, OpenSpec Change artifacts, and Git diff

**Implementation notes:** This is a gate, not a cleanup/refactor task. Fix only failures caused by this Change and preserve unrelated dirty work.

**Verification:** All commands below must exit 0; ESLint may retain documented pre-existing warnings but no new errors.

**Risks / edge cases:** Fresh dependency resolution, cosmetic build warnings, unrelated pre-existing lint findings, and flaky timing assertions.

- [ ] **Step 1:** Run focused Vitest files for CLI, gateway, providers, resolver, Change Detail, ActionBar, ChangeCard, and Dashboard; expect PASS.
- [ ] **Step 2:** Run `zsh -c 'source ~/.zshrc && pnpm test'`; expect all tests PASS.
- [ ] **Step 3:** Run `zsh -c 'source ~/.zshrc && pnpm exec eslint src/'` and `zsh -c 'source ~/.zshrc && pnpm run build'`; expect zero lint errors and successful builds.
- [ ] **Step 4:** Run `openspec validate improve-openspec-plugin-action-model --strict --json`, task-details validator, and `rtk git diff --check`; expect valid/zero errors.

---

### Task 7.4: Verify the real workflow in at least one supported IDE Extension Development Host

**Spec coverage:** All user-visible delta scenarios, especially dynamic schema display, root binding, action-first surfaces, dedicated high-impact flow, and observable receipts.

**Dependencies / order:** Final acceptance after Task 7.3 automated gates.

**Files:**
- Verify only: built extension in a real Project fixture with OpenSpec CLI available

**Implementation notes:** Use a real custom-schema fixture with parallel ready artifacts and multiple outputs. Test at least one supported Host (VS Code or Cursor); preserve one Host per run, capture screenshots/logs, and stop all started Hosts afterward. If another Host requires external authentication or is unavailable, record it as an unverified compatibility risk instead of substituting build or mock evidence.

**Verification:** The verified Host must show CLI-backed state; adapter receipts must match observed delivery; no console errors, cross-root rebinding, or guessed file reads may occur.

**Risks / edge cases:** Shell PATH resolution, fresh-profile extension enable prompt, unavailable Cursor/Copilot adapter, lock screen, and pre-existing IDE windows.

- [ ] **Step 1:** Build and launch one isolated supported IDE Extension Development Host with a real Project/root.
- [ ] **Step 2:** Verify dynamic Detail, Sidebar, Dashboard, keyboard flow, and receipts in that Host.
- [ ] **Step 3:** Verify Chat/Clipboard or available native delivery, fallback visibility, Verify/Archive handoff, refresh, and immutable panel binding.
- [ ] **Step 4:** Save evidence, inspect Extension Host/Webview logs, record any unverified IDE compatibility risk, then close started processes and remove only their exact temporary user-data directories.
