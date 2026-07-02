<!-- Exploration output for openspec/changes/add-workset-page-and-root-selection-flow/explore.md - input for proposal, not the contract. -->

## Clarified Requirements And Constraints

The dashboard currently mixes three concepts that OpenSpec 1.5.0 treats as different product primitives:

- Project root: the nearest local project OpenSpec root. It owns repo-local changes, archived changes, specs, and workflow actions.
- Store root: a registered independent OpenSpec planning root. It can hold shared cross-project changes/specs and is selected with `--store <id>`.
- Workset: a saved local multi-folder editor/workspace view from `openspec workset list/open`. It helps users open related folders together, but it does not choose where OpenSpec artifacts are read or written.

The final design must support cross-project development without making worksets look like stores. Users should be able to:

- See and open saved worksets from a dedicated workspace page.
- Inspect as much `openspec workset list --json` information as the CLI provides, especially workset name, tool/default opener, member count, member names/paths, and first-member primary semantics.
- Choose the active OpenSpec root from project/store options only.
- Understand that selecting a project or store changes the dashboard data scope, while opening a workset changes the editor workspace view.
- Maintain stores and project roots from a clear management surface without hiding the current spec/change workflow.

The UI must remain usable in a narrow VS Code sidebar. It should avoid nested cards, oversized explanatory blocks, and marketing-style layouts. Labels and empty states need to be operational and compact.

## Approaches Considered

### Option 1: Put Worksets In The Existing Root Selector

This would give users one dropdown for everything, but it is semantically wrong. A workset is not an OpenSpec root and cannot own changes/specs by itself. Selecting it would leave users unsure whether subsequent actions run in a project, a store, or several folders at once.

Decision: rejected.

### Option 2: Keep A Mixed Store/Workset Maintenance Panel

This preserves the current shape and adds more rows/actions, but it does not solve the main confusion. The user still has to infer why one row changes dashboard data while another row opens a workspace.

Decision: rejected as the final model, though existing code can be refactored toward the new surfaces.

### Option 3: Separate Root Selection From Workspace Management

Use the status rail/root selector for OpenSpec roots only: current project roots and registered stores. Add a dedicated Worksets page under the workspace area for `openspec workset list --json` data and open actions.

Decision: selected.

## Agreed Design Direction

The dashboard should have two distinct interaction layers:

```text
Status Rail
  CLI health | OpenSpec Root [Project / Store selector] | Cache

Current Root View
  Changes | Archived | Specs | New Change | Apply | Archive | Verify

Workspace View
  Worksets page
  Stores / roots maintenance
  Context / doctor affordances
```

OpenSpec Root selector:

- Shows grouped options for Projects and Stores.
- Excludes worksets.
- Selecting a project or store refreshes root-scoped dashboard data: changes, archived changes, specs, status, and workflow actions.
- Store options should use store ids and expose path/health as secondary metadata where space allows.
- Project options should include the local root label and path, with "Local Project" or equivalent compact wording.

Worksets page:

- Opens from a workspace/worksets navigation entry, not from the root selector.
- Calls the extension data layer backed by `openspec workset list --json`.
- Shows each workset with name, default tool/open-with value when available, member count, primary member, and member folders in CLI order.
- Marks the first member as primary because OpenSpec sessions start there.
- Provides actions such as Open, Open With, Copy Command, Refresh, and Remove only when the extension can support them safely.
- Shows a clear empty state: create a workset from CLI or use project/store root selection for OpenSpec data.
- Explains tersely that opening a workset does not change the selected OpenSpec root.

Store/project management:

- Stores and project roots are managed in a root-focused surface, separate from workset opening.
- Store actions should include refresh, doctor/context, copy path/id, and register/setup guidance where implemented.
- Project root actions should include open/select and copy path.
- Current root state should remain visible while users inspect worksets.

## Key Decisions

- Worksets are workspace launchers, not root choices.
- Project/store selection controls the OpenSpec data scope.
- Workset opening controls the editor folder set and can indirectly change the available nearest project root after VS Code opens that workspace, but the current dashboard should not pretend that a workset itself is selected as a root.
- `openspec workset list --json` is the source of truth for saved workset list data. The UI may enrich rows with derived badges such as Store, Project, Folder, or Missing, but those are secondary hints.
- The root selector should group Project and Store choices. It should never include worksets.
- The workset page is a real workspace-management page, not just a small collapsed row in the dashboard.
- The product should support the microservice case where users first explore impact, then create/open a feature workset, then explicitly choose the project or store root for planning and implementation.
