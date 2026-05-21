## MODIFIED Requirements

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
