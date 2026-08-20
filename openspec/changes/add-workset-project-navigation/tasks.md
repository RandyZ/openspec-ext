## Task 1. CLI-backed Workset navigation data
<!-- details: task-details/01-cli-workset-data.md -->

- [x] Task 1.1 Add RED gateway tests for official Workset/Store membership parsing, canonical paths, Store classification, and Git worktree metadata.
- [x] Task 1.2 Implement selector-free CLI Workset/Store queries and host-created navigation models with fail-soft invalid-member handling.
- [x] Task 1.3 Add GREEN coverage for current-Project reverse membership, multiple Worksets, and empty/unsupported CLI results.

## Task 2. Host Project switching and watcher retargeting
<!-- details: task-details/02-host-project-switch.md -->

- [x] Task 2.1 Add RED provider and watcher tests for valid selection, forged/stale member rejection, return-to-current, and single-root retargeting.
- [x] Task 2.2 Implement fresh membership validation, ProjectContext/OpenSpecRootBinding replacement, and single selected-Project watcher retargeting.
- [x] Task 2.3 Add GREEN provider regression coverage for binding identity, failed-switch preservation, and Project-first refresh routing.

## Task 3. Project-first Workset picker UI
<!-- details: task-details/03-workset-picker-ui.md -->

- [x] Task 3.1 Add RED Webview tests for separate Project/picker scenes, Project-only selection, Planning Store rows, empty state, and keyboard-safe narrow layout.
- [x] Task 3.2 Implement Workset picker payload types, scene state, Header navigation actions, and accessible Project selection messages.
- [x] Task 3.3 Add GREEN Webview coverage proving selected Project content reuses existing Sidebar, All Changes, Specs, and detail entry points.

## Task 4. Binding isolation and legacy compatibility
<!-- details: task-details/04-binding-compatibility.md -->

- [x] Task 4.1 Add RED tests for same-named Change/Spec isolation across Projects and unchanged legacy scope-only Workset behavior.
- [x] Task 4.2 Route all Project-first navigation and content actions through the current Host binding without altering legacy management or adapter flows.
- [x] Task 4.3 Run focused integration regressions for Change Detail, Spec Detail, Explorer, workflow, and watcher root isolation.

## Task 5. CLI fixture, GUI acceptance, and final gates
<!-- details: task-details/05-acceptance-gates.md -->

- [x] Task 5.1 Build and clean an isolated XDG CLI fixture with two Worksets, two Projects, a same-repo worktree, and a registered Store member.
- [x] Task 5.2 Verify real Extension Development Host navigation, empty/keyboard/narrow-sidebar behavior, and Project/Store binding evidence with same-viewport screenshots.
- [x] Task 5.3 Run full tests, lint, build, strict OpenSpec validation, diff checks, and final artifact/task status review.
