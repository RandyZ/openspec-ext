## ADDED Requirements

### Requirement: Shared workflow action resolution
The extension SHALL derive workflow actions through one shared resolver that consumes the root-bound Change workflow snapshot and supplies consistent results to Sidebar, Change Detail, and Dashboard.

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

### Requirement: Continue planning describes its real capability
The extension SHALL present `/opsx:continue <changeName>` as a generic planning continuation action unless the execution contract explicitly supports selecting a target artifact.

#### Scenario: Generic Continue shows next artifact context
- **GIVEN** planning is incomplete and the first ready artifact is `specs`
- **WHEN** the Continue action is displayed
- **THEN** the executable label MUST describe a generic planning continuation
- **AND** supporting text MUST identify `specs` as the next artifact
- **AND** the generated command MUST remain `/opsx:continue <changeName>`

#### Scenario: Parallel ready artifacts remain visible
- **GIVEN** both `specs` and `design` are ready
- **WHEN** Continue planning is displayed
- **THEN** one artifact MUST be identified as next according to CLI order
- **AND** the other artifact MUST be identified as also available
- **AND** the UI MUST NOT imply that only the recommended artifact is permitted

#### Scenario: No misleading targeted create action
- **GIVEN** the current adapter only supports generic `/opsx:continue`
- **WHEN** an artifact has not been created
- **THEN** the UI MUST NOT offer an executable action labeled as creating that specific artifact
- **AND** the user MAY navigate to the artifact's blocked or ready explanation without triggering a guessed command

### Requirement: Workflow action hierarchy remains safe
Change Detail SHALL emphasize at most one recommended workflow action, keep alternative actions accessible, and isolate high-impact actions from ordinary navigation utilities.

#### Scenario: One primary action with accessible alternatives
- **GIVEN** a Change has a recommended action and one or more other available actions
- **WHEN** Change Detail renders its action area
- **THEN** exactly one action MUST receive primary visual emphasis
- **AND** the other available actions MUST remain keyboard-accessible through a secondary group or disclosure
- **AND** action meaning MUST be conveyed by text and not color alone

#### Scenario: Header utilities do not become workflow actions
- **GIVEN** Change Detail exposes copy, open, or refresh utilities
- **WHEN** the header and action area render
- **THEN** those utilities MUST remain visually separate from workflow progression actions
- **AND** they MUST NOT affect resolver state

#### Scenario: Verify and Archive retain dedicated handling
- **GIVEN** Verify or Archive is available
- **WHEN** the user chooses the action
- **THEN** the extension MUST use the existing dedicated interactive or confirmation path
- **AND** it MUST NOT silently route the high-impact action as a normal artifact navigation click

## REMOVED Requirements

### Requirement: Workflow Step Indicator
**Reason**: A fixed Proposal → Specs → Design → Tasks → Apply → Verify → Archive indicator contradicts schema-defined artifact graphs and incorrectly represents archived Changes.

**Migration**: Render the status-backed artifact groups and shared resolved actions defined by `Shared workflow action resolution`.

### Requirement: 动态 ActionBar
**Reason**: The existing requirement derives actions from fixed artifact presence and permits labels such as `Continue → Specs` that imply unsupported targeted execution.

**Migration**: Use `Shared workflow action resolution`, `Continue planning describes its real capability`, and `Workflow action hierarchy remains safe`.

### Requirement: `/opsx:continue` 交互入口
**Reason**: The existing empty-tab and dependency-chain behavior is tied to fixed artifacts and does not distinguish generic continuation from targeted artifact creation.

**Migration**: Use `Continue planning describes its real capability` on every surface.

### Requirement: `/opsx:explore` 入口
**Reason**: The existing requirement assumes a fixed empty Proposal tab; schema-driven Changes may expose a different first artifact or no Proposal artifact.

**Migration**: Resolve Explore or Continue from the current ordered artifact graph and present it through the shared action hierarchy.

### Requirement: Dashboard ChangeCard 智能操作
**Reason**: Dashboard cards currently infer actions independently from coarse draft/completed states.

**Migration**: Consume the shared resolved action summary defined by this capability and the action-first Dashboard requirements.
