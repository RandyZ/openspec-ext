# Task 1. Cache Service Foundation

<!-- covers: Task 1.1, Task 1.2, Task 1.3 -->

### Task 1.1: Add failing tests for extension-owned cache storage and scope isolation

**Spec coverage:** `extension-cache` / `### Requirement: Scope-aware persistent cache storage` / all scenarios

**Files:**
- Create: `test/extension/services/openSpecCacheService.test.ts`
- Modify: none
- Test: `test/extension/services/openSpecCacheService.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `test/extension/services/openSpecCacheService.test.ts`:

```ts
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { describe, expect, it } from 'vitest';
import type { DashboardData } from '../../../src/extension/services/dataManager';
import type { ScopeInfo } from '../../../src/extension/services/openspecScope';
import { OpenSpecCacheService } from '../../../src/extension/services/openSpecCacheService';

async function makeTempRoot(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'openspec-cache-service-'));
}

function scope(id: string, rootPath: string): ScopeInfo {
  return {
    id,
    label: id,
    rootPath,
    source: id === 'local' ? 'local' : 'store',
    runtimeSource: 'installed',
  } as ScopeInfo;
}

function dashboard(label: string, scopeInfo: ScopeInfo): DashboardData {
  return {
    changes: [{ name: label, status: 'draft', artifacts: [], tasks: [], updatedAt: 1 }],
    specs: [],
    lastRefresh: 1,
    scope: scopeInfo,
    scopes: [scopeInfo],
  } as DashboardData;
}

