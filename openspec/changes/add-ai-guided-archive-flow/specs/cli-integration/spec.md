> 参考 Superpowers 设计文档：[Cursor 原生交互与 AI 归档流程设计](../../../../../docs/superpowers/specs/2026-05-23-cursor-native-interaction-and-ai-archive-design.md)

## MODIFIED Requirements

### Requirement: Command Execution
The system SHALL execute OpenSpec CLI commands on behalf of the user for deterministic operations, and direct archive execution SHALL occur only through explicit direct archive paths.

#### Scenario: Create new change
- GIVEN the user requests to create a change named "add-feature"
- WHEN the extension executes the command
- THEN `openspec new change add-feature` MUST be run
- AND the exit code MUST be checked
- AND on success, the change list MUST be refreshed
- AND the UI MUST navigate to the new change

#### Scenario: Archive change
- GIVEN a completed change exists
- WHEN the user explicitly selects `Archive Now` or runs the direct archive command palette command
- THEN `openspec archive <change>` MUST be executed
- AND the output MUST be captured and shown to user
- AND on success, the change MUST move to archive section

#### Scenario: Primary archive action does not execute CLI archive
- GIVEN a change exists
- WHEN the user clicks the primary `Review & Archive` action
- THEN the extension MUST NOT execute `openspec archive <change>`
- AND the action MUST route the archive workflow command to the selected Agent or Chat adapter

#### Scenario: Validate change
- GIVEN a change exists
- WHEN the user clicks "Validate"
- THEN `openspec validate <change>` MUST be run
- AND validation results MUST be displayed in the UI
- AND errors MUST be highlighted
