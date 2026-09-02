## MODIFIED Requirements

### Requirement: Official Workset open action

The Workset UI SHALL open a complete saved Workset through the official non-JSON `openspec workset open <name> [--tool <id>]` command and SHALL preserve the CLI's tool, member, and error semantics.

#### Scenario: Open a saved Workset

- **WHEN** the user activates Open Workset for a saved Workset in the management page
- **THEN** the Host MUST invoke `openspec workset open <name>` without `--json`
- **AND** the official CLI MUST remain responsible for opener selection, member filtering, and generated workspace files

#### Scenario: Open a saved Workset with its configured tool

- **WHEN** the user activates whole-Workset Open without a one-time override
- **THEN** the Host MUST invoke `openspec workset open <name>` without `--json`
- **AND** the official CLI MUST remain responsible for saved opener selection, member filtering, and generated workspace files

#### Scenario: Open a saved Workset with a one-time tool override

- **WHEN** the user submits a non-empty opener id through `Open with another tool`
- **THEN** the Host MUST invoke `openspec workset open <name> --tool <id>` without `--json`
- **AND** the override MUST apply only to that invocation and MUST NOT mutate the saved Workset tool

#### Scenario: Workset open reports an error

- **WHEN** the official Workset open command reports an unavailable tool, missing member, or launch failure
- **THEN** the Host MUST surface a recoverable error or CLI diagnostic
- **AND** it MUST preserve the non-zero exit and MUST NOT treat ordinary CLI output as a JSON parse failure

#### Scenario: Project picker selects a member

- **WHEN** the user activates a selectable Project member inside Workset detail
- **THEN** the action MUST switch the current Project binding within the Sidebar
- **AND** it MUST NOT invoke `openspec workset open` or open the whole Workset

### Requirement: Unambiguous Workset action labels

The UI SHALL distinguish local Workset navigation, detail navigation, whole-Workset opening, one-time opener override, Project switching, and Planning Store selection in labels, focus order, and message routing.

#### Scenario: Worksets launcher

- **WHEN** Worksets is enabled in the Project action grid
- **THEN** its accessible name MUST describe browsing Worksets for the current Project
- **AND** its message MUST only change the local Sidebar view

#### Scenario: Workset list row

- **WHEN** a saved Workset is shown in the Project-first Worksets list
- **THEN** the row body MUST enter Workset detail without opening an external tool
- **AND** its separate `Open` action MUST target the Workset name and open the whole Workset

#### Scenario: Workset management card

- **WHEN** a saved Workset is shown in the Worksets management page
- **THEN** exactly one primary action MUST be labeled as opening the whole Workset
- **AND** the action MUST target the Workset name rather than an arbitrary member

#### Scenario: Workset detail actions

- **WHEN** Workset detail is visible
- **THEN** `Open all` MUST use the saved/default opener path and `Open with another tool` MUST request a one-time opener id
- **AND** neither action MUST switch the current Project or Planning root

#### Scenario: Project-first member row

- **WHEN** a selectable Project member is shown in Workset detail
- **THEN** its action MUST be labeled as switching to that Project within the current Sidebar
- **AND** Store members and invalid members MUST remain unavailable as Project targets

#### Scenario: Planning Store member row

- **WHEN** a validated non-current Store member is shown in Workset detail
- **THEN** its action MUST be labeled as using that Store as Planning root
- **AND** it MUST NOT be labeled or routed as Project switching or whole-Workset opening
