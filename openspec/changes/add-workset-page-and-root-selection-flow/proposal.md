## Why

OpenSpec 1.5.0 introduces stores and worksets as complementary but different concepts. The dashboard needs a product model that lets users manage cross-project work without confusing a workset workspace view with the active OpenSpec root that owns changes, archives, specs, and workflow actions.

## What Changes

- Separate OpenSpec root selection from workset management.
- Change the root selector so it presents Project and Store options only, grouped and labeled by root semantics.
- Add a dedicated Worksets workspace page backed by `openspec workset list --json`.
- Show the useful workset metadata returned by the CLI: name, tool/default opener, member count, first member as primary, and member folders in CLI order.
- Keep workset open actions as workspace-launching actions that do not directly change the selected OpenSpec root.
- Refine store/project management copy and empty states so users understand when they are switching root-scoped dashboard data versus opening a multi-folder workset.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `dashboard`: clarify and extend dashboard behavior for Project/Store root selection, Worksets workspace page, and store/project/workset interaction semantics.

## Impact

- Webview dashboard components for the status rail/root selector, workspace/store/workset surfaces, and navigation.
- Extension-host workset data plumbing and webview messages for opening worksets.
- Dashboard data and message types for displaying workset members and root metadata.
- i18n strings and component tests for English and Chinese UI copy.
- No breaking changes to existing workflow command routing or OpenSpec CLI behavior.
