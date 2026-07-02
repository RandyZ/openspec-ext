# Task 3. Dashboard Activity State

<!-- covers: Task 3.1, Task 3.2, Task 3.3 -->

### Task 3.1: Add reducer tests for cached refresh activity transitions

**Spec coverage:** dashboard / Scope transition feedback / Target cached data arrives during scope switch, Fresh data arrives after cached scope data, Fresh refresh fails after target cached data is visible

**Files:**
- Modify: `test/webview/components/dashboard.test.tsx`
- Modify: `test/webview/components/scopeBar.test.tsx`
- Test: `test/webview/components/dashboard.test.tsx`

- [ ] **Step 1: Update the existing stale scope switch reducer test**

In `test/webview/components/dashboard.test.tsx`, update the test named `keeps scope switch pending while stale cached data is shown, then clears on fresh data`. Rename it to:

```ts
it('changes scope switching to cached refresh when target cached data is shown, then clears on fresh data', () => {
```

Change the assertions after `withStaleCache` to:

```ts
    expect(withStaleCache.data).toBe(cachedStoreData);
    expect(withStaleCache.stale).toBe(true);
    expect(withStaleCache.loading).toBe(true);
    expect(withStaleCache.loadingReason).toBe('background-refresh');
    expect(withStaleCache.pendingScopeId).toBeUndefined();
    expect(withStaleCache.activity).toEqual({
      kind: 'cached-refresh',
      scopeId: storeScope.id,
    });
```

Keep the fresh-data assertions and add:

```ts
    expect(withFreshData.activity).toEqual({ kind: 'idle' });
```

- [ ] **Step 2: Add fresh failure after cached data test**

Add this test to the same `describe('Dashboard scope switching states', () => { ... })` block:

```ts
  it('keeps target cached data and stops switching when fresh refresh fails', () => {
    const cachedStoreData: DashboardData = {
      ...dashboardData,
      scope: storeScope,
      changes: [
        {
          name: 'cached-store-change',
          completedTasks: 0,
          totalTasks: 0,
          lastModified: '2026-06-14T00:00:00.000Z',
          status: 'draft',
          artifacts: [],
        },
      ],
    };
    const switching = appReducer({
      data: dashboardData,
      loading: false,
      error: null,
      selectedChange: null,
      debug: false,
      cliDiagnostic: null,
      stale: false,
      activity: { kind: 'idle' },
    } as any, {
      type: 'START_SCOPE_SWITCH',
      scopeId: storeScope.id,
    });
    const withStaleCache = appReducer(switching, {
      type: 'SET_DATA',
      payload: cachedStoreData,
      cache: { source: 'disk', stale: true, generatedAt: 1 },
    });
    const failed = appReducer(withStaleCache, {
      type: 'SET_ERROR',
      payload: 'Refresh failed',
    });

    expect(failed.data).toBe(cachedStoreData);
    expect(failed.stale).toBe(true);
    expect(failed.loading).toBe(false);
    expect(failed.loadingReason).toBeUndefined();
    expect(failed.pendingScopeId).toBeUndefined();
    expect(failed.activity).toEqual({ kind: 'warning', message: 'Refresh failed' });
  });
```

- [ ] **Step 3: Add ScopeBar activity rendering tests**

In `test/webview/components/scopeBar.test.tsx`, add:

```ts
  it('shows cached refresh activity instead of switching after target cache is visible', () => {
    const html = renderToStaticMarkup(
      <ScopeBar
        scope={storeScope}
        scopes={[localScope, storeScope]}
        loading
        loadingReason="background-refresh"
        activity={{ kind: 'cached-refresh', scopeId: storeScope.id } as any}
        health={{ status: 'ok', label: 'Healthy' }}
        onSelectScope={vi.fn()}
      />,
    );

    expect(html).toMatch(/cached|缓存|refreshing|刷新/i);
    expect(html).not.toMatch(/switching|切换/i);
  });
```

