## Context

See `explore.md` for requirement context and product direction. Current implementation already has scope-aware cache under editor extension storage and a dashboard scope/status surface in `src/webview/components/ScopeBar.tsx`. The remaining problems are product polish and state consistency:

- Cache is intentionally outside the project, but the real path is deep and hash-based, so users need first-class entry points.
- Cache size is useful context, but calculating it must not slow dashboard rendering or scope switching.
- The current status card is visually heavy for an IDE sidebar and mixes runtime, scope, health, and activity in one block.
- Webview state can show target-scope cached data while still rendering a `Switching...` activity label.

Relevant boundaries from `docs/ARCHITECTURE.md`:

- Extension host owns filesystem, commands, clipboard, and VS Code UI APIs.
- Webview renders state and sends typed messages.
- `DataManager` remains the application facade for dashboard data.

## Goals / Non-Goals

**Goals:**

- Add discoverable cache management commands and dashboard entry points.
- Expose cache size and file count without blocking dashboard data rendering.
- Redesign the scope/runtime status UI as a compact operational rail.
- Split scope switching from cached refresh so visible activity text always matches visible data.
- Cover behavior with focused extension-host and webview tests.

**Non-Goals:**

- Move cache into the user's OpenSpec project.
- Replace CLI-backed dashboard loading with a file-system fallback.
- Add a full cache browser or per-entry cache editor.
- Change OpenSpec CLI store/workset semantics.

## Decisions

### 1. Keep cache in extension storage, expose actions instead of moving it

The cache root stays under VS Code/Cursor extension global storage and remains isolated from the user's project. `OpenSpecCacheService` should expose a small management API:

- `getCacheRoot(): vscode.Uri`
- `getStats(options?): Promise<CacheStats>`
- `clearAll(): Promise<CacheStats>`
- `markStatsDirty(): void`

Command handlers should expose:

- `openspec.openCacheFolder`
- `openspec.copyCachePath`
- `openspec.clearCache`
- `openspec.showCacheDetails`

Alternative considered: create a project-local cache directory. Rejected because it violates the existing extension-cache spec and would add files to user repos.

### 2. Compute cache stats asynchronously with TTL and dirty invalidation

Cache stats should be calculated in the extension host by walking only the OpenSpec cache root. The service should keep:

- last successful stats snapshot
- last calculation timestamp
- one in-flight calculation promise
- a dirty flag set after cache writes, clears, or invalidations

Suggested behavior:

```text
request stats
  |
  | cached snapshot fresh and not dirty
  v
return snapshot immediately

request stats
  |
  | stale, dirty, or missing
  v
return calculating state for active scans + start/reuse async scan
  |
  v
post updated stats to webview when scan completes
```

Alternative considered: maintain a manifest updated on every cache write. Rejected for this change because a bounded root walk with TTL is simpler, safer, and enough for the expected cache size. A manifest can be added later if stats become expensive.

### 3. Use typed webview messages for cache stats and actions

The webview must not access the filesystem directly. Add message types in `src/webview/types/messages.ts` and matching handlers in `src/extension/providers/webviewMessageHandler.ts`.

```text
Dashboard / ScopeBar
  | postMessage: getCacheStats
  v
webviewMessageHandler
  | OpenSpecCacheService.getStats()
  v
postMessage: cacheStats

Dashboard / Cache menu
  | postMessage: cacheAction(openFolder/copyPath/clear/showDetails)
  v
webviewMessageHandler
  | command/service action
  v
postMessage: cacheActionResult + cacheStats
```

`DashboardProvider` may include cache stats in initial payload when already available, but dashboard rendering must not wait for stats.

### 4. Model dashboard activity as explicit phases

The current `loadingReason` model is too coarse for scope switching with stale target data. Replace or extend it with a small activity state that can represent the visible truth:

```ts
type DashboardActivity =
  | { kind: 'idle' }
  | { kind: 'scope-switch'; targetScopeId: string }
  | { kind: 'cached-refresh'; scopeId: string }
  | { kind: 'manual-refresh' }
  | { kind: 'scope-action'; action: 'setup' | 'register' }
  | { kind: 'warning'; message: string };
```

Required transition:

```text
select target scope
  -> scope-switch(target)

receive target cached data with stale=true
  -> display target data
  -> cached-refresh(target)

receive target fresh data
  -> display target data
  -> idle

fresh refresh fails after target cache is visible
  -> keep target cached data
  -> warning/stale state
```

Alternative considered: only change the text in `ScopeBar` based on `isStale`. Rejected because the reducer would still allow contradictory pending state and duplicate-action behavior.

### 5. Redesign `ScopeBar` as a compact operational rail

Keep `ScopeBar` as the component integration point to minimize churn, but change its visual structure from a filled card to a compact rail:

```text
+------------------------------------------------+
| CLI Installed        [aihelp-workspace v]      |
| ● Healthy   ↻ Cached refresh   Cache 12 KB ... |
+------------------------------------------------+
```

Product rules:

- Use small chips, inline labels, and VS Code theme tokens.
- Keep status text visible; color is supportive only.
- Scope selector remains the primary interactive control.
- Cache summary is an action chip/menu with tooltip/accessibility labels.
- In narrow widths, long scope/cache labels truncate without horizontal overflow.

Alternative considered: move cache actions to settings only. Rejected because the dashboard is where users notice stale or cached data, so it should provide the fastest path to inspect or clear cache.

## Risks / Trade-offs

- Cache stat scan may still be slow on unusually large cache roots -> bound scan to the cache root, reuse in-flight scans, add TTL, and never block dashboard content on stats.
- Clearing cache while a refresh is in flight can produce stale messages -> mark stats dirty, ignore older cacheStats responses by request id or timestamp, and trigger a fresh dashboard refresh after successful clear.
- Status reducer changes can regress existing loading states -> add tests for manual refresh, scope switch, cached refresh, failure, setup, and register.
- Compact rail may hide long scope names -> use truncation with title/tooltip and keyboard-accessible selector labels.
- Commands differ slightly across VS Code and Cursor -> implement via VS Code extension APIs (`env.clipboard`, `commands.executeCommand('revealFileInOS')` or `vscode.openFolder`-safe equivalent) and test command registration separately from OS behavior.

## Migration Plan

1. Add cache stats/action API while preserving existing cache file layout.
2. Add command contributions and extension command handlers.
3. Add webview message types and handlers.
4. Add the new activity state and reducer transitions while mapping existing refresh events into the new phases.
5. Replace `ScopeBar` presentation with the compact rail and cache action entry.
6. Keep old cache files valid; no migration is required.

Rollback strategy: revert the rail/messages/activity changes. Existing cache files remain compatible because this change does not alter cache schema.

## Open Questions

None. The current product direction is sufficient for implementation.

## Spec Amendments

No amendments required.
