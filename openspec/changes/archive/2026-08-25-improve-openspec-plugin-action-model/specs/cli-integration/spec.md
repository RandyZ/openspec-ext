## ADDED Requirements

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
