## MODIFIED Requirements

### Requirement: Project action launcher and local browsing
Project-first Sidebar SHALL provide a fixed 2×2 action launcher for Changes, Specs, Worksets, and Dashboard as theme-native navigation cards while keeping list and Project navigation inside the Sidebar.

#### Scenario: Render the four actions in a stable grid
- **WHEN** the current Project binding is available
- **THEN** the Sidebar MUST render Changes, Specs, Worksets, and Dashboard in that order as a 2×2 grid
- **AND** every position MUST provide a bounded card target with a theme border, background, icon, title, and concise supporting text
- **AND** New Change and Refresh MUST NOT replace any of the four grid positions

#### Scenario: Browse Changes locally
- **GIVEN** the current Project workspace snapshot contains active and archived Changes
- **WHEN** the user activates Changes
- **THEN** the Sidebar MUST switch to the local Changes view
- **AND** Changes MUST expose its selected state through `aria-pressed` and a visible theme-aware style
- **AND** the Host MUST NOT create a Changes Explorer Editor or repeat root resolution solely because of the click

#### Scenario: Browse Specs locally
- **GIVEN** the current snapshot contains Project Specs and optional referenced Store groups
- **WHEN** the user activates Specs
- **THEN** the Sidebar MUST switch to the local Specs view
- **AND** Specs MUST expose its selected state through `aria-pressed` and a visible theme-aware style
- **AND** the Host MUST NOT create a Specs Explorer Editor or repeat root resolution solely because of the click

#### Scenario: Open Workset mode locally
- **GIVEN** official Workset navigation reports that the current Project belongs to one or more Worksets
- **WHEN** the user activates Worksets
- **THEN** the Sidebar MUST open the local Workset Project picker
- **AND** the Worksets card MUST expose its selected state and trusted membership count
- **AND** it MUST NOT invoke whole-Workset open

#### Scenario: Worksets action is unavailable
- **GIVEN** the current Project belongs to no Workset, Worksets are unsupported, or trusted navigation cannot be loaded
- **WHEN** the four-action grid renders
- **THEN** the Worksets position MUST remain visible with a distinct disabled style and concise unavailable text
- **AND** its accessible name or description MUST expose the complete unavailable reason
- **AND** activating it MUST NOT guess membership or change the current Project

#### Scenario: Open Project Dashboard
- **WHEN** the user activates Dashboard
- **THEN** the Dashboard card MUST indicate that it opens a distinct Editor rather than selecting a local Sidebar tab
- **AND** the Host MUST open or reveal the distinct Project Dashboard Editor
- **AND** the currently selected local Sidebar view MUST remain unchanged

#### Scenario: Open a Change or Spec detail
- **WHEN** the user selects a Change or Spec from a local Sidebar view
- **THEN** the existing binding-aware detail surface MAY open in an Editor
- **AND** the local Sidebar view MUST remain the navigation source

#### Scenario: Narrow Sidebar remains operable
- **WHEN** the launcher and local content are rendered in a narrow Sidebar
- **THEN** the launcher MUST remain a stable two-column grid without overlapping or horizontally scrolling controls
- **AND** every action MUST be keyboard focusable with a visible focus state and an accessible name
- **AND** long Project, Store, Change, Spec, and supporting labels MUST remain bounded without overlapping controls
- **AND** local action selection MUST be exposed without treating the mixed launcher as one ARIA tablist
