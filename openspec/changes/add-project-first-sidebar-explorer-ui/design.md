## Context

See `explore.md` for the product rationale, scope split, and the decision to move the default experience to a Project-first sidebar plus two Editor Explorer pages.

Current state in the extension:

- `DashboardViewProvider` still hosts the sidebar webview and the editor webview panels.
- `ProjectDataGateway` already resolves an explicit `ProjectContext` plus `OpenSpecRootBinding` from OpenSpec CLI JSON.
- `DataManager` still owns the legacy dashboard payload, refresh loop, cache, and compatibility data such as archive lists, relationship data, and workflow launch config.
- `ChangeDetailPanelManager` already opens change detail panels and carries scope metadata for same-named changes.
- The React webview app already swaps between `Dashboard`, `ChangeDetail`, and `SpecViewer` without a router.

The change needs to preserve existing workflow/detail behavior while splitting the UI into a compact current-project sidebar and two project-bound Explorer pages.

## Goals / Non-Goals

**Goals:**

- Make the sidebar current-project first and keep only active, unarchived work directly visible there.
- Add separate Editor Explorer surfaces for All Changes and Specs.
- Keep every page bound to an explicit project/root identity.
- Reuse current detail panels, workflow actions, cache, and file-watching where their semantics still fit.
- Keep the migration incremental so the old compatibility services can remain until the new surfaces are stable.

**Non-Goals:**

- Rewriting `DataManager` into a new global state store.
- Adding React Router or a new navigation framework.
- Implementing Workset switching, reverse store indexing, or a global Project Registry.
- Redesigning Change Detail or Spec Detail beyond the binding guarantees needed for the new pages.

## Decisions

### 1. Keep `DataManager` as the compatibility spine, and add Project-first reads beside it

`ProjectDataGateway` becomes the source for the new Project-first sidebar and Explorer reads. `DataManager` stays in place for legacy cache, watcher, and compatibility flows during migration.

Why this over replacing `DataManager` outright:

- It keeps the diff small enough to ship incrementally.
- It avoids breaking existing cache and refresh semantics that still serve the sidebar and detail panels.
- It lets the new pages use explicit `ProjectContext` / `OpenSpecRootBinding` without forcing a full rewrite of unrelated services.

Implementation shape:

```text
IDE workspace
   │
   ├─ Legacy path: DataManager → DashboardData → current dashboard UI
   │
   └─ Project-first path: ProjectDataGateway → page-specific DTOs
                               │
                               ├─ current-project sidebar
                               ├─ changes explorer
                               └─ specs explorer
```

### 2. Split payloads by page instead of growing `DashboardData`

The new surfaces should use page-specific DTOs/messages rather than extending the monolithic dashboard payload again.

Why this over adding more fields to `DashboardData`:

- It prevents the sidebar, Changes Explorer, and Specs Explorer from becoming another shared grab-bag.
- It makes page ownership obvious in both the host and the webview.
- It reduces the chance that a stale dashboard payload leaks the wrong project into a page that expects a different binding.

Recommended shape:

- Sidebar: compact current-project payload with active changes and navigation entry points.
- Changes Explorer: active + archived changes, list state, and project binding metadata.
- Specs Explorer: canonical project specs plus CLI-confirmed referenced Store specs.

### 3. Keep the existing provider model, but key pages explicitly

`DashboardViewProvider` remains the host entry point for the sidebar and editor panels. The webview app should switch by page kind, not by URL routing.

Why this over adding a router:

- The current app already does page switching with host-pushed context.
- A router adds state duplication without solving the core problem, which is identity and data ownership.
- The sidebar and editor explorers are already naturally panel-based in VS Code.

The host should treat page identity as explicit state, for example:

```text
sidebar
changesExplorer
specsExplorer
changeDetail
specViewer
```

The same pattern can be carried through both the sidebar and the editor panels, with project binding included in every open request and refresh payload.

### 4. Reuse existing detail panels and workflow launch adapters unchanged

