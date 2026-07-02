# Task 2. Cache Webview Protocol

<!-- covers: Task 2.1, Task 2.2, Task 2.3 -->

### Task 2.1: Add typed cache stats and action messages

**Spec coverage:** dashboard / Dashboard cache management entry / User opens cache action menu; extension-cache / Cache usage summary / Dashboard requests cache stats

**Files:**
- Modify: `src/webview/types/messages.ts`
- Test: `test/webview/components/dashboard.test.tsx`
- Test: `test/extension/providers/webviewMessageHandler.test.ts`

- [ ] **Step 1: Add message and view types**

In `src/webview/types/messages.ts`, add these exported types near `WebviewCacheMeta`:

```ts
export type CacheAction = 'openFolder' | 'copyPath' | 'clear' | 'showDetails';

export interface CacheStatsView {
  rootPath: string;
  totalBytes: number;
  formattedSize: string;
  fileCount: number;
  calculatedAt: number;
  isCalculating: boolean;
  error?: string;
}
```

Extend `WebviewMessage`:

```ts
  | { type: 'getCacheStats'; force?: boolean }
  | { type: 'cacheAction'; action: CacheAction }
```

Extend `ExtensionMessage`:

```ts
  | { type: 'cacheStats'; stats: CacheStatsView }
  | { type: 'cacheActionResult'; action: CacheAction; success: boolean; message?: string }
```

- [ ] **Step 2: Add sendMessage helpers**

In the `sendMessage` object in `src/webview/types/messages.ts`, add:

```ts
  getCacheStats: (force = false): WebviewMessage => ({
    type: 'getCacheStats',
    ...(force ? { force } : {}),
  }),

  cacheAction: (action: CacheAction): WebviewMessage => ({
    type: 'cacheAction',
    action,
  }),
```

- [ ] **Step 3: Add failing dashboard message test**

In `test/webview/components/dashboard.test.tsx`, add a test that verifies initial dashboard mount requests cache stats:

```ts
  it('requests cache stats when dashboard mounts', () => {
    const postMessage = vi.fn();
    vi.doMock('../../../src/webview/hooks/useVscode', () => ({
      useVscode: () => ({
        postMessage,
        onMessage: vi.fn(() => vi.fn()),
      }),
    }));

    renderToStaticMarkup(
      <AppProvider
        initialState={{
          data: dashboardData,
          loading: false,
          error: null,
          selectedChange: null,
          debug: false,
          cliDiagnostic: null,
        } as any}
      >
        <Dashboard />
      </AppProvider>
    );

    expect(postMessage).toHaveBeenCalledWith({ type: 'getCacheStats' });
  });
```

If the existing module-level `useVscode` mock makes `vi.doMock` unsuitable in this file, add the assertion to the existing mock's `postMessage` spy pattern instead. The expected message object must remain exactly `{ type: 'getCacheStats' }`.

- [ ] **Step 4: Add failing handler type test**

In `test/extension/providers/webviewMessageHandler.test.ts`, add:

```ts
  it('posts cache stats for getCacheStats messages', async () => {
    const stats = {
      rootPath: '/tmp/openspec-cache',
      totalBytes: 12288,
      fileCount: 4,
      calculatedAt: 1,
      isCalculating: false,
    };
    const dataManager = {
      getCacheStats: vi.fn().mockResolvedValue(stats),
      getWorkspaceRoot: vi.fn().mockReturnValue('/workspace'),
    };
    const webview = { postMessage: vi.fn() };

    await handleWebviewMessage(
      { type: 'getCacheStats' },
      webview as any,
      dataManager as any
    );

    expect(dataManager.getCacheStats).toHaveBeenCalledWith({ force: false });
    expect(webview.postMessage).toHaveBeenCalledWith({
      type: 'cacheStats',
      stats: expect.objectContaining({
        rootPath: '/tmp/openspec-cache',
        formattedSize: '12.0 KB',
        fileCount: 4,
        isCalculating: false,
      }),
    });
  });
```

- [ ] **Step 5: Run tests and confirm failure**

Run:

```bash
rtk zsh -c 'source ~/.zshrc && rtk pnpm exec vitest run test/webview/components/dashboard.test.tsx test/extension/providers/webviewMessageHandler.test.ts'
```

Expected: FAIL because cache messages and handlers are not implemented.

---

### Task 2.2: Handle cache stats and actions in the extension host

**Spec coverage:** dashboard / Dashboard cache management entry / User opens cache action menu, Cache action completes; extension-cache / Cache management actions / Open cache folder, Copy cache path, Clear cache, Show cache details

**Files:**
- Modify: `src/extension/providers/webviewMessageHandler.ts`
- Test: `test/extension/providers/webviewMessageHandler.test.ts`

