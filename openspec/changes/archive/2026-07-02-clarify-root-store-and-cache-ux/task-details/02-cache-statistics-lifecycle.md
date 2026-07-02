# Task 2. Cache Statistics Lifecycle

<!-- covers: Task 2.1, Task 2.2 -->

### Task 2.1: Add dashboard tests proving root switches do not force cache stat recalculation

**Spec coverage:** `extension-cache` / `### Requirement: Cache statistics refresh semantics` / `#### Scenario: Root switch does not force cache stats recalculation`

**Files:**
- Modify: `test/webview/components/dashboard.test.tsx`
- Test: `test/webview/components/dashboard.test.tsx`

- [ ] **Step 1: Import the scope switch helper if needed**

Ensure this import includes `createScopeSelectHandler`:

```tsx
import {
  Dashboard,
  createScopeSelectHandler,
  requestInitialDashboardData,
} from '../../../src/webview/components/Dashboard';
```

- [ ] **Step 2: Add the failing regression test**

Add this test under `describe('Dashboard scope switching states', () => { ... })`:

```tsx
it('selects a root without forcing cache stats recalculation', () => {
  const dispatch = vi.fn();
  const postMessage = vi.fn();

  createScopeSelectHandler(dispatch, postMessage)('store:team-plans');

  expect(dispatch).toHaveBeenCalledWith({
    type: 'START_SCOPE_SWITCH',
    scopeId: 'store:team-plans',
  });
  expect(postMessage).toHaveBeenCalledWith({
    type: 'selectScope',
    scopeId: 'store:team-plans',
  });
  expect(postMessage).not.toHaveBeenCalledWith({ type: 'getCacheStats', force: true });
  expect(postMessage).not.toHaveBeenCalledWith({ type: 'getCacheStats' });
});
```

- [ ] **Step 3: Run the dashboard tests and confirm the intended result**

Run:

```bash
zsh -lc 'source ~/.zshrc && rtk pnpm test -- test/webview/components/dashboard.test.tsx'
```

Expected before implementation: FAIL only if the current root-switch path forces cache stat requests. If it already passes, keep the test as a regression lock.

---

### Task 2.2: Keep cache stats global while preserving explicit and mutation-triggered refreshes

**Spec coverage:** `extension-cache` / `### Requirement: Cache statistics refresh semantics` / all scenarios

**Files:**
- Modify: `src/webview/components/Dashboard.tsx`
- Test: `test/webview/components/dashboard.test.tsx`, `test/extension/providers/webviewMessageHandler.test.ts`

- [ ] **Step 1: Keep initial cache stats warm-up non-forced**

Verify `requestInitialDashboardData` keeps the existing non-forced request:

```tsx
export function requestInitialDashboardData(
  dispatch: DashboardDispatch,
  postMessage: DashboardPostMessage,
) {
  dispatch({ type: 'SET_LOADING', payload: true, reason: 'initial' });
  postMessage(sendMessage.getDashboardData());
  postMessage(sendMessage.getWorkflowLaunchConfig());
  postMessage(sendMessage.getCacheStats());
}
```

- [ ] **Step 2: Keep root selection free of cache stat requests**

Ensure `createScopeSelectHandler` only starts the scope switch and posts `selectScope`:

```tsx
export function createScopeSelectHandler(
  dispatch: DashboardDispatch,
  postMessage: DashboardPostMessage,
) {
  return (scopeId: string) => {
    dispatch({ type: 'START_SCOPE_SWITCH', scopeId });
    postMessage(sendMessage.selectScope(scopeId));
  };
}
```

Remove any `sendMessage.getCacheStats(true)` call from scope-change handlers or `dashboardData` handling that is only triggered by a selected root change.

- [ ] **Step 3: Preserve explicit and mutation-triggered forced refreshes**

Keep these two forced paths:

```tsx
const handleRefresh = () => {
  dispatch({ type: 'SET_LOADING', payload: true, reason: 'refresh' });
  postMessage(sendMessage.refresh());
  postMessage(sendMessage.getWorkflowLaunchConfig());
  postMessage(sendMessage.getCacheStats(true));
};
```

```tsx
} else if (message.type === 'cacheActionResult') {
  setCacheActionMessage(message.message ?? (message.success ? t('cache.menuLabel') : t('cache.unavailable')));
  if (message.success) {
    postMessage(sendMessage.getCacheStats(true));
  }
}
```

- [ ] **Step 4: Run dashboard and cache handler tests**

Run:

```bash
zsh -lc 'source ~/.zshrc && rtk pnpm test -- test/webview/components/dashboard.test.tsx test/extension/providers/webviewMessageHandler.test.ts'
```

Expected: PASS. Existing `getCacheStats` handler tests must still show `{ force: false }` for default requests and forced stats after cache mutation.
