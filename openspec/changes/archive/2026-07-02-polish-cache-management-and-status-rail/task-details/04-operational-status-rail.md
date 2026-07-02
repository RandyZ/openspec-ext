# Task 4. Operational Status Rail

<!-- covers: Task 4.1, Task 4.2, Task 4.3 -->

### Task 4.1: Add status rail rendering and accessibility tests

**Spec coverage:** dashboard / Operational status rail / Rail shows normal runtime status, Rail adapts to narrow sidebar width, Rail exposes cache entry, Rail uses accessible activity copy

**Files:**
- Modify: `test/webview/components/scopeBar.test.tsx`
- Test: `test/webview/components/scopeBar.test.tsx`

- [ ] **Step 1: Add compact rail test**

Add this test to `test/webview/components/scopeBar.test.tsx`:

```ts
  it('renders a compact operational rail instead of a heavy card', () => {
    const html = renderToStaticMarkup(
      <ScopeBar
        scope={storeScope}
        scopes={[localScope, storeScope]}
        health={{ status: 'ok', label: 'Healthy' }}
        loading={false}
        cacheStats={{
          rootPath: '/tmp/openspec-cache',
          totalBytes: 12288,
          formattedSize: '12.0 KB',
          fileCount: 4,
          calculatedAt: 1,
          isCalculating: false,
        } as any}
        onSelectScope={vi.fn()}
        onCacheAction={vi.fn()}
      />,
    );

    expect(html).toContain('Local Source');
    expect(html).toContain('team-plans');
    expect(html).toContain('Healthy');
    expect(html).toContain('Cache 12.0 KB');
    expect(html).toContain('aria-label="Cache actions"');
    expect(html).not.toContain('editor-inactiveSelectionBackground');
  });
```

- [ ] **Step 2: Add cache action menu test**

Add:

```ts
  it('renders accessible cache action controls', () => {
    const html = renderToStaticMarkup(
      <ScopeBar
        scope={localScope}
        scopes={[localScope]}
        loading={false}
        cacheStats={{
          rootPath: '/tmp/openspec-cache',
          totalBytes: 0,
          formattedSize: '0 B',
          fileCount: 0,
          calculatedAt: 1,
          isCalculating: false,
        } as any}
        onSelectScope={vi.fn()}
        onCacheAction={vi.fn()}
      />,
    );

    expect(html).toContain('Open Folder');
    expect(html).toContain('Copy Path');
    expect(html).toContain('Clear Cache');
    expect(html).toContain('aria-label="Open cache folder"');
    expect(html).toContain('aria-label="Copy cache path"');
    expect(html).toContain('aria-label="Clear cache"');
  });
```

- [ ] **Step 3: Add narrow label contract test**

Add:

```ts
  it('uses truncation classes for long scope and cache labels', () => {
    const longScope = {
      ...storeScope,
      id: 'store:very-long-team-workspace-name-for-sidebar',
      label: 'very-long-team-workspace-name-for-sidebar',
    };
    const html = renderToStaticMarkup(
      <ScopeBar
        scope={longScope}
        scopes={[localScope, longScope]}
        health={{ status: 'ok', label: 'Healthy' }}
        loading={false}
        cacheStats={{
          rootPath: '/tmp/openspec-cache',
          totalBytes: 1048576,
          formattedSize: '1.0 MB',
          fileCount: 120,
          calculatedAt: 1,
          isCalculating: false,
        } as any}
        onSelectScope={vi.fn()}
        onCacheAction={vi.fn()}
      />,
    );

    expect(html).toContain('min-w-0');
    expect(html).toContain('truncate');
  });
```

- [ ] **Step 4: Run tests and confirm failure**

Run:

```bash
rtk zsh -c 'source ~/.zshrc && rtk pnpm exec vitest run test/webview/components/scopeBar.test.tsx'
```

Expected: FAIL because `cacheStats`, `onCacheAction`, and compact rail markup are not implemented.

---

### Task 4.2: Refactor ScopeBar into a compact operational rail

**Spec coverage:** dashboard / Operational status rail / Rail shows normal runtime status, Rail adapts to narrow sidebar width, Rail uses accessible activity copy; dashboard / Scope transition feedback / Target cached data arrives during scope switch

**Files:**
- Modify: `src/webview/components/ScopeBar.tsx`
- Modify: `src/webview/components/Dashboard.tsx`
- Test: `test/webview/components/scopeBar.test.tsx`

