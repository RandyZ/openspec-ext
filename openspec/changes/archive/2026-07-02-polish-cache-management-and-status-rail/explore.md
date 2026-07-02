<!-- Exploration output for openspec/changes/polish-cache-management-and-status-rail/explore.md — input for proposal, not the contract. -->

## Clarified requirements and constraints

The current dashboard has three related problems:

- Cache files are stored correctly outside the project, but the cache path is deep and hash-based under editor extension storage. Users need a clear way to find, inspect, and clear it from the extension UI/commands.
- Cache size should be visible because persistent cache can otherwise feel opaque. The size calculation must not block dashboard rendering or make scope switching slower.
- The current scope/runtime status card is visually too heavy for an IDE sidebar. It reads like a content card instead of a compact operational status surface.
- The activity state can become inconsistent: cached data for the target scope may be visible while the status still says `Switching...`. The UI needs to distinguish "switching to a scope" from "showing cached data while fresh data refreshes".

Constraints:

- Keep cache under VS Code/Cursor extension global storage, not under the user's project.
- Do not expose hash-only paths as the primary UX; provide actions such as open folder/copy path instead.
- Keep the sidebar compact and readable in narrow widths.
- Preserve accessibility: status should not rely only on color, and icon-only controls need labels/tooltips.
- Use existing extension host + webview messaging patterns, i18n, and VS Code command/settings contribution patterns.
- Avoid expensive synchronous filesystem scans on dashboard render.

## Agreed design direction

Use a compact two-line status rail instead of the current filled status card:

```text
CLI Installed      aihelp-workspace ▾
● Healthy          ↻ Showing cached · Cache 12 KB
```

The first line identifies runtime and selected scope. The second line shows health, activity, and cache status. Cache status becomes a small actionable chip/menu rather than hidden knowledge.

Cache management should expose:

- `OpenSpec: Open Cache Folder`
- `OpenSpec: Copy Cache Path`
- `OpenSpec: Clear Cache`
- `OpenSpec: Show Cache Details`

Dashboard should also surface a lightweight cache summary such as `Cache 12 KB · 4 files` when available. The extension host should calculate cache stats asynchronously, cache the stats briefly, and refresh them after cache writes or clears.

The status state model should become:

```text
IDLE
  │ select scope
  ▼
SWITCHING(targetScope)
  │ target cached dashboard arrives
  ▼
REFRESHING_CACHED(scope)
  │ fresh dashboard arrives
  ▼
IDLE
```

If fresh loading fails while cached data is visible, the rail should keep the cached-data state visible and show a warning/error instead of returning to a misleading switching state.

## Key decisions

- Selected approach: compact operational rail plus cache action chip/menu.
- Cache size should be computed in the extension host, not in the webview, because the webview cannot directly read extension storage and should stay UI-only.
- Cache stat calculation should be bounded to the extension cache root and performed asynchronously with a short TTL/debounce.
- `Switching...` should only describe the time before target-scope data is shown. Once target-scope cached data is displayed, the copy should change to "Showing cached data while refreshing" or equivalent localized text.
- Settings/command palette should provide clear cache access because the actual storage path is editor-specific and deeply nested.
- The visual treatment should use VS Code theme tokens and small chips/labels, not a large blue card.