- [ ] **Step 4: Run tests and confirm failure**

Run:

```bash
rtk zsh -c 'source ~/.zshrc && rtk pnpm exec vitest run test/webview/components/dashboard.test.tsx test/webview/components/scopeBar.test.tsx'
```

Expected: FAIL because `AppState.activity` and `ScopeBarProps.activity` do not exist yet, and stale `SET_DATA` still preserves `scope-switch`.

---

### Task 3.2: Implement explicit dashboard activity phases

**Spec coverage:** dashboard / Scope transition feedback / Select different scope, Target cached data arrives during scope switch, Fresh data arrives after cached scope data, Scope switch succeeds without cached intermediate data

**Files:**
- Modify: `src/webview/context/AppContext.tsx`
- Modify: `src/webview/components/Dashboard.tsx`
- Modify: `src/webview/components/ScopeBar.tsx`
- Test: `test/webview/components/dashboard.test.tsx`
- Test: `test/webview/components/scopeBar.test.tsx`

- [ ] **Step 1: Add activity type and state field**

In `src/webview/context/AppContext.tsx`, add:

```ts
export type DashboardActivity =
  | { kind: 'idle' }
  | { kind: 'scope-switch'; targetScopeId: string }
  | { kind: 'cached-refresh'; scopeId: string }
  | { kind: 'manual-refresh' }
  | { kind: 'scope-action'; action: 'setup' | 'register' }
  | { kind: 'warning'; message: string };
```

Add to `AppState`:

```ts
  activity: DashboardActivity;
```

Add to `initialState`:

```ts
  activity: { kind: 'idle' },
```

- [ ] **Step 2: Update reducer loading transitions**

Update `SET_LOADING`, `START_LOADING`, and `START_SCOPE_SWITCH`:

```ts
    case 'SET_LOADING':
      return {
        ...state,
        loading: action.payload,
        loadingReason: action.payload ? action.reason : undefined,
        pendingScopeId: action.payload ? state.pendingScopeId : undefined,
        activity: action.payload
          ? action.reason === 'refresh'
            ? { kind: 'manual-refresh' }
            : state.activity
          : { kind: 'idle' },
      };

    case 'START_LOADING':
      return {
        ...state,
        loading: true,
        loadingReason: action.reason,
        pendingScopeId: undefined,
        activity:
          action.reason === 'store-register'
            ? { kind: 'scope-action', action: 'register' }
            : action.reason === 'store-setup'
              ? { kind: 'scope-action', action: 'setup' }
              : action.reason === 'refresh'
                ? { kind: 'manual-refresh' }
                : state.activity,
      };

    case 'START_SCOPE_SWITCH':
      return {
        ...state,
        loading: true,
        loadingReason: 'scope-switch',
        pendingScopeId: action.scopeId,
        stale: false,
        activity: { kind: 'scope-switch', targetScopeId: action.scopeId },
      };
```

- [ ] **Step 3: Update stale and fresh data transitions**

Replace the `SET_DATA` stale branch with:

```ts
      if (action.cache?.stale === true) {
        const scopeId = action.payload.scope?.id ?? state.pendingScopeId;
        const isTargetScope = state.pendingScopeId !== undefined && scopeId === state.pendingScopeId;
        return {
          ...state,
          data: action.payload,
          loading: true,
          loadingReason: isTargetScope ? 'background-refresh' : state.loadingReason,
          pendingScopeId: isTargetScope ? undefined : state.pendingScopeId,
          stale: true,
          error: null,
          cliDiagnostic: null,
          activity: scopeId
            ? { kind: 'cached-refresh', scopeId }
            : { kind: 'manual-refresh' },
        };
      }
```

Update the fresh branch to set:

```ts
        activity: { kind: 'idle' },
```

- [ ] **Step 4: Update error and diagnostic transitions**

In `SET_ERROR`, preserve stale data but stop transient loading:

```ts
        activity: { kind: 'warning', message: action.payload },
```

