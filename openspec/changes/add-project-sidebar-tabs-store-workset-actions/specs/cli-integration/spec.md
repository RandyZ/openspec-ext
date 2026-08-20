## MODIFIED Requirements

### Requirement: Command Execution
The system SHALL execute OpenSpec commands on behalf of the user, preserving whether each official command expects JSON or ordinary CLI output.

#### Scenario: Create new change
- **GIVEN** the user requests to create a change named "add-feature"
- **WHEN** the extension executes the command
- **THEN** `openspec new change add-feature` MUST be run
- **AND** the exit code MUST be checked
- **AND** on success, the change list MUST be refreshed
- **AND** the UI MUST navigate to the new change

#### Scenario: Archive change
- **GIVEN** a completed change exists
- **WHEN** the user archives it via the UI
- **THEN** `openspec archive <change>` MUST be executed
- **AND** the output MUST be captured and shown to user
- **AND** on success, the change MUST move to archive section

#### Scenario: Validate change
- **GIVEN** a change exists
- **WHEN** the user clicks "Validate"
- **THEN** `openspec validate <change>` MUST be run
- **AND** validation results MUST be displayed in the UI
- **AND** errors MUST be highlighted

#### Scenario: Open a Workset with ordinary CLI output
- **GIVEN** a saved Workset exists
- **WHEN** the user clicks Open Workset
- **THEN** the extension MUST execute `openspec workset open <name>` without `--json`
- **AND** it MUST NOT pass the command through a JSON parser
- **AND** the command's exit status and diagnostic output MUST be preserved
