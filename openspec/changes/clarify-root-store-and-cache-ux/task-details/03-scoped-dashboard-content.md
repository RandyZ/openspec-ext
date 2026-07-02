# Task 3. Scoped Dashboard Content

<!-- covers: Task 3.1, Task 3.2, Task 3.3 -->

### Task 3.1: Add extension-host tests for scoped archived change requests

**Spec coverage:** `dashboard` / `### Requirement: Scoped archive overview` / `#### Scenario: Local root archives are scoped`, `#### Scenario: Store root archives are scoped`, `#### Scenario: Scoped archive request fails`

**Files:**
- Modify: `test/extension/providers/webviewMessageHandler.test.ts`
- Test: `test/extension/providers/webviewMessageHandler.test.ts`

- [ ] **Step 1: Add a failing test for store-scoped archive loading**

Append this test to `test/extension/providers/webviewMessageHandler.test.ts`:

```ts
it('passes the resolved store scope when listing archived changes', async () => {
  const storeScope = {
    id: 'store:team-plans',
    label: 'team-plans',
    source: 'store',
    rootPath: '/stores/team-plans',
    storeId: 'team-plans',
  };
  const dataManager = {
    getWorkspaceRoot: vi.fn().mockReturnValue('/workspace'),
    resolveScope: vi.fn().mockReturnValue(storeScope),
    listArchivedChanges: vi.fn().mockResolvedValue([
      {
        directoryName: '2026-06-30-store-change',
        name: 'store-change',
        archiveDate: '2026-06-30',
      },
    ]),
  };
  const webview = { postMessage: vi.fn() };

  await handleWebviewMessage(
    { type: 'getArchivedChanges', scopeId: 'store:team-plans' },
    webview as any,
    dataManager as any,
  );

  expect(dataManager.resolveScope).toHaveBeenCalledWith('store:team-plans');
  expect(dataManager.listArchivedChanges).toHaveBeenCalledWith(storeScope);
  expect(webview.postMessage).toHaveBeenCalledWith({
    type: 'archivedChanges',
    items: [
      {
        directoryName: '2026-06-30-store-change',
        name: 'store-change',
        archiveDate: '2026-06-30',
      },
    ],
  });
});
```

- [ ] **Step 2: Add a failure-path test that does not fall back to another root**

Add this test:

```ts
it('returns an empty archive list when the selected scoped archive request fails', async () => {
  const storeScope = {
    id: 'store:team-plans',
    label: 'team-plans',
    source: 'store',
    rootPath: '/stores/team-plans',
    storeId: 'team-plans',
  };
  const dataManager = {
    getWorkspaceRoot: vi.fn().mockReturnValue('/workspace'),
    resolveScope: vi.fn().mockReturnValue(storeScope),
    listArchivedChanges: vi.fn().mockRejectedValue(new Error('store archive unavailable')),
  };
  const webview = { postMessage: vi.fn() };

  await handleWebviewMessage(
    { type: 'getArchivedChanges', scopeId: 'store:team-plans' },
    webview as any,
    dataManager as any,
  );

  expect(dataManager.listArchivedChanges).toHaveBeenCalledWith(storeScope);
  expect(webview.postMessage).toHaveBeenCalledWith({ type: 'archivedChanges', items: [] });
});
```

- [ ] **Step 3: Run the handler tests and confirm FAIL**

Run:

```bash
zsh -lc 'source ~/.zshrc && rtk pnpm test -- test/extension/providers/webviewMessageHandler.test.ts'
```

Expected: FAIL because `getArchivedChanges` currently calls `dataManager.listArchivedChanges()` without the resolved scope.

---

### Task 3.2: Pass resolved scope into archived change loading

**Spec coverage:** `dashboard` / `### Requirement: Scoped archive overview` / all scenarios

**Files:**
- Modify: `src/extension/providers/webviewMessageHandler.ts`
- Test: `test/extension/providers/webviewMessageHandler.test.ts`

- [ ] **Step 1: Resolve the scope in the archive handler**

Update the `getArchivedChanges` branch:

```ts
case 'getArchivedChanges': {
  try {
    const { scope } = resolveScopeRoot(dataManager, message.scopeId);
    const items = await dataManager.listArchivedChanges(scope);
    webview.postMessage({ type: 'archivedChanges', items });
  } catch (err) {
    logger.error('Failed to list archived changes', err as Error);
    webview.postMessage({ type: 'archivedChanges', items: [] });
  }
  break;
}
```

- [ ] **Step 2: Run the handler tests and confirm PASS**

Run:

```bash
zsh -lc 'source ~/.zshrc && rtk pnpm test -- test/extension/providers/webviewMessageHandler.test.ts'
```

Expected: PASS.

---

### Task 3.3: Add root-scoped empty states for changes, archives, and specs

**Spec coverage:** `dashboard` / `### Requirement: Root-scoped empty states` / all scenarios; `dashboard` / `### Requirement: OpenSpec root selector clarity` / `#### Scenario: Store root does not inherit local root content`

