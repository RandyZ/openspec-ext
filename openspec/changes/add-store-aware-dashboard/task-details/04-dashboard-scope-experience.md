# Task 4. Dashboard Scope Experience

<!-- covers: Task 4.1, Task 4.2, Task 4.3, Task 4.4, Task 4.5 -->

### Task 4.1: Extend dashboard message and view models with scope data

**Spec coverage:** dashboard / Requirement: Scope Bar; openspec-scope-management / Requirement: Selected OpenSpec scope

**Files:**
- Modify: `src/webview/types/messages.ts`
- Modify: `src/webview/context/AppContext.tsx`
- Modify: `src/extension/services/types.ts`
- Modify: `test/webview/components/dashboard.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// test/webview/components/dashboard.test.tsx
it('renders dashboard data with selected scope metadata', () => {
  const html = renderToStaticMarkup(
    <AppProvider
      initialState={{
        data: {
          scope: { id: 'store:team-plans', label: 'team-plans', source: 'store', rootPath: '/stores/team-plans', storeId: 'team-plans', runtimeSource: 'localSource' },
          scopes: [],
          changes: [],
          specs: [],
          lastRefresh: 1,
        },
        loading: false,
        error: null,
        selectedChange: null,
        debug: false,
        cliDiagnostic: null,
      }}
    >
      <Dashboard />
    </AppProvider>
  );

  expect(html).toContain('team-plans');
  expect(html).toContain('Local Source');
});
```

- [ ] **Step 2: Run test - expect FAIL**

Run: `pnpm vitest run test/webview/components/dashboard.test.tsx`
Expected: FAIL because dashboard data has no scope view model and UI does not render it.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/webview/types/messages.ts
export interface OpenSpecScopeView {
  id: string;
  label: string;
  source: 'local' | 'store' | 'declared';
  rootPath: string;
  storeId?: string;
  runtimeSource: 'installed' | 'customPath' | 'localSource';
}

export interface DashboardData {
  scope?: OpenSpecScopeView;
  scopes?: OpenSpecScopeView[];
  relationships?: RelationshipPanelData;
  featureDiagnostics?: FeatureDiagnosticView[];
  changes: ChangeInfo[];
  specs: SpecInfo[];
  lastRefresh: number;
}
```

Keep fields optional until all providers are upgraded so existing tests can be migrated incrementally.

- [ ] **Step 4: Run test - expect PASS**

Run: `pnpm vitest run test/webview/components/dashboard.test.tsx`
Expected: PASS.

---

### Task 4.2: Build the compact Scope Bar component

**Spec coverage:** dashboard / Requirement: Scope Bar / Scenarios: Scope Bar shows local root, Scope Bar shows selected store, Scope Bar shows declared store, Scope Bar remains compact in sidebar

**Files:**
- Create: `src/webview/components/ScopeBar.tsx`
- Create: `test/webview/components/scopeBar.test.tsx`
- Modify: `src/webview/components/Dashboard.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// test/webview/components/scopeBar.test.tsx
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ScopeBar } from '../../../src/webview/components/ScopeBar';

describe('ScopeBar', () => {
  it('shows runtime, scope, and health', () => {
    const html = renderToStaticMarkup(
      <ScopeBar
        scope={{ id: 'store:team-plans', label: 'team-plans', source: 'store', rootPath: '/stores/team-plans', storeId: 'team-plans', runtimeSource: 'localSource' }}
        scopes={[]}
        health={{ status: 'ok', label: 'Healthy' }}
        loading={false}
        onSelectScope={vi.fn()}
      />
    );

    expect(html).toContain('Local Source');
    expect(html).toContain('team-plans');
    expect(html).toContain('Healthy');
  });
});
```

- [ ] **Step 2: Run test - expect FAIL**

Run: `pnpm vitest run test/webview/components/scopeBar.test.tsx`
Expected: FAIL because `ScopeBar` does not exist.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/webview/components/ScopeBar.tsx
import React from 'react';
import type { OpenSpecScopeView } from '../types/messages';

function runtimeLabel(source: OpenSpecScopeView['runtimeSource']): string {
  if (source === 'localSource') return 'Local Source';
  if (source === 'customPath') return 'Custom Path';
  return 'Installed CLI';
}

export const ScopeBar: React.FC<{
  scope?: OpenSpecScopeView;
  scopes?: OpenSpecScopeView[];
  health?: { status: 'ok' | 'warning' | 'unavailable'; label: string };
  loading: boolean;
  onSelectScope: (scopeId: string) => void;
}> = ({ scope, scopes = [], health, loading, onSelectScope }) => {
  if (!scope) return null;
  return (
    <section className="mb-3 rounded border px-2 py-2 text-xs" style={{ borderColor: 'var(--vscode-panel-border)', background: 'var(--vscode-editor-inactiveSelectionBackground)' }}>
      <div className="flex flex-wrap items-center gap-2">
        <span>{runtimeLabel(scope.runtimeSource)}</span>
        <strong>{scope.label}</strong>
        <span style={{ color: 'var(--vscode-descriptionForeground)' }}>{health?.label ?? scope.source}</span>
        {scopes.length > 1 && (
          <select disabled={loading} value={scope.id} onChange={(event) => onSelectScope(event.currentTarget.value)} aria-label="OpenSpec scope">
            {scopes.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        )}
      </div>
    </section>
  );
};
```