- [ ] **Step 1: Extend ScopeBar props**

In `src/webview/components/ScopeBar.tsx`, update imports:

```ts
import type { CacheAction, CacheStatsView, LoadingReason, OpenSpecScopeView } from '../types/messages';
import type { DashboardActivity } from '../context/AppContext';
```

Extend `ScopeBarProps`:

```ts
  activity?: DashboardActivity;
  cacheStats?: CacheStatsView | null;
  cacheActionMessage?: string | null;
  onCacheAction?: (action: CacheAction) => void;
```

- [ ] **Step 2: Replace pending label helper**

Replace `pendingLabel` with:

```ts
function activityLabel(activity: DashboardActivity | undefined, reason?: LoadingReason): string | undefined {
  if (activity?.kind === 'cached-refresh') return t('dashboard.staleData');
  if (activity?.kind === 'manual-refresh') return t('dashboard.refreshing');
  if (activity?.kind === 'warning') return activity.message;
  if (activity?.kind === 'scope-action' && activity.action === 'register') return t('scope.registeringStore');
  if (activity?.kind === 'scope-action' && activity.action === 'setup') return t('scope.settingUpStore');
  if (activity?.kind === 'scope-switch') return t('scope.switching');
  if (reason === 'scope-switch') return t('scope.switching');
  if (reason === 'store-register') return t('scope.registeringStore');
  if (reason === 'store-setup') return t('scope.settingUpStore');
  if (reason === 'refresh') return t('dashboard.refreshing');
  return undefined;
}

function cacheSummary(stats?: CacheStatsView | null): string {
  if (!stats) return t('cache.statsUnavailable');
  if (stats.isCalculating) return t('cache.statsCalculating');
  if (stats.error) return t('cache.statsUnavailable');
  return t('cache.summary', {
    size: stats.formattedSize,
    files: String(stats.fileCount),
  });
}
```

- [ ] **Step 3: Update component destructuring and pending state**

In `ScopeBar`, destructure new props:

```ts
  activity,
  cacheStats,
  cacheActionMessage,
  onCacheAction,
```

Replace `const statusLabel = loading ? pendingLabel(loadingReason) : undefined;` with:

```ts
  const statusLabel = loading ? activityLabel(activity, loadingReason) : activityLabel(activity, undefined);
  const disableScopeActions =
    activity?.kind === 'scope-switch'
    || activity?.kind === 'scope-action'
    || loadingReason === 'scope-switch'
    || loadingReason === 'store-register'
    || loadingReason === 'store-setup';
```

Use `disabled={disableScopeActions}` for the selector and store action buttons.

- [ ] **Step 4: Replace the top-level status card markup**

Replace the top-level `<section>` start and first status row with this compact rail:

```tsx
    <section
      className="mb-3 border-y py-2 text-xs"
      style={{ borderColor: 'var(--vscode-panel-border)' }}
    >
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex min-w-0 items-center justify-between gap-2">
          <span className="shrink-0" style={{ color: 'var(--vscode-descriptionForeground)' }}>
            {runtimeLabel(scope.runtimeSource)}
          </span>

          <div className="min-w-0 flex-1 text-right">
            {showSelector ? (
              <select
                disabled={disableScopeActions}
                value={scope.id}
                onChange={(event) => onSelectScope(event.currentTarget.value)}
                aria-label="OpenSpec scope"
                className="max-w-full rounded border px-1 py-0.5 text-xs"
                style={{
                  borderColor: 'var(--vscode-dropdown-border)',
                  background: 'var(--vscode-dropdown-background)',
                  color: 'var(--vscode-dropdown-foreground)',
                }}
              >
                {scopes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            ) : (
              <strong className="block truncate" title={scope.label}>{scope.label}</strong>
            )}
          </div>
        </div>

        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
          {health && (
            <span className="inline-flex shrink-0 items-center gap-1" title={health.label}>
              <span aria-hidden="true" style={{ color: healthColor(health.status) }}>●</span>
              <span>{healthLabel(health.status)}</span>
            </span>
          )}

          {statusLabel && (
            <span
              role="status"
              aria-live="polite"
              className="inline-flex min-w-0 items-center gap-1"
              style={{ color: 'var(--vscode-descriptionForeground)' }}
            >
              {loading && <span className="h-3 w-3 shrink-0 animate-spin rounded-full border border-current border-t-transparent" />}
              <span className="truncate">{statusLabel}</span>
            </span>
          )}

          {onCacheAction && (
            <details className="relative min-w-0">
              <summary
                className="cursor-pointer list-none truncate rounded px-1 py-0.5"
                aria-label={t('cache.menuLabel')}
                title={cacheStats?.rootPath}
                style={{
                  background: 'var(--vscode-button-secondaryBackground)',
                  color: 'var(--vscode-button-secondaryForeground)',
                }}
              >
                {cacheSummary(cacheStats)}
              </summary>
              <div
                className="mt-1 flex flex-wrap gap-1 rounded border p-1"
                style={{
                  borderColor: 'var(--vscode-panel-border)',
                  background: 'var(--vscode-menu-background)',
                }}
              >
                <button type="button" aria-label="Open cache folder" onClick={() => onCacheAction('openFolder')}>{t('cache.openFolder')}</button>
                <button type="button" aria-label="Copy cache path" onClick={() => onCacheAction('copyPath')}>{t('cache.copyPath')}</button>
                <button type="button" aria-label="Clear cache" onClick={() => onCacheAction('clear')}>{t('cache.clear')}</button>
                <button type="button" aria-label="Show cache details" onClick={() => onCacheAction('showDetails')}>{t('cache.openFolder')}</button>
              </div>
            </details>
          )}
        </div>

        {cacheActionMessage && (
          <div role="status" className="truncate" style={{ color: 'var(--vscode-descriptionForeground)' }}>
            {cacheActionMessage}
          </div>
        )}
      </div>
```

