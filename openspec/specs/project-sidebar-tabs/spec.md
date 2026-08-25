# Project Sidebar Tabs Specification

## Purpose

Project Sidebar Tabs requirements synced from completed change `add-project-sidebar-tabs-store-workset-actions`.

## Requirements

### Requirement: Project action launcher and local browsing
Project-first Sidebar SHALL provide a fixed 2×2 action launcher for Changes, Specs, Worksets, and Dashboard while keeping list and Project navigation inside the Sidebar.

#### Scenario: Render the four actions in a stable grid
- **WHEN** the current Project binding is available
- **THEN** the Sidebar MUST render Changes, Specs, Worksets, and Dashboard in that order as a 2×2 grid
- **AND** New Change and Refresh MUST NOT replace any of the four grid positions

#### Scenario: Browse Changes locally
- **GIVEN** the current Project workspace snapshot contains active and archived Changes
- **WHEN** the user activates Changes
- **THEN** the Sidebar MUST switch to the local Changes view
- **AND** the Host MUST NOT create a Changes Explorer Editor or repeat root resolution solely because of the click

#### Scenario: Browse Specs locally
- **GIVEN** the current snapshot contains Project Specs and optional referenced Store groups
- **WHEN** the user activates Specs
- **THEN** the Sidebar MUST switch to the local Specs view
- **AND** the Host MUST NOT create a Specs Explorer Editor or repeat root resolution solely because of the click

#### Scenario: Open Workset mode locally
- **GIVEN** official Workset navigation reports that the current Project belongs to one or more Worksets
- **WHEN** the user activates Worksets
- **THEN** the Sidebar MUST open the local Workset Project picker
- **AND** it MUST NOT invoke whole-Workset open

#### Scenario: Worksets action is unavailable
- **GIVEN** the current Project belongs to no Workset, Worksets are unsupported, or trusted navigation cannot be loaded
- **WHEN** the four-action grid renders
- **THEN** the Worksets position MUST remain visible with an explicit unavailable state
- **AND** activating it MUST NOT guess membership or change the current Project

#### Scenario: Open Project Dashboard
- **WHEN** the user activates Dashboard
- **THEN** the Host MUST open or reveal the distinct Project Dashboard Editor
- **AND** the currently selected local Sidebar view MUST remain unchanged

#### Scenario: Open a Change or Spec detail
- **WHEN** the user selects a Change or Spec from a local Sidebar view
- **THEN** the existing binding-aware detail surface MAY open in an Editor
- **AND** the local Sidebar view MUST remain the navigation source

#### Scenario: Narrow Sidebar remains operable
- **WHEN** the launcher and local content are rendered in a narrow Sidebar
- **THEN** every action MUST be keyboard focusable with a visible focus state and an accessible name
- **AND** long Project, Store, Change, and Spec labels MUST remain bounded without overlapping controls
- **AND** local action selection MUST be exposed without treating the mixed launcher as one ARIA tablist

### Requirement: Unified Project workspace payload
The Extension Host SHALL provide one binding-scoped Project workspace payload containing active and archived Changes, Project Specs, referenced Store Specs, and Workset navigation for reuse by the Project Sidebar and Project Dashboard.

#### Scenario: First load has a valid cache
- **WHEN** a valid cached Project payload exists for the current binding
- **THEN** the Sidebar MUST render cached data before the fresh refresh completes
- **AND** the fresh response MUST replace only data for the same Project and binding

#### Scenario: Fresh load reuses one binding
- **WHEN** the Host refreshes the Project workspace payload
- **THEN** root resolution MUST be validated once for the current Project binding
- **AND** Changes, archived Changes, Project Specs, Store Specs, and navigation MUST be assembled without tab-specific or Dashboard-specific full scans

#### Scenario: One payload serves multiple surfaces
- **GIVEN** Sidebar and Project Dashboard are open for the same binding
- **WHEN** a fresh Project payload is accepted
- **THEN** both surfaces MUST receive data from that accepted snapshot
- **AND** surface-specific routing MUST NOT change the snapshot's Project or root identity

#### Scenario: Refresh fails after cached data is shown
- **WHEN** the fresh Project payload fails after cached data was displayed
- **THEN** the surfaces MUST keep the last binding-matching data
- **AND** they MUST expose a stale or recoverable state without replacing it with another Project's data
