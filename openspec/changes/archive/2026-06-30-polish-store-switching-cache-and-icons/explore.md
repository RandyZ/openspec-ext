<!-- Exploration output for openspec/changes/polish-store-switching-cache-and-icons/explore.md - input for proposal, not the contract. -->

## Clarified requirements and constraints

This change polishes the multi-store dashboard experience after the initial store-aware implementation. The user-reported issues are:

- Switching between `Local Root` and registered stores has no visible loading feedback, so users cannot tell whether the selection was accepted or whether the extension is stuck.
- The copy icon next to the change name in the detail panel renders as an empty square in Cursor/VS Code webviews.
- Dashboard and detail data should feel faster and more resilient when revisiting a workspace or switching scopes; the current cache is memory-only and not persistent.

The implementation must stay scoped to the OpenSpec VS Code/Cursor extension:

- Extension host is TypeScript running in Node.js.
- Webview is React + Tailwind, bundled by Vite and loaded through VS Code webview resource URIs.
- CLI data remains the source of truth. Cache may improve perceived speed but must not silently override fresh OpenSpec CLI results.
- Multi-store data must be keyed by scope. A local root and a store can have identical change names, spec names, or task files.
- Persistent cache must not be written into the user project by default. It should use VS Code extension storage to avoid polluting repositories or risking accidental commits.
- UI text must continue to use the existing i18n system.
- Existing dirty user work must not be reverted.

## Agreed design direction

Use a "stale while refresh" experience for scope switching and dashboard reloads.

The dashboard should keep the last known data visible, immediately show a small loading indicator near the scope selector, disable duplicate scope actions, then replace the displayed data when the extension host returns the selected scope's data. If switching fails, the UI should recover gracefully and surface the error instead of leaving the dashboard in an ambiguous state.

For icon rendering, move small action icons away from webfont-dependent Codicons in the webview. The blank square indicates that the codicon font is not reliably available in the webview environment, and the current CSP also lacks `font-src`. Inline SVG icons or a bundled React icon component are safer for the small `IconButton` surface.

For caching, introduce a scope-aware cache with two layers:

```text
React/webview state
  -> extension host memory cache
      -> persisted warm cache under context.globalStorageUri
          -> OpenSpec CLI and file reads as source of truth
```

The persisted cache should be used to warm the dashboard on activation or panel creation, then a background refresh should reconcile with the CLI. Cache entries should carry metadata such as schema version, workspace root hash, scope id, scope root path, generated time, and extension version so future changes can invalidate safely.

## Options considered

### Option A: only add frontend loading state

Add `SET_LOADING` before `selectScope`, show a spinner in `ScopeBar`, and leave caching and icons untouched.

Trade-off: This is the smallest fix for the switching feedback issue, but it leaves the blank icon bug and repeated slow reloads unresolved. It also does not improve multi-store resilience when a CLI call is slow or temporarily fails.

### Option B: fix webview CSP/font asset handling and keep Codicons

Add `font-src ${webview.cspSource}` and adjust Vite/webview asset paths so `index.ttf` resolves through `webview.asWebviewUri`.

Trade-off: This keeps the existing icon class API, but it keeps depending on a webfont asset pipeline that is easy to break in VS Code webviews. It also fixes only the icon symptom, not the broader data experience.

### Option C: polish switching, use inline icons, and add scope-aware extension storage cache

Add explicit scope switching/loading state, replace fragile font icons in `IconButton`, and introduce a scoped cache service backed by VS Code extension storage.

Trade-off: This is the broadest change, but it addresses all three user-facing problems together and aligns with the multi-project mode's product expectations. It keeps implementation risk manageable by limiting persistence to dashboard/detail snapshots and leaving the CLI as source of truth.

Selected option: Option C.

## Key decisions

- Scope switching should be visibly pending immediately after the user chooses a different scope.
- The previous dashboard data should stay visible while a selected scope refresh is in flight, with a subtle stale/loading treatment instead of a full blank state.
- Store setup/register actions should also trigger loading feedback and refresh the dashboard after completion.
- The webview should not depend on codicon webfont rendering for critical action icons. `IconButton` should render stable inline SVG icons or a bundled icon component.
- Persistent cache should live under `ExtensionContext.globalStorageUri`, not under the user project.
- Cache keys must include workspace identity and scope identity.
- Cache reads are allowed for fast warm starts, but fresh CLI/file data remains authoritative.
- Cache invalidation must happen after data-mutating actions and relevant file watcher events.
- Tests should cover reducer/loading behavior, `ScopeBar` loading UI, `IconButton` rendering, cache read/write/invalidation, and scope-aware cache isolation.