In `SET_CLI_DIAGNOSTIC`, set:

```ts
        activity: action.payload
          ? { kind: 'warning', message: action.payload.diagnostic.message }
          : { kind: 'idle' },
```

- [ ] **Step 5: Pass activity to ScopeBar**

In `Dashboard.tsx`, include `activity` in the state destructure:

```ts
  const { data, loading, loadingReason, pendingScopeId, error, activity } = state;
```

Pass it to `ScopeBar`:

```tsx
              activity={activity}
```

Add `activity?: DashboardActivity` to `ScopeBarProps` in Task 4 or in this task if TypeScript requires it.

- [ ] **Step 6: Run activity tests**

Run:

```bash
rtk zsh -c 'source ~/.zshrc && rtk pnpm exec vitest run test/webview/components/dashboard.test.tsx'
```

Expected: PASS for reducer tests after ScopeBar prop typing is complete.

---

### Task 3.3: Preserve error, warning, and manual refresh behavior

**Spec coverage:** dashboard / Scope transition feedback / Scope switch fails before target data is visible, Fresh refresh fails after target cached data is visible; dashboard / Operational status rail / Rail uses accessible activity copy

**Files:**
- Modify: `src/webview/context/AppContext.tsx`
- Modify: `src/webview/components/Dashboard.tsx`
- Modify: `src/webview/components/ScopeBar.tsx`
- Test: `test/webview/components/dashboard.test.tsx`
- Test: `test/webview/components/scopeBar.test.tsx`

- [ ] **Step 1: Add manual refresh regression test**

In `test/webview/components/dashboard.test.tsx`, add:

```ts
  it('keeps manual refresh separate from scope switching', () => {
    const refreshing = appReducer({
      data: dashboardData,
      loading: false,
      error: null,
      selectedChange: null,
      debug: false,
      cliDiagnostic: null,
      stale: false,
      activity: { kind: 'idle' },
    } as any, {
      type: 'SET_LOADING',
      payload: true,
      reason: 'refresh',
    });

    expect(refreshing.loadingReason).toBe('refresh');
    expect(refreshing.pendingScopeId).toBeUndefined();
    expect(refreshing.activity).toEqual({ kind: 'manual-refresh' });
  });
```

- [ ] **Step 2: Add scope switch failure before target data test**

Add:

```ts
  it('restores previous data when scope switch fails before target data is visible', () => {
    const switching = appReducer({
      data: dashboardData,
      loading: false,
      error: null,
      selectedChange: null,
      debug: false,
      cliDiagnostic: null,
      stale: false,
      activity: { kind: 'idle' },
    } as any, {
      type: 'START_SCOPE_SWITCH',
      scopeId: storeScope.id,
    });
    const failed = appReducer(switching, {
      type: 'SET_ERROR',
      payload: 'Scope failed',
    });

    expect(failed.data).toBe(dashboardData);
    expect(failed.loading).toBe(false);
    expect(failed.pendingScopeId).toBeUndefined();
    expect(failed.activity).toEqual({ kind: 'warning', message: 'Scope failed' });
  });
```

- [ ] **Step 3: Render manual refresh and warning activity copy**

In `ScopeBar.tsx`, Task 4 will implement `activityLabel`. Make sure it returns:

```ts
  if (activity?.kind === 'cached-refresh') return t('dashboard.staleData');
  if (activity?.kind === 'manual-refresh') return t('dashboard.refreshing');
  if (activity?.kind === 'warning') return activity.message;
```

Add missing i18n key in both locales:

```json
  "dashboard.refreshing": "Refreshing OpenSpec data..."
```

Chinese:

```json
  "dashboard.refreshing": "正在刷新 OpenSpec 数据..."
```

- [ ] **Step 4: Run webview tests**

Run:

```bash
rtk zsh -c 'source ~/.zshrc && rtk pnpm exec vitest run test/webview/components/dashboard.test.tsx test/webview/components/scopeBar.test.tsx'
```

Expected: PASS.
