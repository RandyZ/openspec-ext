# Task 4. Stores and Worksets Panel

<!-- covers: Task 4.1, Task 4.2, Task 4.3 -->

### Task 4.1: Add panel tests for registered stores, references, and personal worksets

**Spec coverage:** `dashboard` / `### Requirement: Stores and worksets maintenance panel` / all scenarios

**Files:**
- Create: `test/webview/components/storesAndWorksetsPanel.test.tsx`
- Test: `test/webview/components/storesAndWorksetsPanel.test.tsx`

- [ ] **Step 1: Create component tests for the combined maintenance panel**

Create `test/webview/components/storesAndWorksetsPanel.test.tsx`:

```tsx
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { StoresAndWorksetsPanel } from '../../../src/webview/components/StoresAndWorksetsPanel';
import type { OpenSpecScopeView } from '../../../src/webview/types/messages';

const localScope: OpenSpecScopeView = {
  id: 'local:/workspace',
  label: 'Local Root',
  source: 'local',
  rootPath: '/workspace',
  runtimeSource: 'installed',
};

const storeScope: OpenSpecScopeView = {
  id: 'store:team-plans',
  label: 'team-plans',
  source: 'store',
  rootPath: '/stores/team-plans',
  storeId: 'team-plans',
  runtimeSource: 'localSource',
};

describe('StoresAndWorksetsPanel', () => {
  it('lists registered stores with maintenance actions', () => {
    const html = renderToStaticMarkup(
      <StoresAndWorksetsPanel
        scopes={[localScope, storeScope]}
        currentScopeId={localScope.id}
        references={[]}
        worksets={[]}
        onSelectStore={vi.fn()}
        onRegisterStore={vi.fn()}
        onSetupStore={vi.fn()}
        onOpenWorkset={vi.fn()}
        onCopyFetch={vi.fn()}
      />,
    );

    expect(html).toContain('Stores &amp; Worksets');
    expect(html).toContain('Store: team-plans');
    expect(html).toContain('/stores/team-plans');
    expect(html).toContain('Open');
    expect(html).toContain('Register Store');
    expect(html).toContain('Create Store');
  });

  it('presents references as read-only context', () => {
    const html = renderToStaticMarkup(
      <StoresAndWorksetsPanel
        scopes={[localScope]}
        references={[
          {
            store_id: 'platform-reqs',
            specs: [{ id: 'billing', summary: 'Billing requirements' }],
            fetch: 'openspec show billing --type spec --store platform-reqs',
            status: [],
          },
        ]}
        worksets={[]}
        onSelectStore={vi.fn()}
        onRegisterStore={vi.fn()}
        onSetupStore={vi.fn()}
        onOpenWorkset={vi.fn()}
        onCopyFetch={vi.fn()}
      />,
    );

    expect(html).toContain('Read-only references');
    expect(html).toContain('platform-reqs');
    expect(html).toContain('billing');
    expect(html).toContain('Copy fetch command');
    expect(html).not.toContain('Apply');
    expect(html).not.toContain('Archive');
    expect(html).not.toContain('Verify');
  });

  it('lists worksets as local personal views', () => {
    const html = renderToStaticMarkup(
      <StoresAndWorksetsPanel
        scopes={[localScope]}
        references={[]}
        worksets={[
          {
            name: 'platform',
            tool: 'code',
            members: [{ name: 'team-plans', path: '/stores/team-plans' }],
          },
        ]}
        onSelectStore={vi.fn()}
        onRegisterStore={vi.fn()}
        onSetupStore={vi.fn()}
        onOpenWorkset={vi.fn()}
        onCopyFetch={vi.fn()}
      />,
    );

    expect(html).toContain('Personal worksets');
    expect(html).toContain('Local personal views');
    expect(html).toContain('platform');
    expect(html).toContain('code');
  });
});
```

- [ ] **Step 2: Run the new test and confirm FAIL**

Run:

```bash
zsh -lc 'source ~/.zshrc && rtk pnpm test -- test/webview/components/storesAndWorksetsPanel.test.tsx'
```

Expected: FAIL because `StoresAndWorksetsPanel` does not exist yet.

---

### Task 4.2: Compose a Stores and Worksets panel from existing dashboard data

**Spec coverage:** `dashboard` / `### Requirement: Stores and worksets maintenance panel` / `#### Scenario: Registered stores are listed`, `#### Scenario: References are presented as read-only context`, `#### Scenario: Personal worksets are listed`

**Files:**
- Create: `src/webview/components/StoresAndWorksetsPanel.tsx`
- Modify: `src/i18n/locales/en.json`
- Modify: `src/i18n/locales/zh-cn.json`
- Test: `test/webview/components/storesAndWorksetsPanel.test.tsx`, `test/i18n/i18n.test.ts`