- [ ] **Step 1: Add cache action handler tests**

Add these tests to `test/extension/providers/webviewMessageHandler.test.ts`:

```ts
  it('copies cache path for cacheAction copyPath', async () => {
    const dataManager = {
      getCacheRootPath: vi.fn().mockReturnValue('/tmp/openspec-cache'),
      getWorkspaceRoot: vi.fn().mockReturnValue('/workspace'),
    };
    const webview = { postMessage: vi.fn() };

    await handleWebviewMessage(
      { type: 'cacheAction', action: 'copyPath' },
      webview as any,
      dataManager as any
    );

    expect(vscode.env.clipboard.writeText).toHaveBeenCalledWith('/tmp/openspec-cache');
    expect(webview.postMessage).toHaveBeenCalledWith({
      type: 'cacheActionResult',
      action: 'copyPath',
      success: true,
      message: expect.any(String),
    });
  });

  it('clears cache, refreshes dashboard data, and posts refreshed stats', async () => {
    const stats = {
      rootPath: '/tmp/openspec-cache',
      totalBytes: 0,
      fileCount: 0,
      calculatedAt: 2,
      isCalculating: false,
    };
    const data = { changes: [], specs: [], lastRefresh: 2 };
    const dataManager = {
      clearCache: vi.fn().mockResolvedValue(stats),
      refresh: vi.fn().mockResolvedValue(data),
      getWorkspaceRoot: vi.fn().mockReturnValue('/workspace'),
    };
    const webview = { postMessage: vi.fn() };

    await handleWebviewMessage(
      { type: 'cacheAction', action: 'clear' },
      webview as any,
      dataManager as any
    );

    expect(dataManager.clearCache).toHaveBeenCalled();
    expect(dataManager.refresh).toHaveBeenCalled();
    expect(webview.postMessage).toHaveBeenCalledWith({
      type: 'cacheActionResult',
      action: 'clear',
      success: true,
      message: expect.any(String),
    });
    expect(webview.postMessage).toHaveBeenCalledWith({ type: 'dashboardData', data, debug: false });
    expect(webview.postMessage).toHaveBeenCalledWith({
      type: 'cacheStats',
      stats: expect.objectContaining({ fileCount: 0, formattedSize: '0 B' }),
    });
  });
```

- [ ] **Step 2: Add formatting and mapper helpers**

In `src/extension/providers/webviewMessageHandler.ts`, add local helpers near `postError`:

```ts
  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  const toCacheStatsView = (stats: {
    rootPath: string;
    totalBytes: number;
    fileCount: number;
    calculatedAt: number;
    isCalculating: boolean;
    error?: string;
  }) => ({
    rootPath: stats.rootPath,
    totalBytes: stats.totalBytes,
    formattedSize: formatBytes(stats.totalBytes),
    fileCount: stats.fileCount,
    calculatedAt: stats.calculatedAt,
    isCalculating: stats.isCalculating,
    ...(stats.error ? { error: stats.error } : {}),
  });

  const postCacheStats = async (force = false) => {
    const stats = await dataManager.getCacheStats?.({ force });
    if (!stats) {
      webview.postMessage({
        type: 'cacheStats',
        stats: {
          rootPath: '',
          totalBytes: 0,
          formattedSize: '0 B',
          fileCount: 0,
          calculatedAt: Date.now(),
          isCalculating: false,
          error: t('cache.unavailable'),
        },
      });
      return;
    }
    webview.postMessage({ type: 'cacheStats', stats: toCacheStatsView(stats) });
  };
```

- [ ] **Step 3: Implement `getCacheStats` message**

Add this switch case:

```ts
    case 'getCacheStats': {
      await postCacheStats(message.force === true);
      break;
    }
```

- [ ] **Step 4: Implement `cacheAction` message**

Add this switch case:

