> 参考 Superpowers 设计文档：[Cursor 原生交互与 AI 归档流程设计](../../../../../docs/superpowers/specs/2026-05-23-cursor-native-interaction-and-ai-archive-design.md)

## MODIFIED Requirements

### Requirement: Dashboard Actions
The system SHALL provide quick actions for common operations, and archive-related quick actions SHALL default to AI-guided review while preserving an explicit direct archive option.

#### Scenario: Create new change
- GIVEN the dashboard is open
- WHEN the user clicks "New Change" button
- THEN a dialog MUST prompt for the change name
- AND on submission, `openspec new change <name>` MUST be executed
- AND the new change MUST appear in the dashboard

#### Scenario: Refresh data
- GIVEN the dashboard is open
- WHEN the user clicks the refresh button
- THEN all data MUST be reloaded from the file system
- AND the UI MUST update to reflect current state
- AND the refresh result MUST be shared with the open sidebar webview

#### Scenario: Copy opsx command
- GIVEN a change in the dashboard
- WHEN the user clicks "Copy /opsx:ff"
- THEN the command `/opsx:ff <change-name>` MUST be copied to clipboard
- AND a notification SHOULD confirm the copy action

#### Scenario: Completed change shows Review and Archive primary action
- GIVEN a completed change is displayed in the dashboard
- WHEN quick actions are shown for that change
- THEN the archive primary action MUST be `Review & Archive`
- AND clicking it MUST route the archive workflow command through the selected adapter
- AND it MUST NOT directly execute the CLI archive path

#### Scenario: Dashboard Archive Now dropdown action
- GIVEN a completed change is displayed in the dashboard
- WHEN the user opens the archive action dropdown
- THEN `Archive Now` MUST be available
- AND selecting `Archive Now` MUST trigger the direct archive confirmation flow

#### Scenario: Dashboard direct archive disabled when incomplete
- GIVEN a change has incomplete tasks or required artifacts
- WHEN archive actions are shown in the dashboard
- THEN `Review & Archive` MAY be shown as a review/advice entry
- AND `Archive Now` MUST be disabled or unavailable with a reason
