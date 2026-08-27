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

### Requirement: CLI resolver supports runtime modes
The system SHALL resolve OpenSpec CLI commands through a runtime-mode-aware resolver that can produce a command, argument prefix, environment, version, and source metadata.

#### Scenario: Resolved command includes args prefix
- **GIVEN** the resolver selects local source mode
- **WHEN** a CLI command is executed
- **THEN** the process command MUST be the extension host Node executable
- **AND** the OpenSpec source entrypoint MUST be prepended to the CLI arguments before the requested OpenSpec arguments

#### Scenario: Installed CLI has empty args prefix
- **GIVEN** the resolver selects an installed CLI executable
- **WHEN** a CLI command is executed
- **THEN** the process command MUST be the resolved OpenSpec executable
- **AND** no local-source entrypoint argument MUST be prepended

#### Scenario: Resolver cache accounts for runtime settings
- **GIVEN** the resolver has cached a runtime
- **WHEN** `openspec.cliMode`, `openspec.cliPath`, or `openspec.localOpenSpecSourcePath` changes
- **THEN** the resolver MUST invalidate the cached runtime
- **AND** subsequent commands MUST use the newly resolved runtime

### Requirement: Local source runtime validation
The system SHALL validate local source runtime inputs with actionable diagnostics.

#### Scenario: Local source version check succeeds
- **GIVEN** local source mode is configured with a ready checkout
- **WHEN** the resolver runs `--version`
- **THEN** it MUST capture the reported OpenSpec version
- **AND** it MUST mark the runtime source as local source
- **AND** CLI activation diagnostics MUST be cleared

#### Scenario: Local source version check fails
- **GIVEN** local source mode is configured
- **AND** running the local source entrypoint with `--version` fails or times out
- **WHEN** availability is checked
- **THEN** the system MUST create a structured diagnostic with a local-source category
- **AND** it MUST include safe details naming the failed validation stage
- **AND** it MUST not expose raw environment variables or unsafe path details in copyable diagnostics

#### Scenario: Local source mode is explicit
- **GIVEN** local source mode is configured incorrectly
- **WHEN** resolver fallback candidates would otherwise find an installed CLI
- **THEN** the system MUST still report the local source failure
- **AND** it MUST not silently use the installed CLI

### Requirement: Store-aware feature probes
The system SHALL probe store-aware runtime capabilities through safe OpenSpec CLI calls.

#### Scenario: Probe detects store list support
- **GIVEN** the resolved runtime supports stores
- **WHEN** feature probing runs
- **THEN** the system MUST detect that `openspec store list --json` or an equivalent supported probe succeeds
- **AND** it MUST expose store list support to the DataManager

#### Scenario: Probe detects context and doctor support
- **GIVEN** the resolved runtime supports relationship health and context
- **WHEN** feature probing runs
- **THEN** the system MUST detect support for `openspec context --json` and `openspec doctor --json`
- **AND** relationship panels MAY request context and health data

#### Scenario: Probe does not block base dashboard
- **GIVEN** store-aware probes fail
- **WHEN** `openspec list --json` still succeeds
- **THEN** the base dashboard MUST continue to load change and spec data
- **AND** the probe failure MUST be represented as a feature diagnostic instead of a CLI activation failure

### Requirement: Scope-aware CLI command execution
The system SHALL execute root-resolving OpenSpec commands against the selected scope.

#### Scenario: Store scope appends store selector
- **GIVEN** the selected scope is an explicit store with id `team-plans`
- **WHEN** the extension runs a root-resolving command such as list, status, show, validate, instructions, new change, archive, context, or doctor
- **THEN** the command arguments MUST include `--store team-plans`
- **AND** the command MUST use the resolved runtime source

#### Scenario: Local root scope does not append store selector
- **GIVEN** the selected scope is the workspace local root
- **WHEN** the extension runs a root-resolving command
- **THEN** the command arguments MUST NOT include `--store`
- **AND** command behavior MUST match the current single-root dashboard behavior

#### Scenario: Command output root metadata is captured
- **GIVEN** a scoped CLI command returns JSON with root metadata
- **WHEN** the system parses the response
- **THEN** it SHOULD retain root path, source, and store id metadata when present
- **AND** that metadata SHOULD be available to the dashboard and diagnostics

### Requirement: Store registry data retrieval
The system SHALL retrieve registered stores and relationship data only when the runtime supports those commands.

#### Scenario: Registered stores are listed
- **GIVEN** store-aware features are available
- **WHEN** the dashboard requests available scopes
- **THEN** the system MUST call the OpenSpec store list surface
- **AND** it MUST parse each registered store id and root path into scope options

#### Scenario: Store list failure is recoverable
- **GIVEN** store-aware features are available
- **AND** store list fails due to registry health
- **WHEN** the dashboard renders scope options
- **THEN** it MUST show the registry diagnostic
- **AND** it MUST keep the current local root scope available when possible

#### Scenario: Relationship data comes from context and doctor
- **GIVEN** a selected scope is loaded
- **WHEN** the relationship panel requests reference and health data
- **THEN** the system MUST use OpenSpec context and doctor JSON surfaces when supported
- **AND** it MUST not build a separate inferred relationship graph from filesystem guesses

### Requirement: Status-backed Change workflow snapshot
The extension SHALL construct each active Change workflow snapshot from a fresh OpenSpec `status --json` response and SHALL bind that snapshot to the root that produced it.

#### Scenario: Preserve arbitrary schema artifact graph
- **GIVEN** OpenSpec status returns an ordered artifact list for a custom schema
- **WHEN** the extension builds the Change workflow snapshot
- **THEN** the snapshot MUST preserve every returned artifact id, status, dependency, missing dependency, output path, and existing output path
- **AND** the extension MUST NOT replace the returned graph with a fixed Proposal, Specs, Design, and Tasks sequence

#### Scenario: Preserve CLI declaration order
- **GIVEN** OpenSpec status returns two or more artifacts with status `ready`
- **WHEN** the extension builds the Change workflow snapshot
- **THEN** the snapshot MUST preserve their CLI declaration order
- **AND** downstream action resolution MUST be able to distinguish the first ready artifact from other ready artifacts

#### Scenario: Snapshot remains bound to producing root
- **GIVEN** two roots contain a Change with the same name
- **WHEN** status is loaded for one root
- **THEN** the snapshot MUST carry that root's immutable binding identity
- **AND** the extension MUST NOT merge or reinterpret it with status, paths, cache data, or actions from the other root

### Requirement: Workflow instructions are loaded on demand
The extension SHALL avoid fetching artifact instructions for every Change during list refresh and SHALL request instructions only when a detail or concrete workflow action needs them.

#### Scenario: Change list refresh does not prefetch instructions
- **GIVEN** a dashboard refresh returns multiple Changes
- **WHEN** the extension enriches the list with workflow status
- **THEN** it MUST NOT run artifact instructions once per listed Change
- **AND** the list MUST remain usable from list and status data alone

#### Scenario: Detail or action requests current instructions
- **GIVEN** a user opens detail that needs instruction context or triggers a workflow action
- **WHEN** instruction data is required
- **THEN** the extension MUST request current instructions for the bound Change and root
- **AND** it MUST discard instruction data whose producing root or Change no longer matches the active binding

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