- [ ] **Step 1: Create the combined panel component**

Create `src/webview/components/StoresAndWorksetsPanel.tsx`:

```tsx
import React from 'react';
import { t } from '../../i18n';
import type {
  OpenSpecScopeView,
  ReferenceIndexEntryView,
  WorksetView,
} from '../types/messages';
import { formatOpenSpecRootLabel } from '../utils/scopeLabels';

export interface StoresAndWorksetsPanelProps {
  scopes?: OpenSpecScopeView[];
  currentScopeId?: string;
  references?: ReferenceIndexEntryView[];
  worksets?: WorksetView[];
  pending?: boolean;
  onSelectStore: (scopeId: string) => void;
  onRegisterStore: () => void;
  onSetupStore: () => void;
  onOpenWorkset: (name: string) => void;
  onCopyFetch: (text: string) => void;
}

export const StoresAndWorksetsPanel: React.FC<StoresAndWorksetsPanelProps> = ({
  scopes = [],
  currentScopeId,
  references = [],
  worksets = [],
  pending = false,
  onSelectStore,
  onRegisterStore,
  onSetupStore,
  onOpenWorkset,
  onCopyFetch,
}) => {
  const stores = scopes.filter((scope) => scope.source === 'store');

  return (
    <section className="mb-6 border-t pt-4" style={{ borderColor: 'var(--vscode-panel-border)' }}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold" style={{ color: 'var(--vscode-foreground)' }}>
          {t('storesWorksets.title')}
        </h2>
        <div className="flex gap-1">
          <button type="button" disabled={pending} onClick={onRegisterStore} className="rounded px-2 py-1 text-xs">
            {t('scope.action.registerStore')}
          </button>
          <button type="button" disabled={pending} onClick={onSetupStore} className="rounded px-2 py-1 text-xs">
            {t('scope.action.setupStore')}
          </button>
        </div>
      </div>

      <div className="space-y-3 text-xs">
        <div>
          <h3 className="mb-1 font-medium">{t('storesWorksets.stores')}</h3>
          {stores.length === 0 ? (
            <p style={{ color: 'var(--vscode-descriptionForeground)' }}>{t('storesWorksets.noStores')}</p>
          ) : (
            <div className="space-y-1">
              {stores.map((store) => (
                <div key={store.id} className="rounded border p-2" style={{ borderColor: 'var(--vscode-panel-border)' }}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{formatOpenSpecRootLabel(store)}</span>
                    <button
                      type="button"
                      disabled={pending || currentScopeId === store.id}
                      onClick={() => onSelectStore(store.id)}
                      className="rounded px-2 py-0.5 text-xs"
                    >
                      {t('storesWorksets.openStore')}
                    </button>
                  </div>
                  <div className="mt-1 truncate" title={store.rootPath} style={{ color: 'var(--vscode-descriptionForeground)' }}>
                    {store.rootPath}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <h3 className="mb-1 font-medium">{t('storesWorksets.references')}</h3>
          <p className="mb-1" style={{ color: 'var(--vscode-descriptionForeground)' }}>
            {t('storesWorksets.referencesDescription')}
          </p>
          {references.length === 0 ? (
            <p style={{ color: 'var(--vscode-descriptionForeground)' }}>{t('storesWorksets.noReferences')}</p>
          ) : (
            references.map((ref) => (
              <div key={ref.store_id} className="rounded border p-2" style={{ borderColor: 'var(--vscode-panel-border)' }}>
                <div className="font-medium">{ref.store_id}</div>
                {(ref.specs ?? []).map((spec) => (
                  <div key={spec.id} style={{ color: 'var(--vscode-descriptionForeground)' }}>
                    {spec.id}{spec.summary ? ` - ${spec.summary}` : ''}
                  </div>
                ))}
                {ref.fetch && (
                  <button type="button" onClick={() => onCopyFetch(ref.fetch!)} className="mt-1 rounded px-2 py-0.5 text-xs">
                    {t('references.copyFetch')}
                  </button>
                )}
              </div>
            ))
          )}
        </div>

        <div>
          <h3 className="mb-1 font-medium">{t('storesWorksets.worksets')}</h3>
          <p className="mb-1" style={{ color: 'var(--vscode-descriptionForeground)' }}>{t('worksets.description')}</p>
          {worksets.length === 0 ? (
            <p style={{ color: 'var(--vscode-descriptionForeground)' }}>{t('storesWorksets.noWorksets')}</p>
          ) : (
            worksets.map((workset) => (
              <button
                key={workset.name}
                type="button"
                onClick={() => onOpenWorkset(workset.name)}
                className="block w-full rounded border px-2 py-1 text-left"
                style={{ borderColor: 'var(--vscode-panel-border)' }}
              >
                <span className="font-medium">{workset.name}</span>
                {workset.tool ? <span className="ml-2">({workset.tool})</span> : null}
              </button>
            ))
          )}
        </div>
      </div>
    </section>
  );
};
```

