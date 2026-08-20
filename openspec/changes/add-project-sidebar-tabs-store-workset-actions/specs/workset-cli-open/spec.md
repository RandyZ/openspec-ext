## ADDED Requirements

### Requirement: Official Workset open action
The Workset management UI SHALL open a complete saved Workset through the official non-JSON `openspec workset open <name>` command and SHALL preserve the CLI's tool, member, and error semantics.

#### Scenario: Open a saved Workset
- **WHEN** the user clicks Open Workset for a saved Workset
- **THEN** the Host MUST invoke `openspec workset open <name>` without `--json`
- **AND** the official CLI MUST remain responsible for opener selection, member filtering, and generated workspace files

#### Scenario: Workset open reports an error
- **WHEN** the official Workset open command reports an unavailable tool, missing member, or launch failure
- **THEN** the Host MUST surface a recoverable error or CLI diagnostic
- **AND** it MUST NOT treat ordinary CLI output as a JSON parse failure

#### Scenario: Project picker selects a member
- **WHEN** the user activates a member inside the Project-first Workset picker
- **THEN** the action MUST switch the current Project binding within the Sidebar
- **AND** it MUST NOT invoke `openspec workset open` or open the whole Workset

### Requirement: Unambiguous Workset action labels
The UI SHALL distinguish whole-Workset opening from Project switching in labels, focus order, and message routing.

#### Scenario: Workset management card
- **WHEN** a saved Workset is shown in the Worksets management page
- **THEN** exactly one primary action MUST be labeled as opening the Workset
- **AND** the action MUST target the Workset name rather than an arbitrary member

#### Scenario: Project-first member row
- **WHEN** a selectable Project member is shown in the Project-first picker
- **THEN** its action MUST be labeled as switching/opening that Project within the current Sidebar
- **AND** Store members and invalid members MUST remain non-selectable
