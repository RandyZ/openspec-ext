# Task 1. Cache Management Service

<!-- covers: Task 1.1, Task 1.2, Task 1.3, Task 1.4 -->

### Task 1.1: Add cache root, stats, and clear service tests

**Spec coverage:** extension-cache / Cache management actions / Open cache folder, Clear cache; extension-cache / Cache usage summary / Dashboard requests cache stats, Cache stats use bounded scan, Cache stats refresh after mutation, Cache stats failure is non-blocking

**Files:**
- Modify: `test/extension/services/openSpecCacheService.test.ts`
- Modify: `test/extension/services/dataManager.test.ts`
- Modify: `test/extension/packageConfiguration.test.ts`

- [ ] **Step 1: Add failing service tests**

Append these tests to `test/extension/services/openSpecCacheService.test.ts` inside the existing `describe('OpenSpecCacheService', () => { ... })` block:

```ts
  it('exposes cache root and computes cache stats under extension storage', async () => {
    const tempRoot = await makeTempRoot();
    const workspaceRoot = path.join(tempRoot, 'workspace');
    const storageRoot = path.join(tempRoot, 'global-storage');
    const local = scope('local', workspaceRoot);
    const service = new OpenSpecCacheService(storageUri(storageRoot), {
      workspaceRoot,
      extensionVersion: '0.0.0-test',
    });

    await service.writeDashboard(local, dashboard('cached-local', local));
    await service.writeArtifactContent({ scope: local, changeName: 'demo', artifactType: 'tasks' }, '- [ ] demo');

    const stats = await service.getCacheStats({ force: true });

    expect(service.getCacheRootPath()).toBe(path.join(storageRoot, 'openspec-cache'));
    expect(stats.rootPath).toBe(path.join(storageRoot, 'openspec-cache'));
    expect(stats.fileCount).toBe(2);
    expect(stats.totalBytes).toBeGreaterThan(0);
    expect(stats.calculatedAt).toBeGreaterThan(0);
    expect(stats.isCalculating).toBe(false);
  });

  it('marks cache stats dirty after writes and clearAll removes only extension cache content', async () => {
    const tempRoot = await makeTempRoot();
    const workspaceRoot = path.join(tempRoot, 'workspace');
    const storageRoot = path.join(tempRoot, 'global-storage');
    await fs.mkdir(path.join(workspaceRoot, 'openspec'), { recursive: true });
    await fs.writeFile(path.join(workspaceRoot, 'openspec', 'config.yaml'), 'schema: test', 'utf8');
    const local = scope('local', workspaceRoot);
    const service = new OpenSpecCacheService(storageUri(storageRoot), {
      workspaceRoot,
      extensionVersion: '0.0.0-test',
    });

    await service.writeDashboard(local, dashboard('before-clear', local));
    const before = await service.getCacheStats({ force: true });
    expect(before.fileCount).toBe(1);

    const after = await service.clearAll();

    expect(after.fileCount).toBe(0);
    expect(after.totalBytes).toBe(0);
    await expect(fs.stat(path.join(workspaceRoot, 'openspec', 'config.yaml'))).resolves.toBeTruthy();
  });

  it('reuses fresh cache stats unless forced or marked dirty', async () => {
    const tempRoot = await makeTempRoot();
    const workspaceRoot = path.join(tempRoot, 'workspace');
    const storageRoot = path.join(tempRoot, 'global-storage');
    const local = scope('local', workspaceRoot);
    const service = new OpenSpecCacheService(storageUri(storageRoot), {
      workspaceRoot,
      extensionVersion: '0.0.0-test',
    });

    await service.writeDashboard(local, dashboard('one', local));
    const first = await service.getCacheStats({ force: true });
    const second = await service.getCacheStats();

    expect(second).toEqual(first);

    await service.writeArtifactContent({ scope: local, changeName: 'demo', artifactType: 'tasks' }, '- [ ] task');
    const third = await service.getCacheStats();

    expect(third.fileCount).toBe(2);
    expect(third.calculatedAt).toBeGreaterThanOrEqual(first.calculatedAt);
  });
```

