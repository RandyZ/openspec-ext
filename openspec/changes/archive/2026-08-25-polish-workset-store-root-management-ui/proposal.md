<!-- Distilled from explore.md saved at openspec/changes/polish-workset-store-root-management-ui/explore.md -->

## Why

Store/workset support is now functionally present, but the dashboard still makes the product model harder to understand than it should be. Users need to clearly see which OpenSpec root they are acting on, manage saved worksets without confusing them with roots, and keep the single-project Local Root experience lightweight.

## What Changes

- Move OpenSpec root selection into the primary action area near `Refresh` and `New Change`.
- Keep the root selector scoped to project roots and store roots only; worksets remain a separate workspace-management concept.
- Make Local Root without store references feel like the original single-project dashboard while still offering a lightweight `Register Store` entry point.
- Redesign registered store cards so the current store shows a `Current` state and inactive stores use a normal `Switch` action instead of a disabled `Open` button.
- Redesign Worksets page cards so names, opener/tool, repo names, primary member, store/project member type, and paths are readable in narrow VS Code sidebars.
- Add a Remove action for saved worksets with a modal confirmation that states member folders are never deleted.
- Hide or disable store/workset controls when the resolved OpenSpec runtime does not support 1.5.0 store/workset features, and show a concise upgrade message.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `dashboard`: Refine root selection, store maintenance, workset management, remove flow, and feature-gated OpenSpec 1.5.0 multi-project affordances.

## Impact

- Webview UI:
  - `Dashboard`
  - `Header` or equivalent primary action region
  - `ScopeBar`
  - `StoresAndWorksetsPanel`
  - `WorksetsPage`
  - i18n strings
- Extension host:
  - webview message contract for workset removal
  - `DataManager` workset removal method
  - feature capability diagnostics exposed to dashboard
- Tests:
  - root action rail rendering
  - store current/switch states
  - Local Root lightweight mode
  - workset card rendering and remove action
  - OpenSpec 1.5.0 feature-gated fallback
