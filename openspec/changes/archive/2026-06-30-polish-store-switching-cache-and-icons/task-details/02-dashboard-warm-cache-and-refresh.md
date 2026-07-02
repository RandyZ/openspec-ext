# Task 2. Dashboard Warm Cache And Refresh

<!-- covers: Task 2.1, Task 2.2, Task 2.3 -->

### Task 2.1: Add failing tests for cached dashboard data posting before fresh refresh

**Spec coverage:** `dashboard` / `### Requirement: Cache-aware dashboard rendering` / `#### Scenario: Open dashboard with cached data`

**Files:**
- Create: none
- Modify: `test/extension/providers/dashboardViewProvider.test.ts`
- Test: `test/extension/providers/dashboardViewProvider.test.ts`

- [ ] **Step 1: Add the failing provider test**

In `test/extension/providers/dashboardViewProvider.test.ts`, add a test in the main `DashboardViewProvider` describe block:

```ts
it('posts cached dashboard data before fresh initial refresh data', async () => {
  vi.useFakeTimers();
  const cachedData = makeDashboardData({ changeName: 'cached-change', lastRefresh: 1 });
  const freshData = makeDashboardData({ changeName: 'fresh-change', lastRefresh: 2 });
  const postMessage = vi.fn();
  const webview = makeWebview(postMessage);
  const dataManager = makeDataManager({
    getCachedDashboardData: vi.fn().mockResolvedValue({
      payload: cachedData,
      metadata: { generatedAt: 1 },
      source: 'disk',
    }),
    refresh: vi.fn().mockResolvedValue(freshData),
  });
  const provider = new DashboardViewProvider(dataManager as any, '/ext');

  provider.resolveWebviewView(makeWebviewView(webview) as any, {} as any, {} as any);
  await vi.runAllTimersAsync();

  expect(postMessage.mock.calls[0][0]).toMatchObject({
    type: 'dashboardData',
    data: cachedData,
    cache: { source: 'disk', stale: true },
  });
  expect(postMessage.mock.calls.at(-1)?.[0]).toMatchObject({
    type: 'dashboardData',
    data: freshData,
    cache: { source: 'fresh', stale: false },
  });
});
```

If the helper names differ in this test file, reuse the existing local helper style and keep the assertions identical.

- [ ] **Step 2: Run test - expect FAIL**

Run:

```bash
zsh -c "source ~/.zshrc && rtk pnpm test -- test/extension/providers/dashboardViewProvider.test.ts"
```

Expected: FAIL because provider does not call `getCachedDashboardData` or post `cache` metadata yet.

---

### Task 2.2: Implement dashboard warm cache reads and fresh refresh reconciliation

**Spec coverage:** `extension-cache` / `### Requirement: Cache warm start and refresh reconciliation`; `dashboard` / `### Requirement: Cache-aware dashboard rendering`

**Files:**
- Create: none
- Modify: `src/extension/services/dataManager.ts`, `src/extension/providers/dashboardViewProvider.ts`
- Test: `test/extension/providers/dashboardViewProvider.test.ts`, `test/extension/services/dataManager.test.ts`

- [ ] **Step 1: Add DataManager warm cache methods**

Add to `src/extension/services/dataManager.ts`:

```ts
export interface CachedDashboardData {
  payload: DashboardData;
  metadata: { generatedAt: number };
  source: 'memory' | 'disk';
}

async getCachedDashboardData(scope = this.resolveScope()): Promise<CachedDashboardData | undefined> {
  if (this.cachedData && this.scopeMatches(this.cachedData.scope, scope)) {
    return {
      payload: this.cachedData,
      metadata: { generatedAt: this.cachedData.lastRefresh },
      source: 'memory',
    };
  }

  const cached = scope && this.cacheService
    ? await this.cacheService.readDashboard(scope)
    : undefined;

  return cached
    ? { payload: cached.payload, metadata: { generatedAt: cached.metadata.generatedAt }, source: 'disk' }
    : undefined;
}
```

Add a private scope comparison helper:

```ts
private scopeMatches(left?: ScopeInfo, right?: ScopeInfo): boolean {
  if (!left || !right) return false;
  return left.id === right.id && left.rootPath === right.rootPath;
}
```