- [ ] **Step 2: Add failing DataManager facade tests**

Append this test to `test/extension/services/dataManager.test.ts` in an existing `describe` block or create a new `describe('DataManager cache management facade', () => { ... })` block using local test helpers already present in that file:

```ts
  it('exposes cache stats and clear through DataManager', async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'openspec-data-cache-'));
    const workspaceRoot = path.join(tempRoot, 'workspace');
    const storageRoot = path.join(tempRoot, 'storage');
    await fs.mkdir(path.join(workspaceRoot, 'openspec'), { recursive: true });
    const cacheService = new OpenSpecCacheService({ fsPath: storageRoot } as any, {
      workspaceRoot,
      extensionVersion: '0.0.0-test',
    });
    const dataManager = new DataManager(workspaceRoot, { cacheService });

    expect(dataManager.getCacheRootPath()).toBe(path.join(storageRoot, 'openspec-cache'));
    const emptyStats = await dataManager.getCacheStats({ force: true });
    expect(emptyStats.fileCount).toBe(0);

    const clearedStats = await dataManager.clearCache();
    expect(clearedStats.rootPath).toBe(path.join(storageRoot, 'openspec-cache'));
    expect(clearedStats.fileCount).toBe(0);
  });
```

- [ ] **Step 3: Add failing package contribution tests**

Extend `test/extension/packageConfiguration.test.ts` with assertions for all four commands:

```ts
  it('contributes cache management commands', () => {
    const commandIds = packageJson.contributes.commands.map((command: { command: string }) => command.command);

    expect(commandIds).toContain('openspec.openCacheFolder');
    expect(commandIds).toContain('openspec.copyCachePath');
    expect(commandIds).toContain('openspec.clearCache');
    expect(commandIds).toContain('openspec.showCacheDetails');
  });
```

- [ ] **Step 4: Run tests and confirm failure**

Run:

```bash
rtk zsh -c 'source ~/.zshrc && rtk pnpm exec vitest run test/extension/services/openSpecCacheService.test.ts test/extension/services/dataManager.test.ts test/extension/packageConfiguration.test.ts'
```

Expected: FAIL because `getCacheStats`, `clearAll`, `getCacheRootPath`, DataManager cache facade methods, and package commands do not exist yet.

---

### Task 1.2: Implement cache root, stats, dirty, and clear APIs

**Spec coverage:** extension-cache / Cache management actions / Clear cache; extension-cache / Cache usage summary / Cache stats use bounded scan, Cache stats refresh after mutation, Cache stats failure is non-blocking

**Files:**
- Modify: `src/extension/services/openSpecCacheService.ts`
- Modify: `src/extension/services/dataManager.ts`
- Test: `test/extension/services/openSpecCacheService.test.ts`
- Test: `test/extension/services/dataManager.test.ts`

- [ ] **Step 1: Add cache stats types and service fields**

In `src/extension/services/openSpecCacheService.ts`, add these exports near the existing interfaces:

```ts
export interface CacheStats {
  rootPath: string;
  totalBytes: number;
  fileCount: number;
  calculatedAt: number;
  isCalculating: boolean;
  error?: string;
}

export interface CacheStatsOptions {
  force?: boolean;
}
```

Add these private fields inside `OpenSpecCacheService`:

```ts
  private static readonly statsTtlMs = 5000;
  private statsSnapshot: CacheStats | undefined;
  private statsInFlight: Promise<CacheStats> | undefined;
  private statsDirty = true;
```

- [ ] **Step 2: Add root, dirty, stats, and clear methods**

Add these public methods to `OpenSpecCacheService`:

