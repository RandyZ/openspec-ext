> 参考 Superpowers 设计文档：[Cursor 原生交互与 AI 归档流程设计](../../../../../docs/superpowers/specs/2026-05-23-cursor-native-interaction-and-ai-archive-design.md)

## MODIFIED Requirements

### Requirement: Execution mode and adapter delegation
The system SHALL use the configured execution mode and selected adapter when the user triggers execution after dependency check passes, and workflow prompts SHALL be generated through the shared OpenSpec workflow command builder.

#### Scenario: Auto mode calls executeTask
- GIVEN taskExecutionMode is "auto" and dependency check passes
- WHEN the user triggers execution for a task
- THEN the system MUST call the selected adapter's executeTask(request)
- AND MUST NOT open Chat or copy to clipboard as the primary action
- AND the request prompt MUST be generated through the shared workflow command builder

#### Scenario: FillChat mode calls fillChat
- GIVEN taskExecutionMode is "fillChat" and dependency check passes
- WHEN the user triggers execution for a task
- THEN the system MUST call the selected adapter's fillChat(request)
- AND the adapter MAY prefill Chat or use clipboard fallback
- AND the request prompt MUST be generated through the shared workflow command builder
- AND the plugin treats both Chat prefill and clipboard fallback as successful routing

#### Scenario: Cursor task execution prompt uses hyphen command
- GIVEN the selected adapter target is Cursor
- AND taskExecutionMode is "fillChat"
- WHEN the user triggers execution for a task
- THEN the generated prompt MUST use `/opsx-apply <change>` format
- AND it MUST NOT use `/opsx:apply <change>` format

#### Scenario: Generic task execution prompt keeps compatibility
- GIVEN the selected adapter target is Clipboard, VS Code Copilot, Generic Chat, or unknown
- AND taskExecutionMode is "fillChat"
- WHEN the user triggers execution for a task
- THEN the generated prompt MUST use `/opsx:apply <change>` format