```ts
    case 'cacheAction': {
      try {
        if (message.action === 'openFolder') {
          const rootPath = dataManager.getCacheRootPath?.();
          if (!rootPath) throw new Error(t('cache.unavailable'));
          await vscode.workspace.fs.createDirectory(vscode.Uri.file(rootPath));
          await vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(rootPath));
          webview.postMessage({ type: 'cacheActionResult', action: message.action, success: true, message: t('cache.openFolder') });
          await postCacheStats();
          break;
        }

        if (message.action === 'copyPath') {
          const rootPath = dataManager.getCacheRootPath?.();
          if (!rootPath) throw new Error(t('cache.unavailable'));
          await vscode.env.clipboard.writeText(rootPath);
          webview.postMessage({ type: 'cacheActionResult', action: message.action, success: true, message: t('cache.pathCopied') });
          await postCacheStats();
          break;
        }

        if (message.action === 'clear') {
          const stats = await dataManager.clearCache?.();
          webview.postMessage({ type: 'cacheActionResult', action: message.action, success: true, message: t('cache.cleared', { size: formatBytes(stats?.totalBytes ?? 0) }) });
          const data = await dataManager.refresh();
          webview.postMessage({ type: 'dashboardData', data, debug: getDebug() });
          if (stats) webview.postMessage({ type: 'cacheStats', stats: toCacheStatsView(stats) });
          break;
        }

        if (message.action === 'showDetails') {
          const stats = await dataManager.getCacheStats?.({ force: true });
          if (!stats) throw new Error(t('cache.unavailable'));
          vscode.window.showInformationMessage(t('cache.details', {
            path: stats.rootPath,
            size: formatBytes(stats.totalBytes),
            files: String(stats.fileCount),
          }));
          webview.postMessage({ type: 'cacheActionResult', action: message.action, success: true, message: t('cache.details', {
            path: stats.rootPath,
            size: formatBytes(stats.totalBytes),
            files: String(stats.fileCount),
          }) });
          webview.postMessage({ type: 'cacheStats', stats: toCacheStatsView(stats) });
        }
      } catch (error) {
        webview.postMessage({
          type: 'cacheActionResult',
          action: message.action,
          success: false,
          message: (error as Error).message,
        });
      }
      break;
    }
```

- [ ] **Step 5: Ensure vscode mock supports filesystem operations**

In `test/extension/providers/webviewMessageHandler.test.ts`, ensure the `vscode` mock contains these members:

```ts
  Uri: {
    file: vi.fn((fsPath: string) => ({ fsPath })),
  },
  workspace: {
    getConfiguration: vi.fn(() => ({
      get: vi.fn(() => false),
      inspect: vi.fn(() => undefined),
    })),
    openTextDocument: vi.fn(() => Promise.resolve({})),
    fs: {
      createDirectory: vi.fn(() => Promise.resolve()),
    },
  },
```

- [ ] **Step 6: Run handler tests**

Run:

```bash
rtk zsh -c 'source ~/.zshrc && rtk pnpm exec vitest run test/extension/providers/webviewMessageHandler.test.ts'
```

Expected: PASS.

---

### Task 2.3: Request and refresh cache stats from the dashboard

**Spec coverage:** dashboard / Dashboard cache management entry / Cache action completes; extension-cache / Cache usage summary / Dashboard requests cache stats, Cache stats failure is non-blocking

**Files:**
- Modify: `src/webview/components/Dashboard.tsx`
- Modify: `src/webview/types/messages.ts`
- Test: `test/webview/components/dashboard.test.tsx`

- [ ] **Step 1: Store cache stats in Dashboard local state**

In `src/webview/components/Dashboard.tsx`, import `CacheAction` and `CacheStatsView`:

```ts
import type { ArchivedChangeInfo, CacheAction, CacheStatsView, SpecInfo, WebviewMessage } from '../types/messages';
```

Add state near the existing local state:

```ts
  const [cacheStats, setCacheStats] = useState<CacheStatsView | null>(null);
  const [cacheActionMessage, setCacheActionMessage] = useState<string | null>(null);
```

- [ ] **Step 2: Handle cache messages**

In the `onMessage` callback in `Dashboard.tsx`, add branches:

```ts
      } else if (message.type === 'cacheStats') {
        setCacheStats(message.stats ?? null);
      } else if (message.type === 'cacheActionResult') {
        setCacheActionMessage(message.message ?? null);
        if (message.success) {
          postMessage(sendMessage.getCacheStats(true));
        }
```

- [ ] **Step 3: Request cache stats on mount and after refresh**

In the initial request section of the dashboard effect, add:

```ts
    postMessage(sendMessage.getCacheStats());
```

In `handleRefresh`, after requesting dashboard refresh and workflow config, add:

```ts
    postMessage(sendMessage.getCacheStats(true));
```

- [ ] **Step 4: Add cache action dispatcher**

Add this handler in `Dashboard.tsx`:

```ts
  const handleCacheAction = (action: CacheAction) => {
    setCacheActionMessage(null);
    postMessage(sendMessage.cacheAction(action));
  };
```

Complete Task 4 in the same implementation pass before running the final TypeScript build, then pass `cacheStats`, `cacheActionMessage`, and `handleCacheAction` to `ScopeBar` exactly as described there.

- [ ] **Step 5: Run dashboard tests**

Run:

```bash
rtk zsh -c 'source ~/.zshrc && rtk pnpm exec vitest run test/webview/components/dashboard.test.tsx'
```

Expected: PASS after Task 4 props are wired.
