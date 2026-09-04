<!-- Exploration output for this change — input for proposal, not the contract. -->

## Clarified requirements and constraints

### Problem

The extension already lists, opens, removes, and navigates project members from OpenSpec Worksets, but the Project-first Sidebar expands every Workset and its members at once. Users cannot scan Worksets first and inspect one topology second. The extension also lacks UI for `workset create` and the one-time `workset open --tool` override supported by OpenSpec 1.8.0.

### Required outcomes

- Present Worksets as a list that drills into a detail view.
- Keep Create Workset as a third state reached from the list, not as a competing workspace.
- Make Current Project and Planning root visibly distinct.
- Let users switch to an eligible Project member and use a registered Store member as Planning root only after Host-side revalidation.
- Support selector-free Workset creation and one-time tool override through official CLI commands.
- Use the existing React, Tailwind, VS Code theme-token, Webview messaging, and `ProjectDataGateway` patterns.
- Preserve keyboard access, focus states, i18n, capability gating, and narrow-sidebar behavior.
- Treat the approved high-fidelity images as the visual implementation baseline:
  - [Worksets list and detail](assets/worksets-list-detail-high-fidelity.png)
  - [Create Workset](assets/workset-create-high-fidelity.png)

### Boundaries

- Workset remains machine-local multi-folder state; Store remains the OpenSpec Planning root.
- Opening a Workset does not switch Planning root.
- All Workset CLI commands remain selector-free, including when the active Planning root is a Store.
- No Git clone, pull, push, or synchronization controls.
- No direct reads or writes of OpenSpec private Workset registry files.
- No member editing until OpenSpec provides an official update command.
- No synthetic `Reference` Workset member role; current roles remain `project | store`.
- No router, new state library, or generalized component framework.
- No automatic extension activation outside the existing explicit View entrypoint.

## Agreed design direction

### Approaches considered

| Approach | Benefits | Costs | Decision |
|---|---|---|---|
| Keep the current fully expanded Workset/member list | Smallest code change | Poor scanning, weak object hierarchy, creation and detail actions remain crowded | Rejected |
| List → detail drill-down, with Create as a third local state | Fits the narrow Sidebar, matches existing navigation, keeps each state focused, needs no router | Requires explicit local view state and a small message extension | Selected |
| Open a full editor-area Worksets workspace | More horizontal room and richer future management | Duplicates Sidebar navigation, creates a new surface, and over-scopes the MVP | Rejected |

### Final interaction model

```text
Worksets tab
    |
    v
+-----------+      select row      +----------------+
|   List    | --------------------> |     Detail     |
|           | <-------------------- |                |
+-----------+         back          +----------------+
      |
      | Create Workset
      v
+-----------+      save success
|  Create   | --------------------> Detail(new name)
+-----------+
```

The list shows only Worksets that contain the current Project, using the existing Project-first navigation data. Clicking the row opens details; the row-level `Open` action launches immediately without navigating.

The detail view shows the saved tool, `Open all`, one-time tool override, members, and destructive removal. Project and Store actions are derived from trusted roles. Current Project and current Planning Store display state instead of disabled actions.

The Create view is one compact form. Current Project is included and cannot be removed in this Project-first flow. The user can add folders, choose which selected member is Primary, and optionally enter an opener id. The Primary path is sent as the first repeated `--member` argument. Successful creation refreshes Project Sidebar data and opens the new detail view.

## Key decisions

### Reuse before expansion

- Keep the existing `Worksets` tab and Project-first data load.
- Evolve `WorksetProjectPicker` into the local list/detail/create coordinator before extracting more components.
- Reuse `selectWorksetProject`, `removeWorkset`, capability diagnostics, Store classification, path canonicalization, and VS Code confirmation patterns.
- Add only the messages required for folder picking, creation, one-time tool override, and trusted Store-member selection.

### Trust boundary

Webview-provided names, tool ids, and paths are hints. Host-side code validates their types, then relies on the official CLI and freshly read Workset/Store inventories. `selectWorksetStore(worksetName, memberPath)` mirrors the existing Project-member revalidation rather than accepting a Webview-supplied scope id.

### CLI behavior

- Create uses `openspec workset create <name> --member <primary> --member <other>... [--tool <id>] --json`.
- Normal open uses `openspec workset open <name>` through the ordinary runner.
- One-time override appends `--tool <id>` and does not mutate the saved Workset.
- No Workset command receives `--store`.

### Visual fidelity

The two approved images define hierarchy, density, grouping, labels, and action placement. Implementation may reuse the existing Header instead of duplicating its Project/Planning-root card, but it must preserve the same semantic separation and compact VS Code-native appearance. Visual acceptance compares the running Sidebar states against both images at the same narrow viewport.

### Deferred work

Member editing, Git management, automatic activation, and a full editor-area workspace remain outside this change. They require either an official CLI capability or separate user evidence and design work.