Keep the existing no-store and store-unavailable hint block below this rail content, but update its buttons to use `disabled={disableScopeActions}`.

- [ ] **Step 5: Fix show details label**

Add an i18n key in both locales:

```json
  "cache.showDetails": "Show Details"
```

Chinese:

```json
  "cache.showDetails": "查看详情"
```

Change the show details button from `t('cache.openFolder')` to:

```tsx
{t('cache.showDetails')}
```

- [ ] **Step 6: Run ScopeBar tests**

Run:

```bash
rtk zsh -c 'source ~/.zshrc && rtk pnpm exec vitest run test/webview/components/scopeBar.test.tsx'
```

Expected: PASS.

---

### Task 4.3: Wire cache actions and stale warnings into the rail UX

**Spec coverage:** dashboard / Dashboard cache management entry / Cache action completes; dashboard / Operational status rail / Rail exposes cache entry; dashboard / Scope transition feedback / Fresh refresh fails after target cached data is visible

**Files:**
- Modify: `src/webview/components/Dashboard.tsx`
- Modify: `src/webview/components/ScopeBar.tsx`
- Modify: `src/i18n/locales/en.json`
- Modify: `src/i18n/locales/zh-cn.json`
- Test: `test/webview/components/dashboard.test.tsx`

- [ ] **Step 1: Pass cache props from Dashboard to ScopeBar**

In `Dashboard.tsx`, pass the state and handler created in Task 2:

```tsx
              cacheStats={cacheStats}
              cacheActionMessage={cacheActionMessage}
              onCacheAction={handleCacheAction}
```

- [ ] **Step 2: Keep stale warning visible but avoid duplicate wording**

Update the stale warning block in `Dashboard.tsx` so it does not duplicate the rail activity text during cached refresh:

```tsx
            {state.stale && activity.kind !== 'cached-refresh' && (
              <div
                role="status"
                className="mb-3 text-xs"
                style={{ color: 'var(--vscode-descriptionForeground)' }}
              >
                {t('dashboard.staleData')}
              </div>
            )}
```

- [ ] **Step 3: Add dashboard render smoke test**

In `test/webview/components/dashboard.test.tsx`, add a smoke test that renders the dashboard after the new `ScopeBar` props are wired. Cache summary rendering is already covered by `scopeBar.test.tsx`; this test protects the dashboard integration point from prop or import regressions.

```ts
  it('renders dashboard with cache-capable status rail props', () => {
    const html = renderDashboardWithData(dashboardData);

    expect(html).toContain('OpenSpec');
    expect(html).toContain('Local Root');
  });
```

- [ ] **Step 4: Run dashboard and ScopeBar tests**

Run:

```bash
rtk zsh -c 'source ~/.zshrc && rtk pnpm exec vitest run test/webview/components/dashboard.test.tsx test/webview/components/scopeBar.test.tsx'
```

Expected: PASS.
