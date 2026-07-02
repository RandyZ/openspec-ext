# Task 2. Root Selector Semantics

<!-- covers: Task 2.1, Task 2.2 -->

### Task 2.1: Render project and store root options with semantic grouping

**Spec coverage:** `dashboard` / `OpenSpec Root Selector Separates Projects And Stores` / `Root selector groups project and store roots`, `Selecting a project or store scopes dashboard data`

**Dependencies / order:** Can start after Task 1; no dependency on Worksets page.

**Files:**
- Modify: `src/webview/components/ScopeBar.tsx`
- Modify: `src/webview/utils/scopeLabels.ts`
- Modify: `src/i18n/locales/en.json`
- Modify: `src/i18n/locales/zh-cn.json`
- Test: `test/webview/components/scopeBar.test.tsx`

**Implementation notes:**
- Prefer native `optgroup` inside the existing `select` if it renders acceptably in static tests and VS Code themes.
- If `optgroup` causes layout or accessibility issues, keep a plain `select` but prefix option labels with translated Project/Store group labels.
- Keep existing `onSelectScope(scopeId)` contract unchanged.

**Verification:**
- Run `zsh -lc 'source ~/.zshrc && rtk pnpm test -- --run test/webview/components/scopeBar.test.tsx test/i18n/i18n.test.ts'`.
- Expected: selector shows OpenSpec Root, Project/Store grouping labels, local root label, and store root label.

**Risks / edge cases:**
- Native `optgroup` output may differ in React server rendering. Tests should assert user-visible labels, not browser styling.
- Declared roots should be treated as project-like roots unless a stronger source category is introduced.

- [ ] **Step 1: Write the failing selector grouping test**

Extend `test/webview/components/scopeBar.test.tsx` to render local, declared if available, and store scopes; assert Project and Store grouping labels are visible.

- [ ] **Step 2: Run test and expect FAIL**

Run `zsh -lc 'source ~/.zshrc && rtk pnpm test -- --run test/webview/components/scopeBar.test.tsx'`.
Expected: grouping label assertions fail before implementation.

- [ ] **Step 3: Implement grouped option rendering**

Update `ScopeBar` to group root options by `source`, preserving current selection, disabled state, pending state, and `aria-label`.

- [ ] **Step 4: Add i18n strings**

Add English and Chinese strings for Project roots, Store roots, and any compact selector labels used in the UI.

- [ ] **Step 5: Run targeted tests and expect PASS**

Run `zsh -lc 'source ~/.zshrc && rtk pnpm test -- --run test/webview/components/scopeBar.test.tsx test/i18n/i18n.test.ts'`.
Expected: selector and i18n tests pass.

---

### Task 2.2: Ensure worksets never appear as root selector options

**Spec coverage:** `dashboard` / `OpenSpec Root Selector Separates Projects And Stores` / `Worksets are excluded from root selector`

**Dependencies / order:** Follows Task 2.1.

**Files:**
- Modify: `src/webview/components/ScopeBar.tsx`
- Modify: `test/webview/components/scopeBar.test.tsx`

**Implementation notes:**
- `ScopeBar` should receive only `OpenSpecScopeView[]`, but add a regression test that renders dashboard-like data with worksets separately and confirms their names are absent from the root selector.
- Do not add workset-specific fields to `OpenSpecScopeView`.

**Verification:**
- Run `zsh -lc 'source ~/.zshrc && rtk pnpm test -- --run test/webview/components/scopeBar.test.tsx'`.
- Expected: root selector tests pass and no workset name appears in the selector markup.

**Risks / edge cases:**
- If parent components accidentally merge worksets into scope options, this component-level test may not catch it. Add a Dashboard-level test in Task 3 if needed.

- [ ] **Step 1: Write the failing exclusion test**

Add a test that includes a workset named similarly to a store, renders the scope selector, and asserts the workset name is not an option label.

- [ ] **Step 2: Run test and expect FAIL only if worksets are currently mixed into root options**

Run `zsh -lc 'source ~/.zshrc && rtk pnpm test -- --run test/webview/components/scopeBar.test.tsx'`.
Expected: if current code already excludes worksets, the test can pass immediately and acts as regression coverage.

- [ ] **Step 3: Fix any root/workset mixing**

If the test fails, filter root selector options to `source === 'local' || source === 'store' || source === 'declared'` and keep worksets in workspace UI only.

- [ ] **Step 4: Run targeted test and expect PASS**

Run `zsh -lc 'source ~/.zshrc && rtk pnpm test -- --run test/webview/components/scopeBar.test.tsx'`.
Expected: exclusion test passes.
