# Task 6. Verification And Packaging

<!-- covers: Task 6.1, Task 6.2, Task 6.3 -->

### Task 6.1: Validate the OpenSpec change artifacts

**Spec coverage:** all capabilities / artifact integrity before implementation completion

**Files:**
- Create: none
- Modify: OpenSpec artifacts only if validation reports issues
- Test: `openspec/changes/polish-store-switching-cache-and-icons/**`

- [ ] **Step 1: Run strict OpenSpec validation**

Run:

```bash
zsh -c "source ~/.zshrc && rtk openspec validate polish-store-switching-cache-and-icons --type change --strict"
```

Expected: validation succeeds with no requirement/scenario format errors.

- [ ] **Step 2: Fix validation issues when reported**

If validation reports an artifact issue, update the exact artifact it names, then re-run:

```bash
zsh -c "source ~/.zshrc && rtk openspec validate polish-store-switching-cache-and-icons --type change --strict"
```

Expected: PASS.

---

### Task 6.2: Run unit tests and production build

**Spec coverage:** all capabilities / regression verification

**Files:**
- Create: none
- Modify: source or tests only if verification fails
- Test: repository test suite and build output

- [ ] **Step 1: Run focused tests**

Run:

```bash
zsh -c "source ~/.zshrc && rtk pnpm test -- test/extension/services/openSpecCacheService.test.ts test/extension/services/dataManager.test.ts test/extension/providers/dashboardViewProvider.test.ts test/extension/providers/webviewMessageHandler.test.ts test/webview/components/scopeBar.test.tsx test/webview/components/dashboard.test.tsx test/webview/components/iconButton.test.tsx test/webview/components/changeDetailRouting.test.ts"
```

Expected: all focused tests pass.

- [ ] **Step 2: Run full test suite**

Run:

```bash
zsh -c "source ~/.zshrc && rtk pnpm test"
```

Expected: full suite passes.

- [ ] **Step 3: Run production build**

Run:

```bash
zsh -c "source ~/.zshrc && rtk pnpm run build"
```

Expected: extension and webview bundles build successfully.

---

### Task 6.3: Package a VSIX for Cursor manual verification

**Spec coverage:** all capabilities / manual runtime verification in packaged extension

**Files:**
- Create: `openspec-workflow-<version>.vsix`
- Modify: `package.json` only if the release version must be bumped
- Test: packaged extension in Cursor

- [ ] **Step 1: Package VSIX**

Run:

```bash
zsh -c "source ~/.zshrc && rtk pnpm exec vsce package --no-dependencies"
```

Expected: a `.vsix` file is created in the repository root.

- [ ] **Step 2: Install and smoke test in Cursor**

Install the VSIX in Cursor, reload the extension host, then verify:

```text
1. Open the OpenSpec dashboard.
2. Switch between Local Root and a store scope.
3. Confirm the scope selector shows loading feedback immediately.
4. Confirm cached/stale data appears before fresh data when available.
5. Open a change detail view.
6. Confirm the copy change-name icon is visible and changes to a success icon after click.
7. Toggle a task and refresh to confirm stale artifact cache is not shown.
```

Expected: all manual checks pass without webview console errors.

- [ ] **Step 3: Capture verification notes**

Record the exact commands run, VSIX filename, and any manual findings in the final implementation summary.
