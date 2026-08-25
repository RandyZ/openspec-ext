## MODIFIED Requirements

### Requirement: Command Execution
The system SHALL execute OpenSpec commands on behalf of the user while preserving whether each official command expects JSON or ordinary CLI output, and direct archive execution SHALL occur only through explicit direct archive paths.

#### Scenario: Create new change
- **GIVEN** the user requests to create a change named "add-feature"
- **WHEN** the extension executes the command
- **THEN** `openspec new change add-feature` MUST be run
- **AND** the exit code MUST be checked
- **AND** on success, the change list MUST be refreshed
- **AND** the UI MUST navigate to the new change

#### Scenario: Archive change
- **GIVEN** a completed change exists
- **WHEN** the user explicitly confirms `Archive Now` in Change Detail or invokes the direct archive Command Palette action
- **THEN** `openspec archive <change>` MUST be executed
- **AND** ordinary output MUST be captured and surfaced safely
- **AND** on success, the change MUST move to the archive section and bound surfaces MUST refresh

#### Scenario: Review and Archive does not execute direct CLI archive
- **GIVEN** an unarchived change exists
- **WHEN** the user clicks `Review & Archive`
- **THEN** the extension MUST NOT execute direct `openspec archive <change>`
- **AND** the action MUST use the interactive archive workflow for the current binding

#### Scenario: Validate change
- **GIVEN** a change exists
- **WHEN** the user clicks "Validate"
- **THEN** `openspec validate <change>` MUST be run
- **AND** validation results MUST be displayed in the UI
- **AND** errors MUST be highlighted

#### Scenario: Open a Workset with ordinary CLI output
- **GIVEN** a saved Workset exists
- **WHEN** the user invokes the whole-Workset open action
- **THEN** the extension MUST execute the exact argument sequence `openspec workset open <name>`
- **AND** the command MUST NOT include `--json`
- **AND** ordinary stdout MUST NOT be passed through a JSON parser
- **AND** a non-zero exit status, stderr, and safe diagnostic details MUST remain available to the caller
