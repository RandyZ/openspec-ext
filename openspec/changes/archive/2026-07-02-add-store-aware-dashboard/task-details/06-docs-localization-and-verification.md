# Task 6. Documentation, Localization, And Verification

<!-- covers: Task 6.1, Task 6.2, Task 6.3, Task 6.4 -->

### Task 6.1: Add localized strings for runtime, scope, references, and worksets

**Spec coverage:** dashboard / Requirement: Scope Bar, Read-only references panel, Workset entry points; openspec-scope-management / Requirement: OpenSpec runtime source selection

**Files:**
- Modify: `src/i18n/locales/en.json`
- Modify: `src/i18n/locales/zh-cn.json`
- Modify: `test/i18n/i18n.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// test/i18n/i18n.test.ts
it('contains scope and runtime keys in both locales', () => {
  for (const key of [
    'scope.runtime.localSource',
    'scope.runtime.installed',
    'scope.localRoot',
    'scope.health.healthy',
    'references.title',
    'references.copyFetch',
    'worksets.title',
    'worksets.localPersonal',
  ]) {
    expect(en).toHaveProperty(key);
    expect(zhCn).toHaveProperty(key);
  }
});
```

- [ ] **Step 2: Run test - expect FAIL**

Run: `pnpm vitest run test/i18n/i18n.test.ts`
Expected: FAIL because the keys are missing.

- [ ] **Step 3: Write minimal implementation**

Add English strings:

```json
{
  "scope.runtime.localSource": "Local Source",
  "scope.runtime.installed": "Installed CLI",
  "scope.runtime.customPath": "Custom Path",
  "scope.localRoot": "Local Root",
  "scope.health.healthy": "Healthy",
  "scope.health.unavailable": "Health unavailable",
  "references.title": "References",
  "references.copyFetch": "Copy fetch command",
  "worksets.title": "Worksets",
  "worksets.localPersonal": "Local personal views for opening folders together."
}
```

Add matching Simplified Chinese strings in `zh-cn.json`.

- [ ] **Step 4: Run test - expect PASS**

Run: `pnpm vitest run test/i18n/i18n.test.ts`
Expected: PASS.

---

### Task 6.2: Document installed CLI versus local source mode

**Spec coverage:** openspec-scope-management / Requirement: OpenSpec runtime source selection; dashboard / Requirement: Store selection / Scenario: Store selector hidden when unsupported

**Files:**
- Modify: `README.md`
- Modify: `README.zh-CN.md`
- Modify: `test/extension/packageConfiguration.test.ts`

- [ ] **Step 1: Write the failing doc assertion**

```ts
// test/extension/packageConfiguration.test.ts
it('documents local source runtime settings in package descriptions', () => {
  expect(properties['openspec.cliMode'].description).toContain('local OpenSpec source');
  expect(properties['openspec.localOpenSpecSourcePath'].description).toContain('source checkout');
});
```

- [ ] **Step 2: Run test - expect FAIL if descriptions are incomplete**

Run: `pnpm vitest run test/extension/packageConfiguration.test.ts`
Expected: FAIL until setting descriptions explicitly mention local OpenSpec source checkout.

- [ ] **Step 3: Update docs**

Add a configuration subsection to both READMEs:

```md
### Local OpenSpec Source Mode

Store-aware dashboard features may require an unreleased OpenSpec CLI. Set `openspec.cliMode` to `localSource` and `openspec.localOpenSpecSourcePath` to a local OpenSpec checkout. Build that checkout first with `pnpm run build`; the extension runs `node <checkout>/bin/openspec.js`.
```

Document that stable installed CLI users can keep `openspec.cliMode=auto`.

- [ ] **Step 4: Run test - expect PASS**

Run: `pnpm vitest run test/extension/packageConfiguration.test.ts`
Expected: PASS.

---

### Task 6.3: Run unit, build, and OpenSpec validation checks

**Spec coverage:** All changed capabilities; verifies tasks are implementation-ready.

**Files:**
- No source changes expected.
- Verification commands touch test/build output only.

- [ ] **Step 1: Run focused unit tests**

Run:

```bash
pnpm vitest run \
  test/extension/packageConfiguration.test.ts \
  test/extension/services/openspecCliResolver.test.ts \
  test/extension/services/openspecCli.test.ts \
  test/extension/services/openspecFeatures.test.ts \
  test/extension/services/openspecScope.test.ts \
  test/extension/services/openspecRelationships.test.ts \
  test/extension/services/dataManager.test.ts \
  test/extension/services/fileManager.test.ts \
  test/extension/providers/webviewMessageHandler.test.ts \
  test/webview/components/dashboard.test.tsx \
  test/webview/components/scopeBar.test.tsx \
  test/webview/components/referencesPanel.test.tsx \
  test/webview/components/worksetsPanel.test.tsx \
  test/i18n/i18n.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run full unit suite**

Run: `pnpm test`
Expected: PASS.

- [ ] **Step 3: Run build**

Run: `pnpm run build`
Expected: PASS and `dist/extension.js` plus `dist/webview/` are produced.

- [ ] **Step 4: Run OpenSpec validation**

Run: `zsh -c "source ~/.zshrc && openspec validate add-store-aware-dashboard --strict"`
Expected: PASS.

---

### Task 6.4: Manually verify the extension in local-root and local-source scenarios

**Spec coverage:** dashboard / Scope Bar, Store selection, Root health display, References panel, Workset entry points; workflow-control / scoped actions; artifact-viewing / scoped editor opens

**Files:**
- No source changes expected.
- Manual verification notes MAY be added to `openspec/changes/add-store-aware-dashboard/verification.md` if useful.

- [ ] **Step 1: Verify current installed CLI behavior**

Run the extension with default settings:

```bash
pnpm run build
```

Open Extension Development Host, open this repository, run `OpenSpec: Open Dashboard`.
Expected:

- Dashboard loads existing local-root changes.
- Scope Bar shows local root and installed or auto runtime.
- Store controls are hidden or disabled if the installed CLI lacks store support.

- [ ] **Step 2: Verify local source mode**

In VS Code settings for the Extension Development Host:

```json
{
  "openspec.cliMode": "localSource",
  "openspec.localOpenSpecSourcePath": "/Users/randy/workspace/projects/github/OpenSpec"
}
```

Build local OpenSpec source:

```bash
cd /Users/randy/workspace/projects/github/OpenSpec
pnpm run build
```

Reload Extension Development Host.
Expected:

- Scope Bar shows Local Source.
- Feature probes allow store-aware controls when local OpenSpec supports them.
- CLI diagnostic card is not shown.

- [ ] **Step 3: Verify store scope switching**

If local stores exist, select a registered store in the Scope Bar.
Expected:

- Changes/specs refresh to the selected store.
- New Change and artifact opens use the selected store root.
- Returning to Local Root restores this repository's dashboard.

- [ ] **Step 4: Verify references and worksets remain correctly scoped**

Use a root with `references:` or a fixture store.
Expected:

- References panel shows upstream stores as read-only.
- Fetch command copy works.
- Unresolved references show fix text.
- Worksets are labeled as local personal views and open through OpenSpec without writing into member folders.
