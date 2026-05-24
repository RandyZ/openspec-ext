> 参考 Superpowers 设计文档：[Cursor 原生交互与 AI 归档流程设计](../../../../../docs/superpowers/specs/2026-05-23-cursor-native-interaction-and-ai-archive-design.md)

## MODIFIED Requirements

### Requirement: Dashboard Actions
The system SHALL provide quick actions for common operations, and workflow-oriented quick actions SHALL route through the shared OpenSpec workflow command routing capability.

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
- WHEN the user clicks a copy-command quick action
- THEN the command builder MUST generate the command using the Clipboard target
- AND the generated command MUST use colon format such as `/opsx:apply <change>`
- AND the generated command MUST be copied to clipboard
- AND a notification SHOULD confirm the copy action

#### Scenario: Open workflow command from quick action through launch settings
- GIVEN a change in the dashboard
- WHEN the user clicks a workflow quick action such as Continue, FF, Apply, Verify, or Sync
- THEN the action MUST route through the shared workflow launch settings
- AND `openspec.workflowLaunchMode=clipboard` MUST copy the generated command and show a non-modal notification
- AND `openspec.workflowLaunchMode=adapter` MUST route through the selected adapter's configured launch behavior
- AND the dashboard quick action MUST NOT directly modify OpenSpec change files

#### Scenario: Cursor quick action uses hyphen command when adapter launch is selected
- GIVEN `openspec.workflowLaunchMode` is `adapter`
- AND the selected adapter target is Cursor
- WHEN the user clicks a workflow quick action in the dashboard
- THEN the command opened, copied, or executed through Cursor MUST use `/opsx-<action> <change>` format

#### Scenario: Default dashboard quick action is clipboard safe
- GIVEN the extension uses default settings
- WHEN the user clicks a workflow quick action in the dashboard
- THEN the generated command MUST be copied to the clipboard
- AND no Agent window, deeplink, or CLI process MUST start automatically
