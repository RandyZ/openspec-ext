## ADDED Requirements

### Requirement: Project-first Sidebar tab browsing
Project-first Sidebar SHALL provide Changes and Specs as local tabs for the currently selected Project binding, and SHALL keep list browsing inside the Sidebar.

#### Scenario: Switch between Changes and Specs tabs
- **WHEN** the user activates the Changes or Specs tab
- **THEN** the Sidebar MUST switch the visible list without creating an Editor Explorer panel
- **AND** the active Project label and binding MUST remain unchanged

#### Scenario: Open a Change or Spec detail
- **WHEN** the user selects a Change or Spec from a Sidebar list
- **THEN** the existing binding-aware detail surface MAY open in an Editor
- **AND** the list tab MUST remain the source of navigation rather than an Editor list Explorer

#### Scenario: Narrow Sidebar remains operable
- **WHEN** the tabs and their lists are rendered in a narrow Sidebar
- **THEN** both tabs MUST be keyboard focusable and operable
- **AND** long Project, Store, Change, and Spec labels MUST remain bounded without overlapping controls

### Requirement: Unified Project workspace payload
The Extension Host SHALL provide the Project-first Sidebar with binding-scoped Changes, archived Changes, Project Specs, referenced Store Specs, and Workset navigation data without requiring a separate full scan for each tab.

#### Scenario: First load has a valid cache
- **WHEN** a valid cached Project payload exists for the current binding
- **THEN** the Sidebar MUST render cached data before the fresh refresh completes
- **AND** the fresh response MUST replace only data for the same Project and binding

#### Scenario: Fresh load reuses one binding
- **WHEN** the Host refreshes the Project-first workspace payload
- **THEN** root resolution MUST be validated once for the current Project binding
- **AND** Changes, Specs, Store Specs, and navigation data MUST NOT trigger duplicate tab-specific Editor scans

#### Scenario: Refresh fails after cached data is shown
- **WHEN** the fresh Project payload fails after cached data was displayed
- **THEN** the Sidebar MUST keep the last binding-matching data
- **AND** it MUST expose a stale or recoverable state without replacing it with another Project's data
