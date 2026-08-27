## MODIFIED Requirements

### Requirement: Shared workflow action resolution

The extension SHALL derive workflow actions through one shared resolver that consumes the root-bound Change workflow snapshot and supplies consistent results to Sidebar, Change Detail, and Dashboard.

Lifecycle status MAY drive badges, filters, and counts, but it MUST NOT become a parallel workflow-action resolver inside an individual surface.

#### Scenario: First ready artifact is recommended

- **GIVEN** the ordered artifact graph contains one or more artifacts with status `ready`
- **WHEN** workflow actions are resolved
- **THEN** the first ready artifact in CLI declaration order MUST determine the recommended planning action
- **AND** every other ready artifact MUST remain visible as available now

#### Scenario: Blocked and skipped artifacts retain distinct meaning

- **GIVEN** the artifact graph contains blocked and skipped artifacts
- **WHEN** workflow state is displayed
- **THEN** blocked artifacts MUST be non-actionable and MUST expose their missing dependencies
- **AND** skipped artifacts MUST be identified as skipped rather than completed or blocked

#### Scenario: Planning completion recommends Apply

- **GIVEN** OpenSpec reports planning complete
- **AND** tasks remain incomplete
- **WHEN** workflow actions are resolved
- **THEN** Apply MUST be the recommended implementation action
- **AND** planning creation actions MUST NOT remain the primary action

#### Scenario: Completed tasks recommend Verify without auto-archive

- **GIVEN** planning is complete and all tasks are complete
- **WHEN** workflow actions are resolved
- **THEN** Verify MUST be recommended
- **AND** Archive MUST remain a separate high-impact action
- **AND** the Change MUST NOT be represented as archived until OpenSpec reports it as archived

#### Scenario: Sync Specs is conditional

- **GIVEN** a Change has no delta specs eligible for synchronization
- **WHEN** workflow actions are resolved
- **THEN** Sync Specs MUST NOT be shown as a fixed workflow stage
- **AND** it MUST appear only when current Change data indicates applicable spec deltas

#### Scenario: All surfaces consume the same resolved action semantics

- **GIVEN** Sidebar, Change Detail, and Dashboard display the same bound Change snapshot
- **WHEN** each surface renders its workflow summary
- **THEN** they MUST agree on the recommended action, other available actions, and blocked reasons
- **AND** a surface MAY reduce detail but MUST NOT independently recalculate a contradictory lifecycle

#### Scenario: Archived Change remains read-only history

- **GIVEN** a Change is archived
- **WHEN** workflow actions are resolved
- **THEN** no write-producing workflow action MUST be returned
- **AND** the UI MUST NOT fabricate completed states for artifacts absent from the archived data

#### Scenario: Lifecycle presentation does not create a second action model

- **GIVEN** the Extension Host provides both `lifecycleStatus` and a binding-matching workflow snapshot for a Change
- **WHEN** ChangeCard or another surface renders lifecycle presentation and workflow controls
- **THEN** badges, filters, and counts MUST use the Host-provided lifecycle status
- **AND** recommended, available, and high-impact actions MUST come from the shared workflow resolver and the bound snapshot
- **AND** the surface MUST NOT independently infer another action set from lifecycle, artifact, or task fields
