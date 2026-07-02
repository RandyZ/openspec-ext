<!-- Distilled from brainstorm.md saved at openspec/changes/<change>/brainstorm.md -->

## Why

The new status rail clarified runtime health, but root/store/cache interactions still feel ambiguous. Users cannot tell whether they are switching OpenSpec roots, opening a workspace mode, or filtering cached data, and the cache menu disrupts the compact rail layout.

## What Changes

- Keep the cache summary visually stable in the status rail and move cache operations into a menu or popover that does not change the rail's layout height.
- Treat cache statistics as extension-cache-root statistics. Do not force a full cache stat recalculation merely because the selected OpenSpec root changes.
- Rename and present the scope selector as an `OpenSpec Root` selector, with labels that distinguish `Local Root` from `Store: <id>`.
- Ensure active changes, archived changes, and specs are all scoped consistently to the selected OpenSpec root.
- Add clearer empty states that name the selected root, so users understand why a store or local root has no active changes/specs.
- Add a compact `Stores & Worksets` management panel that lists registered stores, references, and personal worksets, with actions for common maintenance flows.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `dashboard`: Clarify root/store/workset presentation, scope archived content consistently, add Stores & Worksets maintenance UI, and improve root-specific empty states.
- `extension-cache`: Keep cache summary stable, expose cache actions without changing rail layout, and avoid unnecessary global cache-stat recalculation during root switches.

## Impact

- Webview:
  - `ScopeBar` cache menu behavior and root selector labeling.
  - `Dashboard` root-specific empty states, archived scope handling, cache stats refresh triggers, and Stores & Worksets panel placement.
  - Existing `WorksetsPanel` may be expanded or replaced by a richer Stores & Worksets surface.
- Extension host:
  - Webview message handlers for archived changes must honor the selected `scopeId`.
  - DataManager or adjacent services may expose registered store and workset data to the webview.
  - Cache stat requests should avoid forced recalculation on root switching unless cache content was mutated or explicitly requested.
- i18n:
  - New strings for `OpenSpec Root`, store/root labels, root-scoped empty states, and Stores & Worksets actions.
- Tests:
  - Webview rendering tests for stable cache menu layout and root selector labels.
  - Reducer/message tests for cache stats not being forced on root switch.
  - Extension handler tests for scoped archived changes.
  - Dashboard tests for Stores & Worksets panel data and empty-state copy.
