# CLI Integration Specification

## Purpose

Integrate with OpenSpec CLI to retrieve data and execute commands, serving as the data layer for the extension.

## Requirements

### Requirement: CLI Availability Check
The system SHALL verify OpenSpec CLI is available before operation.

#### Scenario: CLI installed and available
- GIVEN the extension activates
- WHEN checking for CLI availability
- THEN the command `openspec --version` MUST execute successfully
- AND the version MUST be parsed and stored
- AND the extension MUST continue normal operation

#### Scenario: CLI not found
- GIVEN the extension activates
- AND `openspec` command is not in PATH
- WHEN checking for CLI availability
- THEN an error notification MUST be shown
- AND the error MUST include installation instructions
- AND the error MUST provide a link to OpenSpec documentation
- AND core extension features MUST be disabled gracefully

#### Scenario: Minimum version check
- GIVEN the extension requires OpenSpec >= 1.0.0
- AND the installed version is 0.9.0
- WHEN checking CLI version
- THEN a warning MUST be shown
- AND the user MUST be prompted to upgrade
- AND the extension SHOULD still attempt to function

### Requirement: Change Data Retrieval
The system SHALL retrieve change information via CLI.

#### Scenario: List all changes
- GIVEN `openspec list --json` returns valid JSON
- WHEN the extension requests change list
- THEN the response MUST be parsed into Change objects
- AND each change MUST include:
  - name
  - completedTasks
  - totalTasks
  - lastModified
  - status (draft/active/completed)

#### Scenario: Get change details
- GIVEN `openspec show <change> --json` returns change metadata
- WHEN details are requested for a specific change
- THEN the response MUST include:
  - name
  - schema
  - artifacts (list of available artifacts)
  - tasks (if tasks.md exists)
  - metadata (from .openspec.yaml if present)

#### Scenario: CLI command fails
- GIVEN `openspec list` returns non-zero exit code
- WHEN the extension calls the CLI
- THEN the error output MUST be captured
- AND an error MUST be logged
- AND the UI MUST show a friendly error message
- AND the system MUST retry with exponential backoff

### Requirement: Spec Data Retrieval
The system SHALL retrieve spec information via CLI.

#### Scenario: List all specs
- GIVEN `openspec list --specs --json` returns spec data
- WHEN the extension requests spec list
- THEN the response MUST be parsed
- AND each spec MUST include:
  - id (directory name)
  - requirementCount
  - path

#### Scenario: Get spec details
- GIVEN a spec exists at `openspec/specs/<id>/spec.md`
- WHEN spec details are requested
- THEN the file MUST be read directly
- AND the markdown MUST be parsed to extract:
  - Requirements (## Requirements sections)
  - Scenarios (#### Scenario: lines)
  - Purpose statement

### Requirement: Command Execution
The system SHALL execute OpenSpec commands on behalf of the user.

#### Scenario: Create new change
- GIVEN the user requests to create a change named "add-feature"
- WHEN the extension executes the command
- THEN `openspec new change add-feature` MUST be run
- AND the exit code MUST be checked
- AND on success, the change list MUST be refreshed
- AND the UI MUST navigate to the new change

#### Scenario: Archive change
- GIVEN a completed change exists
- WHEN the user archives it via the UI
- THEN `openspec archive <change>` MUST be executed
- AND the output MUST be captured and shown to user
- AND on success, the change MUST move to archive section

#### Scenario: Validate change
- GIVEN a change exists
- WHEN the user clicks "Validate"
- THEN `openspec validate <change>` MUST be run
- AND validation results MUST be displayed in the UI
- AND errors MUST be highlighted

### Requirement: Process Management
The system SHALL manage CLI process lifecycle correctly.

#### Scenario: Async command execution
- GIVEN a CLI command is executed
- WHEN the command is long-running (> 1 second)
- THEN the extension MUST not block the UI
- AND a loading indicator MUST be shown
- AND the user MUST be able to cancel if needed

#### Scenario: Concurrent command handling
- GIVEN multiple CLI commands are triggered
- WHEN executed
- THEN commands MUST be queued or executed in parallel safely
- AND race conditions MUST be avoided
- AND resource limits MUST be respected

#### Scenario: Process timeout
- GIVEN a CLI command is running
- WHEN it exceeds 30 seconds
- THEN the process MUST be killed
- AND a timeout error MUST be shown
- AND the system MUST recover gracefully

### Requirement: JSON Parsing
The system SHALL correctly parse CLI JSON output.

#### Scenario: Valid JSON response
- GIVEN CLI returns `{"changes": [...]}`
- WHEN parsed
- THEN the data MUST be validated against expected schema
- AND TypeScript types MUST be enforced
- AND invalid fields MUST be ignored or defaulted

#### Scenario: Malformed JSON
- GIVEN CLI returns invalid JSON
- WHEN parsing is attempted
- THEN an error MUST be caught
- AND the raw output MUST be logged for debugging
- AND a fallback MUST be used (empty data or retry)

#### Scenario: JSON with unexpected structure
- GIVEN CLI output structure changes (e.g., new fields)
- WHEN parsed
- THEN the extension MUST handle gracefully
- AND unknown fields MUST be ignored
- AND required fields MUST be validated

### Requirement: Error Handling
The system SHALL handle CLI integration errors robustly.

#### Scenario: Command not found
- GIVEN `openspec` is not in PATH
- WHEN any CLI command is attempted
- THEN a clear error MUST be shown once per session
- AND the error MUST not spam the user
- AND a "Dismiss" option MUST be provided

#### Scenario: Permission denied
- GIVEN the user lacks execute permission on `openspec`
- WHEN a command is executed
- THEN the permission error MUST be detected
- AND a helpful message MUST guide the user to fix it

#### Scenario: Workspace not initialized
- GIVEN `openspec/` directory doesn't exist
- WHEN CLI commands are executed
- THEN the error from CLI MUST be captured
- AND the UI MUST suggest running `openspec init`
- AND an "Initialize Now" button SHOULD be provided

### Requirement: Performance
The system SHALL optimize CLI integration for responsiveness.

#### Scenario: Cache CLI output
- GIVEN `openspec list` was called 10 seconds ago
- WHEN another list request is made
- THEN the cached result SHOULD be returned
- AND the cache MUST be invalidated on file changes
- AND the cache TTL SHOULD be configurable (default 10s)

#### Scenario: Batch CLI calls
- GIVEN multiple data requests are queued
- WHEN possible
- THEN multiple requests SHOULD be combined into one CLI call
- AND the result SHOULD be shared among requesters

#### Scenario: Debounce rapid calls
- GIVEN the UI triggers multiple rapid refresh requests
- WHEN within 500ms window
- THEN only the last request SHOULD execute
- AND earlier requests SHOULD be cancelled

## Design Constraints

- All CLI calls MUST be asynchronous (non-blocking)
- CLI output MUST be UTF-8 encoded
- Process spawning MUST use Node.js `child_process.spawn`
- Error messages MUST be user-friendly (not raw CLI errors)
- The system MUST not depend on CLI internal implementation details

## Dependencies

- Node.js `child_process` module
- OpenSpec CLI installed globally or locally
- JSON parsing capability
- TypeScript type definitions for CLI output