- [ ] **Step 2: Add locale keys**

Add English keys:

```json
{
  "storesWorksets.title": "Stores & Worksets",
  "storesWorksets.stores": "Registered stores",
  "storesWorksets.noStores": "No stores registered.",
  "storesWorksets.openStore": "Open",
  "storesWorksets.references": "Read-only references",
  "storesWorksets.referencesDescription": "References provide upstream context and are not the writable planning root.",
  "storesWorksets.noReferences": "No references configured.",
  "storesWorksets.worksets": "Personal worksets",
  "storesWorksets.noWorksets": "No worksets yet.",
  "references.copyFetch": "Copy fetch command"
}
```

Add Simplified Chinese keys:

```json
{
  "storesWorksets.title": "Stores 与工作集",
  "storesWorksets.stores": "已注册 Stores",
  "storesWorksets.noStores": "还没有注册 store。",
  "storesWorksets.openStore": "打开",
  "storesWorksets.references": "只读 References",
  "storesWorksets.referencesDescription": "References 提供上游上下文，不是当前可写规划根。",
  "storesWorksets.noReferences": "还没有配置 reference。",
  "storesWorksets.worksets": "个人工作集",
  "storesWorksets.noWorksets": "还没有工作集。",
  "references.copyFetch": "复制 fetch 命令"
}
```

- [ ] **Step 3: Run panel and i18n tests**

Run:

```bash
zsh -lc 'source ~/.zshrc && rtk pnpm test -- test/webview/components/storesAndWorksetsPanel.test.tsx test/i18n/i18n.test.ts'
```

Expected: PASS.

---

### Task 4.3: Wire store and workset maintenance actions through typed webview messages

**Spec coverage:** `dashboard` / `### Requirement: Stores and worksets maintenance panel` / `#### Scenario: Store setup and registration are available`, `#### Scenario: Registered stores are listed`, `#### Scenario: Personal worksets are listed`

**Files:**
- Modify: `src/webview/components/Dashboard.tsx`
- Modify: `test/webview/components/dashboard.test.tsx`
- Test: `test/webview/components/dashboard.test.tsx`, `test/webview/components/storesAndWorksetsPanel.test.tsx`

- [ ] **Step 1: Replace separate reference/workset rendering with the combined panel**

In `Dashboard.tsx`, replace the `ReferencesPanel` and `WorksetsPanel` imports with:

```tsx
import { StoresAndWorksetsPanel } from './StoresAndWorksetsPanel';
```

Replace the separate panels with:

```tsx
<StoresAndWorksetsPanel
  scopes={data.scopes ?? []}
  currentScopeId={data.scope?.id}
  references={data.relationships?.references ?? []}
  worksets={data.worksets ?? []}
  pending={loadingReason === 'store-register' || loadingReason === 'store-setup'}
  onSelectStore={handleSelectScope}
  onRegisterStore={handleRegisterStore}
  onSetupStore={handleSetupStore}
  onOpenWorkset={(name) => {
    postMessage(sendMessage.openWorkset(name));
  }}
  onCopyFetch={(text) => {
    navigator.clipboard.writeText(text).catch(() => {});
  }}
/>
```

- [ ] **Step 2: Add dashboard rendering coverage**

Add this test to `test/webview/components/dashboard.test.tsx`:

```tsx
it('renders stores and worksets maintenance from dashboard data', () => {
  const html = renderDashboardWithData({
    ...dashboardData,
    scope: localScope,
    scopes: [localScope, storeScope],
    relationships: {
      references: [
        {
          store_id: 'platform-reqs',
          specs: [{ id: 'billing', summary: 'Billing requirements' }],
          fetch: 'openspec show billing --type spec --store platform-reqs',
          status: [],
        },
      ],
    },
    worksets: [
      {
        name: 'platform',
        tool: 'code',
        members: [{ name: 'team-plans', path: '/stores/team-plans' }],
      },
    ],
  });

  expect(html).toContain('Stores &amp; Worksets');
  expect(html).toContain('Store: team-plans');
  expect(html).toContain('platform-reqs');
  expect(html).toContain('platform');
});
```

- [ ] **Step 3: Run dashboard and panel tests**

Run:

```bash
zsh -lc 'source ~/.zshrc && rtk pnpm test -- test/webview/components/dashboard.test.tsx test/webview/components/storesAndWorksetsPanel.test.tsx'
```

Expected: PASS. The dashboard should still use existing typed messages: `selectScope`, `requestRegisterStore`, `requestSetupStore`, and `openWorkset`.
