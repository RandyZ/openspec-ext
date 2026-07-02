# Task 3. Artifact Content Cache

<!-- covers: Task 3.1, Task 3.2, Task 3.3 -->

### Task 3.1: Add failing tests for scope-aware artifact content cache behavior

**Spec coverage:** `extension-cache` / `### Requirement: Artifact content cache` / all scenarios

**Files:**
- Create: none
- Modify: `test/extension/providers/webviewMessageHandler.test.ts`, `test/extension/services/openSpecCacheService.test.ts`
- Test: `test/extension/providers/webviewMessageHandler.test.ts`, `test/extension/services/openSpecCacheService.test.ts`

- [ ] **Step 1: Add cache service artifact isolation test**

Append to `test/extension/services/openSpecCacheService.test.ts`:

```ts
it('keeps artifact content isolated by scope and artifact key', async () => {
  const tempRoot = await makeTempRoot();
  const workspaceRoot = path.join(tempRoot, 'workspace');
  const storageRoot = path.join(tempRoot, 'global-storage');
  const local = scope('local', path.join(workspaceRoot, 'root'));
  const store = scope('store:aihelp', path.join(workspaceRoot, 'store-aihelp'));
  const service = new OpenSpecCacheService(vscode.Uri.file(storageRoot), {
    workspaceRoot,
    extensionVersion: '0.0.0-test',
  });

  await service.writeArtifactContent({ scope: local, changeName: 'same', artifactType: 'tasks' }, 'local tasks');
  await service.writeArtifactContent({ scope: store, changeName: 'same', artifactType: 'tasks' }, 'store tasks');

  await expect(service.readArtifactContent({ scope: local, changeName: 'same', artifactType: 'tasks' }))
    .resolves.toMatchObject({ payload: 'local tasks' });
  await expect(service.readArtifactContent({ scope: store, changeName: 'same', artifactType: 'tasks' }))
    .resolves.toMatchObject({ payload: 'store tasks' });
});
```

- [ ] **Step 2: Add message handler cached-content test**

In `test/extension/providers/webviewMessageHandler.test.ts`, add:

```ts
it('posts cached artifact content before fresh scoped artifact content', async () => {
  const webview = { postMessage: vi.fn() };
  const scope = { id: 'store:aihelp', rootPath: '/store', label: 'aihelp', source: 'store' };
  const dataManager = {
    resolveScope: vi.fn().mockReturnValue(scope),
    getCachedArtifactContent: vi.fn().mockResolvedValue({
      content: 'cached tasks',
      source: 'disk',
      generatedAt: 1,
    }),
    readArtifact: vi.fn().mockResolvedValue('fresh tasks'),
  };

  await handleWebviewMessage(
    { type: 'getArtifactContent', changeName: 'same', artifactType: 'tasks', scopeId: 'store:aihelp' },
    webview as any,
    dataManager as any
  );

  expect(webview.postMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({
    type: 'artifactContent',
    content: 'cached tasks',
    cache: { source: 'disk', stale: true, generatedAt: 1 },
  }));
  expect(webview.postMessage).toHaveBeenLastCalledWith(expect.objectContaining({
    type: 'artifactContent',
    content: 'fresh tasks',
    cache: { source: 'fresh', stale: false },
  }));
});
```

- [ ] **Step 3: Run tests - expect FAIL**

Run:

```bash
zsh -c "source ~/.zshrc && rtk pnpm test -- test/extension/services/openSpecCacheService.test.ts test/extension/providers/webviewMessageHandler.test.ts"
```

Expected: FAIL until artifact cache methods and message metadata exist.

---

### Task 3.2: Implement cached artifact content reads before fresh file reads

**Spec coverage:** `extension-cache` / `### Requirement: Artifact content cache` / `#### Scenario: Detail artifact warms from cache`

**Files:**
- Create: none
- Modify: `src/extension/services/dataManager.ts`, `src/extension/providers/webviewMessageHandler.ts`, `src/webview/components/ChangeDetail.tsx`, `src/webview/types/messages.ts`
- Test: `test/extension/providers/webviewMessageHandler.test.ts`

- [ ] **Step 1: Add DataManager artifact cache helpers**

Add to `src/extension/services/dataManager.ts`:

