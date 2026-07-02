# Task 1. Root Selector and Cache Rail

<!-- covers: Task 1.1, Task 1.2, Task 1.3 -->

### Task 1.1: Add ScopeBar tests for OpenSpec Root labels and stable cache menu behavior

**Spec coverage:** `dashboard` / `### Requirement: OpenSpec root selector clarity` / `#### Scenario: Selector distinguishes local and store roots`; `extension-cache` / `### Requirement: Stable cache status rail controls` / `#### Scenario: Cache actions open without rail reflow`, `#### Scenario: Cache actions remain accessible`

**Files:**
- Modify: `test/webview/components/scopeBar.test.tsx`
- Test: `test/webview/components/scopeBar.test.tsx`

- [ ] **Step 1: Add failing tests for root labels and non-inline cache actions**

Append these tests inside the existing `describe('ScopeBar', () => { ... })` block:

```tsx
it('labels the selector as OpenSpec Root and prefixes store roots', () => {
  const html = renderToStaticMarkup(
    <ScopeBar
      scope={storeScope}
      scopes={[localScope, storeScope]}
      health={{ status: 'ok', label: 'Healthy' }}
      loading={false}
      cacheStats={cacheStats}
      onSelectScope={vi.fn()}
      onCacheAction={vi.fn()}
    />,
  );

  expect(html).toContain('OpenSpec Root');
  expect(html).toContain('aria-label="OpenSpec Root"');
  expect(html).toContain('Local Root');
  expect(html).toContain('Store: team-plans');
});

it('renders cache actions behind a menu trigger without inline details markup', () => {
  const html = renderToStaticMarkup(
    <ScopeBar
      scope={storeScope}
      scopes={[localScope, storeScope]}
      health={{ status: 'ok', label: 'Healthy' }}
      loading={false}
      cacheStats={cacheStats}
      onSelectScope={vi.fn()}
      onCacheAction={vi.fn()}
    />,
  );

  expect(html).toContain('aria-haspopup="menu"');
  expect(html).toContain('aria-expanded="false"');
  expect(html).toContain('Cache 12.0 KB');
  expect(html).not.toContain('<details');
  expect(html).not.toContain('<summary');
  expect(html).not.toContain('Open Folder</button>');
});
```

- [ ] **Step 2: Run the ScopeBar tests and confirm FAIL**

Run:

```bash
zsh -lc 'source ~/.zshrc && rtk pnpm test -- test/webview/components/scopeBar.test.tsx'
```

Expected: FAIL because the selector still uses `aria-label="OpenSpec scope"`, store options are not prefixed, and cache actions are rendered inside `<details>`.

---

### Task 1.2: Refactor ScopeBar cache actions into a non-reflowing menu

**Spec coverage:** `extension-cache` / `### Requirement: Stable cache status rail controls` / all scenarios; `dashboard` / `### Requirement: OpenSpec root selector clarity` / `#### Scenario: Selector distinguishes local and store roots`

**Files:**
- Create: `src/webview/utils/scopeLabels.ts`
- Modify: `src/webview/components/ScopeBar.tsx`
- Test: `test/webview/components/scopeBar.test.tsx`

- [ ] **Step 1: Add a shared root label helper**

Create `src/webview/utils/scopeLabels.ts`:

```ts
import { t } from '../../i18n';
import type { OpenSpecScopeView } from '../types/messages';

export function formatOpenSpecRootLabel(scope?: Pick<OpenSpecScopeView, 'source' | 'label' | 'storeId'>): string {
  if (!scope) return t('scope.root.unknown');
  if (scope.source === 'store') {
    return t('scope.root.storeLabel', { id: scope.storeId ?? scope.label });
  }
  if (scope.source === 'declared') {
    return t('scope.root.declaredLabel', { label: scope.label });
  }
  return t('scope.root.localLabel');
}
```

- [ ] **Step 2: Replace inline `details` with a controlled menu**

In `src/webview/components/ScopeBar.tsx`, import `useState` and the helper:

```tsx
import React, { useState } from 'react';
import { formatOpenSpecRootLabel } from '../utils/scopeLabels';
```

Inside the component, add local menu state:

```tsx
const [cacheMenuOpen, setCacheMenuOpen] = useState(false);
const rootLabel = formatOpenSpecRootLabel(scope);
```

Replace the selector label and option labels:

