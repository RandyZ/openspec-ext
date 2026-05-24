> 参考 Superpowers 设计文档：[Cursor 原生交互与 AI 归档流程设计](../../../../../docs/superpowers/specs/2026-05-23-cursor-native-interaction-and-ai-archive-design.md)

## MODIFIED Requirements

### Requirement: Execution mode and workflow launch delegation
The system SHALL use the configured execution mode, workflow launch mode, and selected adapter when the user triggers execution after dependency check passes, and workflow prompts SHALL be generated through the shared OpenSpec workflow command or payload builder.

#### Scenario: Auto mode calls executeTask
- GIVEN taskExecutionMode is "auto" and dependency check passes
- WHEN the user triggers execution for a task
- THEN the system MUST call the selected adapter's executeTask(request)
- AND MUST NOT open Chat or copy to clipboard as the primary action
- AND the request prompt MUST be generated through the shared workflow command builder

#### Scenario: FillChat mode with default clipboard launch
- GIVEN taskExecutionMode is "fillChat" and dependency check passes
- AND `openspec.workflowLaunchMode` is `clipboard`
- WHEN the user triggers execution for a task
- THEN the generated workflow command MUST be copied to the clipboard
- AND the extension MUST show a non-modal notification
- AND no adapter Chat window, deeplink, or CLI process MUST start automatically

#### Scenario: FillChat mode with adapter launch
- GIVEN taskExecutionMode is "fillChat" and dependency check passes
- AND `openspec.workflowLaunchMode` is `adapter`
- WHEN the user triggers execution for a task
- THEN the system MUST call the selected adapter's fillChat(request)
- AND the adapter MAY prefill Chat, open a deeplink, or use clipboard fallback according to its own settings
- AND the request prompt MUST be generated through the shared workflow command or payload builder

#### Scenario: Cursor task execution prompt uses hyphen command
- GIVEN the selected adapter target is Cursor
- AND taskExecutionMode is "fillChat"
- AND `openspec.workflowLaunchMode` is `adapter`
- WHEN the user triggers execution for a task
- THEN the generated prompt MUST use `/opsx-apply <change>` format
- AND it MUST NOT use `/opsx:apply <change>` format

#### Scenario: Generic task execution prompt keeps compatibility
- GIVEN the selected adapter target is Clipboard, VS Code Copilot, Generic Chat, or unknown
- AND taskExecutionMode is "fillChat"
- WHEN the user triggers execution for a task
- THEN the generated prompt MUST use `/opsx:apply <change>` format
