## ADDED Requirements

### Requirement: Project-first Workset navigation scene

Project-first Dashboard SHALL provide a separate Workset Project selection scene without creating a second Changes/Specs dashboard.

#### Scenario: Workset navigation is eligible

- **WHEN** the host supplies at least one confirmed Workset membership for the current Project
- **THEN** the Sidebar MUST show a Workset navigation entry using the existing VS Code/Cursor visual language
- **AND** the entry MUST make the current Project, Workset level, and selectable Project level distinguishable

#### Scenario: Project content scene remains focused

- **WHEN** the user is viewing a selected Project
- **THEN** the Sidebar MUST keep the existing Current Project identity, active Changes, All Changes, and Specs entry points
- **AND** it MUST NOT render the Workset picker and Project content as one ambiguous list

#### Scenario: Switching Project reuses content navigation

- **WHEN** the user selects a valid Project member
- **THEN** the Dashboard MUST replace the Project identity and active Changes with the selected Project data
- **AND** existing All Changes, Specs, Change Detail, and Spec Detail actions MUST remain available

#### Scenario: Workset navigation is hidden

- **WHEN** the current Project has no confirmed Workset membership or the workset capability is unavailable
- **THEN** the Dashboard MUST render the existing Project-first view without an empty or enabled Workset control
