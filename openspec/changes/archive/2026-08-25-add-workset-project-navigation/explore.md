<!-- Exploration output for the resolved explore.md artifact path — input for proposal, not the contract. -->

## Clarified requirements and constraints

- Current Project-first Sidebar remains the default experience. Workset navigation is visible only when the host confirms that the current canonical Project path is a member of at least one official CLI workset.
- A Workset is a navigation source, not a second dashboard and not a persistence layer. It can select another Project member; after selection the existing Project Sidebar, All Changes, Specs Explorer, Change Detail, and Spec Detail surfaces are reused.
- Registered Store members are displayed as `Planning Store` context only. They are never selectable as Projects and unreferenced Stores remain absent from Specs Explorer.
- All workset/store membership and paths come from official CLI JSON. The extension must not create a mirror registry, workset database, reverse-index file, or global Project Registry.
- Member paths and Project identities are canonicalized by the host. Same-repository Git worktrees may show repository identity and branch metadata, but this metadata is display-only and does not become a new persistent identity system.
- Every navigation result is converted to a fresh immutable `ProjectContext` and `OpenSpecRootBinding`. Webview-supplied paths, roots, Store ids, and stale bindings are untrusted and must be revalidated against fresh CLI membership and a fresh CLI root probe.
- Only the selected Project is watched. Selecting another member replaces the watcher target; the extension never watches every Workset member.
- Workflow Delivery/Adapter behavior, Store/Workset management, root selectors, and Store reverse-consumer indexes are out of scope.
- The visual target is the existing VS Code/Cursor sidebar language and scale. Workset selection and Project content are separate scenes, and narrow-sidebar keyboard navigation is part of acceptance.

## Agreed design direction

Three approaches were considered:

1. Reuse the existing legacy `WorksetsPage` and open a VS Code workspace. This is small, but it keeps management actions, does not provide Project selection, and would separate the selected Project from the existing Project-bound data path.
2. Add a second Workset dashboard with its own Changes/Specs UI. This would make selection obvious, but duplicates the current Project-first surfaces and creates additional root-isolation paths.
3. Add a host-backed Workset Project picker as a temporary scene in the existing Project-first Dashboard. The picker receives only CLI-confirmed membership data; selecting a Project asks the host to revalidate the workset member, create a new ProjectContext, resolve a new binding, switch the single watcher target, and reload the same Sidebar. This preserves one content UI and one binding boundary.

Choose option 3. The webview owns only scene state (`project` or `workset-picker`). The Extension Host owns membership discovery, canonicalization, Store classification, Git display metadata, target validation, ProjectContext replacement, binding resolution, and watcher retargeting.

Conceptually:

```text
current Project
      │ official workset list + store list
      ▼
Workset picker ── select Project member ──▶ host validates fresh membership
      ▲                                      │
      └──────── back to current Project ◀───┘
                                             │
                              ProjectContext + OpenSpecRootBinding
                                             │
                              existing Sidebar / Explorers / Details
```

## Key decisions

- Workset membership is computed on demand for the current Project and refreshed after a successful Project switch; no persistent cache is authoritative for navigation.
- A workset is eligible only when its canonical member set contains the current Project. A member whose canonical path matches a registered Store root is shown as `Planning Store` and has no selection control.
- A selectable member is represented by canonical path and a host-created ProjectContext. The webview sends a workset name and member path only as a request hint; the host resolves the official list again and rejects mismatches.
- The original activation Project is retained as the `Current Project` return target. Returning to it follows the same host validation and binding/watcher reset path as selecting another member.
- Git repository root and branch are best-effort display metadata. Failure to inspect Git must not make a valid OpenSpec Project unavailable.
- Binding equality remains the existing full-field comparison. Data, watcher events, Change Detail, Specs, and workflow actions are accepted only for the currently selected Project/binding.
- The existing legacy `Dashboard` Worksets page and management commands remain compatible for non-Project-first callers; this Change adds only the Project-first navigation path.
