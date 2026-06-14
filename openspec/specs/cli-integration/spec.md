# CLI Integration Specification

## Purpose

Integrate with OpenSpec CLI to retrieve data and execute commands, serving as the data layer for the extension.

## Requirements

### Requirement: CLI Availability Check
The system SHALL verify OpenSpec CLI is available before operation, including GUI-launched Cursor/VS Code sessions whose Extension Host PATH differs from the user's terminal shell PATH, and SHALL produce structured activation diagnostics when availability cannot be established.

#### Scenario: CLI installed and available
- GIVEN the extension activates
- WHEN checking for CLI availability
- THEN the command `openspec --version` MUST execute successfully
- AND the version MUST be parsed and stored
- AND the extension MUST continue normal operation
- AND any previous CLI activation diagnostic MUST be cleared

#### Scenario: CLI path configured explicitly
- GIVEN `openspec.cliPath` is configured with an executable path
- WHEN checking for CLI availability
- THEN the configured path MUST be validated with `--version`
- AND the validated configured path MUST be used for subsequent OpenSpec CLI commands
- AND automatic PATH or shell discovery MUST NOT override the configured path

#### Scenario: CLI available through Extension Host PATH
- GIVEN `openspec.cliPath` is empty
- AND `openspec` is resolvable from the Extension Host process PATH
- WHEN checking for CLI availability
- THEN the extension MUST validate `openspec --version`
- AND the extension MUST continue normal operation without invoking shell PATH discovery

#### Scenario: CLI available only through terminal shell PATH
- GIVEN `openspec.cliPath` is empty
- AND `openspec` is not resolvable from the Extension Host process PATH
- AND the user's login shell can resolve `openspec` with `command -v openspec`
- WHEN checking for CLI availability
- THEN the extension MUST validate the resolved absolute path with `--version`
- AND the extension MUST cache the validated path for subsequent OpenSpec CLI commands during the extension session
- AND the extension MUST continue normal operation

#### Scenario: CLI available in common install path
- GIVEN `openspec.cliPath` is empty
- AND direct PATH lookup and shell PATH discovery do not resolve `openspec`
- AND `openspec` exists at a known installation path such as `/opt/homebrew/bin/openspec`, `/usr/local/bin/openspec`, or `/usr/bin/openspec`
- WHEN checking for CLI availability
- THEN the extension MUST validate the candidate path with `--version`
- AND the extension MUST use the first validated candidate path for subsequent OpenSpec CLI commands

#### Scenario: CLI not found
- GIVEN the extension activates
- AND `openspec` cannot be resolved through configured path, Extension Host PATH, shell PATH discovery, or known installation paths
- WHEN checking for CLI availability
- THEN a CLI activation diagnostic MUST be created with category `cli-not-found`
- AND the diagnostic MUST include safe user-facing details about the failed resolution attempts
- AND the diagnostic MUST provide `open-docs`, `open-settings`, `retry`, and `copy-diagnostics` recovery actions
- AND the diagnostic log MUST include the attempted resolution methods and relevant PATH information
- AND core extension features MUST be disabled gracefully or remain limited to existing cached data

#### Scenario: Configured path invalid
- GIVEN `openspec.cliPath` is configured
- AND the configured path is missing, not executable, or fails `--version`
- WHEN checking for CLI availability
- THEN a CLI activation diagnostic MUST be created with category `configured-path-invalid`
- AND the diagnostic MUST identify that the configured path is invalid without exposing sensitive path segments in user-copyable diagnostics
- AND automatic discovery MUST NOT silently ignore the configured path unless the user clears or corrects it
- AND the diagnostic MUST provide `open-settings`, `copy-diagnostics`, and `open-docs` recovery actions

#### Scenario: CLI spawn fails after resolution
- GIVEN the resolver returns a candidate CLI command
- AND spawning the command fails, including Windows shim or `.cmd` launch failures
- WHEN checking for CLI availability
- THEN a CLI activation diagnostic MUST be created with category `spawn-failed`
- AND the diagnostic MUST preserve the low-level error code such as `ENOENT` when available
- AND the diagnostic MUST provide `open-settings`, `copy-diagnostics`, `retry`, and `open-docs` recovery actions

