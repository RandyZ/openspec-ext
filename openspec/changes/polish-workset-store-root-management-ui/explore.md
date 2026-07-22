<!-- Exploration output for openspec/changes/<change>/explore.md - input for proposal, not the contract. -->

## Clarified Requirements And Constraints

The current dashboard already separates OpenSpec roots from worksets at a data level, but the visible product experience is still confusing:

- Workset cards compress the workset name, tool, member count, repo names, and paths into one dense layout. Long paths truncate too early and users cannot tell which folder is primary, which member is a store root, and which members are ordinary project repos.
- Worksets can be opened but not removed. Removal must delete only the saved workset record, never member folders, repos, or stores.
- Registered store cards show a disabled `Open` action for the current store. This reads like a broken button instead of a current-state indicator.
- The root selector currently lives in the CLI/cache status area. Root choice is part of the primary workflow context for `Refresh`, `New Change`, and workflow actions, so it should move into the main action rail near those commands.
- Single-project users on Local Root with no references should keep a simple dashboard. Store/workset affordances should be light and opt-in, with a clear way to register the current project into a store when users start cross-project work.
- OpenSpec versions before 1.5.0 do not support stores/worksets. The UI must not show broken store/workset controls when feature probes fail; it should explain that OpenSpec 1.5.0+ enables multi-project planning.

The solution must preserve the key semantic split:

```text
Project Root / Store Root = selected OpenSpec planning root
Workset                  = saved editor workspace view
Reference Store          = read-only upstream context
```

Implementation should fit the existing VS Code webview design language: dense, utility-oriented, low chrome, no marketing-style panels, and careful wrapping for narrow sidebar widths.

## Options Considered

### Option 1: Keep the current structure and only restyle workset cards

This would improve the most visible screenshot problem quickly, but it leaves root selection and store maintenance in the wrong place. Users would still see an `Open` button that means different things for stores and worksets.

Trade-off: smallest code change, but does not solve the product model confusion.

### Option 2: Move every store/workset control into a separate management page

This makes the overview clean, but it hides root choice too deeply. Root selection must remain visible before users refresh, create changes, or launch workflows.

Trade-off: clean management surface, but too much navigation for a core workflow control.

### Option 3: Promote root context to the action rail and make Store/Workset management secondary

Selected path. Put `Refresh`, `New Change`, current root selector, and register/setup affordances into one compact action area. Keep a maintenance panel below for registered stores, references, and Worksets page navigation. Redesign Worksets page cards and add remove flow.

Trade-off: slightly more header complexity, but it matches user intent: choose where OpenSpec work happens before acting.

## Agreed Design Direction

The dashboard should have three levels:

1. **Primary action rail** near the title:
   - `Refresh`
   - `New Change`
   - Root selector grouped as `Projects` and `Stores`
   - Contextual store actions, especially `Register Store` for Local Root users

2. **Overview content**:
   - Existing CLI health/cache remains visible but should not own root selection.
   - For single-project Local Root with no references and no store/workset capability, the dashboard behaves like the original single-project experience.
   - When OpenSpec 1.5+ features are available, show concise maintenance entry points without overwhelming single-project users.

3. **Management surfaces**:
   - Registered store cards use `Current` for active store and `Switch` for inactive stores.
   - Worksets page shows each workset as a richer utility card with title, tool badge, member count, Open and Remove actions, and a readable member list.
   - Workset removal uses a modal confirmation from the extension host and clearly states that member folders are not deleted.

## Key Decisions

- Worksets remain excluded from the root selector.
- Store selection uses `Switch`, not `Open`. Current selected store shows a `Current` badge instead of a disabled `Open` button.
- Workset launch uses `Open` because it opens an editor workspace view.
- Workset delete uses `Remove`, calls `openspec workset remove <name> --yes --json`, refreshes dashboard data, and shows success/failure feedback.
- Workset cards derive display structure from the existing CLI contract only: `name`, `tool`, and ordered `members[]`.
- Member display should split name and path into a readable two-row layout. The first member is `Primary`; members whose path matches a registered store root can be marked `Store root`; other members are `Project`.
- Store/workset UI is gated by detected capabilities. If store/workset probes fail, show a concise upgrade message for OpenSpec 1.5.0+ and keep the dashboard functional as Local Root.
- Registering a store should be available from Local Root as a primary contextual action, not buried in the lower maintenance panel.