- [ ] **Step 2: Update provider initial posting**

Modify `DashboardViewProvider.postInitialDashboardData` to:

```ts
const cached = await this.dataManager.getCachedDashboardData?.();
if (cached) {
  this.postDashboardData(cached.payload, targetWebview, {
    source: cached.source,
    stale: true,
    generatedAt: cached.metadata.generatedAt,
  });
}
const data = await this.dataManager.refresh();
this.postDashboardData(data, targetWebview, { source: 'fresh', stale: false });
```

Change `postDashboardData` signature to accept optional cache metadata and include it in the posted message.

- [ ] **Step 3: Update selectScope handling**

In `handleWebviewMessage` or the provider path that handles `selectScope`, after selecting the target scope:

```ts
const cached = await dataManager.getCachedDashboardData?.(selectedScope);
if (cached) {
  webview.postMessage({
    type: 'dashboardData',
    data: cached.payload,
    cache: { source: cached.source, stale: true, generatedAt: cached.metadata.generatedAt },
  });
}
const data = await dataManager.refresh({ force: true });
webview.postMessage({ type: 'dashboardData', data, cache: { source: 'fresh', stale: false } });
```

Use the existing refresh method shape if it already queues forced refreshes; do not introduce a second refresh queue.

- [ ] **Step 4: Run tests - expect PASS**

Run:

```bash
zsh -c "source ~/.zshrc && rtk pnpm test -- test/extension/providers/dashboardViewProvider.test.ts test/extension/services/dataManager.test.ts test/extension/providers/webviewMessageHandler.test.ts"
```

Expected: PASS.

---

### Task 2.3: Update dashboard cache writes and invalidation after refreshes and mutations

**Spec coverage:** `extension-cache` / `### Requirement: Cache invalidation`; `dashboard` / `### Requirement: Cache-aware dashboard rendering`

**Files:**
- Create: none
- Modify: `src/extension/services/dataManager.ts`
- Test: `test/extension/services/dataManager.test.ts`

- [ ] **Step 1: Add failing cache write/invalidation tests**

In `test/extension/services/dataManager.test.ts`, add tests using a fake cache service:

```ts
it('writes fresh dashboard data to the selected scope cache after refresh', async () => {
  const cacheService = makeCacheServiceFake();
  const manager = makeDataManagerWithSuccessfulRefresh({ cacheService });

  const data = await manager.refresh();

  expect(cacheService.writeDashboard).toHaveBeenCalledWith(
    expect.objectContaining({ id: data.scope?.id }),
    data
  );
});

it('invalidates the selected scope cache after task mutation', async () => {
  const cacheService = makeCacheServiceFake();
  const manager = makeDataManagerWithTaskFixture({ cacheService });

  await manager.toggleTask('change-a', 0);

  expect(cacheService.invalidateScope).toHaveBeenCalledWith(
    expect.objectContaining({ id: expect.any(String) })
  );
});
```

- [ ] **Step 2: Run test - expect FAIL**

Run:

```bash
zsh -c "source ~/.zshrc && rtk pnpm test -- test/extension/services/dataManager.test.ts"
```

Expected: FAIL because refresh does not write the persistent cache and mutation paths do not invalidate it.

- [ ] **Step 3: Write cache after successful refresh**

In `DataManager.runRefresh`, after `this.cachedData = data`:

```ts
if (data.scope && this.cacheService) {
  await this.cacheService.writeDashboard(data.scope, data);
}
```

Do not write cache inside the refresh error path.

- [ ] **Step 4: Invalidate after successful mutations**

After successful mutation methods such as `toggleTask`, `createChange`, `archiveChange`, store register, and store setup:

```ts
const scope = this.resolveScope(scopeId);
if (scope && this.cacheService) {
  await this.cacheService.invalidateScope(scope);
}
```

Keep the existing queued refresh behavior so the UI still receives fresh data after invalidation.

- [ ] **Step 5: Run tests - expect PASS**

Run:

```bash
zsh -c "source ~/.zshrc && rtk pnpm test -- test/extension/services/dataManager.test.ts"
```

Expected: PASS.