```ts
  getCacheRootPath(): string {
    return path.join(this.storageUri.fsPath, 'openspec-cache');
  }

  markStatsDirty(): void {
    this.statsDirty = true;
  }

  async getCacheStats(options: CacheStatsOptions = {}): Promise<CacheStats> {
    const now = Date.now();
    const snapshotFresh =
      this.statsSnapshot !== undefined
      && !this.statsDirty
      && !options.force
      && now - this.statsSnapshot.calculatedAt < OpenSpecCacheService.statsTtlMs;

    if (snapshotFresh) {
      return this.statsSnapshot;
    }

    if (this.statsInFlight && !options.force) {
      return {
        ...(this.statsSnapshot ?? this.emptyStats(true)),
        isCalculating: true,
      };
    }

    this.statsInFlight = this.calculateCacheStats()
      .then((stats) => {
        this.statsSnapshot = stats;
        this.statsDirty = false;
        return stats;
      })
      .catch((error) => {
        const failed = this.emptyStats(false, (error as Error).message);
        this.statsSnapshot = failed;
        this.statsDirty = false;
        return failed;
      })
      .finally(() => {
        this.statsInFlight = undefined;
      });

    return this.statsInFlight;
  }

  async clearAll(): Promise<CacheStats> {
    await fs.rm(this.getCacheRootPath(), { recursive: true, force: true });
    await fs.mkdir(this.getCacheRootPath(), { recursive: true });
    this.markStatsDirty();
    return this.getCacheStats({ force: true });
  }
```

- [ ] **Step 3: Add bounded recursive scanner helpers**

Add these private helpers to `OpenSpecCacheService`:

```ts
  private emptyStats(isCalculating: boolean, error?: string): CacheStats {
    return {
      rootPath: this.getCacheRootPath(),
      totalBytes: 0,
      fileCount: 0,
      calculatedAt: Date.now(),
      isCalculating,
      ...(error ? { error } : {}),
    };
  }

  private async calculateCacheStats(): Promise<CacheStats> {
    let totalBytes = 0;
    let fileCount = 0;

    const walk = async (dir: string): Promise<void> => {
      let entries: import('fs').Dirent[];
      try {
        entries = await fs.readdir(dir, { withFileTypes: true });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
        throw error;
      }

      for (const entry of entries) {
        const child = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await walk(child);
          continue;
        }
        if (!entry.isFile()) continue;
        const stat = await fs.stat(child);
        totalBytes += stat.size;
        fileCount += 1;
      }
    };

    await walk(this.getCacheRootPath());

    return {
      rootPath: this.getCacheRootPath(),
      totalBytes,
      fileCount,
      calculatedAt: Date.now(),
      isCalculating: false,
    };
  }
```

- [ ] **Step 4: Mark stats dirty after cache mutations**

In `writeEnvelope`, `invalidateScope`, and `invalidateArtifact`, call `this.markStatsDirty()` after the filesystem mutation completes:

```ts
    await fs.writeFile(filePath, JSON.stringify(envelope, null, 2), 'utf8');
    this.markStatsDirty();
```

```ts
  async invalidateScope(scope: ScopeInfo): Promise<void> {
    await fs.rm(this.scopeDir(scope), { recursive: true, force: true });
    this.markStatsDirty();
  }

  async invalidateArtifact(key: ArtifactCacheKey): Promise<void> {
    await fs.rm(this.artifactPath(key), { force: true });
    this.markStatsDirty();
  }
```

- [ ] **Step 5: Add DataManager cache facade methods**

In `src/extension/services/dataManager.ts`, import the cache types:

```ts
import type { CacheStats, CacheStatsOptions, OpenSpecCacheService } from './openSpecCacheService';
```

Replace the existing cache service type import so there is only one import from `openSpecCacheService`.

Add these public methods to `DataManager`:

