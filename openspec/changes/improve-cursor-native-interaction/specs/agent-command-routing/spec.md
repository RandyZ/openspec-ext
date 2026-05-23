> 参考 Superpowers 设计文档：[Cursor 原生交互与 AI 归档流程设计](../../../../../docs/superpowers/specs/2026-05-23-cursor-native-interaction-and-ai-archive-design.md)

## ADDED Requirements

### Requirement: Cursor plugin registration
The extension SHALL register its bundled OpenSpec Cursor commands and skills as a Cursor plugin source when the Cursor extension API is available.

#### Scenario: Register bundled plugin path in Cursor
- **WHEN** the extension activates in an environment where `vscode.cursor.plugins.registerPath` is available
- **THEN** the extension MUST call `registerPath` exactly once for the bundled OpenSpec plugin directory
- **AND** the registered directory MUST contain OpenSpec commands and skills needed by the workflow actions

#### Scenario: Skip registration outside Cursor
- **WHEN** the extension activates in VS Code or any environment where `vscode.cursor.plugins.registerPath` is unavailable
- **THEN** activation MUST continue without throwing an error
- **AND** workflow actions MUST still fall back to supported adapters or clipboard behavior

#### Scenario: Unregister bundled plugin path on dispose
- **WHEN** the extension is deactivated after registering the bundled plugin path
- **THEN** the extension MUST call `vscode.cursor.plugins.unregisterPath` with the same path

### Requirement: Workflow command generation
The extension SHALL generate OpenSpec workflow commands through a shared command builder instead of hardcoding command strings in individual webview components.

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

### Requirement: Cursor Chat prefill with fallback
The Cursor adapter SHALL prefer opening Cursor Chat with a prefilled command and fall back to copying the command when prefill is unavailable.

#### Scenario: Chat prefill succeeds
- **WHEN** the user triggers a fill-chat workflow action in Cursor
- **AND** the IDE accepts a Chat open command with query or equivalent prefill arguments
- **THEN** Cursor Chat MUST open with the generated workflow command prefilled
- **AND** the extension MUST NOT directly modify OpenSpec change files as part of that action

#### Scenario: Chat prefill fails
- **WHEN** the user triggers a fill-chat workflow action in Cursor
- **AND** the IDE rejects or does not support Chat prefill
- **THEN** the generated command MUST be copied to the clipboard
- **AND** the user MUST receive a notification explaining that the command was copied

#### Scenario: Automatic Agent execution remains explicit
- **WHEN** the user triggers a normal fill-chat workflow action
- **THEN** the Cursor adapter MUST NOT start the Agent CLI automatically
- **AND** Agent CLI execution MAY occur only when the user explicitly selects an automatic execution path or `openspec.taskExecutionMode` is `auto`

### Requirement: Action labels reflect actual behavior
The extension SHALL label workflow actions according to what they do.

#### Scenario: Chat routed action label
- **WHEN** an action opens or pre-fills Chat
- **THEN** its visible label or accessible description MUST indicate that it opens Chat rather than immediately completing the workflow

#### Scenario: Clipboard fallback label
- **WHEN** an action only copies a command
- **THEN** its visible label or notification MUST indicate that the command was copied and requires user paste/send
