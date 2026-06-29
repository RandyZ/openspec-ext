# Task 2. Feature Probes And Scope Model

<!-- covers: Task 2.1, Task 2.2, Task 2.3, Task 2.4 -->

### Task 2.1: Add store-aware capability probes

**Spec coverage:** openspec-scope-management / Requirement: Store-aware feature detection; cli-integration / Requirement: Store-aware feature probes

**Files:**
- Create: `src/extension/services/openspecFeatures.ts`
- Create: `test/extension/services/openspecFeatures.test.ts`
- Modify: `src/extension/services/openspecCli.ts`

- [ ] **Step 1: Write the failing test**

```ts
// test/extension/services/openspecFeatures.test.ts
import { describe, expect, it, vi } from 'vitest';
import { detectOpenSpecFeatures } from '@extension/services/openspecFeatures';

describe('detectOpenSpecFeatures', () => {
  it('marks store features available when probes succeed', async () => {
    const cli = {
      runJson: vi.fn()
        .mockResolvedValueOnce({ stores: [], status: [] })
        .mockResolvedValueOnce({ root: { path: '/repo', source: 'nearest' }, members: [], status: [] })
        .mockResolvedValueOnce({ root: { path: '/repo', healthy: true, status: [] }, references: [], status: [] }),
    };

    await expect(detectOpenSpecFeatures(cli as any)).resolves.toMatchObject({
      stores: true,
      context: true,
      doctor: true,
    });
  });

  it('keeps base dashboard available when store probe fails', async () => {
    const cli = { runJson: vi.fn().mockRejectedValue(new Error('unknown command store')) };

    await expect(detectOpenSpecFeatures(cli as any)).resolves.toMatchObject({
      stores: false,
      diagnostics: [expect.objectContaining({ code: 'store_features_unavailable' })],
    });
  });
});
```

- [ ] **Step 2: Run test - expect FAIL**

Run: `pnpm vitest run test/extension/services/openspecFeatures.test.ts`
Expected: FAIL because `openspecFeatures.ts` does not exist.

- [ ] **Step 3: Write minimal implementation**

```ts
export interface OpenSpecCapabilities {
  stores: boolean;
  context: boolean;
  doctor: boolean;
  worksets: boolean;
  diagnostics: { code: string; message: string; severity: 'info' | 'warning' | 'error' }[];
}

export async function detectOpenSpecFeatures(cli: { runJson: (args: string[]) => Promise<unknown> }): Promise<OpenSpecCapabilities> {
  const diagnostics: OpenSpecCapabilities['diagnostics'] = [];
  const probe = async (args: string[], code: string): Promise<boolean> => {
    try {
      await cli.runJson(args);
      return true;
    } catch (error) {
      diagnostics.push({ code, severity: 'warning', message: (error as Error).message });
      return false;
    }
  };

  return {
    stores: await probe(['store', 'list', '--json'], 'store_features_unavailable'),
    context: await probe(['context', '--json'], 'context_feature_unavailable'),
    doctor: await probe(['doctor', '--json'], 'doctor_feature_unavailable'),
    worksets: await probe(['workset', 'list', '--json'], 'workset_feature_unavailable'),
    diagnostics,
  };
}
```

Expose a small `runJson(args)` method on `OpenSpecCliService` that calls `execOpenSpec(args)` and parses JSON.

- [ ] **Step 4: Run test - expect PASS**

Run: `pnpm vitest run test/extension/services/openspecFeatures.test.ts`
Expected: PASS.

---

### Task 2.2: Introduce OpenSpec scope types and scope manager

**Spec coverage:** openspec-scope-management / Requirement: Selected OpenSpec scope / Scenarios: Local root scope, Explicit store scope, Declared store scope is reported