```ts
export interface CachedArtifactContent {
  content: string;
  source: 'memory' | 'disk';
  generatedAt: number;
}

async getCachedArtifactContent(params: {
  changeName: string;
  artifactType: string;
  scope?: ScopeInfo;
  specId?: string;
}): Promise<CachedArtifactContent | undefined> {
  if (!this.cacheService || !params.scope) return undefined;
  const cached = await this.cacheService.readArtifactContent({
    scope: params.scope,
    changeName: params.changeName,
    artifactType: params.artifactType,
    specId: params.specId,
  });
  return cached
    ? { content: cached.payload, source: 'disk', generatedAt: cached.metadata.generatedAt }
    : undefined;
}

async writeArtifactContentCache(params: {
  changeName: string;
  artifactType: string;
  scope?: ScopeInfo;
  specId?: string;
  content: string;
}): Promise<void> {
  if (!this.cacheService || !params.scope) return;
  await this.cacheService.writeArtifactContent({
    scope: params.scope,
    changeName: params.changeName,
    artifactType: params.artifactType,
    specId: params.specId,
  }, params.content);
}
```

- [ ] **Step 2: Post cached content before fresh content**

In `src/extension/providers/webviewMessageHandler.ts`, update `getArtifactContent` handling:

```ts
const scope = dataManager.resolveScope(message.scopeId);
const cached = await dataManager.getCachedArtifactContent?.({
  changeName: message.changeName,
  artifactType: message.artifactType,
  scope,
});
if (cached) {
  webview.postMessage({
    type: 'artifactContent',
    changeName: message.changeName,
    artifactType: message.artifactType,
    content: cached.content,
    cache: { source: cached.source, stale: true, generatedAt: cached.generatedAt },
  });
}
const content = await dataManager.readArtifact(message.changeName, message.artifactType, scope);
await dataManager.writeArtifactContentCache?.({
  changeName: message.changeName,
  artifactType: message.artifactType,
  scope,
  content,
});
webview.postMessage({
  type: 'artifactContent',
  changeName: message.changeName,
  artifactType: message.artifactType,
  content,
  cache: { source: 'fresh', stale: false },
});
```

Apply the same pattern to delta spec content and spec content handlers when those paths load detail content.

- [ ] **Step 3: Teach webview message types about cache metadata**

In `src/webview/types/messages.ts`, add optional cache metadata to content messages:

```ts
export interface WebviewCacheMeta {
  source: 'memory' | 'disk' | 'fresh';
  stale: boolean;
  generatedAt?: number;
}
```

Attach `cache?: WebviewCacheMeta` to dashboard and artifact content message types.

- [ ] **Step 4: Run tests - expect PASS**

Run:

```bash
zsh -c "source ~/.zshrc && rtk pnpm test -- test/extension/providers/webviewMessageHandler.test.ts test/extension/services/openSpecCacheService.test.ts"
```

Expected: PASS.

---

### Task 3.3: Invalidate artifact content cache after task and artifact changes

**Spec coverage:** `extension-cache` / `### Requirement: Artifact content cache` / `#### Scenario: Artifact mutation invalidates cache`

**Files:**
- Create: none
- Modify: `src/extension/services/dataManager.ts`, `src/extension/providers/webviewMessageHandler.ts`
- Test: `test/extension/services/dataManager.test.ts`, `test/extension/providers/webviewMessageHandler.test.ts`

- [ ] **Step 1: Add failing invalidation tests**

Add to `test/extension/services/dataManager.test.ts`:

```ts
it('invalidates task artifact cache after toggling a task', async () => {
  const cacheService = makeCacheServiceFake();
  const manager = makeDataManagerWithTaskFixture({ cacheService });

  await manager.toggleTask('change-a', 0);

  expect(cacheService.invalidateArtifact).toHaveBeenCalledWith(expect.objectContaining({
    changeName: 'change-a',
    artifactType: 'tasks',
  }));
});
```

- [ ] **Step 2: Run test - expect FAIL**

Run:

```bash
zsh -c "source ~/.zshrc && rtk pnpm test -- test/extension/services/dataManager.test.ts"
```

Expected: FAIL because artifact cache invalidation is not called.

- [ ] **Step 3: Invalidate changed artifacts**

After successful task toggles:

```ts
const scope = this.resolveScope(scopeId);
if (scope && this.cacheService) {
  await this.cacheService.invalidateArtifact({ scope, changeName, artifactType: 'tasks' });
  await this.cacheService.invalidateScope(scope);
}
```

For broader file watcher refreshes where the specific artifact is not known, call `invalidateScope(scope)` so dashboard and artifact content are refreshed safely.

- [ ] **Step 4: Run tests - expect PASS**

Run:

```bash
zsh -c "source ~/.zshrc && rtk pnpm test -- test/extension/services/dataManager.test.ts test/extension/providers/webviewMessageHandler.test.ts"
```

Expected: PASS.
