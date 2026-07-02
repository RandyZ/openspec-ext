<!-- Exploration output for openspec/changes/clarify-root-store-and-cache-ux/explore.md — input for proposal, not the contract. -->

## Clarified requirements and constraints

The current dashboard status rail and scope selector create four product problems:

- Cache actions are rendered inline when expanded, which changes the height and rhythm of the compact status rail. The rail stops feeling like a stable operational summary and becomes a button row.
- Cache statistics are described as extension cache usage, but scope switching can force recalculation. Since the displayed cache summary represents the extension cache root, not the selected OpenSpec root, recalculating on every scope switch is misleading and unnecessary.
- The scope selector currently shows `Local Root` and registered stores such as `aihelp-workspace`, but the UI does not explain that these are different OpenSpec roots. Users can interpret this as a workspace mode or a filter, then become confused when active changes, specs, and archives do not line up.
- Store and workset maintenance is not surfaced as a first-class workflow. Users need a way to see registered stores, inspect health, register/setup stores, and understand worksets without digging through command palette actions.

OpenSpec official stores guidance defines the mental model:

- A store is a standalone OpenSpec planning repo with its own `openspec/specs` and `openspec/changes`.
- A code repo with a real local `openspec/` root remains its own OpenSpec root. A `store:` pointer is fallback, not an override.
- References are read-only upstream context, not the current writable planning root.
- Worksets are personal local views for opening multiple folders together, not shared planning state.
- Commands resolve roots in this order: explicit `--store`, nearest real `openspec/`, `store:` pointer fallback, then store selection guidance.

Current implementation observations:

- `ScopeBar` always renders cache controls inside a `details` block in the rail.
- Dashboard sends `getCacheStats(true)` during manual refresh and after successful cache actions. It should not force stats refresh solely because the selected root changes.
- Dashboard asks for archived changes with a `scopeId`, but the extension message handler currently lists archives without applying that scope. This can make archived changes appear disconnected from the selected root.
- `openspec store list --json`, `openspec context --json`, `openspec doctor --json`, and `openspec workset list --json` provide the data needed for a proper Stores & Worksets panel.

Constraints:

- Keep the dashboard compact for VS Code/Cursor sidebars.
- Preserve VS Code theme tokens and keyboard-accessible controls.
- Do not turn the dashboard into a full store admin application. The first pass should expose the essential maintenance surface.
- Do not change OpenSpec CLI semantics; the extension should mirror official root/store/workset concepts.
- Avoid filesystem reads from the webview. Store/workset/cache actions must go through typed extension-host messages.

## Agreed design direction

Use a clearer hierarchy:

```text
------------------------------------------------+
| Installed CLI                 OpenSpec Root ▾  |
| ● Healthy   Cache 7.3 KB        Cache actions ⋯|
+------------------------------------------------+

Current root content
  Changes
  Archived
  Specs

Stores & Worksets
  Registered stores
  References
  Personal worksets
```

The status rail should stay stable. Cache opens a popover/menu, not an inline expanded row:

```text
Cache 7.3 KB
────────────
Open Folder
Copy Path
Clear Cache
Show Details
```

The selector should be labeled and framed as `OpenSpec Root`, not as workspace mode:

```text
OpenSpec Root
  Local Root
  Store: aihelp-workspace
```

All primary content should follow the selected root:

```text
selected root
   ├─ active changes
   ├─ archived changes
   └─ specs
```

If archived changes cannot be scoped in a given state, the UI must say so explicitly instead of showing them as if they belong to the selected root.

Stores and worksets should become a compact maintenance panel:

```text
Stores & Worksets
  Stores
    aihelp-workspace   /Users/.../aihelp-workspace
    Open · Doctor · Unregister
    + Register Store
    + Setup New Store

  References
    platform-reqs
    Fetch command · health

  Worksets
    No worksets yet
    + Create Workset
```

## Key decisions

- Treat `Local Root` and stores as selectable OpenSpec roots, not as workspace filters.
- Rename or label the selector around `OpenSpec Root` so users know content changes because the writable planning root changed.
- Keep cache statistics global to the extension cache unless a later change introduces per-root cache summaries. Do not force global stats recomputation on root switch.
- Render cache operations in a popover/menu so the rail height and layout do not change when actions are visible.
- Scope active changes, specs, and archived changes consistently to the selected root.
- Add a focused Stores & Worksets panel that surfaces registered stores, references, and personal worksets using official OpenSpec CLI concepts.
- Use empty states that name the selected root, for example `No active changes in Store: aihelp-workspace` or `No specs defined in Local Root`.
