## MODIFIED Requirements

### Requirement: Change List Display
The system SHALL display all active changes grouped by status, with searchable contextual information for each change.

#### Scenario: Changes grouped by status
- GIVEN a workspace with multiple changes at different stages
- WHEN the user opens the dashboard
- THEN changes MUST be grouped into three sections:
  - Draft: changes with no tasks defined
  - Active: changes with incomplete tasks
  - Completed: changes with all tasks marked done
- AND each section MUST show a count in the header

#### Scenario: Empty state
- GIVEN a workspace with no changes
- WHEN the user opens the dashboard
- THEN an empty state message MUST be displayed
- AND a "Create New Change" button SHOULD be shown

#### Scenario: Change progress display
- GIVEN a change with tasks
- WHEN displayed in the dashboard
- THEN it MUST show:
  - Change name
  - Task progress (e.g., "3/5 tasks")
  - Last modified time (relative, e.g., "2h ago")
  - Visual progress indicator (progress bar or percentage)

#### Scenario: Proposal Why summary display
- GIVEN a change has a `proposal.md` file with a `## Why` section
- WHEN the change is displayed in the dashboard
- THEN the change card MUST show a summary of the Proposal Why content below the title
- AND the visible summary MUST be limited to 150 characters
- AND content longer than 150 characters MUST be truncated with `...`
- AND hovering the summary or card MUST expose the full Why text through a native tooltip or equivalent accessible hint

#### Scenario: Missing Proposal Why summary
- GIVEN a change has no proposal or no parseable `## Why` section
- WHEN the change is displayed in the dashboard
- THEN the change card MUST remain visible
- AND no summary extraction error MUST be shown to the user

#### Scenario: Search changes by loaded metadata
- GIVEN the dashboard has loaded changes
- WHEN the user enters a search query in the change list search input
- THEN the displayed changes MUST be filtered locally
- AND matching MUST include change name, status, artifact id, artifact status, Proposal Why summary, and Proposal Why full text
- AND the filtered list MUST preserve status grouping

#### Scenario: Search empty result
- GIVEN the dashboard has loaded changes
- WHEN the user enters a query that matches no loaded change metadata
- THEN the dashboard MUST show an empty search result message
- AND it MUST NOT trigger an OpenSpec CLI refresh for each typed character

### Requirement: Real-time Updates
The system SHALL reflect file system changes and extension-triggered state changes without requiring manual refresh.

#### Scenario: New change created
- GIVEN the dashboard is open
- WHEN a new change is created (via CLI or other means)
- THEN the new change MUST appear in the dashboard
- AND it MUST be added to the Draft section

#### Scenario: Task completion updates status
- GIVEN a change in the Active section
- WHEN the last task is marked complete (in file or via UI)
- THEN the change MUST move to the Completed section
- AND the progress indicator MUST update to show 100%

#### Scenario: Change deleted
- GIVEN a change displayed in the dashboard
- WHEN the change is deleted from the file system
- THEN it MUST be removed from the dashboard
- AND no error SHOULD be shown

#### Scenario: Sidebar receives refreshed dashboard data
- GIVEN the OpenSpec sidebar webview is open
- WHEN `DataManager.refresh()` completes because of file watcher events, task writes, new change, archive, or manual refresh
- THEN the sidebar MUST receive the latest dashboard data without requiring the user to click the reload button
- AND the change list, task counts, status grouping, specs list, and search metadata MUST reflect the refreshed data

#### Scenario: Existing cache avoids click-time reload
- GIVEN dashboard data has already been loaded
- WHEN the user reveals the OpenSpec sidebar or opens a change detail from a change card
- THEN the UI MUST reuse cached dashboard data where valid
- AND it MUST NOT perform an additional full OpenSpec scan solely because of the click

### Requirement: Dashboard Actions
The system SHALL provide quick actions for common operations.

#### Scenario: Create new change
- GIVEN the dashboard is open
- WHEN the user clicks "New Change" button
- THEN a dialog MUST prompt for the change name
- AND on submission, `openspec new change <name>` MUST be executed
- AND the new change MUST appear in the dashboard

#### Scenario: Refresh data
- GIVEN the dashboard is open
- WHEN the user clicks the refresh button
- THEN all data MUST be reloaded from the file system
- AND the UI MUST update to reflect current state
- AND the refresh result MUST be shared with the open sidebar webview

#### Scenario: Copy opsx command
- GIVEN a change in the dashboard
- WHEN the user clicks "Copy /opsx:ff"
- THEN the command `/opsx:ff <change-name>` MUST be copied to clipboard
- AND a notification SHOULD confirm the copy action
