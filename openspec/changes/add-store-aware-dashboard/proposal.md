<!-- Distilled from explore.md saved at openspec/changes/add-store-aware-dashboard/explore.md -->

## Why

OpenSpec is adding an unreleased multi-project workflow built around stores, references, context, and worksets, but the extension currently assumes one workspace-local `openspec/` root and one installed CLI executable. Users need a safe way to dogfood the latest local OpenSpec source and a clear dashboard experience that shows which root is being acted on before store-scoped work can be trusted.

## What Changes

- Add a first-class OpenSpec runtime source model that can use the installed CLI, a custom executable path, or a local OpenSpec source checkout.
- Extend CLI command resolution so local source mode can run `node <OpenSpec source>/bin/openspec.js <args>` and report source-specific diagnostics.
- Add capability detection for unreleased store/context/workset commands instead of assuming support from package version alone.
- Introduce a selected OpenSpec scope for dashboard data and actions: local root, explicit store, or declared store.
- Make dashboard data, artifact reads, editor opens, task toggles, and workflow actions respect the selected scope.
- Add a compact dashboard Scope Bar showing runtime source, selected root, store id/path, health, and feature support.
- Add read-only relationship UI for referenced stores, including health, spec summaries, fetch commands, and unresolved registration fixes.
- Add personal workset visibility and open actions without treating worksets as shared project relationships.
- Preserve existing single-root behavior for users who do not opt into store-aware capabilities.

MVP:

- Runtime settings and diagnostics for local source mode.
- Scope-aware CLI wrapper and content access root selection.
- Store list/select, current root display, health display, and scoped dashboard refresh.
- Read-only references panel using `openspec context --json` and `openspec doctor --json` when available.
- Store-aware New Change, artifact viewing, task toggling, and workflow command routing.

Later:

- Guided store setup/register flows inside the extension.
- Rich workset create/remove editing UI.
- Cross-root compare views, sync helpers, or Git push/pull orchestration.

## Capabilities

### New Capabilities

- `openspec-scope-management`: Runtime source selection, feature detection, selected root scope, store/reference/workset relationship semantics, and persistence rules for the extension.

### Modified Capabilities

- `cli-integration`: Add local source runtime, command argument prefixing, feature probes, and scope-aware command execution.
- `dashboard`: Add Scope Bar, store selection, root health, read-only relationship panel, workset entry points, and scoped refresh behavior.
- `artifact-viewing`: Make artifact/spec reads and editor opens use the selected OpenSpec root instead of always using the workspace root.
- `workflow-control`: Ensure workflow commands and high-impact actions are visibly scoped to the selected root/store and keep referenced stores read-only.

## Impact

- Extension host:
  - `OpenSpecCliResolver` and `OpenSpecCliService` must support runtime source modes, `argsPrefix`, feature probes, and scope-aware command argument construction.
  - `DataManager`, `StateReader`, `ContentAccess`, and `FileManagerService` need a resolved root/scope input instead of assuming `workspaceRoot/openspec`.
  - Webview message handlers and editor-open safety checks must allow selected roots that may be outside the VS Code workspace when explicitly selected via a registered store.
- Webview:
  - Dashboard needs a compact Scope Bar and relationship/workset sections.
  - Change cards, change detail, artifact tabs, and workflow actions must show or inherit selected scope.
  - Existing CLI diagnostic card patterns should handle local source and unsupported feature states.
- Configuration:
  - New settings for CLI mode, local source path, and optional auto-build behavior.
  - Existing `openspec.cliPath` remains supported for custom executable mode.
- Tests:
  - Resolver mode unit tests, scope command argument tests, dashboard state tests, and content access root-selection tests.
- Documentation:
  - README/settings docs should explain installed CLI vs local source mode and the beta nature of store-aware features.
