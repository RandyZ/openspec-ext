## Task 1. Unified Project workspace data
<!-- details: task-details/01-project-workspace-data.md -->

- [x] Task 1.1 Add RED Gateway tests for one binding-scoped payload, cache identity, and official referenced Store data.
- [x] Task 1.2 Implement unified Project Sidebar data loading with binding reuse and fail-soft Store groups.
- [x] Task 1.3 Add GREEN provider/cache coverage for stale-safe refresh and no duplicate tab scans.

## Task 2. Sidebar Changes / Specs tabs
<!-- details: task-details/02-sidebar-tabs.md -->

- [x] Task 2.1 Add RED Webview tests for local tabs, Project/Store Specs grouping, and narrow keyboard operation.
- [x] Task 2.2 Implement Sidebar tab state and render Changes, archived Changes, Project Specs, and Store Specs in place.
- [x] Task 2.3 Preserve binding-aware Change/Spec detail actions while removing list Explorer creation from tab navigation.

## Task 3. Official Workset open command
<!-- details: task-details/03-workset-cli-open.md -->

- [x] Task 3.1 Add RED CLI/DataManager tests proving Workset open is non-JSON and receives the exact Workset name.
- [x] Task 3.2 Implement the ordinary-output CLI execution path and route the Workset management action through it.
- [x] Task 3.3 Rename and test Project picker versus whole-Workset actions so their messages and focus targets are unambiguous.

## Task 4. Compatibility and performance regression
<!-- details: task-details/04-compatibility-performance.md -->

- [x] Task 4.1 Add RED regressions for active Project switching, same-named Project/Store Specs, and legacy scope-only behavior.
- [x] Task 4.2 Remove duplicate Project-first Explorer loading while preserving detail panels, watcher routing, and legacy management flows.
- [x] Task 4.3 Add GREEN command-count, cache, error-state, and message-routing coverage for the complete Sidebar path.

## Task 5. Real CLI fixture, GUI acceptance, and final gates
<!-- details: task-details/05-acceptance-gates.md -->

- [x] Task 5.1 Verify a real reference Project plus registered Store returns separate Project and Store Specs through official CLI JSON.
- [ ] Task 5.2 Verify Sidebar tabs, Store Spec binding, Project switching, and official Workset open in the real Extension Development Host.
- [x] Task 5.3 Run full tests, lint, build, strict OpenSpec validation, task-detail validation, diff checks, and final status review.