**Files:**
- Create: `src/extension/services/openspecScope.ts`
- Create: `test/extension/services/openspecScope.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// test/extension/services/openspecScope.test.ts
import { describe, expect, it } from 'vitest';
import { createLocalScope, createStoreScope } from '@extension/services/openspecScope';

describe('OpenSpec scope factories', () => {
  it('creates a local root scope', () => {
    expect(createLocalScope('/workspace', { stores: false, context: false, doctor: false, worksets: false, diagnostics: [] })).toMatchObject({
      id: 'local:/workspace',
      label: 'Local Root',
      rootPath: '/workspace',
      source: 'local',
    });
  });

  it('creates a store scope', () => {
    expect(createStoreScope({ id: 'team-plans', root: '/stores/team-plans' }, { stores: true, context: true, doctor: true, worksets: true, diagnostics: [] })).toMatchObject({
      id: 'store:team-plans',
      label: 'team-plans',
      rootPath: '/stores/team-plans',
      source: 'store',
      storeId: 'team-plans',
    });
  });
});
```

- [ ] **Step 2: Run test - expect FAIL**

Run: `pnpm vitest run test/extension/services/openspecScope.test.ts`
Expected: FAIL because `openspecScope.ts` does not exist.

- [ ] **Step 3: Write minimal implementation**

```ts
import type { OpenSpecCapabilities } from './openspecFeatures';

export type OpenSpecScopeSource = 'local' | 'store' | 'declared';

export interface OpenSpecScope {
  id: string;
  label: string;
  rootPath: string;
  source: OpenSpecScopeSource;
  storeId?: string;
  capabilities: OpenSpecCapabilities;
  diagnostics: { code: string; message: string; severity: 'info' | 'warning' | 'error' }[];
}

export function createLocalScope(rootPath: string, capabilities: OpenSpecCapabilities): OpenSpecScope {
  return { id: `local:${rootPath}`, label: 'Local Root', rootPath, source: 'local', capabilities, diagnostics: [] };
}

export function createStoreScope(store: { id: string; root: string }, capabilities: OpenSpecCapabilities): OpenSpecScope {
  return { id: `store:${store.id}`, label: store.id, rootPath: store.root, source: 'store', storeId: store.id, capabilities, diagnostics: [] };
}
```

- [ ] **Step 4: Run test - expect PASS**

Run: `pnpm vitest run test/extension/services/openspecScope.test.ts`
Expected: PASS.

---

### Task 2.3: Implement scope option loading, selection, and cache invalidation

**Spec coverage:** openspec-scope-management / Requirement: Selected OpenSpec scope / Scenario: Scope selection clears stale dashboard data; dashboard / Requirement: Store selection

**Files:**
- Modify: `src/extension/services/openspecScope.ts`
- Modify: `src/extension/services/dataManager.ts`
- Modify: `test/extension/services/openspecScope.test.ts`
- Modify: `test/extension/services/dataManager.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// test/extension/services/openspecScope.test.ts
it('loads local and store scope options', async () => {
  const cli = { runJson: vi.fn().mockResolvedValue({ stores: [{ id: 'team-plans', root: '/stores/team-plans' }], status: [] }) };
  const manager = new OpenSpecScopeManager('/workspace', cli as any, capabilities);

  await expect(manager.loadScopeOptions()).resolves.toEqual([
    expect.objectContaining({ id: 'local:/workspace' }),
    expect.objectContaining({ id: 'store:team-plans' }),
  ]);
});
```

```ts
// test/extension/services/dataManager.test.ts
it('clears cached dashboard data when selected scope changes', async () => {
  const { manager, stateReader, changesDeferred, specsDeferred } = createManager();
  const scopeManager = {
    getSelectedScope: vi.fn()
      .mockReturnValueOnce({ id: 'local:/workspace' })
      .mockReturnValueOnce({ id: 'store:team-plans' }),
    onDidChangeScope: vi.fn(),
  };
  Object.assign(manager as any, { scopeManager });

  const first = manager.getDashboardData();
  changesDeferred.resolve([]);
  specsDeferred.resolve([]);
  await first;

  (manager as any).handleScopeChanged();
  await manager.getDashboardData();

  expect(stateReader.listChanges).toHaveBeenCalledTimes(2);
});
```

- [ ] **Step 2: Run tests - expect FAIL**

