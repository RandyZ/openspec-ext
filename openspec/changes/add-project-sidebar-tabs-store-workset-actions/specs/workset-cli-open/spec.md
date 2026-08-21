## ADDED Requirements

### Requirement: Dynamic Worksets launcher
The Project-first action grid SHALL expose Workset Project navigation only from official, trusted Workset membership data.

#### Scenario: Current Project belongs to Worksets
- **GIVEN** official Workset navigation reports one or more Worksets containing the current Project
- **WHEN** the action grid renders
- **THEN** Worksets MUST be enabled and MUST expose the available membership count
- **AND** activating Worksets MUST show the local Project picker without invoking an external opener

#### Scenario: Current Project has no trusted Workset membership
- **GIVEN** no containing Workset is reported, the capability is unsupported, or trusted topology loading fails
- **WHEN** the action grid renders
- **THEN** Worksets MUST remain visible with a disabled or unavailable explanation
- **AND** the extension MUST NOT infer a Workset from repository layout or cached data for another Project

### Requirement: Official Workset open action
The Workset management UI SHALL open a complete saved Workset through the official non-JSON `openspec workset open <name>` command and SHALL preserve the CLI's tool, member, and error semantics.

#### Scenario: Open a saved Workset
- **WHEN** the user activates Open Workset for a saved Workset in the management page
- **THEN** the Host MUST invoke `openspec workset open <name>` without `--json`
- **AND** the official CLI MUST remain responsible for opener selection, member filtering, and generated workspace files

#### Scenario: Workset open reports an error
- **WHEN** the official Workset open command reports an unavailable tool, missing member, or launch failure
- **THEN** the Host MUST surface a recoverable error or CLI diagnostic
- **AND** it MUST preserve the non-zero exit and MUST NOT treat ordinary CLI output as a JSON parse failure

#### Scenario: Project picker selects a member
- **WHEN** the user activates a selectable Project member inside the Project-first Workset picker
- **THEN** the action MUST switch the current Project binding within the Sidebar
- **AND** it MUST NOT invoke `openspec workset open` or open the whole Workset

### Requirement: Unambiguous Workset action labels
The UI SHALL distinguish local Workset mode, whole-Workset opening, and Project switching in labels, focus order, and message routing.

#### Scenario: Worksets launcher
- **WHEN** Worksets is enabled in the Project action grid
- **THEN** its accessible name MUST describe browsing Workset Projects
- **AND** its message MUST only change the local Sidebar view

#### Scenario: Workset management card
- **WHEN** a saved Workset is shown in the Worksets management page
- **THEN** exactly one primary action MUST be labeled as opening the whole Workset
- **AND** the action MUST target the Workset name rather than an arbitrary member

#### Scenario: Project-first member row
- **WHEN** a selectable Project member is shown in the Project-first picker
- **THEN** its action MUST be labeled as switching to that Project within the current Sidebar
- **AND** Store members and invalid members MUST remain non-selectable