- [ ] **Step 4: Run test - expect PASS**

Run: `pnpm vitest run test/webview/components/scopeBar.test.tsx`
Expected: PASS.

---

### Task 4.3: Wire store selection to scoped dashboard refresh

**Spec coverage:** dashboard / Requirement: Store selection / Scenarios: Store selector lists local root and registered stores, Selecting a store refreshes scoped data, Returning to local root restores local dashboard

**Files:**
- Modify: `src/webview/types/messages.ts`
- Modify: `src/webview/components/Dashboard.tsx`
- Modify: `src/extension/providers/webviewMessageHandler.ts`
- Modify: `test/extension/providers/webviewMessageHandler.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/webview/types/messages.ts expected addition in tests
expect(sendMessage.selectScope('store:team-plans')).toEqual({ type: 'selectScope', scopeId: 'store:team-plans' });
```

```ts
// test/extension/providers/webviewMessageHandler.test.ts
it('selects scope and posts refreshed dashboard data', async () => {
  const data = { scope: { id: 'store:team-plans' }, scopes: [], changes: [], specs: [], lastRefresh: 1 };
  const dataManager = {
    selectScope: vi.fn().mockResolvedValue(undefined),
    refresh: vi.fn().mockResolvedValue(data),
    getWorkspaceRoot: vi.fn().mockReturnValue('/workspace'),
  };
  const webview = { postMessage: vi.fn() };

  await handleWebviewMessage({ type: 'selectScope', scopeId: 'store:team-plans' } as any, webview as any, dataManager as any);

  expect(dataManager.selectScope).toHaveBeenCalledWith('store:team-plans');
  expect(webview.postMessage).toHaveBeenCalledWith({ type: 'dashboardData', data, debug: false });
});
```

- [ ] **Step 2: Run tests - expect FAIL**

Run: `pnpm vitest run test/extension/providers/webviewMessageHandler.test.ts`
Expected: FAIL because `selectScope` message is not handled.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/webview/types/messages.ts
| { type: 'selectScope'; scopeId: string }

selectScope: (scopeId: string): WebviewMessage => ({ type: 'selectScope', scopeId })
```

```ts
// webviewMessageHandler.ts
case 'selectScope': {
  await dataManager.selectScope(message.scopeId);
  const refreshedData = await dataManager.refresh();
  webview.postMessage({ type: 'dashboardData', data: refreshedData, debug: getDebug() });
  break;
}
```

In Dashboard, pass `sendMessage.selectScope` to `ScopeBar`.

- [ ] **Step 4: Run tests - expect PASS**

Run: `pnpm vitest run test/extension/providers/webviewMessageHandler.test.ts test/webview/components/dashboard.test.tsx`
Expected: PASS.

---

### Task 4.4: Render the read-only references panel

**Spec coverage:** dashboard / Requirement: Read-only references panel; openspec-scope-management / Requirement: Reference and workset semantics

**Files:**
- Create: `src/webview/components/ReferencesPanel.tsx`
- Create: `test/webview/components/referencesPanel.test.tsx`
- Modify: `src/webview/components/Dashboard.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// test/webview/components/referencesPanel.test.tsx
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ReferencesPanel } from '../../../src/webview/components/ReferencesPanel';

