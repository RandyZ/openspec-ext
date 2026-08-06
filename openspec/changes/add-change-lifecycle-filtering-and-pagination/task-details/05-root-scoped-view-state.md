# Task Detail 05: Root-Scoped View State

## Objective

防止 Local Root 和 Store Root 共用同一套筛选、搜索和分页状态。

## State Shape

```ts
export interface PersistedDashboardState {
  changesViews?: Record<string, ChangesViewState>;
}
```

## Stable Root Key

```ts
export function getChangesViewRootKey(scope: OpenSpecScopeView): string {
  return [
    scope.source,
    scope.id,
    scope.storeId ?? '',
    scope.rootPath,
  ].join('::');
}
```

## Default State

```ts
{
  lifecycleStatus: 'all',
  attentionOnly: false,
  query: '',
  sort: 'updated-desc',
  page: 1,
  pageSize: 10
}
```

## Lifecycle

```text
dashboard opens
→ get vscode state
→ resolve current root key
→ restore state or defaults

state changes
→ update current root entry
→ vscode.setState

scope switching
→ current root entry already persisted
→ resolve target root key
→ restore target state
→ clamp page after target data arrives
```

## Race Handling

When scope changes while data is refreshing:

- view state is keyed by the selected target root;
- old scope data must not cause target state to be clamped;
- clamp only when data and scope id match.

## Tests

- Local Applying/page 2 and Store Ready to Verify/page 1 stay independent.
- Reload restores both.
- New Root uses defaults.
- Removed Root state is harmless.
- Refresh reducing item count clamps page.
- Stale old-root response does not mutate target-root state.

## Done When

Switching roots restores each root's last Changes view without cross-contamination.
