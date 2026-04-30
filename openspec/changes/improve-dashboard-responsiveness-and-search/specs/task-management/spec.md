## MODIFIED Requirements

### Requirement: Task Toggle Interaction
The system SHALL allow users to toggle task completion state only after explicit confirmation in the webview UI.

#### Scenario: Toggle task via checkbox
- GIVEN an incomplete task `[ ]`
- WHEN the user clicks the checkbox
- THEN a webview confirmation dialog MUST appear within 100ms
- AND the dialog MUST have one confirm action and one cancel action
- AND the `tasks.md` file MUST remain unchanged before the user confirms
- WHEN the user confirms
- THEN the checkbox MUST visually change to checked
- AND the `tasks.md` file MUST be updated to `[x]`
- AND the change MUST be saved immediately after confirmation
- AND file watcher MUST detect and refresh

#### Scenario: Untoggle completed task
- GIVEN a completed task `[x]`
- WHEN the user clicks the checkbox
- THEN a webview confirmation dialog MUST appear within 100ms
- AND the dialog MUST have one confirm action and one cancel action
- AND the `tasks.md` file MUST remain unchanged before the user confirms
- WHEN the user confirms
- THEN the checkbox MUST visually change to unchecked
- AND the `tasks.md` file MUST be updated to `[ ]`
- AND the change MUST be saved immediately after confirmation

#### Scenario: Cancel task toggle
- GIVEN any task
- WHEN the user clicks the checkbox
- AND the confirmation dialog is shown
- AND the user cancels or dismisses the dialog
- THEN the checkbox state MUST remain unchanged
- AND the `tasks.md` file MUST remain unchanged

#### Scenario: Toggle feedback
- GIVEN any task
- WHEN the user clicks the checkbox
- THEN confirmation UI feedback MUST be immediate (< 100ms)
- AND no VS Code native modal MUST be shown for this task toggle confirmation
- AND the progress indicator MUST update only after the confirmed write succeeds

### Requirement: Performance
The system SHALL perform task operations efficiently.

#### Scenario: Fast toggle response
- GIVEN any task
- WHEN the user clicks the task checkbox
- THEN webview confirmation UI feedback MUST appear within 100ms
- WHEN the user confirms the toggle
- THEN file write MUST complete < 500ms

#### Scenario: Large task files
- GIVEN a `tasks.md` with 100+ tasks
- WHEN displayed
- THEN rendering MUST complete < 1 second
- AND scrolling MUST remain smooth (60fps)

### Requirement: Plugin does not update task completion from execution
The system SHALL NOT update task checkboxes in tasks.md as a result of the user triggering execution or fillChat.

#### Scenario: No automatic toggle after execution
- GIVEN the user has triggered execute or fillChat for a task
- WHEN the adapter completes (success or failure)
- THEN the plugin MUST NOT modify the task's [ ] / [x] state in tasks.md
- AND task completion MUST be left to the Agent or OpenSpec workflow (e.g. user or Agent edits tasks.md)

#### Scenario: Toggle remains a separate confirmed action
- GIVEN the existing task toggle checkbox is shown separately from the execution/fillChat trigger
- WHEN the user clicks the checkbox
- THEN the plugin MUST show the webview confirmation dialog for the checkbox toggle
- AND the plugin MUST update `tasks.md` only after the user confirms the toggle
- AND this behavior MUST remain independent of the execution/fillChat trigger
