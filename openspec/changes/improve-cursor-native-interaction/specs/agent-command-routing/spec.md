> 参考 Superpowers 设计文档：[Cursor 原生交互与 AI 归档流程设计](../../../../../docs/superpowers/specs/2026-05-23-cursor-native-interaction-and-ai-archive-design.md)

## ADDED Requirements

### Requirement: Workflow launch configuration
The extension SHALL expose clear workflow launch settings that separate safe default behavior, target adapter selection, Cursor launch behavior, and automatic execution behavior.

#### Scenario: Clipboard is the default workflow launch mode
- **WHEN** the extension is installed with default settings
- **THEN** workflow actions MUST copy the generated OpenSpec command to the clipboard
- **AND** the extension MUST show a non-modal VS Code notification confirming the copy
- **AND** the action MUST NOT open Cursor, Copilot, or any external Agent automatically

#### Scenario: Preferred adapter is selectable from settings
- **WHEN** the user opens settings for `openspec.preferredAgentAdapter`
- **THEN** the setting MUST be presented as a finite choice list
- **AND** it MUST include at least `clipboard`, `cursor`, `vscode-copilot`, `claude-code`, and `opencode`
- **AND** its default value MUST be `clipboard`

#### Scenario: Cursor launch mode is scoped to Cursor adapter
- **WHEN** the preferred adapter is `cursor`
- **THEN** the extension MUST read `openspec.cursorLaunchMode` to decide how to start Cursor
- **AND** supported modes MUST include `deeplink`, `chatCommand`, `clipboard`, and `agentCli`

#### Scenario: Adapter launch mode uses preferred adapter
- **WHEN** `openspec.workflowLaunchMode` is `adapter`
- AND `openspec.preferredAgentAdapter` is set to an available adapter such as `cursor`, `opencode`, `vscode-copilot`, `claude-code`, or `clipboard`
- **THEN** workflow actions MUST generate the command or payload for that adapter target
- **AND** the action MUST be routed through that adapter's configured launch behavior

#### Scenario: Cursor model setting is scoped to Cursor CLI
- **WHEN** Cursor Agent CLI automatic execution is used
- **THEN** the extension MUST read a Cursor-specific model setting such as `openspec.cursorAgentModel`
- **AND** legacy `openspec.agentModel` MAY be read for backward compatibility
- **AND** non-Cursor adapters MUST NOT treat Cursor model configuration as their own model setting

### Requirement: Workflow command generation
The extension SHALL generate OpenSpec workflow commands or launch payloads through a shared builder instead of hardcoding command strings in individual webview components.

#### Scenario: Cursor target uses hyphen command format
- **WHEN** a workflow command is generated for the Cursor target
- **THEN** the command MUST use hyphen format such as `/opsx-apply <change>`
- **AND** it MUST NOT use colon format such as `/opsx:apply <change>`

#### Scenario: OpenCode target uses hyphen command format
- **WHEN** a workflow command is generated for the OpenCode target
- **THEN** the command MUST use hyphen format such as `/opsx-apply <change>`

#### Scenario: Generic target uses colon command format
- **WHEN** a workflow command is generated for Clipboard, Generic Chat, VS Code Copilot, or an unknown target
- **THEN** the command MUST use colon format such as `/opsx:apply <change>`
- **AND** this default MUST preserve compatibility with existing non-Cursor workflows

#### Scenario: Supported workflow actions
- **WHEN** the command builder receives any supported workflow action
- **THEN** it MUST generate the correct command for `explore`, `continue`, `ff`, `apply`, `verify`, `archive`, and `sync`

### Requirement: Cursor deeplink prefill with fallback
The Cursor adapter SHALL support opening Cursor with a prefilled prompt through the official deeplink protocol and SHALL always preserve a clipboard fallback.

#### Scenario: Cursor deeplink launch succeeds
- **WHEN** the user triggers a fill-chat workflow action in Cursor
- **AND** `openspec.cursorLaunchMode` is `deeplink`
- **THEN** the generated workflow command MUST first be copied to the clipboard
- **AND** the extension MUST open `cursor://anysphere.cursor-deeplink/prompt?text=<encoded command>`
- **AND** the extension MUST show a non-modal notification that Cursor was opened and the command was also copied
- **AND** the extension MUST NOT directly modify OpenSpec change files as part of that action

#### Scenario: Cursor deeplink launch fails
- **WHEN** the user triggers a fill-chat workflow action in Cursor
- **AND** `openspec.cursorLaunchMode` is `deeplink`
- **AND** opening the deeplink fails
- **THEN** the generated command MUST be copied to the clipboard
- **AND** the user MUST receive a non-modal notification explaining that Cursor could not be opened and the command was copied instead

#### Scenario: Cursor chat command mode
- **WHEN** the user triggers a fill-chat workflow action in Cursor
- **AND** `openspec.cursorLaunchMode` is `chatCommand`
- **THEN** the generated workflow command MUST first be copied to the clipboard
- **AND** the extension MUST try `workbench.action.chat.open` with a query argument
- **AND** failure MUST fall back to the existing clipboard copy notification

#### Scenario: Cursor clipboard mode
- **WHEN** the user triggers a fill-chat workflow action in Cursor
- **AND** `openspec.cursorLaunchMode` is `clipboard`
- **THEN** the generated workflow command MUST be copied to the clipboard
- **AND** no Cursor window or Agent CLI process MUST be opened

#### Scenario: Non-Cursor adapter launch keeps clipboard fallback
- **WHEN** `openspec.workflowLaunchMode` is `adapter`
- AND the selected adapter is not Cursor
- WHEN the adapter cannot prefill or execute through its native integration
- **THEN** the generated command or prompt MUST be copied to the clipboard
- AND the user MUST receive a non-modal notification explaining the fallback

#### Scenario: Automatic Agent execution remains explicit
- **WHEN** the user triggers a normal fill-chat workflow action
- **THEN** the Cursor adapter MUST NOT start the Agent CLI automatically
- **AND** Agent CLI execution MAY occur only when the user explicitly selects an automatic execution path, `openspec.cursorLaunchMode` is `agentCli`, or `openspec.taskExecutionMode` is `auto`

### Requirement: Cursor plugin registration remains optional
The extension MAY register bundled Cursor plugin assets in the future, but OpenSpec workflow launch MUST NOT depend on that registration.

#### Scenario: Plugin registration unavailable
- **WHEN** Cursor plugin registration is unavailable or disabled
- **THEN** workflow actions MUST still work through clipboard, deeplink, chatCommand, or Agent CLI launch modes
- **AND** the extension MUST NOT report OpenSpec as unavailable solely because plugin registration is unavailable

#### Scenario: Extension does not bundle OpenSpec CLI
- **WHEN** the extension is packaged
- **THEN** it MUST NOT rely on bundling the OpenSpec CLI itself to make workflows available
- **AND** project OpenSpec initialization remains the responsibility of `openspec init` or `openspec update`

### Requirement: Action labels reflect actual behavior
The extension SHALL label workflow actions according to what they do.

#### Scenario: Chat routed action label
- **WHEN** an action opens or pre-fills Chat
- **THEN** its visible label or accessible description MUST indicate that it opens Chat rather than immediately completing the workflow

#### Scenario: Clipboard fallback label
- **WHEN** an action only copies a command
- **THEN** its visible label or notification MUST indicate that the command was copied and requires user paste/send
