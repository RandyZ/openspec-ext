> 参考 Superpowers 设计文档：[Interactive Verify & Archive Terminal 设计](../../../../../docs/superpowers/specs/2026-05-25-interactive-verify-archive-terminal-design.md)
>
> 参考 Superpowers 实现计划：[Interactive Verify & Archive Terminal Implementation Plan](../../../../../docs/superpowers/plans/2026-05-25-interactive-verify-archive-terminal-plan.md)

## ADDED Requirements

### Requirement: Interactive Agent terminal sessions
The extension SHALL provide interactive terminal sessions for Verify and Archive workflows.

#### Scenario: Run Verify opens interactive Terminal Editor
- **GIVEN** a non-archived change
- **WHEN** the user clicks `Run Verify` in the `Verify & Archive` tab
- **THEN** the extension MUST create or reveal a VS Code Integrated Terminal in the editor area
- **AND** the terminal command MUST use `agent --workspace <workspaceRoot> --model <model> /opsx-verify <change>`
- **AND** the command MUST NOT use `-p`, `--print`, or `--force`

#### Scenario: Run Archive opens interactive Terminal Editor
- **GIVEN** a non-archived change
- **WHEN** the user clicks `Run Archive` in the `Verify & Archive` tab
- **THEN** the extension MUST create or reveal a VS Code Integrated Terminal in the editor area
- **AND** the terminal command MUST use `agent --workspace <workspaceRoot> --model <model> /opsx-archive <change>`
- **AND** the command MUST NOT use `-p`, `--print`, or `--force`

#### Scenario: Terminal sessions are scoped by change and action
- **GIVEN** a Verify terminal is running for a change
- **WHEN** the user starts Archive for the same change
- **THEN** the extension MUST create or reveal a separate Archive terminal session
- **AND** Verify and Archive MUST NOT share the same terminal session

#### Scenario: Running session is not started twice
- **GIVEN** a terminal session is already running for a change and action
- **WHEN** the user clicks the same run action again
- **THEN** the extension MUST reveal the existing terminal or show an existing-session state
- **AND** it MUST NOT send a duplicate Agent command into that terminal

#### Scenario: Stop and Clear close the terminal session
- **GIVEN** a terminal session exists for a change and action
- **WHEN** the user clicks Stop or Clear Session
- **THEN** the extension MUST dispose that terminal
- **AND** the session state MUST no longer be running

#### Scenario: Cursor Agent CLI is unavailable
- **GIVEN** the `agent` executable is not available
- **WHEN** the user starts Verify or Archive
- **THEN** the extension MUST NOT create a terminal session for that workflow
- **AND** the webview MUST receive an error state explaining that Cursor Agent CLI was not found

### Requirement: Interactive workflow state reporting
The extension SHALL report interactive workflow session state to the webview.

#### Scenario: Running session state is visible in Change Detail
- **GIVEN** an interactive workflow terminal has been started
- **WHEN** the webview requests interactive workflow state for the change
- **THEN** the extension MUST return the session status, terminal name, last command, and start time for each running action

#### Scenario: Reveal shows the existing terminal
- **GIVEN** an interactive workflow terminal exists
- **WHEN** the user clicks `Reveal Terminal`
- **THEN** the extension MUST reveal the existing terminal
- **AND** it MUST return the current session state to the webview

#### Scenario: Archived changes cannot run Archive
- **GIVEN** a change detail view is showing an archived change
- **WHEN** the user attempts to run Archive
- **THEN** the extension MUST reject the Archive run
- **AND** the webview MUST receive an error state explaining that archived changes are read-only

#### Scenario: Archived changes may run read-only Verify
- **GIVEN** a change detail view is showing an archived change
- **WHEN** the user starts Verify
- **THEN** the extension MAY start an interactive Verify terminal session
- **AND** the terminal command MUST use the archived change identifier provided by the view
- **AND** the extension MUST NOT expose Archive as a runnable action for that archived change
