## ADDED Requirements

### Requirement: Scope transition feedback
Dashboard SHALL provide immediate visual feedback when the active OpenSpec scope is changing.

The scope selector and store setup/register actions MUST enter a pending state as soon as the user triggers a scope-affecting action. The dashboard MUST prevent duplicate scope-affecting actions while the pending operation is active.

#### Scenario: Select different scope
- **GIVEN** dashboard shows multiple OpenSpec scopes
- **WHEN** the user selects a different scope from the scope selector
- **THEN** dashboard MUST immediately show a loading indicator associated with scope switching
- **AND** dashboard MUST disable duplicate scope selection until the operation completes
- **AND** dashboard MUST request data for the selected scope from the extension host

#### Scenario: Scope switch succeeds
- **GIVEN** dashboard is showing a scope switching pending state
- **WHEN** the extension host returns dashboard data for the selected scope
- **THEN** dashboard MUST display changes and specs for the selected scope
- **AND** dashboard MUST clear the scope switching pending state
- **AND** the scope selector MUST show the selected scope

#### Scenario: Scope switch fails
- **GIVEN** dashboard is showing a scope switching pending state
- **WHEN** the extension host reports a failure while loading the selected scope
- **THEN** dashboard MUST clear the scope switching pending state
- **AND** dashboard MUST keep or restore the last successfully loaded dashboard data
- **AND** dashboard MUST show an error or warning explaining that scope data could not be loaded

#### Scenario: Store setup or register pending
- **GIVEN** dashboard displays store setup or register actions
- **WHEN** the user starts setup or register from the dashboard
- **THEN** dashboard MUST show a pending state for that action
- **AND** dashboard MUST refresh scope metadata after the action succeeds
- **AND** dashboard MUST prevent duplicate setup/register clicks while the action is pending

### Requirement: Cache-aware dashboard rendering
Dashboard SHALL render valid cached dashboard data while fresh data is being loaded.

Cached dashboard data MUST be visibly treated as potentially stale until fresh data is returned by the extension host.

#### Scenario: Open dashboard with cached data
- **GIVEN** valid cached dashboard data exists for the current workspace and scope
- **WHEN** the dashboard webview opens
- **THEN** dashboard MUST render cached changes and specs without waiting for a full CLI refresh
- **AND** dashboard MUST show a refreshing or stale indicator until fresh data arrives

#### Scenario: Fresh dashboard data replaces cache
- **GIVEN** dashboard is rendering cached data
- **WHEN** fresh dashboard data arrives from the extension host
- **THEN** dashboard MUST replace cached data with fresh data
- **AND** dashboard MUST clear the stale indicator
- **AND** search, status grouping, specs list, and scope metadata MUST reflect the fresh data

#### Scenario: Cached data is scoped
- **GIVEN** dashboard has cached data for multiple scopes
- **WHEN** the user switches from one scope to another
- **THEN** dashboard MUST only render cached data belonging to the selected scope
- **AND** dashboard MUST NOT show changes or specs from the previously selected scope as if they belonged to the new scope
