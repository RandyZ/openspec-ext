## Context

See `explore.md` for the problem framing and selected direction. This design turns that direction into implementation structure for three related areas:

- Dashboard scope switching should show an immediate pending state.
- Change detail action icons should not rely on Codicon webfont loading.
- Dashboard and artifact content should support scope-aware warm cache outside the user repository.

Current state:

- `Dashboard.handleSelectScope` sends `selectScope` but does not set frontend loading state first.
- `ScopeBar` accepts a `loading` prop and disables controls, but it does not render a visible spinner or pending label.
- `IconButton` renders `<span className="codicon codicon-*">`, while the webview CSP currently does not include `font-src`; in practice the copy icon can render as an empty square.
- `DataManager` has an in-memory `cachedData` snapshot and in-flight refresh coalescing, but no persisted cache and no per-scope persisted warm start.
- `ChangeDetail` has a per-webview `contentCacheRef`, but it is not persisted and disappears when the webview reloads.

High-level data flow:

```text
User action
  |
  v
React webview state
  |  postMessage
  v
DashboardViewProvider / webviewMessageHandler
  |
  v
DataManager
  |---------> OpenSpecCacheService -> globalStorageUri cache
  |
  v
OpenSpec CLI + file reads
```

## Goals / Non-Goals

**Goals:**

- Show an immediate, visible pending state for scope switching and store setup/register actions.
- Keep previous or cached data visible while fresh data is loading.
- Prevent duplicate scope-affecting clicks during pending operations.
- Replace Codicon font-based `IconButton` rendering with reliable bundled icons.
- Add a scope-aware cache layer that persists under VS Code extension storage.
- Support cached warm starts for dashboard data and artifact content.
- Keep CLI/file reads as the authoritative source of truth.
- Add focused unit tests before implementation changes.

**Non-Goals:**

- Do not introduce a project-level cache directory such as `.openspec-ext-cache`.
- Do not replace OpenSpec CLI as the source of truth.
- Do not redesign the entire dashboard visual layout.
- Do not add remote sync, cross-machine cache sharing, or cache encryption in this change.
- Do not change the OpenSpec CLI contract.

## Decisions

### Decision 1: Represent loading by reason, not only a boolean

Add richer webview loading state:

```ts
type LoadingReason =
  | 'initial'
  | 'refresh'
  | 'scope-switch'
  | 'store-register'
  | 'store-setup'
  | 'background-refresh';

interface AppState {
  loading: boolean;
  loadingReason?: LoadingReason;
  pendingScopeId?: string;
  dataSource?: 'fresh' | 'memory-cache' | 'disk-cache';
  stale?: boolean;
}
```

Scope switching flow:

```text
Scope select changed
  -> reducer START_SCOPE_SWITCH(pendingScopeId)
  -> send selectScope(scopeId)
  -> extension host resolves selected scope
  -> optional cached dashboardData(stale)
  -> fresh dashboardData
  -> reducer SET_DATA clears pending state
```

Rationale: a boolean `loading` cannot distinguish manual refresh from scope switching or store setup. Reasoned loading lets `ScopeBar` show the right microcopy/spinner without blanking the whole dashboard.

Alternative considered: only dispatch the existing `SET_LOADING` action. This fixes basic feedback but cannot express selected scope, stale data, or store setup/register pending states cleanly.

### Decision 2: Use stale-while-refresh rendering

When cached data or previous data exists, do not replace the dashboard with an empty loading state. Instead:

- keep the current data visible;
- show a small spinner in `ScopeBar`;
- dim or annotate the affected dashboard region with a stale/refreshing indicator;
- replace data when fresh results arrive.

Rationale: multi-store switching can involve CLI latency. Keeping context visible is calmer and avoids the false impression that the workspace has no changes.

Alternative considered: full-page spinner. This is simpler but makes slow CLI calls feel like the dashboard disappeared.

### Decision 3: Add an extension-host cache service

Introduce `OpenSpecCacheService` in the extension host. It should be constructed with `context.globalStorageUri` and passed into `DataManager`.

Suggested API:

```ts
interface CacheEnvelope<T> {
  schemaVersion: 1;
  extensionVersion: string;
  workspaceHash: string;
  workspaceRoot: string;
  scopeId: string;
  scopeRootPath: string;
  dataKind: 'dashboard' | 'artifact-content';
  generatedAt: number;
  payload: T;
}

class OpenSpecCacheService {
  readDashboard(scope: ScopeInfo): Promise<CachedValue<DashboardData> | undefined>;
  writeDashboard(scope: ScopeInfo, data: DashboardData): Promise<void>;
  readArtifactContent(key: ArtifactCacheKey): Promise<CachedValue<string> | undefined>;
  writeArtifactContent(key: ArtifactCacheKey, content: string): Promise<void>;
  invalidateScope(scope: ScopeInfo): Promise<void>;
  invalidateArtifact(key: ArtifactCacheKey): Promise<void>;
}
```

Cache key inputs:

- normalized workspace root;
- scope id;
- scope root path;
- data kind;
- change name for artifact content;
- artifact type and spec id when applicable.

Persisted path shape:

```text
globalStorageUri/
  openspec-cache/
    v1/
      <workspaceHash>/
        <scopeHash>/
          dashboard.json
          artifacts/
            <artifactHash>.json
```

Rationale: VS Code extension storage avoids repository pollution and accidental commits. Scope-aware keys prevent same-name changes from different stores from colliding.

Alternative considered: create a cache directory in the project. Rejected because it pollutes repos and becomes risky in multi-store/team projects.

### Decision 4: Post cached data before fresh data

`DashboardViewProvider.postInitialDashboardData` should first ask `DataManager` for a warm cache, post it with stale metadata when present, then trigger normal refresh.

Message shape can remain compatible by adding optional metadata:

```ts
{
  type: 'dashboardData',
  data,
  debug,
  cache?: {
    source: 'memory' | 'disk' | 'fresh';
    stale: boolean;
    generatedAt?: number;
  }
}
```

For scope switching, the extension host should do the same for the target scope:

```text
selectScope(scopeId)
  -> resolve target scope
  -> post target-scope cached data if available
  -> refresh target scope
  -> post fresh data
```

Rationale: this preserves the existing `dashboardData` message path while giving the frontend enough information to show stale indicators.

Alternative considered: create separate `cachedDashboardData` and `freshDashboardData` message types. This is more explicit but increases reducer/message duplication.

### Decision 5: Cache artifact content in the extension host

Keep `ChangeDetail`'s in-memory `contentCacheRef` only as a webview-local optimization, but add extension-host cache for artifact content.

For `getArtifactContent`, `getDeltaSpecContent`, and related detail reads:

```text
webview requests artifact content
  -> extension host posts cached content if available with stale metadata
  -> extension host reads file from selected scope
  -> extension host writes cache
  -> extension host posts fresh content
```

Rationale: detail panels benefit from warm cache after webview reloads, while file reads remain authoritative.

Alternative considered: persist only dashboard snapshots. That would miss the user's detail-loading pain and leave `ChangeDetail` dependent on per-webview memory only.

### Decision 6: Render IconButton with bundled SVG icons

Replace the Codicon class string with a small typed icon map:

```tsx
type IconName = 'copy' | 'check' | 'refresh' | 'go-to-file';

function IconGlyph({ name }: { name: IconName }) {
  return iconMap[name];
}
```

`IconButton` should keep:

- `aria-label`;
- `title`;
- tooltip;
- stable button dimensions;
- keyboard focus ring.

Rationale: inline SVGs do not require font loading, CSP `font-src`, or Vite font asset rewriting. The action remains visible in both VS Code and Cursor webviews.

Alternative considered: fix CSP and Vite font asset paths for Codicons. This may help, but it keeps a fragile font dependency for a very small icon surface.

## Risks / Trade-offs

- Cache shows stale data too convincingly -> show stale/refreshing metadata whenever data source is not fresh.
- Cache schema changes later -> include `schemaVersion` and ignore incompatible entries.
- Scope key collisions -> hash normalized workspace root, scope id, and scope root path together.
- Refresh failure after cached warm start -> preserve cached data and show a warning rather than writing failed data.
- More tests need updated mocks because `DataManager` gains a cache dependency -> make the cache service optional or provide a small in-memory fake in tests.
- Inline SVG map grows over time -> keep the first map intentionally small and typed; add icons only when `IconButton` users need them.

## Migration Plan

1. Add tests for the current missing behaviors:
   - scope select starts pending state;
   - `ScopeBar` renders spinner/disabled controls;
   - `IconButton` renders SVG and not Codicon font classes;
   - cache service stores outside workspace and isolates scopes;
   - provider posts cached data before fresh data.
2. Add `OpenSpecCacheService` with v1 envelope format and temp-directory based tests.
3. Wire the cache service from `activate(context)` into `DataManager`.
4. Extend `DataManager`/provider message flow to support warm dashboard data and background refresh.
5. Extend artifact content read paths to use cached content before fresh file reads.
6. Update webview reducer and components for reasoned loading and stale indicators.
7. Replace `IconButton` internals with bundled SVG icons.
8. Run `pnpm test` and `pnpm run build`.
9. Package a VSIX for manual verification in Cursor after tests pass.

Rollback strategy: because cache is additive and stored under versioned extension storage, rollback is safe. Older builds will ignore the cache directory. If a cache bug is found, disable cache reads while keeping fresh CLI/file paths intact.

## Open Questions

None blocking.

Implementation should choose conservative UI copy from existing i18n patterns and keep cache TTL simple for v1: schema-compatible cache may be shown as stale warm data, and fresh refresh must always run immediately.

## Spec Amendments

- Capability: `extension-cache`
  - Finding: proposal and design both include detail artifact warm cache, but the initial spec only made dashboard warm start explicit.
  - Resolution: [x] updated `specs/extension-cache/spec.md` with `Artifact content cache`.
