## MODIFIED Requirements

### Requirement: Task Toggle Interaction
The system SHALL allow users to toggle task completion state **only for active (non-archived) changes**.

#### Scenario: Toggle task via checkbox（active change）
- **WHEN** the user clicks the checkbox on a task in an active change
- **THEN** the checkbox MUST visually change to checked/unchecked
- **AND** the `tasks.md` file MUST be updated accordingly
- **AND** the change MUST be saved immediately

#### Scenario: Checkbox disabled for archived change
- **WHEN** the user views the Tasks tab of an archived change
- **THEN** all checkboxes SHALL be rendered in a disabled state
- **AND** clicking SHALL have no effect
- **AND** no `toggleTask` message SHALL be sent to the extension

### Requirement: Task Execution
The system SHALL allow users to execute tasks via agent **only for active (non-archived) changes**.

#### Scenario: Execute button shown（active change）
- **WHEN** viewing Tasks tab of an active change with agent adapters available
- **THEN** each task SHALL show an「执行」button

#### Scenario: Execute button hidden for archived change
- **WHEN** viewing Tasks tab of an archived change
- **THEN** NO「执行」button SHALL be rendered for any task
