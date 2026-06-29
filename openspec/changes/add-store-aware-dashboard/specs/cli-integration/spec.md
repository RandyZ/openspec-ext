## ADDED Requirements

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