#### Scenario: Shell resolution fails
- GIVEN direct Extension Host PATH lookup fails
- AND login shell PATH resolution times out, returns no path, errors, or is skipped as unsafe
- AND no known installation path restores CLI availability
- WHEN checking for CLI availability
- THEN a CLI activation diagnostic MUST be created with category `shell-resolution-failed`
- AND the diagnostic MUST include safe details that shell resolution failed without exposing raw shell output
- AND the diagnostic MUST provide `open-settings`, `open-docs`, `copy-diagnostics`, and `retry` recovery actions

#### Scenario: Version check fails for resolved CLI
- GIVEN the resolver identifies a CLI command candidate
- AND executing `openspec --version` fails, times out, or returns unusable output
- WHEN checking for CLI availability
- THEN a CLI activation diagnostic MUST be created with category `version-check-failed`
- AND the diagnostic MUST include safe details that the command could start but version validation failed
- AND the diagnostic MUST provide `open-docs`, `copy-diagnostics`, and `retry` recovery actions

#### Scenario: Minimum version check
- GIVEN the extension requires OpenSpec >= 1.0.0
- AND the installed version is 0.9.0
- WHEN checking CLI version
- THEN a warning MUST be shown
- AND the user MUST be prompted to upgrade
- AND the extension SHOULD still attempt to function

### Requirement: Change Data Retrieval
The system SHALL retrieve change information via CLI and enrich dashboard-facing change objects with cached metadata needed for sidebar display and filtering.

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

#### Scenario: Enrich change with Proposal Why summary
- GIVEN a change has a `proposal.md` file with a `## Why` section
- WHEN dashboard data is refreshed
- THEN the change object MUST include a plain-text Proposal Why summary no longer than 150 characters
- AND the change object MUST include the full plain-text Proposal Why text for hover display and search
- AND markdown formatting and extra whitespace MUST be normalized before display

#### Scenario: Proposal summary unavailable
- GIVEN a change has no `proposal.md`
- OR the proposal has no readable `## Why` section
- WHEN dashboard data is refreshed
- THEN the change object MUST still be returned
- AND Proposal Why summary fields MUST be omitted or empty
- AND dashboard loading MUST NOT fail because the summary could not be extracted

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
The system SHALL handle CLI integration errors robustly and provide structured, actionable, and privacy-preserving diagnostics when the executable cannot be resolved or launched.

#### Scenario: Command not found
- GIVEN `openspec` cannot be resolved by the CLI path resolver
- WHEN any CLI command is attempted
- THEN a clear error MUST be shown once per session for the same diagnostic key
- AND the error MUST not spam the user
- AND the error MUST offer installation instructions or settings recovery based on the diagnostic category
- AND the output log MUST mention `openspec.cliPath`, `process.env.PATH`, `process.env.SHELL`, and attempted fallback paths

#### Scenario: Configured CLI path invalid
- GIVEN `openspec.cliPath` is configured
- AND the configured path is missing, not executable, or fails `--version`
- WHEN checking for CLI availability
- THEN the error MUST identify the configured path as invalid
- AND the error MUST suggest clearing or correcting `openspec.cliPath`
- AND automatic discovery MUST NOT silently ignore the configured path unless the user clears it

#### Scenario: Shell path discovery fails
- GIVEN direct PATH lookup fails
- AND shell PATH discovery times out, errors, or returns no path
- WHEN checking for CLI availability
- THEN the extension MUST continue to known installation path checks
- AND the output log MUST include the shell command failure or timeout
- AND no untrusted shell output MUST be executed

#### Scenario: Permission denied
- GIVEN the user lacks execute permission on `openspec`
- WHEN a command is executed
- THEN the permission error MUST be detected
- AND a CLI activation diagnostic MUST be created with category `permission-denied`
- AND a helpful message MUST guide the user to fix it

