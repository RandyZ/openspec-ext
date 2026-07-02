<!-- Distilled from explore.md saved at openspec/changes/polish-store-switching-cache-and-icons/explore.md -->

## Why

Multi-store support is now visible in the dashboard, but the experience still feels unreliable: switching stores gives no immediate feedback, the change-detail copy icon can render as an empty square, and reloads lose useful data between sessions.

This change improves the perceived reliability of the multi-project workflow by making scope transitions explicit, removing fragile webfont icon rendering from critical actions, and adding scope-aware cache storage outside the user's repository.

## What Changes

- Add visible loading feedback when users switch OpenSpec scopes or run store setup/register actions from the dashboard.
- Keep existing dashboard data visible while a scope refresh is pending, then replace it when the selected scope data is ready.
- Render webview action icons, including the change-name copy icon, through stable bundled icons instead of depending on Codicon font loading.
- Add a scope-aware cache layer backed by VS Code extension storage, not by a directory in the user project.
- Warm dashboard/detail views from valid cache when available, then reconcile with fresh CLI/file data in the background.
- Invalidate scoped cache after data-mutating actions and relevant file watcher events.
- Add tests for loading state, icon rendering, cache persistence, cache invalidation, and scope isolation.

No breaking changes are expected.

## Capabilities

### New Capabilities

- `extension-cache`: Covers extension-owned persistent cache stored outside user repositories, including scope-aware keys, stale metadata, warm-start behavior, and invalidation rules.

### Modified Capabilities

- `dashboard`: Add scope switching loading feedback, stale-while-refresh behavior, and cache-aware dashboard rendering.
- `artifact-viewing`: Ensure change detail action icons render reliably and remain accessible in VS Code/Cursor webviews.

## Impact

- Webview state/reducer code for loading modes and scope selection.
- `ScopeBar` UI and i18n strings for switching/register/setup pending states.
- `IconButton` and related tests for stable icon rendering.
- `DataManager` and/or a new extension-host cache service for memory and persistent cache coordination.
- Dashboard and change detail webview message flow to support cached warm starts and background refreshes.
- `DashboardViewProvider` and activation wiring to pass VS Code storage locations where cache services need them.
- Tests under `test/webview` and `test/extension` covering the new behavior.
