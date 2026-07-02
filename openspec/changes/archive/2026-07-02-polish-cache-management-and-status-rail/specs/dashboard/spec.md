## ADDED Requirements

### Requirement: Operational status rail
Dashboard SHALL render OpenSpec runtime, scope, health, activity, and cache summary as a compact operational status rail instead of a large filled status card.

The status rail MUST fit narrow IDE sidebars, MUST use VS Code theme tokens, and MUST keep status meaning visible through text in addition to color. Icon-only controls in the rail MUST have accessible labels or tooltips.

#### Scenario: Rail shows normal runtime status
- **GIVEN** OpenSpec CLI is installed and the current scope is healthy
- **WHEN** dashboard renders the status rail
- **THEN** the rail MUST show the CLI source or mode, selected scope name, and health text in a compact two-line or equivalent layout
- **AND** the rail MUST NOT dominate the dashboard content like a large content card
- **AND** the health state MUST be understandable without relying only on green color

#### Scenario: Rail adapts to narrow sidebar width
- **GIVEN** the OpenSpec sidebar is rendered in a narrow IDE panel
- **WHEN** the selected scope name or cache summary is long
- **THEN** the rail MUST keep controls usable without horizontal overflow
- **AND** long labels MUST truncate or wrap in a controlled way
- **AND** primary dashboard actions MUST remain visible and clickable

#### Scenario: Rail exposes cache entry
- **GIVEN** cache statistics are available or being calculated
- **WHEN** dashboard renders the status rail
- **THEN** the rail MUST expose a cache entry showing a concise summary such as size and file count when available
- **AND** the cache entry MUST provide access to cache management actions
- **AND** unavailable cache stats MUST be represented as pending or unavailable without blocking the rest of the rail

#### Scenario: Rail uses accessible activity copy
- **GIVEN** dashboard is switching scope, refreshing cached data, or showing a warning
- **WHEN** the rail renders the current activity
- **THEN** the rail MUST show a concise text label for the activity
- **AND** spinner or progress indicators MUST be paired with accessible text
- **AND** warning or error states MUST remain visible after the transient spinner ends

### Requirement: Dashboard cache management entry
Dashboard SHALL provide a clear cache management entry connected to extension-host cache actions and settings/discovery surfaces.

The dashboard entry MUST allow users to open the cache folder, copy the cache path, clear the cache, and view cache details without knowing the editor-specific storage path.

#### Scenario: User opens cache action menu
- **GIVEN** dashboard status rail includes a cache entry
- **WHEN** the user activates the cache entry
- **THEN** dashboard MUST show available cache actions
- **AND** each action MUST send a typed message or command to the extension host
- **AND** dashboard MUST NOT attempt to read the filesystem directly from the webview

#### Scenario: Cache action completes
- **GIVEN** the user selects a cache action from dashboard
- **WHEN** extension host reports the action result
- **THEN** dashboard MUST show non-blocking success or failure feedback
- **AND** cache statistics MUST refresh after actions that mutate cache contents
- **AND** current dashboard data MUST remain visible unless the user explicitly clears and refreshes data

#### Scenario: Settings surface links to cache management
- **GIVEN** the user opens OpenSpec extension settings or command palette
- **WHEN** they look for cache management
- **THEN** the extension MUST expose discoverable commands or settings descriptions for opening, copying, clearing, and inspecting cache
- **AND** the description MUST make clear that cache lives in editor extension storage, not in the project

## MODIFIED Requirements

### Requirement: Scope transition feedback
Dashboard SHALL provide immediate visual feedback when the active OpenSpec scope is changing, and SHALL keep the visible activity label consistent with the data currently displayed.

The scope selector and store setup/register actions MUST enter a pending state as soon as the user triggers a scope-affecting action. The dashboard MUST prevent duplicate scope-affecting actions while the pending operation is active. `Switching` MUST only describe the period before dashboard data for the target scope is visible; once target-scope cached data is displayed, dashboard MUST show a cached-refresh activity instead of continuing to show switching.

#### Scenario: Select different scope
- **GIVEN** dashboard shows multiple OpenSpec scopes
- **WHEN** the user selects a different scope from the scope selector
- **THEN** dashboard MUST immediately show a loading indicator associated with scope switching
- **AND** dashboard MUST disable duplicate scope selection until the operation completes
- **AND** dashboard MUST request data for the selected scope from the extension host

#### Scenario: Target cached data arrives during scope switch
- **GIVEN** dashboard is showing a scope switching pending state for a selected target scope
- **WHEN** the extension host returns cached dashboard data marked stale for the selected target scope
- **THEN** dashboard MUST display changes and specs for the selected target scope
- **AND** the scope selector MUST show the selected target scope
- **AND** dashboard MUST clear the scope switching label
- **AND** dashboard MUST show a cached-refresh activity such as `Showing cached data while refreshing`

#### Scenario: Fresh data arrives after cached scope data
- **GIVEN** dashboard is displaying cached data for the selected target scope with a cached-refresh activity
- **WHEN** fresh dashboard data for that scope arrives from the extension host
- **THEN** dashboard MUST replace cached data with fresh data
- **AND** dashboard MUST clear the cached-refresh activity
- **AND** dashboard MUST keep the scope selector on the selected scope

#### Scenario: Scope switch succeeds without cached intermediate data
- **GIVEN** dashboard is showing a scope switching pending state
- **WHEN** the extension host returns fresh dashboard data for the selected scope
- **THEN** dashboard MUST display changes and specs for the selected scope
- **AND** dashboard MUST clear the scope switching pending state
- **AND** the scope selector MUST show the selected scope

#### Scenario: Scope switch fails before target data is visible
- **GIVEN** dashboard is showing a scope switching pending state
- **WHEN** the extension host reports a failure before any data for the selected scope is displayed
- **THEN** dashboard MUST clear the scope switching pending state
- **AND** dashboard MUST keep or restore the last successfully loaded dashboard data
- **AND** dashboard MUST show an error or warning explaining that scope data could not be loaded

#### Scenario: Fresh refresh fails after target cached data is visible
- **GIVEN** dashboard is displaying cached data for the selected target scope
- **WHEN** the extension host reports that fresh refresh failed
- **THEN** dashboard MUST keep displaying the target scope cached data
- **AND** dashboard MUST stop showing switching or refresh spinners
- **AND** dashboard MUST show a warning that visible data may be stale

#### Scenario: Store setup or register pending
- **GIVEN** dashboard displays store setup or register actions
- **WHEN** the user starts setup or register from the dashboard
- **THEN** dashboard MUST show a pending state for that action
- **AND** dashboard MUST refresh scope metadata after the action succeeds
- **AND** dashboard MUST prevent duplicate setup/register clicks while the action is pending
