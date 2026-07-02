# Task 4. Scope Switching UX

<!-- covers: Task 4.1, Task 4.2, Task 4.3 -->

### Task 4.1: Add failing webview tests for scope switching pending state

**Spec coverage:** `dashboard` / `### Requirement: Scope transition feedback` / select, success, failure scenarios

**Files:**
- Create: none
- Modify: `test/webview/components/scopeBar.test.tsx`, `test/webview/components/dashboard.test.tsx`
- Test: `test/webview/components/scopeBar.test.tsx`, `test/webview/components/dashboard.test.tsx`

- [ ] **Step 1: Add ScopeBar pending state test**

In `test/webview/components/scopeBar.test.tsx`, add:

```tsx
it('shows a scope switching indicator and disables selector while switching', () => {
  render(
    <ScopeBar
      scope={localScope}
      scopes={[localScope, storeScope]}
      loading
      loadingReason="scope-switch"
      pendingScopeId={storeScope.id}
      health={{ status: 'ok', label: 'Healthy' }}
      onSelectScope={vi.fn()}
    />
  );

  expect(screen.getByRole('status')).toHaveTextContent(/switching|切换/i);
  expect(screen.getByLabelText(/OpenSpec scope/i)).toBeDisabled();
});
```

- [ ] **Step 2: Add Dashboard select-state test**

In `test/webview/components/dashboard.test.tsx`, add a test that selects a different scope and asserts a `selectScope` message plus pending UI:

```tsx
it('enters pending state immediately when selecting another scope', async () => {
  const postMessage = vi.fn();
  renderDashboardWithData({ postMessage, scopes: [localScope, storeScope], scope: localScope });

  await userEvent.selectOptions(screen.getByLabelText(/OpenSpec scope/i), storeScope.id);

  expect(postMessage).toHaveBeenCalledWith({ type: 'selectScope', scopeId: storeScope.id });
  expect(screen.getByRole('status')).toHaveTextContent(/switching|切换/i);
});
```

Use existing dashboard test helpers if they are already present.

- [ ] **Step 3: Run tests - expect FAIL**

Run:

```bash
zsh -c "source ~/.zshrc && rtk pnpm test -- test/webview/components/scopeBar.test.tsx test/webview/components/dashboard.test.tsx"
```

Expected: FAIL because `ScopeBar` does not accept `loadingReason` or render a status indicator.

---

### Task 4.2: Implement reasoned loading state and ScopeBar switching feedback

**Spec coverage:** `dashboard` / `### Requirement: Scope transition feedback`

**Files:**
- Create: none
- Modify: `src/webview/App.tsx`, `src/webview/components/Dashboard.tsx`, `src/webview/components/ScopeBar.tsx`, `src/webview/types/messages.ts`
- Test: `test/webview/components/scopeBar.test.tsx`, `test/webview/components/dashboard.test.tsx`

- [ ] **Step 1: Extend webview state**

In `src/webview/App.tsx`, extend state and reducer actions:

```ts
type LoadingReason = 'initial' | 'refresh' | 'scope-switch' | 'store-register' | 'store-setup' | 'background-refresh';

interface AppState {
  loading: boolean;
  loadingReason?: LoadingReason;
  pendingScopeId?: string;
  stale?: boolean;
}

case 'START_SCOPE_SWITCH':
  return { ...state, loading: true, loadingReason: 'scope-switch', pendingScopeId: action.scopeId };
case 'SET_DATA':
  return { ...state, data: action.data, loading: false, loadingReason: undefined, pendingScopeId: undefined, stale: action.cache?.stale === true };
case 'SET_ERROR':
  return { ...state, loading: false, loadingReason: undefined, pendingScopeId: undefined, error: action.error };
```

- [ ] **Step 2: Dispatch before sending selectScope**

In `src/webview/components/Dashboard.tsx`:

```tsx
const handleSelectScope = useCallback((scopeId: string) => {
  dispatch({ type: 'START_SCOPE_SWITCH', scopeId });
  postMessage(sendMessage.selectScope(scopeId));
}, [dispatch, postMessage]);
```