**Files:**
- Modify: `src/webview/components/Dashboard.tsx`
- Modify: `src/webview/components/ChangesSection.tsx`
- Modify: `src/webview/components/SpecsSection.tsx`
- Modify: `src/i18n/locales/en.json`
- Modify: `src/i18n/locales/zh-cn.json`
- Modify: `test/webview/components/dashboard.test.tsx`
- Create: `test/webview/components/changesSection.test.tsx`
- Create: `test/webview/components/specsSection.test.tsx`
- Test: dashboard, changes section, specs section, i18n

- [ ] **Step 1: Add section-level tests for root-specific empty copy**

Create `test/webview/components/changesSection.test.tsx`:

```tsx
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ChangesSection } from '../../../src/webview/components/ChangesSection';

describe('ChangesSection root-scoped empty states', () => {
  it('names the selected root when no changes exist', () => {
    const html = renderToStaticMarkup(
      <ChangesSection
        changes={[]}
        rootLabel="Store: team-plans"
        onRequestNewChange={vi.fn()}
      />,
    );

    expect(html).toContain('No active changes in Store: team-plans');
  });

  it('names the selected root when archives are empty', () => {
    const html = renderToStaticMarkup(
      <ChangesSection
        changes={[]}
        rootLabel="Store: team-plans"
        archivedExpanded
        archivedItems={[]}
        archivedLoading={false}
        onArchivedToggle={vi.fn()}
      />,
    );

    expect(html).toContain('No archived changes in Store: team-plans');
  });
});
```

Create `test/webview/components/specsSection.test.tsx`:

```tsx
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SpecsSection } from '../../../src/webview/components/SpecsSection';

describe('SpecsSection root-scoped empty states', () => {
  it('names the selected root when no specs exist', () => {
    const html = renderToStaticMarkup(
      <SpecsSection specs={[]} rootLabel="Store: team-plans" />,
    );

    expect(html).toContain('No specs defined in Store: team-plans');
  });
});
```

- [ ] **Step 2: Run the new tests and confirm FAIL**

Run:

```bash
zsh -lc 'source ~/.zshrc && rtk pnpm test -- test/webview/components/changesSection.test.tsx test/webview/components/specsSection.test.tsx'
```

Expected: FAIL because `rootLabel` props and root-specific locale keys do not exist yet.

- [ ] **Step 3: Add rootLabel props and wire them from Dashboard**

In `ChangesSection.tsx`, add `rootLabel?: string` to props and use root-specific copy:

```tsx
interface ChangesSectionProps {
  changes: ChangeInfo[];
  rootLabel?: string;
  // existing props stay unchanged
}
```

```tsx
message={rootLabel ? t('dashboard.emptyChangesInRoot', { root: rootLabel }) : t('dashboard.emptyChanges')}
```

For archived empty copy:

```tsx
{rootLabel ? t('dashboard.archivedEmptyInRoot', { root: rootLabel }) : t('dashboard.archivedEmpty')}
```

In `SpecsSection.tsx`, add `rootLabel?: string` and render:

```tsx
<EmptyState
  message={rootLabel ? t('dashboard.emptySpecsInRoot', { root: rootLabel }) : t('dashboard.emptySpecs')}
/>
```

In `Dashboard.tsx`, import and use the root label helper:

```tsx
import { formatOpenSpecRootLabel } from '../utils/scopeLabels';
```

Before rendering child sections:

```tsx
const selectedRootLabel = data.scope ? formatOpenSpecRootLabel(data.scope) : undefined;
```

Pass it to both sections:

```tsx
<ChangesSection
  rootLabel={selectedRootLabel}
  changes={data.changes}
  // existing props
/>
<SpecsSection
  rootLabel={selectedRootLabel}
  specs={data.specs}
  // existing props
/>
```

- [ ] **Step 4: Add locale keys**

Add English keys:

```json
{
  "dashboard.emptyChangesInRoot": "No active changes in {root}. Create one to get started.",
  "dashboard.emptySpecsInRoot": "No specs defined in {root}.",
  "dashboard.archivedEmptyInRoot": "No archived changes in {root}."
}
```

Add Simplified Chinese keys:

```json
{
  "dashboard.emptyChangesInRoot": "{root} 中没有活跃 change。创建一个开始使用。",
  "dashboard.emptySpecsInRoot": "{root} 中还没有定义 spec。",
  "dashboard.archivedEmptyInRoot": "{root} 中没有归档 change。"
}
```

- [ ] **Step 5: Run scoped content tests**

Run:

```bash
zsh -lc 'source ~/.zshrc && rtk pnpm test -- test/webview/components/dashboard.test.tsx test/webview/components/changesSection.test.tsx test/webview/components/specsSection.test.tsx test/i18n/i18n.test.ts'
```

Expected: PASS.
