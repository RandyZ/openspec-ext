## Context

See `explore.md` for the product reasoning and official OpenSpec root/store/workset mental model. This design focuses on implementation boundaries for the VS Code extension.

Current implementation already has most primitives:

- `OpenSpecScopeManager` loads the local root plus registered store scopes from `openspec store list --json`.
- `Dashboard` sends `scopeId` for most scope-bound operations and requests cache statistics independently.
- `DataManager.listArchivedChanges(scope?)` already accepts a scope, but `webviewMessageHandler` currently drops `message.scopeId` in the `getArchivedChanges` branch.
- `ScopeBar` renders cache actions inside an inline `details` block, which reflows the compact status rail.
- `ReferencesPanel` and `WorksetsPanel` exist, but store/reference/workset maintenance is split and incomplete.

Target architecture:

```text
Webview Dashboard
  |-- ScopeBar
  |    |-- OpenSpec Root selector
  |    `-- stable cache summary + overlay menu
  |
  |-- Changes / Archived / Specs
  |    `-- selected scopeId for all root-scoped requests
  |
  `-- StoresAndWorksetsPanel
       |-- registered stores
       |-- read-only references
       `-- personal worksets

Extension Host
  |-- webviewMessageHandler
  |    |-- resolveScopeRoot(message.scopeId)
  |    `-- route scoped archive/store/workset/cache messages
  |
  `-- DataManager
       |-- OpenSpecScopeManager
       |-- scope-aware StateReader / ContentAccess
       `-- OpenSpecCacheService
```

## Goals / Non-Goals

**Goals:**

- Keep the status rail stable when users open cache actions.
- Make the selector explicitly represent an `OpenSpec Root`.
- Ensure changes, archived changes, and specs all follow the selected root.
- Stop forced cache-stat recalculation from being coupled to root switching.
- Provide a compact Stores and Worksets maintenance surface using existing CLI-backed extension-host services.
- Add tests around the affected message contracts and UI behavior before implementation.

**Non-Goals:**

- Implement per-root cache statistics.
- Change OpenSpec CLI root resolution semantics.
- Build a full store administration console.
- Add a new external dependency.
- Replace existing scope-aware dashboard caching.

## Decisions

### 1. Cache actions use an overlay, not inline `details`

`ScopeBar` will keep the cache summary in the rail and render actions through a positioned menu/popover controlled by React state. The trigger remains a compact focusable control with `aria-haspopup="menu"` and the menu contains `Open Folder`, `Copy Path`, `Clear Cache`, and `Show Details`.

Message flow:

```text
ScopeBar trigger click
  -> local menu open state
  -> action click
  -> Dashboard.handleCacheAction(action)
  -> webview message: cacheAction
  -> extension host action
  -> cacheActionResult
  -> Dashboard requests getCacheStats(force: true) only after success
```

Alternative considered: keep `details` and restyle it. Rejected because the native expanded content still participates in layout and caused the exact rail jump reported in the screenshots.

### 2. Cache statistics remain global extension-cache statistics

`getCacheStats(force?)` continues to report the extension cache root. It is requested on dashboard initial load with `force: false`, after cache mutations with `force: true`, and on explicit dashboard refresh as an intentional user refresh.

Root switching must only request root data:

```text
Root select
  -> selectScope(scopeId)
  -> dashboardData for selected root
  -> spec requirements for selected root
  -> archived changes only when the archive section is expanded
  -> no forced cache-stat scan caused by the root change