Pass `loadingReason` and `pendingScopeId` into `ScopeBar`.

- [ ] **Step 3: Render spinner and status**

In `src/webview/components/ScopeBar.tsx`, add props:

```ts
loadingReason?: LoadingReason;
pendingScopeId?: string;
```

Render a compact status:

```tsx
{loading && loadingReason === 'scope-switch' && (
  <span role="status" aria-live="polite" className="inline-flex items-center gap-1">
    <span className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent" />
    {t('scope.switching')}
  </span>
)}
```

- [ ] **Step 4: Run tests - expect PASS**

Run:

```bash
zsh -c "source ~/.zshrc && rtk pnpm test -- test/webview/components/scopeBar.test.tsx test/webview/components/dashboard.test.tsx"
```

Expected: PASS.

---

### Task 4.3: Implement setup/register pending feedback and localized stale indicators

**Spec coverage:** `dashboard` / `### Requirement: Scope transition feedback`; `dashboard` / `### Requirement: Cache-aware dashboard rendering`

**Files:**
- Create: none
- Modify: `src/webview/App.tsx`, `src/webview/components/Dashboard.tsx`, `src/webview/components/ScopeBar.tsx`, `src/i18n/locales/en.json`, `src/i18n/locales/zh-cn.json`
- Test: `test/webview/components/scopeBar.test.tsx`, `test/webview/components/dashboard.test.tsx`

- [ ] **Step 1: Add failing tests for setup/register loading**

In `test/webview/components/scopeBar.test.tsx`:

```tsx
it('shows store setup pending state and disables setup actions', () => {
  render(
    <ScopeBar
      scope={{ ...localScope, capabilities: { stores: true } }}
      scopes={[localScope]}
      loading
      loadingReason="store-setup"
      health={{ status: 'ok', label: 'Healthy' }}
      onSelectScope={vi.fn()}
      onRegisterStore={vi.fn()}
      onSetupStore={vi.fn()}
    />
  );

  expect(screen.getByRole('status')).toHaveTextContent(/setting up|创建|配置/i);
  expect(screen.getByRole('button', { name: /setup|创建/i })).toBeDisabled();
});
```

- [ ] **Step 2: Add i18n keys**

Add to `src/i18n/locales/en.json`:

```json
"scope.switching": "Switching...",
"scope.registeringStore": "Registering store...",
"scope.settingUpStore": "Setting up store...",
"dashboard.staleData": "Showing cached data while refreshing..."
```

Add to `src/i18n/locales/zh-cn.json`:

```json
"scope.switching": "正在切换...",
"scope.registeringStore": "正在注册 store...",
"scope.settingUpStore": "正在创建 store...",
"dashboard.staleData": "正在刷新，当前显示缓存数据..."
```

- [ ] **Step 3: Dispatch pending states for setup/register**

In `Dashboard.tsx`:

```tsx
const handleRegisterStore = useCallback(() => {
  dispatch({ type: 'START_LOADING', reason: 'store-register' });
  postMessage(sendMessage.requestRegisterStore());
}, [dispatch, postMessage]);

const handleSetupStore = useCallback(() => {
  dispatch({ type: 'START_LOADING', reason: 'store-setup' });
  postMessage(sendMessage.requestSetupStore());
}, [dispatch, postMessage]);
```

- [ ] **Step 4: Render stale indicator**

Near the dashboard header or scope bar:

```tsx
{state.stale && (
  <div role="status" className="text-xs" style={{ color: 'var(--vscode-descriptionForeground)' }}>
    {t('dashboard.staleData')}
  </div>
)}
```

- [ ] **Step 5: Run tests - expect PASS**

Run:

```bash
zsh -c "source ~/.zshrc && rtk pnpm test -- test/webview/components/scopeBar.test.tsx test/webview/components/dashboard.test.tsx"
```

Expected: PASS.