#### Scenario: Workspace not initialized
- GIVEN `openspec/` directory doesn't exist
- WHEN CLI commands are executed
- THEN the error from CLI MUST be captured
- AND the UI MUST suggest running `openspec init`
- AND an "Initialize Now" button SHOULD be provided
- AND the error MUST NOT be classified as a CLI activation diagnostic
- AND it MUST NOT use CLI activation diagnostic recovery actions such as `open-settings` or `copy-diagnostics`

#### Scenario: Diagnostic category maps to deterministic recovery actions
- GIVEN a CLI activation diagnostic is created
- WHEN the diagnostic is converted to UI actions
- THEN `configured-path-invalid` MUST map to `open-settings`, `copy-diagnostics`, and `open-docs`
- AND `cli-not-found` MUST map to `open-docs`, `open-settings`, `retry`, and `copy-diagnostics`
- AND `permission-denied` MUST map to `open-docs`, `copy-diagnostics`, and `retry`
- AND `spawn-failed` MUST map to `open-settings`, `copy-diagnostics`, `retry`, and `open-docs`
- AND `shell-resolution-failed` MUST map to `open-settings`, `open-docs`, `copy-diagnostics`, and `retry`
- AND `version-check-failed` MUST map to `open-docs`, `copy-diagnostics`, and `retry`
- AND `unknown` MUST map to `copy-diagnostics`, `retry`, and `open-docs`

#### Scenario: User-copyable diagnostics are sanitized
- GIVEN a CLI activation diagnostic includes raw resolver details
- WHEN the user copies diagnostics
- THEN the copied text MUST NOT include the full `process.env.PATH`
- AND it MUST NOT include full home-directory paths or username path segments
- AND it MUST NOT include environment variables containing `TOKEN`, `KEY`, `SECRET`, or `PASSWORD`
- AND it MUST preserve platform, architecture, diagnostic category, recovery action ids, resolver attempt labels, and stable error codes

#### Scenario: Duplicate notifications are suppressed per session
- GIVEN the same diagnostic category and normalized message occur multiple times in the same extension session
- WHEN CLI availability checks fail repeatedly
- THEN VS Code error notification MUST be shown at most once for that diagnostic key
- AND Output logging MAY record every failure
- AND Dashboard diagnostic state MUST still refresh for every failed check

#### Scenario: Normalized notification key is stable and privacy-preserving
- GIVEN two CLI activation diagnostics have the same category
- AND their messages differ only by absolute user paths, repeated whitespace, timestamps, durations, or attempt numbers
- WHEN the notification dedupe key is computed
- THEN the normalized messages MUST be equal
- AND the normalized message MUST be generated by the extension host as part of the CLI activation diagnostic
- AND the normalized message MUST preserve stable error codes such as `ENOENT`, `EACCES`, `EPERM`, and exit codes
- AND the normalized message MUST NOT include full home-directory paths or username path segments
- AND the normalized message MUST be truncated to a bounded length before being used in the dedupe key

#### Scenario: Retry does not mutate user configuration
- GIVEN a CLI activation diagnostic is visible
- WHEN the user chooses Retry
- THEN the extension MUST re-run CLI availability detection
- AND it MUST NOT modify `openspec.cliPath`
- AND it MUST NOT install OpenSpec CLI
- AND if CLI becomes available, the previous diagnostic MUST be cleared
- AND if CLI remains unavailable, the diagnostic MUST be updated without creating duplicate notifications for the same diagnostic key

### Requirement: Performance
The system SHALL optimize CLI integration for responsiveness.

#### Scenario: Cache CLI output
- GIVEN dashboard data was already loaded during the current session
- WHEN the sidebar webview requests dashboard data again without an invalidating refresh
- THEN the cached dashboard data MUST be returned
- AND no new `openspec list` or per-change status scan MUST be started for that request
- AND the cache MUST be invalidated on OpenSpec file changes, explicit refresh, create change, archive change, and task write operations

#### Scenario: Share refresh result across consumers
- GIVEN a refresh is triggered by file watching, manual refresh, new/archive, or task write
- WHEN the refresh completes
- THEN the generated dashboard data MUST update the central cache
- AND the same dashboard data MUST be sent to any open dashboard sidebar webview
- AND consumers MUST NOT each start a duplicate refresh for the same state transition

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