```

Alternative considered: compute per-root cache usage. Rejected for this change because existing cache storage is global and the UI copy does not need root-specific numbers. Per-root usage can be added later with a separate data model.

### 3. Selector copy is normalized at the view boundary

The scope model should remain stable: `OpenSpecScopeView.source` continues to carry `local`, `store`, or `declared`, and `storeId` remains the store identity. Presentation labels should be derived in the webview or in a small mapper:

```text
source=local  -> Local Root
source=store  -> Store: <storeId or label>
source=declared -> Declared Root: <label>
```

`ScopeBar` should label the control as `OpenSpec Root` instead of `OpenSpec scope`. Empty states should receive the selected root label so the user sees copy such as `No active changes in Store: aihelp-workspace`.

Alternative considered: rename all internal `scope` types to `root`. Rejected because the codebase already uses `scope` for root identity and scoped caches; a broad rename would add risk without changing behavior.

### 4. Archived changes use the same selected root as active content

`Dashboard` already sends `sendMessage.getArchivedChanges(state.data?.scope?.id)`. The handler must resolve that scope and pass it into `DataManager.listArchivedChanges(scope)`.

Message flow:

```text
Dashboard archive expand
  -> getArchivedChanges(scopeId)
  -> webviewMessageHandler.resolveScopeRoot(scopeId)
  -> DataManager.listArchivedChanges(scope)
  -> StateReader for selected root
  -> archivedChanges(items)
```

The archive response should eventually carry the `scopeId` it belongs to so stale responses can be ignored if users switch roots while a request is in flight. If not added in the first implementation slice, the handler still must stop falling back to the default root.

Alternative considered: hide archives in store roots. Rejected because store roots are standalone OpenSpec planning repos and archived changes should be available when present.

### 5. Stores and Worksets panel composes existing primitives

Create or evolve a `StoresAndWorksetsPanel` that receives:

- `scopes`: registered store roots derived from `OpenSpecScopeView[]`.
- `references`: `relationships.references` from `openspec doctor/context`.
- `worksets`: `DashboardData.worksets`.
- feature diagnostics and pending action state.

No filesystem access is allowed in the webview. Actions are extension-host messages:

```text
Register Store   -> requestRegisterStore
Setup Store      -> requestSetupStore
Open Workset     -> openWorkset(name)
Open/View Store  -> selectScope(storeScopeId)
Doctor Store     -> initially reuse visible health/context data; add explicit message only if needed
Unregister Store -> add only if supported by current CLI and confirmed by tests
```

The panel should show registered stores even when there are no worksets. Current `WorksetsPanel` returns `null` for empty worksets, so it cannot be the only maintenance surface.

Alternative considered: keep `ReferencesPanel` and `WorksetsPanel` separate. Rejected because the user task is about understanding how to maintain the store, and the split panels hide the shared root/store/workset relationship.

## Risks / Trade-offs

- [Risk] Archive requests can race with root switching -> Mitigation: pass `scopeId` through the request and prefer adding it to the response so the webview can ignore stale archive data.
- [Risk] Overlay menus can be clipped in narrow sidebars -> Mitigation: position the menu within the rail container, cap width, and test narrow viewport screenshots.
- [Risk] Store CLI shape can vary by OpenSpec version -> Mitigation: keep defensive parsing in `DataManager`, gate actions with `capabilities`, and surface diagnostics instead of breaking the dashboard.
- [Risk] Empty-state copy can become noisy in small panels -> Mitigation: use concise root labels and keep path details in titles/tooltips.
- [Risk] Manual refresh forcing cache stats could still feel expensive -> Mitigation: only root switching is decoupled in this change; further cache throttling can be a separate performance change if needed.

## Migration Plan

1. Add tests for current failure cases: inline cache action reflow, unscoped archive handler, and root selector/empty-state copy.
2. Implement the cache overlay and preserve existing cache action messages.
3. Update root labels and empty states without changing internal scope ids.
4. Fix `getArchivedChanges` to resolve and pass `scope`.
5. Compose the Stores and Worksets panel from existing scope/reference/workset data and add any minimal message types required by the UI.
6. Run unit tests, build, and strict OpenSpec validation.

Rollback is straightforward: revert the UI composition and handler changes. No persisted data migration is required.

## Open Questions

- Should `Doctor Store` run an explicit new request, or is the existing relationships health data enough for the first implementation? Default implementation should reuse existing health data unless tests show a real workflow gap.
- Does the current OpenSpec CLI expose unregister/remove store consistently enough to ship an `Unregister` action now? If not, render only supported actions and leave unregister out of the first pass.

## Spec Amendments

No amendments needed; the current delta specs cover the design decisions.
