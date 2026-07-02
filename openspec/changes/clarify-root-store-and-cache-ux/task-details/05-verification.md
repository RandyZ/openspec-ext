# Task 5. Verification

<!-- covers: Task 5.1, Task 5.2, Task 5.3 -->

### Task 5.1: Run targeted unit tests for the changed webview and extension-host modules

**Spec coverage:** All delta spec requirements in `dashboard` and `extension-cache`

**Files:**
- Test: `test/webview/components/scopeBar.test.tsx`
- Test: `test/webview/components/dashboard.test.tsx`
- Test: `test/webview/components/changesSection.test.tsx`
- Test: `test/webview/components/specsSection.test.tsx`
- Test: `test/webview/components/storesAndWorksetsPanel.test.tsx`
- Test: `test/extension/providers/webviewMessageHandler.test.ts`
- Test: `test/i18n/i18n.test.ts`

- [ ] **Step 1: Run the targeted test set**

Run:

```bash
zsh -lc 'source ~/.zshrc && rtk pnpm test -- test/webview/components/scopeBar.test.tsx test/webview/components/dashboard.test.tsx test/webview/components/changesSection.test.tsx test/webview/components/specsSection.test.tsx test/webview/components/storesAndWorksetsPanel.test.tsx test/extension/providers/webviewMessageHandler.test.ts test/i18n/i18n.test.ts'
```

Expected: PASS.

- [ ] **Step 2: Fix failures within the changed files**

If a targeted test fails, update only the files touched by this change unless the failure points to an existing shared helper contract. Re-run the same targeted command until it passes.

---

### Task 5.2: Run full test, build, and OpenSpec validation commands

**Spec coverage:** All delta spec requirements in `dashboard` and `extension-cache`

**Files:**
- Test: full repository test suite
- Test: build output
- Test: OpenSpec change validation

- [ ] **Step 1: Run the full unit test suite**

Run:

```bash
zsh -lc 'source ~/.zshrc && rtk pnpm test'
```

Expected: PASS.

- [ ] **Step 2: Run the full build**

Run:

```bash
zsh -lc 'source ~/.zshrc && rtk pnpm run build'
```

Expected: PASS and `dist/extension.js` plus `dist/webview/` assets exist.

- [ ] **Step 3: Validate the OpenSpec change**

Run:

```bash
zsh -lc 'source ~/.zshrc && rtk openspec validate clarify-root-store-and-cache-ux --type change --strict'
```

Expected: PASS with no spec formatting or scenario header errors.

---

### Task 5.3: Perform sidebar visual QA for narrow and expanded states

**Spec coverage:** `extension-cache` / `### Requirement: Stable cache status rail controls`; `dashboard` / `### Requirement: OpenSpec root selector clarity`; `dashboard` / `### Requirement: Stores and worksets maintenance panel`

**Files:**
- Test: Extension Development Host manual QA

- [ ] **Step 1: Build before opening the extension host**

Run:

```bash
zsh -lc 'source ~/.zshrc && rtk pnpm run build'
```

Expected: PASS.

- [ ] **Step 2: Open the Extension Development Host**

From VS Code or Cursor, run the existing debug configuration `Run Extension`. Open this repository as the workspace because it contains `openspec/config.yaml`.

- [ ] **Step 3: Verify the status rail in a narrow sidebar**

In the OpenSpec dashboard sidebar:

```text
Expected:
- The selector is labeled OpenSpec Root.
- Store roots are shown as Store: <id>.
- The cache summary stays on the same rail line when the cache menu opens.
- Cache actions appear in an overlay/menu and do not create a second inline row.
- Buttons and menu items remain keyboard focusable.
```

- [ ] **Step 4: Verify root-scoped content**

Switch between `Local Root` and any registered `Store: <id>` option:

```text
Expected:
- Changes, archived changes, and specs update for the selected root.
- Empty states name the selected root.
- Archived changes from another root do not appear as fallback content.
- Cache statistics do not visibly recalculate just because the root changed.
```

- [ ] **Step 5: Verify Stores and Worksets maintenance**

Inspect the Stores and Worksets panel:

```text
Expected:
- Registered stores are listed with identity and path.
- Register Store and Create Store actions enter pending state when triggered.
- References appear as read-only context.
- Worksets appear as local personal views.
```
