> 参考 Superpowers 设计文档：[Cursor 原生交互与 AI 归档流程设计](../../../../../docs/superpowers/specs/2026-05-23-cursor-native-interaction-and-ai-archive-design.md)

## ADDED Requirements

### Requirement: Review and Archive primary action
The extension SHALL provide an AI-guided archive primary action that routes the user to the OpenSpec archive Agent workflow instead of directly archiving the change.

#### Scenario: Completed change opens AI archive workflow
- **WHEN** the user clicks the primary archive action for a completed change
- **THEN** the action MUST generate the archive workflow command for the current route target
- **AND** the default Cursor command MUST be `/opsx-archive <change>`
- **AND** the webview MUST send a Chat routing message rather than an `archiveChange` message

#### Scenario: Primary action does not move files directly
- **WHEN** the user clicks `Review & Archive`
- **THEN** the extension MUST NOT call `dataManager.archiveChange`
- **AND** the change directory MUST remain in the active changes location until the Agent workflow or explicit direct archive path archives it

### Requirement: Archive split button
The extension SHALL present archive as a split button with AI-guided review as the primary action and direct archive as an explicit dropdown action.

#### Scenario: Split button primary action
- **WHEN** a change is eligible to show archive actions
- **THEN** the primary button label MUST communicate AI-guided review, such as `Review & Archive`
- **AND** clicking the primary button MUST open or copy the archive workflow command through the selected adapter

#### Scenario: Archive Now dropdown action
- **WHEN** a change is eligible for direct archive
- **THEN** the split button dropdown MUST include `Archive Now`
- **AND** selecting `Archive Now` MUST use the existing direct archive CLI path after confirmation

#### Scenario: Change Detail completed change archive actions
- **WHEN** a completed change is shown in Change Detail
- **THEN** the action bar MUST show `Review & Archive` as the primary archive action
- **AND** the archive dropdown MUST include `Archive Now`
- **AND** Dashboard and Change Detail MUST use the same archive eligibility rules

#### Scenario: Change Detail primary action routes to Agent
- **WHEN** the user clicks `Review & Archive` in Change Detail
- **THEN** the webview MUST send a Chat routing message for `/opsx-archive <change>` or the target-specific equivalent
- **AND** it MUST NOT send an `archiveChange` message

#### Scenario: Change Detail direct archive disabled when incomplete
- **WHEN** Change Detail shows a change with incomplete tasks or required artifacts
- **THEN** `Archive Now` MUST be disabled or unavailable
- **AND** the UI MUST explain why direct archive is unavailable
- **AND** `Review & Archive` MAY remain available as an Agent review/advice entry

#### Scenario: Archived change is read-only
- **WHEN** a change is already archived
- **THEN** archive actions MUST NOT be shown
- **AND** the change detail view MUST remain read-only

### Requirement: Direct archive gating
The extension SHALL gate direct archive behind completion state and explicit confirmation.

#### Scenario: Direct archive enabled for complete change
- **WHEN** all required artifacts exist
- **AND** all tasks are complete
- **AND** the user opens the archive dropdown
- **THEN** `Archive Now` MUST be enabled
- **AND** selecting it MUST show a confirmation before calling the CLI archive path

#### Scenario: Direct archive disabled for incomplete tasks
- **WHEN** any task is incomplete
- **AND** the user opens the archive dropdown
- **THEN** `Archive Now` MUST be disabled or unavailable
- **AND** the UI MUST explain that incomplete tasks should be reviewed through `Review & Archive`

#### Scenario: Direct archive disabled for incomplete artifacts
- **WHEN** any required artifact is incomplete
- **AND** the user opens the archive dropdown
- **THEN** `Archive Now` MUST be disabled or unavailable
- **AND** the UI MUST explain that artifacts should be completed or reviewed before direct archive

### Requirement: Verify-to-archive recommendation
The extension SHALL recommend AI-guided archive after verification-ready or completed states.

#### Scenario: Verify complete recommendation
- **WHEN** a change is ready for archive after task completion or verification
- **THEN** the recommended next action MUST be `Review & Archive`
- **AND** the UI MUST NOT present direct CLI archive as the default primary action

#### Scenario: Incomplete change review entry
- **WHEN** a change has partial task progress but is not complete
- **THEN** the UI MAY expose `Review & Archive` as an Agent review entry
- **AND** the entry MUST communicate review/advice semantics rather than promising that the change can be archived
