## MODIFIED Requirements

### Requirement: Cache-aware dashboard rendering
Dashboard SHALL render valid cached dashboard data while fresh data is being loaded, and a Project Dashboard SHALL reuse the current binding-matching Project workspace snapshot instead of starting a click-time scan.

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
- **GIVEN** dashboard has cached data for multiple scopes or Project bindings
- **WHEN** the user switches from one scope or Project binding to another
- **THEN** dashboard MUST only render cached data belonging to the selected identity
- **AND** dashboard MUST NOT show changes or specs from the previous identity as if they belonged to the new selection

#### Scenario: Project Dashboard reuses the warm Sidebar snapshot
- **GIVEN** the Project-first Sidebar already holds a binding-matching Project workspace snapshot
- **WHEN** the user opens the Project Dashboard
- **THEN** the Host MUST send that snapshot to the Dashboard Editor immediately
- **AND** the click MUST NOT trigger another root resolution or a second full Project scan

#### Scenario: One refresh updates both Project surfaces
- **GIVEN** the Project Sidebar and Project Dashboard are both open for the same binding
- **WHEN** an explicit refresh or watcher event produces fresh Project data
- **THEN** the Host MUST assemble one fresh Project workspace snapshot
- **AND** the Host MUST publish the binding-matching result to both surfaces
- **AND** an older generation MUST NOT overwrite a newer Project selection

### Requirement: Dashboard Actions
The system SHALL provide quick actions for common operations, workflow-oriented quick actions SHALL route through shared OpenSpec workflow command routing, and Verify/Archive quick actions SHALL be able to open the interactive `Verify & Archive` workflow.

#### Scenario: Create new change
- **GIVEN** the Project-first Sidebar is open
- **WHEN** the user invokes the native New Change view-title action
- **THEN** a dialog MUST prompt for the change name
- **AND** on submission, `openspec new change <name>` MUST be executed
- **AND** the new change MUST appear in the current Project surfaces

#### Scenario: Refresh data
- **GIVEN** at least one Project surface is open
- **WHEN** the user invokes the native Refresh action
- **THEN** current data MUST be reloaded from the official Project sources
- **AND** one binding-validated refresh result MUST be shared with the open Sidebar and Project Dashboard

#### Scenario: Open Project Dashboard
- **GIVEN** the Project-first action grid is visible
- **WHEN** the user activates Dashboard
- **THEN** the extension MUST open or reveal the singleton Project Dashboard Editor
- **AND** the action MUST NOT replace the active local Sidebar view

#### Scenario: Copy opsx command
- **GIVEN** a change in the dashboard
- **WHEN** the user clicks a copy-command quick action
- **THEN** the command builder MUST generate the command using the Clipboard target
- **AND** the generated command MUST use colon format such as `/opsx:apply <change>`
- **AND** the generated command MUST be copied to clipboard
- **AND** a notification SHOULD confirm the copy action

#### Scenario: Open workflow command from quick action through launch settings
- **GIVEN** a change in the dashboard
- **WHEN** the user clicks a workflow quick action such as Continue, FF, Apply, or Sync
- **THEN** the action MUST route through the shared workflow launch settings
- **AND** `openspec.workflowLaunchMode=clipboard` MUST copy the generated command and show a non-modal notification
- **AND** `openspec.workflowLaunchMode=adapter` MUST route through the selected adapter's configured launch behavior
- **AND** the dashboard quick action MUST NOT directly modify OpenSpec change files

#### Scenario: Cursor quick action uses hyphen command when adapter launch is selected
- **GIVEN** `openspec.workflowLaunchMode` is `adapter`
- **AND** the selected adapter target is Cursor
- **WHEN** the user clicks a workflow quick action in the dashboard
- **THEN** the command opened, copied, or executed through Cursor MUST use `/opsx-<action> <change>` format

#### Scenario: Default dashboard quick action is clipboard safe
- **GIVEN** the extension uses default settings
- **WHEN** the user clicks a workflow quick action other than interactive Verify or Archive in the dashboard
- **THEN** the generated command MUST be copied to the clipboard
- **AND** no Agent window, deeplink, or CLI process MUST start automatically

#### Scenario: Dashboard Verify quick action opens interactive workflow
- **GIVEN** a change card displays a Verify quick action
- **WHEN** the user clicks that action
- **THEN** the extension MUST open the change detail view
- **AND** the change detail view MUST switch to `Verify & Archive`
- **AND** the Verify terminal workflow MAY start immediately
- **AND** the quick action MUST NOT use headless `agentCli`

#### Scenario: Dashboard Archive quick action opens interactive workflow
- **GIVEN** a change card displays an Archive quick action
- **WHEN** the user clicks that action
- **THEN** the extension MUST open the change detail view
- **AND** the change detail view MUST switch to `Verify & Archive`
- **AND** the Archive terminal workflow MAY start immediately
- **AND** the quick action MUST NOT call direct `archiveChange`

## ADDED Requirements

### Requirement: Project Dashboard summary surface
The Project Dashboard SHALL present a wide Editor-oriented summary derived only from the current binding-matching Project workspace snapshot.

#### Scenario: Dashboard reports truthful Project metrics
- **GIVEN** the snapshot contains active and archived Changes with lifecycle and task totals
- **WHEN** the Project Dashboard renders its KPI summary
- **THEN** it MUST show Total Changes, Active Changes, Ready to Verify, Archived, Active Tasks, and Active Task Completion Rate
- **AND** completion rate MUST be calculated from the sum of completed active tasks divided by the sum of total active tasks
- **AND** a zero-task Project MUST display a defined empty value rather than `NaN` or an invented percentage

#### Scenario: Dashboard uses official lifecycle distribution
- **GIVEN** active Changes have Host-derived lifecycle status
- **WHEN** the status distribution renders
- **THEN** it MUST use planning, ready-to-apply, applying, ready-to-verify, and archived counts
- **AND** it MUST NOT relabel task completion as an archived or fully finished workflow

#### Scenario: Dashboard derives Artifact Readiness from declared artifacts
- **GIVEN** Changes declare schema artifact ids and statuses
- **WHEN** Artifact Readiness renders
- **THEN** each displayed artifact id MUST use done-versus-declared counts from the current Project Changes
- **AND** the UI MUST NOT assume every schema has exactly Proposal, Design, Tasks, and Specs

#### Scenario: Referenced Store data does not alter Project metrics
- **GIVEN** the current Project references one or more Stores
- **WHEN** the Dashboard derives Change, task, lifecycle, or readiness metrics
- **THEN** referenced Store Specs MUST NOT be counted as current Project Changes, tasks, or artifacts

#### Scenario: Dashboard shows recent updates without invented history
- **GIVEN** Changes include last-modified timestamps
- **WHEN** the Dashboard renders recent activity
- **THEN** it MUST order a bounded Recent Updates list from those timestamps
- **AND** it MUST NOT present file modification times as a historical task-progress timeline

#### Scenario: Dashboard remains operable across states
- **WHEN** the Dashboard is loading, stale, empty, failed, narrow, or used with reduced motion and keyboard navigation
- **THEN** it MUST expose understandable text state and accessible controls
- **AND** decorative visualizations MUST have equivalent textual counts
