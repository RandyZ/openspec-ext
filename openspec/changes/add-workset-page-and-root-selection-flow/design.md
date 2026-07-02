## Context

See `explore.md` for the product decision: stores/projects select OpenSpec state, while worksets open a multi-folder workspace view. The current code already has several useful building blocks:

- `DataManager.listWorksets()` calls `openspec workset list --json` and parses `name`, `tool`, and `members`.
- `DataManager.openWorkset()` calls `openspec workset open <name>`.
- `ScopeBar` renders the current OpenSpec scope selector.
- `StoresAndWorksetsPanel` and `WorksetsPanel` show early versions of store/workset information.
- `DashboardData` already carries `scope`, `scopes`, `relationships`, and `worksets`.

The implementation should refine these pieces rather than introduce a second data model.

## Goals / Non-Goals

**Goals:**

- Make the OpenSpec root selector display only project/store root scopes.
- Group or label root selector options as Project and Store so the scope action is unambiguous.
- Add a dedicated Worksets workspace page using the existing workset data source.
- Display workset details from CLI JSON: name, tool, member count, primary member, and member paths.
- Preserve root-scoped dashboard behavior for changes, archives, specs, and workflow actions.
- Keep UI compact and usable in VS Code sidebar width.

**Non-Goals:**

- Do not change OpenSpec CLI behavior.
- Do not make worksets selectable OpenSpec roots.
- Do not infer a "current workset" unless the CLI provides reliable data.
- Do not implement full store setup/register onboarding beyond existing extension actions.
- Do not redesign the entire dashboard layout or change workflow command routing.

## Decisions

### Decision 1: Keep `OpenSpecScopeView` As The Root Selector Model

Use existing `DashboardData.scopes` and `OpenSpecScopeView.source` to render root choices. The selector filters to root scopes only, which today are `local`, `store`, and possibly `declared`.

Alternative considered: merge worksets into `OpenSpecScopeView`. Rejected because a workset has members and opener behavior, not root-owned changes/specs.

### Decision 2: Render Root Options With Semantic Groups

The webview should separate root options into Project and Store groups. If a native `select` remains the control, use `optgroup` where possible. If the existing styling makes `optgroup` hard to control, use stable option labels such as `Project - Local Root` and `Store - aihelp-workspace`.

```text
OpenSpec Root
  Projects
    Local Root                 /path/to/repo
  Stores
    aihelp-workspace           /path/to/store
```

The selector must not include worksets. Worksets are reached from the workspace page.

### Decision 3: Add A Worksets Workspace Page Instead Of Another Inline Panel

The existing inline panel can be refactored into a workspace management entry and a dedicated Worksets page. The page should be a first-class dashboard view, but still keep the status rail visible or easily recoverable.

```text
Dashboard
  ScopeBar
  MainContent
    CurrentRootOverview
    WorkspaceHome
      Worksets entry
      Stores entry
      References entry

WorksetsPage
  ScopeBar
  WorksetList
    WorksetCard
      name, tool
      primary member
      member count
      member paths
      actions
```

Implementation can use local React state in `App`/`Dashboard` for the subview before introducing a larger router. The required views are small enough for a typed `dashboardView: 'overview' | 'worksets'` state.

### Decision 4: Derive Primary Member From CLI Member Order

OpenSpec workset semantics treat the first member as primary. `WorksetView` can keep the CLI order and either:

- derive primary member in the UI as `workset.members[0]`, or
- add a derived `primaryMember` field in the parser.

Prefer deriving in a small utility or component to avoid duplicating CLI data. The member array remains the source of truth.

### Decision 5: Keep Workset Actions Separate From Scope Actions

Root-affecting actions already use `scope-switch`, `store-register`, and `store-setup` pending states. Workset open actions should use independent feedback, such as per-workset button pending state or a workspace-launch status. They must not set `scopeId` or call `selectScope`.

Extension/webview message flow:

```text
Webview WorksetsPage
  -> openWorkset(name)
  -> WebviewMessageHandler
  -> DataManager.openWorkset(name)
  -> openspec workset open <name>
  -> VS Code notification / page feedback
```

### Decision 6: Use Existing Dashboard Data For The First Implementation

The extension already includes worksets in `DashboardData` when the CLI supports them. A separate `refreshWorksets` message is not necessary for MVP. Manual refresh can reload dashboard data, including worksets.

If implementation discovers that workset open/remove/setup needs independent refresh, add the smallest message extension needed, but do not block the initial Worksets page on a new endpoint.

## Risks / Trade-offs

- [Risk] Native `select` `optgroup` styling may be inconsistent inside VS Code themes. -> Mitigation: keep labels readable even if group styling is minimal.
- [Risk] The CLI may return workset fields beyond `name`, `tool`, and `members`. -> Mitigation: defensively parse known fields and preserve layout flexibility for extra metadata later.
- [Risk] Workset open may launch or focus another editor window, so the current webview may not receive immediate completion state. -> Mitigation: provide fire-and-forget feedback and do not mutate root state locally.
- [Risk] Users may expect opening a workset to select a root automatically. -> Mitigation: page copy and root rail explicitly state the active root remains project/store-scoped.
- [Risk] Existing `StoresAndWorksetsPanel` might duplicate the new Worksets page. -> Mitigation: refactor it into store/reference management plus a Worksets entry, or remove its workset list once the dedicated page exists.

## Migration Plan

1. Add tests around root selector grouping and workset exclusion.
2. Add tests around Worksets page rendering CLI metadata and primary member.
3. Refactor `ScopeBar` root option rendering without changing selected-scope message contracts.
4. Add the Worksets page and connect it to existing `DashboardData.worksets` and `openWorkset`.
5. Refactor or remove duplicate inline workset lists.
6. Update i18n strings in English and Chinese.
7. Run unit tests and build.

Rollback is straightforward: revert the webview component changes. Existing extension-host data plumbing can remain because it is already used by current panels.

## Open Questions

None.

## Spec Amendments

None.
