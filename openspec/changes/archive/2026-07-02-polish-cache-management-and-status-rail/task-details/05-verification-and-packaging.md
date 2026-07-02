# Task 5. Verification and Packaging

<!-- covers: Task 5.1, Task 5.2, Task 5.3 -->

### Task 5.1: Add i18n and package contribution coverage

**Spec coverage:** dashboard / Dashboard cache management entry / Settings surface links to cache management; dashboard / Operational status rail / Rail uses accessible activity copy

**Files:**
- Modify: `test/i18n/i18n.test.ts`
- Modify: `test/extension/packageConfiguration.test.ts`
- Test: `test/i18n/i18n.test.ts`
- Test: `test/extension/packageConfiguration.test.ts`

- [ ] **Step 1: Ensure package command coverage includes cache commands**

Confirm `test/extension/packageConfiguration.test.ts` includes this assertion:

```ts
  it('contributes cache management commands', () => {
    const commandIds = packageJson.contributes.commands.map((command: { command: string }) => command.command);

    expect(commandIds).toContain('openspec.openCacheFolder');
    expect(commandIds).toContain('openspec.copyCachePath');
    expect(commandIds).toContain('openspec.clearCache');
    expect(commandIds).toContain('openspec.showCacheDetails');
  });
```

- [ ] **Step 2: Ensure i18n coverage includes cache and refresh activity strings**

Confirm `test/i18n/i18n.test.ts` covers these keys:

```ts
  it('has cache management and status rail strings in English and Chinese', () => {
    setLocale('en');
    expect(t('cache.clear')).toBe('Clear Cache');
    expect(t('cache.showDetails')).toBe('Show Details');
    expect(t('dashboard.refreshing')).toBe('Refreshing OpenSpec data...');

    setLocale('zh-cn');
    expect(t('cache.clear')).toBe('清理缓存');
    expect(t('cache.showDetails')).toBe('查看详情');
    expect(t('dashboard.refreshing')).toBe('正在刷新 OpenSpec 数据...');
  });
```

- [ ] **Step 3: Run coverage tests**

Run:

```bash
rtk zsh -c 'source ~/.zshrc && rtk pnpm exec vitest run test/i18n/i18n.test.ts test/extension/packageConfiguration.test.ts'
```

Expected: PASS.

---

### Task 5.2: Run targeted tests, full tests, build, and OpenSpec validation

**Spec coverage:** all requirements in `specs/extension-cache/spec.md` and `specs/dashboard/spec.md`

**Files:**
- Test: `test/extension/services/openSpecCacheService.test.ts`
- Test: `test/extension/services/dataManager.test.ts`
- Test: `test/extension/providers/webviewMessageHandler.test.ts`
- Test: `test/webview/components/dashboard.test.tsx`
- Test: `test/webview/components/scopeBar.test.tsx`
- Test: `test/i18n/i18n.test.ts`
- Test: `test/extension/packageConfiguration.test.ts`

- [ ] **Step 1: Run targeted test suite**

Run:

```bash
rtk zsh -c 'source ~/.zshrc && rtk pnpm exec vitest run test/extension/services/openSpecCacheService.test.ts test/extension/services/dataManager.test.ts test/extension/providers/webviewMessageHandler.test.ts test/webview/components/dashboard.test.tsx test/webview/components/scopeBar.test.tsx test/i18n/i18n.test.ts test/extension/packageConfiguration.test.ts'
```

Expected: PASS.

- [ ] **Step 2: Run full unit test suite**

Run:

```bash
rtk zsh -c 'source ~/.zshrc && rtk pnpm test'
```

Expected: PASS.

- [ ] **Step 3: Run production build**

Run:

```bash
rtk zsh -c 'source ~/.zshrc && rtk pnpm run build'
```

Expected: PASS and generated output under `dist/`.

- [ ] **Step 4: Validate OpenSpec change**

Run:

```bash
rtk zsh -c 'source ~/.zshrc && rtk openspec validate polish-cache-management-and-status-rail --type change --strict'
```

Expected: PASS.

- [ ] **Step 5: Inspect final change status**

Run:

```bash
rtk zsh -c 'source ~/.zshrc && rtk openspec status --change "polish-cache-management-and-status-rail" --json'
```

Expected: `explore`, `proposal`, `specs`, `design`, and `tasks` are all `done`; `isComplete` remains `false` until implementation tasks are checked off.

---

### Task 5.3: Package a local VSIX for manual validation

**Spec coverage:** dashboard / Operational status rail / Rail adapts to narrow sidebar width; dashboard / Dashboard cache management entry / Cache action completes; dashboard / Scope transition feedback / Target cached data arrives during scope switch

**Files:**
- Generated: `*.vsix`

- [ ] **Step 1: Package the extension**

Run:

```bash
rtk zsh -c 'source ~/.zshrc && rtk pnpm run package'
```

Expected: package command completes and writes a `.vsix` file for the current `package.json` version.

- [ ] **Step 2: Install the VSIX in Cursor for manual validation**

Use the generated file from Step 1. In Cursor, run the command palette action `Extensions: Install from VSIX...` and select that file.

- [ ] **Step 3: Validate status rail manually**

Open an OpenSpec workspace with multiple scopes and confirm:

```text
1. The status area is a compact rail, not a large blue card.
2. Runtime source, selected scope, health, activity, and cache summary are visible.
3. Cache summary opens actions for Open Folder, Copy Path, Clear Cache, and Show Details.
4. Scope switching first shows Switching, then changes to cached refresh if target cached data appears.
5. Fresh data clears the activity label.
6. Fresh refresh failure after target cache keeps cached data visible and shows a warning.
```

- [ ] **Step 4: Validate cache commands manually**

Run these commands from the command palette:

```text
OpenSpec: Open Cache Folder
OpenSpec: Copy Cache Path
OpenSpec: Show Cache Details
OpenSpec: Clear Cache
```

Expected: each command completes without changing files under the workspace `openspec/` directory.