it('renders resolved and unresolved referenced stores without write actions', () => {
  const html = renderToStaticMarkup(
    <ReferencesPanel
      references={[
        { store_id: 'platform-reqs', specs: [{ id: 'billing', summary: 'Billing requirements' }], fetch: 'openspec show billing --type spec --store platform-reqs', status: [] },
        { store_id: 'design-system', status: [{ severity: 'warning', code: 'reference_unresolved', message: 'not registered', fix: 'Clone or register this store before using it as a reference' }] },
      ]}
      onCopyFetch={vi.fn()}
    />
  );

  expect(html).toContain('platform-reqs');
  expect(html).toContain('billing');
  expect(html).toContain('design-system');
  expect(html).toContain('git clone');
  expect(html).not.toContain('Apply');
  expect(html).not.toContain('Archive');
});
```

- [ ] **Step 2: Run test - expect FAIL**

Run: `pnpm vitest run test/webview/components/referencesPanel.test.tsx`
Expected: FAIL because `ReferencesPanel` does not exist.

- [ ] **Step 3: Write minimal implementation**

```tsx
export const ReferencesPanel: React.FC<{
  references?: ReferenceIndexEntryView[];
  onCopyFetch: (text: string) => void;
}> = ({ references = [], onCopyFetch }) => {
  if (references.length === 0) return null;
  return (
    <section className="mt-4">
      <h2 className="text-base font-semibold mb-2">References</h2>
      <div className="space-y-2">
        {references.map((ref) => (
          <div key={ref.store_id} className="rounded border p-2 text-xs" style={{ borderColor: 'var(--vscode-panel-border)' }}>
            <div className="font-medium">{ref.store_id}</div>
            {(ref.specs ?? []).map((spec) => <div key={spec.id}>{spec.id}{spec.summary ? ` - ${spec.summary}` : ''}</div>)}
            {ref.fetch && <button type="button" onClick={() => onCopyFetch(ref.fetch)}>Copy fetch command</button>}
            {(ref.status ?? []).map((status) => <div key={status.code}>{status.message}{status.fix ? ` Fix: ${status.fix}` : ''}</div>)}
          </div>
        ))}
      </div>
    </section>
  );
};
```

- [ ] **Step 4: Run test - expect PASS**

Run: `pnpm vitest run test/webview/components/referencesPanel.test.tsx`
Expected: PASS.

---

### Task 4.5: Render workset entry points as local personal views

**Spec coverage:** dashboard / Requirement: Workset entry points; openspec-scope-management / Requirement: Reference and workset semantics / Scenario: Workset is local convenience only

**Files:**
- Create: `src/webview/components/WorksetsPanel.tsx`
- Create: `test/webview/components/worksetsPanel.test.tsx`
- Modify: `src/webview/types/messages.ts`
- Modify: `src/extension/providers/webviewMessageHandler.ts`
- Modify: `src/webview/components/Dashboard.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
// test/webview/components/worksetsPanel.test.tsx
it('renders worksets as local personal views', () => {
  const html = renderToStaticMarkup(
    <WorksetsPanel
      worksets={[{ name: 'platform', tool: 'code', members: [{ name: 'team-plans', path: '/stores/team-plans' }] }]}
      onOpenWorkset={vi.fn()}
    />
  );

  expect(html).toContain('platform');
  expect(html).toContain('local personal');
  expect(html).not.toContain('shared');
});
```

```ts
// test/extension/providers/webviewMessageHandler.test.ts
it('delegates openWorkset to DataManager', async () => {
  const dataManager = { openWorkset: vi.fn().mockResolvedValue(undefined), getWorkspaceRoot: vi.fn().mockReturnValue('/workspace') };
  await handleWebviewMessage({ type: 'openWorkset', name: 'platform' } as any, { postMessage: vi.fn() } as any, dataManager as any);
  expect(dataManager.openWorkset).toHaveBeenCalledWith('platform');
});
```

- [ ] **Step 2: Run tests - expect FAIL**

Run: `pnpm vitest run test/webview/components/worksetsPanel.test.tsx test/extension/providers/webviewMessageHandler.test.ts`
Expected: FAIL because workset UI/message is missing.

- [ ] **Step 3: Write minimal implementation**

```tsx
export const WorksetsPanel: React.FC<{
  worksets?: { name: string; tool?: string; members: { name: string; path: string }[] }[];
  onOpenWorkset: (name: string) => void;
}> = ({ worksets = [], onOpenWorkset }) => {
  if (worksets.length === 0) return null;
  return (
    <section className="mt-4">
      <h2 className="text-base font-semibold mb-1">Worksets</h2>
      <p className="text-xs" style={{ color: 'var(--vscode-descriptionForeground)' }}>Local personal views for opening folders together.</p>
      {worksets.map((workset) => (
        <button key={workset.name} type="button" onClick={() => onOpenWorkset(workset.name)}>
          {workset.name} {workset.tool ? `(${workset.tool})` : ''}
        </button>
      ))}
    </section>
  );
};
```

Add `openWorkset` message and DataManager method that delegates to `OpenSpecCliService.worksetOpen(name)`.

- [ ] **Step 4: Run tests - expect PASS**

Run: `pnpm vitest run test/webview/components/worksetsPanel.test.tsx test/extension/providers/webviewMessageHandler.test.ts`
Expected: PASS.
