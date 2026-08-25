<!-- Implementation details are in openspec/changes/add-project-first-sidebar-explorer-ui/task-details/. Each ## Task N group references one task group file; Task N.M ids correspond 1-to-1 with ### Task blocks across files. -->

## Task 1. Project-first data contracts
<!-- details: task-details/01-project-data-contracts.md -->

- [x] Task 1.1 Define page-specific Sidebar and Explorer payload/message contracts with explicit Project/root identity
- [x] Task 1.2 Extend ProjectDataGateway to load archived Changes for the resolved binding
- [x] Task 1.3 Load referenced Store Specs only from CLI-confirmed project references

## Task 2. Host navigation and panels
<!-- details: task-details/02-host-navigation-panels.md -->

- [x] Task 2.1 Load and refresh compact Sidebar data for the current workspace Project
- [x] Task 2.2 Open binding-keyed Changes and Specs Explorer panels from Sidebar messages
- [x] Task 2.3 Preserve Project/root binding when opening Change, archive, and Spec detail views

## Task 3. Compact Project Sidebar
<!-- details: task-details/03-project-sidebar.md -->

- [x] Task 3.1 Render current Project identity, active Changes, and persistent Explorer entry points
- [x] Task 3.2 Preserve workflow actions, CLI diagnostics, cache feedback, and accessible empty states
- [x] Task 3.3 Remove root selection and Store/Workset administration from the default Sidebar UI

## Task 4. Editor Explorers
<!-- details: task-details/04-editor-explorers.md -->

- [x] Task 4.1 Route host page context to Sidebar, Changes Explorer, and Specs Explorer without a router dependency
- [x] Task 4.2 Build the Changes Explorer with project-bound active and archived filtering, sorting, and pagination
- [x] Task 4.3 Build the Specs Explorer with separate Project and referenced Store groups

## Task 5. Compatibility and verification
<!-- details: task-details/05-compatibility-verification.md -->

- [x] Task 5.1 Prove cache, refresh, and same-named resource isolation across Project/root bindings
- [x] Task 5.2 Verify legacy details, workflow delivery, Store/Workset services, and scoped actions remain compatible
- [x] Task 5.3 Run strict OpenSpec validation, focused tests, full tests, lint, build, and VS Code Extension Host smoke checks