describe('OpenSpecCacheService', () => {
  it('stores dashboard cache under extension storage instead of the workspace root', async () => {
    const tempRoot = await makeTempRoot();
    const workspaceRoot = path.join(tempRoot, 'workspace');
    const storageRoot = path.join(tempRoot, 'global-storage');
    await fs.mkdir(workspaceRoot, { recursive: true });

    const service = new OpenSpecCacheService(vscode.Uri.file(storageRoot), {
      workspaceRoot,
      extensionVersion: '0.0.0-test',
    });
    const local = scope('local', workspaceRoot);

    await service.writeDashboard(local, dashboard('cached-local', local));

    await expect(fs.stat(path.join(storageRoot, 'openspec-cache'))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(workspaceRoot, '.openspec-ext-cache'))).rejects.toThrow();
  });

  it('keeps same-named dashboard data isolated by scope', async () => {
    const tempRoot = await makeTempRoot();
    const workspaceRoot = path.join(tempRoot, 'workspace');
    const storageRoot = path.join(tempRoot, 'global-storage');
    const local = scope('local', path.join(workspaceRoot, 'root'));
    const store = scope('store:aihelp', path.join(workspaceRoot, 'store-aihelp'));
    const service = new OpenSpecCacheService(vscode.Uri.file(storageRoot), {
      workspaceRoot,
      extensionVersion: '0.0.0-test',
    });

    await service.writeDashboard(local, dashboard('same-name', local));
    await service.writeDashboard(store, dashboard('same-name', store));

    const localCached = await service.readDashboard(local);
    const storeCached = await service.readDashboard(store);

    expect(localCached?.payload.scope?.rootPath).toBe(local.rootPath);
    expect(storeCached?.payload.scope?.rootPath).toBe(store.rootPath);
    expect(localCached?.metadata.scopeId).toBe('local');
    expect(storeCached?.metadata.scopeId).toBe('store:aihelp');
  });

  it('ignores incompatible cache envelopes', async () => {
    const tempRoot = await makeTempRoot();
    const workspaceRoot = path.join(tempRoot, 'workspace');
    const storageRoot = path.join(tempRoot, 'global-storage');
    const service = new OpenSpecCacheService(vscode.Uri.file(storageRoot), {
      workspaceRoot,
      extensionVersion: '0.0.0-test',
    });
    const local = scope('local', workspaceRoot);

    await service.writeDashboard(local, dashboard('valid', local));
    const cached = await service.readDashboard(local);
    expect(cached).toBeDefined();

    await fs.writeFile(cached!.filePath, JSON.stringify({ schemaVersion: 999 }), 'utf8');

    await expect(service.readDashboard(local)).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test - expect FAIL**

Run:

```bash
zsh -c "source ~/.zshrc && rtk pnpm test -- test/extension/services/openSpecCacheService.test.ts"
```

Expected: FAIL because `src/extension/services/openSpecCacheService.ts` does not exist.

---

### Task 1.2: Implement the OpenSpec cache service and v1 cache envelope

**Spec coverage:** `extension-cache` / `### Requirement: Scope-aware persistent cache storage` / all scenarios

**Files:**
- Create: `src/extension/services/openSpecCacheService.ts`
- Modify: none
- Test: `test/extension/services/openSpecCacheService.test.ts`

- [ ] **Step 1: Implement the cache service**

Create `src/extension/services/openSpecCacheService.ts`:

```ts
import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as vscode from 'vscode';
import type { DashboardData } from './dataManager';
import type { ScopeInfo } from './openspecScope';

export interface OpenSpecCacheServiceOptions {
  workspaceRoot: string;
  extensionVersion: string;
}

export interface ArtifactCacheKey {
  scope: ScopeInfo;
  changeName: string;
  artifactType: string;
  specId?: string;
}

export interface CacheMetadata {
  schemaVersion: 1;
  extensionVersion: string;
  workspaceHash: string;
  workspaceRoot: string;
  scopeId: string;
  scopeRootPath: string;
  dataKind: 'dashboard' | 'artifact-content';
  generatedAt: number;
}

export interface CachedValue<T> {
  metadata: CacheMetadata;
  payload: T;
  filePath: string;
}

interface CacheEnvelope<T> extends CacheMetadata {
  payload: T;
}

export class OpenSpecCacheService {
  private static readonly schemaVersion = 1 as const;

  constructor(
    private readonly storageUri: vscode.Uri,
    private readonly options: OpenSpecCacheServiceOptions
  ) {}

  async readDashboard(scope: ScopeInfo): Promise<CachedValue<DashboardData> | undefined> {
    return this.readEnvelope<DashboardData>(this.dashboardPath(scope), 'dashboard', scope);
  }

  async writeDashboard(scope: ScopeInfo, data: DashboardData): Promise<void> {
    await this.writeEnvelope(this.dashboardPath(scope), 'dashboard', scope, data);
  }

  async readArtifactContent(key: ArtifactCacheKey): Promise<CachedValue<string> | undefined> {
    return this.readEnvelope<string>(this.artifactPath(key), 'artifact-content', key.scope);
  }

  async writeArtifactContent(key: ArtifactCacheKey, content: string): Promise<void> {
    await this.writeEnvelope(this.artifactPath(key), 'artifact-content', key.scope, content);
  }

  async invalidateScope(scope: ScopeInfo): Promise<void> {
    await fs.rm(this.scopeDir(scope), { recursive: true, force: true });
  }

  async invalidateArtifact(key: ArtifactCacheKey): Promise<void> {
    await fs.rm(this.artifactPath(key), { force: true });
  }

  private async readEnvelope<T>(
    filePath: string,
    expectedKind: CacheMetadata['dataKind'],
    scope: ScopeInfo
  ): Promise<CachedValue<T> | undefined> {
    try {
      const raw = await fs.readFile(filePath, 'utf8');
      const parsed = JSON.parse(raw) as Partial<CacheEnvelope<T>>;
      if (!this.isValidEnvelope(parsed, expectedKind, scope)) return undefined;
      const { payload, ...metadata } = parsed as CacheEnvelope<T>;
      return { metadata, payload, filePath };
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'ENOENT') return undefined;
      return undefined;
    }
  }

  private async writeEnvelope<T>(
    filePath: string,
    dataKind: CacheMetadata['dataKind'],
    scope: ScopeInfo,
    payload: T
  ): Promise<void> {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const envelope: CacheEnvelope<T> = {
      schemaVersion: OpenSpecCacheService.schemaVersion,
      extensionVersion: this.options.extensionVersion,
      workspaceHash: this.hash(this.normalize(this.options.workspaceRoot)),
      workspaceRoot: this.options.workspaceRoot,
      scopeId: scope.id,
      scopeRootPath: scope.rootPath,
      dataKind,
      generatedAt: Date.now(),
      payload,
    };
    await fs.writeFile(filePath, JSON.stringify(envelope, null, 2), 'utf8');
  }

  private isValidEnvelope<T>(
    value: Partial<CacheEnvelope<T>>,
    expectedKind: CacheMetadata['dataKind'],
    scope: ScopeInfo
  ): value is CacheEnvelope<T> {
    return value.schemaVersion === OpenSpecCacheService.schemaVersion
      && value.dataKind === expectedKind
      && value.workspaceHash === this.hash(this.normalize(this.options.workspaceRoot))
      && value.scopeId === scope.id
      && value.scopeRootPath === scope.rootPath
      && value.payload !== undefined
      && typeof value.generatedAt === 'number';
  }

  private dashboardPath(scope: ScopeInfo): string {
    return path.join(this.scopeDir(scope), 'dashboard.json');
  }

  private artifactPath(key: ArtifactCacheKey): string {
    const artifactHash = this.hash([
      key.changeName,
      key.artifactType,
      key.specId ?? '',
    ].join('\n'));
    return path.join(this.scopeDir(key.scope), 'artifacts', `${artifactHash}.json`);
  }

  private scopeDir(scope: ScopeInfo): string {
    return path.join(
      this.storageUri.fsPath,
      'openspec-cache',
      'v1',
      this.hash(this.normalize(this.options.workspaceRoot)),
      this.hash(`${scope.id}\n${this.normalize(scope.rootPath)}`)
    );
  }

  private normalize(value: string): string {
    return path.resolve(value);
  }

  private hash(value: string): string {
    return crypto.createHash('sha256').update(value).digest('hex').slice(0, 16);
  }
}
```

- [ ] **Step 2: Run test - expect PASS**

Run:

```bash
zsh -c "source ~/.zshrc && rtk pnpm test -- test/extension/services/openSpecCacheService.test.ts"
```

Expected: PASS.

---

### Task 1.3: Wire the cache service into extension activation and DataManager construction

**Spec coverage:** `extension-cache` / `### Requirement: Cache warm start and refresh reconciliation` / setup prerequisite

**Files:**
- Create: none
- Modify: `src/extension/extension.ts`, `src/extension/services/dataManager.ts`
- Test: `test/extension/services/dataManager.test.ts`

- [ ] **Step 1: Add a failing constructor compatibility test**

In `test/extension/services/dataManager.test.ts`, add a small test near the constructor/setup tests:

```ts
it('accepts an optional cache service dependency', () => {
  const cacheService = {
    readDashboard: vi.fn(),
    writeDashboard: vi.fn(),
    readArtifactContent: vi.fn(),
    writeArtifactContent: vi.fn(),
    invalidateScope: vi.fn(),
    invalidateArtifact: vi.fn(),
  };

  const manager = new DataManager('/workspace', { cacheService } as any);

  expect(manager).toBeInstanceOf(DataManager);
});
```

- [ ] **Step 2: Run test - expect FAIL**

Run:

```bash
zsh -c "source ~/.zshrc && rtk pnpm test -- test/extension/services/dataManager.test.ts"
```

Expected: FAIL because `DataManager` does not accept the options object yet.

- [ ] **Step 3: Update DataManager constructor**

Modify `src/extension/services/dataManager.ts` so construction remains backward compatible:

```ts
export interface DataManagerOptions {
  cacheService?: OpenSpecCacheService;
}

export class DataManager {
  constructor(
    private workspaceRoot: string,
    private readonly options: DataManagerOptions = {}
  ) {
    this.cacheService = options.cacheService;
  }

  private readonly cacheService?: OpenSpecCacheService;
}
```

Place imports near existing service imports:

```ts
import { OpenSpecCacheService } from './openSpecCacheService';
```

- [ ] **Step 4: Wire activation**

Modify `src/extension/extension.ts` where `DataManager` is created:

```ts
const cacheService = new OpenSpecCacheService(context.globalStorageUri, {
  workspaceRoot,
  extensionVersion: context.extension.packageJSON.version ?? '0.0.0',
});

dataManager = new DataManager(workspaceRoot, { cacheService });
```

- [ ] **Step 5: Run tests - expect PASS**

Run:

```bash
zsh -c "source ~/.zshrc && rtk pnpm test -- test/extension/services/dataManager.test.ts test/extension/services/openSpecCacheService.test.ts"
```

Expected: PASS.
