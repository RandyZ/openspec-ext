## Context

See `explore.md` for the product problem and selected direction. The current implementation already has:

- scoped project/store roots in `OpenSpecScopeManager`
- `DashboardData.scopes`, `DashboardData.worksets`, and `OpenSpecCapabilities`
- `openWorkset` message and `DataManager.openWorkset`
- `StoresAndWorksetsPanel` and `WorksetsPage`

The missing pieces are information architecture polish, readable workset cards, removal flow, and capability-gated multi-project UI states.

Current mental model to preserve:

```text
┌────────────────────┐
│ Project Root       │  local repo OpenSpec root; commands run with cwd=root
└─────────┬──────────┘
          │ selectable OpenSpec root
┌─────────▼──────────┐
│ Store Root         │  registered OpenSpec planning root; commands use --store
└─────────┬──────────┘
          │ separate concept
┌─────────▼──────────┐
│ Workset            │  saved editor workspace view; open/remove only
└────────────────────┘
```

## Goals / Non-Goals

**Goals:**

- Move root selection into the primary dashboard action rail.
- Keep single-project Local Root usage lightweight.
- Make store cards distinguish selected state from selectable state.
- Redesign Worksets page cards for readable names, paths, primary member, and actions.
- Add confirmed workset removal backed by `openspec workset remove <name> --yes --json`.
- Gate store/workset controls behind detected OpenSpec 1.5.0 capabilities and show upgrade guidance when unavailable.
- Preserve existing scoped data loading, cache behavior, and workflow-launch scope semantics.

**Non-Goals:**

- Do not change OpenSpec CLI behavior.
- Do not introduce create/edit workset flows beyond existing open and new remove action.
- Do not delete member folders, repos, stores, or `.code-workspace` files when removing a saved workset.
- Do not redesign change cards, specs list, cache management, or interactive workflow panels beyond layout changes needed to fit the action rail.

## Decisions

### Decision 1: Add a primary root/action rail above CLI status

Render the main controls as a compact action row:

```text
OpenSpec
[Refresh] [New Change]     Root [Projects / Stores ▼] [Register Store]
```

On narrow sidebar widths, wrap the root controls to a second row under the action buttons. The CLI health/cache row remains below as operational status, not the owner of root selection.

Rationale:

- `New Change` and workflow actions depend on the selected root.
- Users should not discover root selection only after reading CLI/cache status.
- The root selector is an active planning context, while cache is passive diagnostics.

Alternative considered: keep root selector in `ScopeBar`. Rejected because it creates the screenshot problem where the selected store floats in the status area and feels unrelated to `New Change`.

### Decision 2: Treat Stores & Worksets panel as maintenance, not primary navigation

Keep `StoresAndWorksetsPanel`, but make it a lower-priority maintenance surface:

- Registered stores: state and switch action.
- Read-only references: existing reference summary.
- Worksets: navigation to Worksets page.
- Setup/register actions: secondary entries, with the primary Local Root register affordance also available in the action rail.

For single-project Local Root with no references and unsupported or unused store/workset features, avoid rendering a large management block. Prefer a small contextual message or button.

### Decision 3: Derive a Workset display model in the webview

The CLI contract only provides:

```typescript
interface WorksetView {
  name: string;
  tool?: string;
  members: { name: string; path: string }[];
}
```

Do not expand the extension host contract unless needed. The webview can derive:

- primary member: `members[0]`
- member count
- display path via existing full path
- member type:
  - `Store root` if `member.path` matches a registered store `rootPath`
  - `Primary` for first member
  - `Project` for other members

The full path remains available through `title` and optional copy affordances.

### Decision 4: Add a workset remove message and host-side confirmation

New message:

```typescript
{ type: 'removeWorkset'; name: string }
```

Extension host flow:

```text
WorksetsPage Remove
  -> webviewMessageHandler removeWorkset
  -> showWarningMessage(modal)
  -> DataManager.removeWorkset(name)
  -> openspec workset remove <name> --yes --json
  -> refresh dashboard data
  -> post dashboardData
```

Confirmation copy must say that removing the workset does not delete folders, repos, or stores.

Keep confirmation in the extension host rather than the webview so the destructive action uses native VS Code modal affordances and is testable through message handler mocks.

### Decision 5: Use capability diagnostics for OpenSpec 1.5.0 gating

Use existing `OpenSpecCapabilities`:

- `stores`
- `worksets`
- diagnostics from failed probes

UI rules:

- If `stores === false`, do not render enabled store selector/store register/setup controls.
- If `worksets === false`, do not render enabled Worksets page navigation/open/remove controls.
- Show a concise upgrade notice: Stores and worksets require OpenSpec 1.5.0+.
- Keep Local Root changes/specs usable.

This should be based on feature probes, not string-parsing CLI version output. The message can mention 1.5.0 because that is the feature boundary.

## Risks / Trade-offs

- [Risk] Moving root selector could crowd the sidebar header.
  -> Mitigation: wrap root controls, keep labels short, use existing VS Code colors and compact spacing.

- [Risk] Derived member type can be wrong if a store path is symlinked or path casing differs.
  -> Mitigation: normalize paths before comparison; treat unmatched members as project folders.

- [Risk] Workset remove command may fail on older OpenSpec versions.
  -> Mitigation: hide/remove disable when `capabilities.worksets` is false and show upgrade guidance.

- [Risk] A low-version runtime might support one feature but not the other.
  -> Mitigation: gate stores and worksets independently.

- [Risk] Store register action appears in two places.
  -> Mitigation: primary rail action is contextual and lightweight; maintenance panel action remains available for users already managing stores.

## Migration Plan

1. Update message/types and `DataManager` with `removeWorkset`.
2. Update message handler to confirm and execute removal.
3. Refactor dashboard header/action rail placement of root selector and register/setup actions.
4. Update store maintenance card states.
5. Redesign `WorksetsPage` card layout and actions.
6. Add feature-gated upgrade states.
7. Update i18n strings and tests.

Rollback is straightforward: revert this change to restore the previous root selector placement and Worksets page. No persisted data migration is required.

## Open Questions

None. The user-provided screenshots and exploration have converged on the desired interaction model.

## Spec Amendments

None.