```ts
  getCacheRootPath(): string | undefined {
    return this.cacheService?.getCacheRootPath();
  }

  async getCacheStats(options: CacheStatsOptions = {}): Promise<CacheStats | undefined> {
    return this.cacheService?.getCacheStats(options);
  }

  async clearCache(): Promise<CacheStats | undefined> {
    this.cachedData = null;
    return this.cacheService?.clearAll();
  }
```

- [ ] **Step 6: Run targeted tests and confirm pass**

Run:

```bash
rtk zsh -c 'source ~/.zshrc && rtk pnpm exec vitest run test/extension/services/openSpecCacheService.test.ts test/extension/services/dataManager.test.ts'
```

Expected: PASS for cache service and DataManager cache facade tests.

---

### Task 1.3: Add cache management commands and package contributions

**Spec coverage:** extension-cache / Cache management actions / Open cache folder, Copy cache path, Clear cache, Show cache details; dashboard / Dashboard cache management entry / Settings surface links to cache management

**Files:**
- Modify: `package.json`
- Modify: `src/extension/commands/commandManager.ts`
- Test: `test/extension/packageConfiguration.test.ts`

- [ ] **Step 1: Add command contributions**

In `package.json`, add these command objects under `contributes.commands`:

```json
      {
        "command": "openspec.openCacheFolder",
        "title": "OpenSpec: Open Cache Folder",
        "category": "OpenSpec",
        "icon": "$(folder-opened)"
      },
      {
        "command": "openspec.copyCachePath",
        "title": "OpenSpec: Copy Cache Path",
        "category": "OpenSpec",
        "icon": "$(copy)"
      },
      {
        "command": "openspec.clearCache",
        "title": "OpenSpec: Clear Cache",
        "category": "OpenSpec",
        "icon": "$(trash)"
      },
      {
        "command": "openspec.showCacheDetails",
        "title": "OpenSpec: Show Cache Details",
        "category": "OpenSpec",
        "icon": "$(info)"
      }
```

- [ ] **Step 2: Register command handlers**

In `src/extension/commands/commandManager.ts`, add four registrations in `register()`:

```ts
      vscode.commands.registerCommand('openspec.openCacheFolder', () =>
        this.handleOpenCacheFolder()
      ),
      vscode.commands.registerCommand('openspec.copyCachePath', () =>
        this.handleCopyCachePath()
      ),
      vscode.commands.registerCommand('openspec.clearCache', () =>
        this.handleClearCache()
      ),
      vscode.commands.registerCommand('openspec.showCacheDetails', () =>
        this.handleShowCacheDetails()
      ),
```

- [ ] **Step 3: Implement command handlers**

Add these private methods to `CommandManager`:

```ts
  private async handleOpenCacheFolder(): Promise<void> {
    const rootPath = this.dataManager.getCacheRootPath();
    if (!rootPath) {
      vscode.window.showWarningMessage(t('cache.unavailable'));
      return;
    }
    await vscode.workspace.fs.createDirectory(vscode.Uri.file(rootPath));
    await vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(rootPath));
  }

  private async handleCopyCachePath(): Promise<void> {
    const rootPath = this.dataManager.getCacheRootPath();
    if (!rootPath) {
      vscode.window.showWarningMessage(t('cache.unavailable'));
      return;
    }
    await vscode.env.clipboard.writeText(rootPath);
    vscode.window.showInformationMessage(t('cache.pathCopied'));
  }

  private async handleClearCache(): Promise<void> {
    const confirm = await vscode.window.showWarningMessage(
      t('cache.clearConfirm'),
      { modal: true },
      t('cache.clear')
    );
    if (confirm !== t('cache.clear')) return;

    const stats = await this.dataManager.clearCache();
    const size = this.formatBytes(stats?.totalBytes ?? 0);
    vscode.window.showInformationMessage(t('cache.cleared', { size }));
    await this.dataManager.refresh().catch((error) => {
      logger.warn('Failed to refresh after cache clear', error as Error);
    });
  }

  private async handleShowCacheDetails(): Promise<void> {
    const stats = await this.dataManager.getCacheStats({ force: true });
    if (!stats) {
      vscode.window.showWarningMessage(t('cache.unavailable'));
      return;
    }
    const message = t('cache.details', {
      path: stats.rootPath,
      size: this.formatBytes(stats.totalBytes),
      files: String(stats.fileCount),
    });
    const open = t('cache.openFolder');
    const copy = t('cache.copyPath');
    const selected = await vscode.window.showInformationMessage(message, open, copy);
    if (selected === open) await this.handleOpenCacheFolder();
    if (selected === copy) await this.handleCopyCachePath();
  }

  private formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }
```