Change Detail, Spec Detail, workflow actions, and launch adapters should stay in place.

Why this over redesigning them now:

- The change is about navigation and data partitioning, not new workflow semantics.
- The existing `Verify & Archive` path and adapter launch logic are already cross-cutting and tested.
- Rewriting them would multiply the regression surface without improving the new page split.

Only the open request needs to carry enough binding metadata so same-named resources cannot cross-resolve across projects.

### 5. Source archive and file-backed spec data from `FileManagerService`

`ProjectDataGateway` already resolves CLI-backed active data. Archived change lists and file-backed spec reads should continue to come from `FileManagerService`.

Why this split is acceptable:

- Archive data is already stored on disk under `openspec/changes/archive`.
- `FileManagerService` already understands archive paths and delta spec lookup for archived changes.
- Canonical project specs remain CLI-backed through `list --specs --json`, so the explorer can combine CLI truth with file-backed archive reads without inventing another store.

### 6. Make project identity part of every cache key

Any cached sidebar or Explorer data must be keyed by the canonical project binding, not by a vague workspace label.

Required key inputs:

- canonical `projectId`
- canonical `rootPath`
- optional `storeId`
- `rootSource`

Why this matters:

- It prevents stale data from the previous project from appearing under a new project heading.
- It keeps store-backed and local-root-backed bindings from colliding.
- It makes cache invalidation deterministic when the same workspace resolves through different roots.

## Risks / Trade-offs

- `DataManager` and `ProjectDataGateway` will overlap for a while.  
  Mitigation: keep their responsibilities disjoint and only let the new pages depend on the gateway.

- Page-specific DTOs may duplicate some shape already present in `DashboardData`.  
  Mitigation: prefer duplication over a shared mega-payload; the pages are different enough that a flat shared type would be the wrong abstraction.

- Archived and canonical data come from different readers.  
  Mitigation: keep binding explicit in every payload and fall back closed if the requested project/root identity changes.

- Explorer pages can drift into separate lifecycle behavior if each one grows custom state handling.  
  Mitigation: reuse the existing list pipeline and panel lifecycle helpers rather than writing new page-specific state managers.

## Migration Plan

1. Add page-specific DTOs and webview messages for the sidebar, Changes Explorer, and Specs Explorer.
2. Extend the React webview app to switch by page kind while preserving the existing `Dashboard`, `ChangeDetail`, and `SpecViewer` components.
3. Wire the compact sidebar to `ProjectDataGateway` for current-project active changes and navigation entry points.
4. Wire the Changes Explorer to the project-bound list pipeline and the archive reader.
5. Wire the Specs Explorer to CLI-backed canonical specs plus referenced Store spec lookup.
6. Keep `DataManager` and legacy dashboard compatibility paths alive until the new surfaces are stable.
7. After the new pages prove stable, reduce the old dashboard shell’s dependence on scope-management UI, but do not delete the compatibility services in this change.

Rollback strategy:

- Switch the sidebar back to the legacy dashboard payload path.
- Hide the new Explorer entry points.
- Leave `DataManager`, cache, and workflow adapters intact so the rollback is reversible without data migration.

## Open Questions

- Should the Changes Explorer and Specs Explorer use two separate editor panels, or a single explorer shell with a mode flag?  
  The safest choice for this change is separate panels with shared lifecycle helpers, but the code can still converge later if duplication appears.

- Should archived change navigation keep using the existing `archive:<directoryName>` convention everywhere, or should the explorer normalize it before opening detail views?  
  The current file manager already understands the archive prefix, so the design keeps that convention for now.

## Spec Amendments

- [x] Add `specs/project-first-explorers/spec.md` for the Project-bound Sidebar and Editor Explorer contract.
- [x] Modify `specs/dashboard/spec.md` so the default Sidebar shows current-project active work and Explorer entry points.
- [x] Modify `specs/openspec-scope-management/spec.md` so Project-first reads use an immutable CLI-resolved binding while legacy selected Store scope remains compatibility-only.