Run: `pnpm vitest run test/extension/services/openspecScope.test.ts test/extension/services/dataManager.test.ts`
Expected: FAIL because scope manager and invalidation hook are missing.

- [ ] **Step 3: Write minimal implementation**

```ts
export class OpenSpecScopeManager {
  private selectedScopeId: string | null = null;
  private listeners = new Set<() => void>();

  constructor(private workspaceRoot: string, private cli: { runJson: (args: string[]) => Promise<any> }, private capabilities: OpenSpecCapabilities) {}

  async loadScopeOptions(): Promise<OpenSpecScope[]> {
    const scopes = [createLocalScope(this.workspaceRoot, this.capabilities)];
    if (this.capabilities.stores) {
      const payload = await this.cli.runJson(['store', 'list', '--json']);
      for (const store of payload.stores ?? []) scopes.push(createStoreScope(store, this.capabilities));
    }
    return scopes;
  }

  selectScope(id: string): void {
    if (this.selectedScopeId === id) return;
    this.selectedScopeId = id;
    for (const listener of this.listeners) listener();
  }

  onDidChangeScope(listener: () => void): { dispose(): void } {
    this.listeners.add(listener);
    return { dispose: () => this.listeners.delete(listener) };
  }
}
```

In `DataManager`, subscribe to scope changes and clear `cachedData`.

- [ ] **Step 4: Run tests - expect PASS**

Run: `pnpm vitest run test/extension/services/openspecScope.test.ts test/extension/services/dataManager.test.ts`
Expected: PASS.

---

### Task 2.4: Load context and doctor relationship data for the selected scope

**Spec coverage:** openspec-scope-management / Requirement: Reference and workset semantics; dashboard / Requirement: Root health display, Read-only references panel; cli-integration / Requirement: Store registry data retrieval

**Files:**
- Modify: `src/extension/services/openspecScope.ts`
- Create: `test/extension/services/openspecRelationships.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// test/extension/services/openspecRelationships.test.ts
import { describe, expect, it, vi } from 'vitest';
import { loadScopeRelationships } from '@extension/services/openspecScope';

it('loads context and doctor data for a store scope', async () => {
  const cli = {
    runJson: vi.fn()
      .mockResolvedValueOnce({ root: { path: '/stores/team-plans', source: 'store', store_id: 'team-plans' }, members: [{ role: 'referenced_store', id: 'platform-reqs', path: '/stores/platform-reqs', status: [] }], status: [] })
      .mockResolvedValueOnce({ root: { path: '/stores/team-plans', healthy: true, status: [] }, references: [{ store_id: 'platform-reqs', specs: [{ id: 'billing', summary: 'Billing requirements' }], fetch: 'openspec show billing --type spec --store platform-reqs', status: [] }], status: [] }),
  };

  await expect(loadScopeRelationships(cli as any, { storeId: 'team-plans' } as any)).resolves.toMatchObject({
    references: [expect.objectContaining({ store_id: 'platform-reqs' })],
    health: expect.objectContaining({ root: expect.objectContaining({ healthy: true }) }),
  });
});
```

- [ ] **Step 2: Run test - expect FAIL**

Run: `pnpm vitest run test/extension/services/openspecRelationships.test.ts`
Expected: FAIL because `loadScopeRelationships` is missing.

- [ ] **Step 3: Write minimal implementation**

```ts
function withScopeArgs(base: string[], scope: OpenSpecScope): string[] {
  return scope.storeId ? [...base, '--store', scope.storeId] : base;
}

export async function loadScopeRelationships(cli: { runJson: (args: string[]) => Promise<any> }, scope: OpenSpecScope) {
  const [context, health] = await Promise.all([
    cli.runJson(withScopeArgs(['context', '--json'], scope)),
    cli.runJson(withScopeArgs(['doctor', '--json'], scope)),
  ]);
  return {
    context,
    health,
    references: health.references ?? [],
    status: [...(context.status ?? []), ...(health.status ?? [])],
  };
}
```

- [ ] **Step 4: Run test - expect PASS**

Run: `pnpm vitest run test/extension/services/openspecRelationships.test.ts`
Expected: PASS.