- [ ] **Step 4: Run package contribution test**

Run:

```bash
rtk zsh -c 'source ~/.zshrc && rtk pnpm exec vitest run test/extension/packageConfiguration.test.ts'
```

Expected: PASS.

---

### Task 1.4: Add localized cache management strings

**Spec coverage:** extension-cache / Cache management actions / Copy cache path, Clear cache, Show cache details; dashboard / Dashboard cache management entry / Settings surface links to cache management

**Files:**
- Modify: `src/i18n/locales/en.json`
- Modify: `src/i18n/locales/zh-cn.json`
- Test: `test/i18n/i18n.test.ts`

- [ ] **Step 1: Add English strings**

Add these keys to `src/i18n/locales/en.json`:

```json
  "cache.unavailable": "OpenSpec cache is unavailable.",
  "cache.openFolder": "Open Folder",
  "cache.copyPath": "Copy Path",
  "cache.clear": "Clear Cache",
  "cache.clearConfirm": "Clear OpenSpec cache? This only removes extension cache files and does not modify your project.",
  "cache.cleared": "OpenSpec cache cleared. Current cache size: {size}",
  "cache.pathCopied": "OpenSpec cache path copied.",
  "cache.details": "OpenSpec cache: {size}, {files} files\n{path}",
  "cache.statsUnavailable": "Cache size unavailable",
  "cache.statsCalculating": "Calculating cache size...",
  "cache.summary": "Cache {size} · {files} files",
  "cache.menuLabel": "Cache actions"
```

- [ ] **Step 2: Add Chinese strings**

Add these keys to `src/i18n/locales/zh-cn.json`:

```json
  "cache.unavailable": "OpenSpec 缓存不可用。",
  "cache.openFolder": "打开目录",
  "cache.copyPath": "复制路径",
  "cache.clear": "清理缓存",
  "cache.clearConfirm": "清理 OpenSpec 缓存？这只会删除扩展缓存文件，不会修改你的项目。",
  "cache.cleared": "OpenSpec 缓存已清理。当前缓存大小：{size}",
  "cache.pathCopied": "已复制 OpenSpec 缓存路径。",
  "cache.details": "OpenSpec 缓存：{size}，{files} 个文件\n{path}",
  "cache.statsUnavailable": "缓存大小不可用",
  "cache.statsCalculating": "正在计算缓存大小...",
  "cache.summary": "缓存 {size} · {files} 个文件",
  "cache.menuLabel": "缓存操作"
```

- [ ] **Step 3: Add i18n coverage**

In `test/i18n/i18n.test.ts`, extend the existing key coverage or add:

```ts
  it('has cache management strings in English and Chinese', () => {
    setLocale('en');
    expect(t('cache.clear')).toBe('Clear Cache');
    expect(t('cache.summary', { size: '12 KB', files: '4' })).toContain('12 KB');

    setLocale('zh-cn');
    expect(t('cache.clear')).toBe('清理缓存');
    expect(t('cache.summary', { size: '12 KB', files: '4' })).toContain('4');
  });
```

- [ ] **Step 4: Run i18n tests**

Run:

```bash
rtk zsh -c 'source ~/.zshrc && rtk pnpm exec vitest run test/i18n/i18n.test.ts'
```

Expected: PASS.