```tsx
<span className="shrink-0" style={{ color: 'var(--vscode-descriptionForeground)' }}>
  {t('scope.root.selectorLabel')}
</span>
<select
  disabled={disableScopeActions}
  value={scope.id}
  onChange={(event) => onSelectScope(event.currentTarget.value)}
  aria-label={t('scope.root.selectorLabel')}
  className="min-w-0 max-w-[60%] truncate rounded border px-1 py-0.5 text-xs"
  style={{
    borderColor: 'var(--vscode-dropdown-border)',
    background: 'var(--vscode-dropdown-background)',
    color: 'var(--vscode-dropdown-foreground)',
  }}
>
  {scopes.map((item) => (
    <option key={item.id} value={item.id}>
      {formatOpenSpecRootLabel(item)}
    </option>
  ))}
</select>
```

For the single-root branch, render `rootLabel`.

- [ ] **Step 3: Render cache actions in an overlay menu**

Replace the `<details>` block with:

```tsx
<div className="relative min-w-0">
  <button
    type="button"
    aria-label={t('cache.menuLabel')}
    aria-haspopup="menu"
    aria-expanded={cacheMenuOpen}
    title={cacheText}
    disabled={cacheActionDisabled}
    onClick={() => setCacheMenuOpen((open) => !open)}
    className="max-w-full truncate border-none bg-transparent p-0 text-left text-xs"
    style={{
      color: 'var(--vscode-foreground)',
      opacity: cacheActionDisabled ? 0.6 : 1,
    }}
  >
    {cacheLabel}
  </button>

  {cacheMenuOpen && (
    <div
      role="menu"
      className="absolute left-0 z-10 mt-1 min-w-36 rounded border p-1 shadow-lg"
      style={{
        borderColor: 'var(--vscode-panel-border)',
        background: 'var(--vscode-menu-background)',
        color: 'var(--vscode-menu-foreground)',
      }}
    >
      {cacheActions.map((action) => {
        const label = action === 'openFolder'
          ? t('cache.openFolder')
          : action === 'copyPath'
            ? t('cache.copyPath')
            : action === 'clear'
              ? t('cache.clear')
              : t('cache.showDetails');

        return (
          <button
            key={action}
            type="button"
            role="menuitem"
            aria-label={label}
            title={label}
            disabled={cacheActionDisabled}
            onClick={() => {
              setCacheMenuOpen(false);
              runCacheAction(action);
            }}
            className="block w-full rounded px-2 py-1 text-left text-xs"
            style={{
              background: 'transparent',
              color: 'var(--vscode-menu-foreground)',
              opacity: cacheActionDisabled ? 0.6 : 1,
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  )}
</div>
```

- [ ] **Step 4: Run the ScopeBar tests and confirm PASS**

Run:

```bash
zsh -lc 'source ~/.zshrc && rtk pnpm test -- test/webview/components/scopeBar.test.tsx'
```

Expected: PASS.

---

### Task 1.3: Add localized root selector and cache menu strings

**Spec coverage:** `dashboard` / `### Requirement: OpenSpec root selector clarity`; `extension-cache` / `### Requirement: Stable cache status rail controls`

**Files:**
- Modify: `src/i18n/locales/en.json`
- Modify: `src/i18n/locales/zh-cn.json`
- Test: `test/i18n/i18n.test.ts`, `test/webview/components/scopeBar.test.tsx`

- [ ] **Step 1: Add English strings**

Add these keys to `src/i18n/locales/en.json` near the existing `scope.*` and `cache.*` strings:

```json
{
  "scope.root.selectorLabel": "OpenSpec Root",
  "scope.root.localLabel": "Local Root",
  "scope.root.storeLabel": "Store: {id}",
  "scope.root.declaredLabel": "Declared Root: {label}",
  "scope.root.unknown": "Current Root"
}
```

- [ ] **Step 2: Add Simplified Chinese strings**

Add matching keys to `src/i18n/locales/zh-cn.json`:

```json
{
  "scope.root.selectorLabel": "OpenSpec 根",
  "scope.root.localLabel": "本地根",
  "scope.root.storeLabel": "Store：{id}",
  "scope.root.declaredLabel": "声明根：{label}",
  "scope.root.unknown": "当前根"
}
```

- [ ] **Step 3: Run i18n and ScopeBar tests**

Run:

```bash
zsh -lc 'source ~/.zshrc && rtk pnpm test -- test/i18n/i18n.test.ts test/webview/components/scopeBar.test.tsx'
```

Expected: PASS with no missing locale key failures.
