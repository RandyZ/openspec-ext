## ADDED Requirements

### Requirement: Scope Bar
The Dashboard SHALL show a compact Scope Bar that makes the active OpenSpec runtime and selected writable root visible.

#### Scenario: Scope Bar shows local root
- **GIVEN** the selected scope is the workspace local OpenSpec root
- **WHEN** the dashboard renders
- **THEN** the Scope Bar MUST show the local root label
- **AND** it MUST show the root path in a concise, inspectable form
- **AND** it MUST show the resolved runtime source

#### Scenario: Scope Bar shows selected store
- **GIVEN** the selected scope is a registered store
- **WHEN** the dashboard renders
- **THEN** the Scope Bar MUST show the store id
- **AND** it MUST show that commands act on the store root
- **AND** it MUST distinguish explicit store scope from local root scope

#### Scenario: Scope Bar shows declared store
- **GIVEN** OpenSpec reports that the current workspace resolves through a declared store
- **WHEN** the dashboard renders
- **THEN** the Scope Bar MUST show the declared store id
- **AND** it MUST indicate that the selected root comes from project configuration

#### Scenario: Scope Bar remains compact in sidebar
- **GIVEN** the OpenSpec dashboard is shown in the sidebar
- **WHEN** the available width is narrow
- **THEN** runtime, scope, health, and actions MUST wrap or collapse without overlapping text
- **AND** the change list MUST remain readable below the Scope Bar

### Requirement: Store selection
The Dashboard SHALL allow users to switch between local root and registered store scopes when store-aware features are available.

#### Scenario: Store selector lists local root and registered stores
- **GIVEN** store-aware features are available
- **AND** registered stores exist
- **WHEN** the user opens the scope selector
- **THEN** the selector MUST include the local root when available
- **AND** it MUST include each registered store by id
- **AND** each option SHOULD include a concise path or health hint

#### Scenario: Selecting a store refreshes scoped data
- **GIVEN** the dashboard is showing local root data
- **WHEN** the user selects a registered store
- **THEN** the dashboard MUST refresh changes and specs from the selected store scope
- **AND** stale local-root changes MUST not remain visible as store changes

#### Scenario: Returning to local root restores local dashboard
- **GIVEN** the dashboard is showing a store scope
- **WHEN** the user selects the local root option
- **THEN** the dashboard MUST refresh changes and specs from the workspace root
- **AND** store-specific relationship data MUST no longer be shown as the active root relationship data

#### Scenario: Store selector hidden when unsupported
- **GIVEN** the resolved OpenSpec runtime does not support stores
- **WHEN** the dashboard renders
- **THEN** the store selector MUST NOT be shown as an enabled control
- **AND** the dashboard MAY show a concise message explaining that local source mode is needed for unreleased store support

### Requirement: Root health display
The Dashboard SHALL surface selected root health without blocking normal data display for non-fatal health findings.

#### Scenario: Healthy root
- **GIVEN** OpenSpec doctor reports the selected root is healthy
- **WHEN** the dashboard renders
- **THEN** the Scope Bar MUST show a healthy state
- **AND** no relationship warning card MUST be shown for root health

#### Scenario: Health findings are visible
- **GIVEN** OpenSpec doctor reports warnings or informational findings for the selected root
- **WHEN** the dashboard renders
- **THEN** the Scope Bar MUST show a warning or info state
- **AND** the relationship area MUST show diagnostic messages and fixes supplied by OpenSpec

#### Scenario: Doctor unavailable
- **GIVEN** base dashboard data can load
- **AND** doctor support is unavailable or probe-disabled
- **WHEN** the dashboard renders
- **THEN** the dashboard MUST continue to show changes and specs
- **AND** health status MUST be shown as unavailable rather than failed activation

### Requirement: Read-only references panel
The Dashboard SHALL show referenced stores as read-only upstream context for the selected scope.

#### Scenario: Resolved reference displays specs
- **GIVEN** the selected root has a resolved referenced store with specs
- **WHEN** the references panel renders
- **THEN** it MUST show the referenced store id
- **AND** it MUST show referenced spec ids and one-line summaries when provided by OpenSpec
- **AND** it MUST show a fetch command or action for reading a referenced spec

#### Scenario: Empty resolved reference remains visible
- **GIVEN** a referenced store resolves but has no specs
- **WHEN** the references panel renders
- **THEN** it MUST show the referenced store id
- **AND** it MUST indicate that no specs are currently available

#### Scenario: Unresolved reference displays fix
- **GIVEN** OpenSpec context or doctor reports an unresolved referenced store
- **WHEN** the references panel renders
- **THEN** it MUST show the store id and warning state
- **AND** it MUST show the fix text supplied by OpenSpec
- **AND** it MUST NOT hide the reference silently

#### Scenario: References do not expose write actions
- **GIVEN** a referenced store is displayed
- **WHEN** the user views the reference row or card
- **THEN** the UI MUST NOT show New Change, Apply, Sync, Verify, Archive, or task-toggle controls for that referenced store
- **AND** it MAY offer to select the referenced store as the active scope when the store is registered

### Requirement: Workset entry points
The Dashboard SHALL expose personal worksets as local open-together conveniences without making them project truth.

#### Scenario: Worksets are listed when supported
- **GIVEN** the runtime supports worksets
- **WHEN** the dashboard requests workset data
- **THEN** the UI MAY show saved workset names, preferred tool, and members
- **AND** the section MUST label worksets as local personal views

#### Scenario: Open workset action delegates to OpenSpec
- **GIVEN** a saved workset is visible
- **WHEN** the user chooses to open it
- **THEN** the extension MUST delegate to `openspec workset open <name>` or an equivalent OpenSpec command
- **AND** it MUST not write membership files into any member folder

#### Scenario: Workset management is not required for MVP
- **GIVEN** store-aware dashboard MVP is implemented
- **WHEN** worksets are displayed
- **THEN** create, edit, and remove workset UI MAY be absent
- **AND** the UI MUST still explain how the user can manage worksets through OpenSpec CLI when needed
