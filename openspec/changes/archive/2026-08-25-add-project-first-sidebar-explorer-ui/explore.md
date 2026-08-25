<!-- Exploration output for add-project-first-sidebar-explorer-ui — input for proposal, not the contract. -->

## Clarified requirements and constraints

### Product goal

The extension remains a VS Code/Cursor workflow surface, not a standalone management dashboard. The default experience starts from the code project currently open in the IDE and answers two questions quickly:

1. Which unarchived Changes in this project need attention now?
2. Where can the user browse all Changes and canonical Specs for this project?

The agreed information architecture is:

```text
VS Code / Cursor
├── Sidebar: current project and active work
│   ├── Active Changes
│   ├── All Changes
│   └── Specs
└── Editor
    ├── Changes Explorer: active + archived Changes
    ├── Specs Explorer: project Specs + referenced Store Specs
    ├── Change Detail
    └── Spec Detail
```

### Non-negotiable behavior

- The Sidebar is Project-first. A plain project must not be presented with Store/Workset administration or a root selector as its primary context.
- Active, unarchived Changes stay directly visible in the Sidebar so the next workflow action remains one click away.
- “All Changes” opens an Editor page containing both active and archived Changes.
- “Specs” opens an Editor page. Project canonical Specs and referenced Store Specs are visibly separated; installed Stores alone do not make a Store relevant to the project.
- Workflow buttons describe OpenSpec actions such as Apply, Verify, and Archive. Cursor, Copilot, CLI, and clipboard remain delivery choices and are not redesigned in this Change.
- Every list and panel is bound to an explicit `ProjectContext` and CLI-resolved `OpenSpecRootBinding`; it must not silently follow mutable `selectedScope` state or fall back to another project/root.
- Root resolution, Store references, and Store contents come from official OpenSpec CLI JSON surfaces. The extension must not mirror the Store/Workset registry as a second source of truth.

### Existing implementation to reuse

- `DashboardViewProvider` already hosts the Sidebar webview and opens Editor webviews.
- `ChangeDetailPanelManager` and the existing Spec viewer already provide detail surfaces.
- The React webview bundle already switches views from host-provided context; no routing dependency is needed.
- Existing Change cards, lifecycle presentation, filtering, search, pagination, workflow actions, i18n, cache, and file watching should be reused where their semantics remain valid.
- `ProjectDataGateway` now provides fail-closed Project/root binding plus active Change and canonical Spec reads. This is the new read path to extend, not a reason to rewrite `DataManager` immediately.

### Scope boundary

This Change completes the current-project slice only. It does not add Workset project switching, Git worktree identity/membership, reverse Store-to-project indexing, Store management pages, a global Project registry, workflow delivery refactoring, or a Change Detail redesign. Those remain separate milestones.

The legacy Store/Workset services may stay in place for compatibility while the default Sidebar stops presenting them as peer roots. Removing `DataManager`, `OpenSpecScopeManager`, cache/watcher infrastructure, or existing adapters is not required here.

## Approaches considered

### 1. Restyle the current Dashboard

Keep `DashboardData`, `selectedScope`, the root selector, and `StoresAndWorksetsPanel`, then rearrange their components.

- Advantage: smallest immediate UI diff.
- Cost: preserves the wrong Store/root-first mental model and keeps archived Changes, Specs, Store management, and current work coupled in one payload.
- Decision: rejected. It would polish the surface that this milestone is intended to replace.

### 2. Replace the whole Dashboard/data/panel stack at once

Remove `DataManager`, scope management, existing panels, cache, and watchers, then rebuild every surface around Project contexts.

- Advantage: a clean end-state in one migration.
- Cost: unnecessarily couples UI, workflow actions, content editing, caching, watching, Store/Workset navigation, and panel lifecycle. It creates a large regression surface and delays a usable Project-first release.
- Decision: rejected.

### 3. Add Project-first page data and migrate the visible surfaces incrementally

Use `ProjectDataGateway` for new page-specific reads, reuse the existing webview and detail panels, and replace only the default Sidebar plus the two Explorer entry pages.

- Advantage: delivers the agreed user experience while leaving working workflow/detail infrastructure intact.
- Cost: old and new read paths coexist temporarily, so message contracts and ownership must be explicit.
- Decision: selected. It is the smallest independently releasable slice that changes the product model rather than only its styling.

## Agreed design direction

### Sidebar

The existing Dashboard surface becomes a compact current-project home:

```text
CURRENT PROJECT
openspec-ext

ACTIVE CHANGES
add-project-first-sidebar-explorer-ui
Planning · next: Continue

All Changes                         6  →
Specs                              18  →
```

Only active/unarchived work is rendered as cards. Existing lifecycle and primary-action logic is reused. Search, lifecycle filters, archived cards, Store switching, and Workset management do not remain in the compact default Sidebar.

Loading and error states identify the affected project/root and fail closed. Stale data from a previously viewed project must not be displayed under a new project heading.

### Changes Explorer

“All Changes” opens or reveals one Editor panel keyed by the Project/root binding. It combines active and archived items, reusing the existing Change list pipeline for search, lifecycle filters, attention filtering, sorting, and pagination.

Opening an active Change reuses Change Detail. Opening an archived Change reuses the existing archived-content behavior. The host message carries the Project/root identity so same-named Changes in different roots cannot cross-resolve.

### Specs Explorer

“Specs” opens or reveals one Editor panel keyed by the Project/root binding. It shows:

```text
PROJECT SPECS
  local canonical specs

REFERENCED STORE SPECS
  team-plans
    referenced canonical specs
```

Project Specs come from `list --specs --json` in the project binding. Referenced Store groups are derived only from the current project’s official CLI context/health data; each referenced Store is then read through an explicit Store binding. A registered but unreferenced Store is not shown.

The first release does not load every Store Change into the Sidebar or Specs Explorer. Store planning/change exploration can be added when a concrete navigation surface is designed for it.

### Host and webview contracts

- Add page-specific host messages and DTOs for Sidebar, Changes Explorer, and Specs Explorer instead of expanding the monolithic `DashboardData` contract.
- Extend the current webview context switch with `sidebar`, `changesExplorer`, and `specsExplorer`; do not add React Router.
- Reuse the existing provider/panel lifecycle pattern. A generic panel abstraction is only justified if the two Explorer panels produce real duplicated lifecycle code.
- Keep existing Change Detail and Spec Detail implementations. Only their open requests need enough Project/root identity to remain correctly bound.
- Continue using existing cache and watcher behavior where safe; introduce no new global cache or watcher registry in this Change.

### Migration behavior

The new Project-first read path is introduced alongside the legacy `DataManager` path. Once the new Sidebar is active, the default UI no longer exposes the root selector or `StoresAndWorksetsPanel`, but their underlying compatibility services are not deleted as part of this milestone.

## Key decisions

- Current Project is the primary context; Store and Workset are progressively disclosed relationships, not peer Dashboard roots.
- Sidebar optimizes for current work; Editor Explorers optimize for complete browsing.
- Archived Changes belong in Changes Explorer, not the compact Sidebar.
- Canonical project Specs and referenced Store Specs share one Specs Explorer but remain visually separated by source.
- Only CLI-confirmed Store references are displayed.
- New surfaces use page-specific data contracts and immutable Project/root binding.
- Existing detail panels, workflow actions, delivery adapters, cache, and watchers are reused rather than redesigned.
- Workset navigation and cross-project browsing remain the next milestone, not hidden scope in this Change.
