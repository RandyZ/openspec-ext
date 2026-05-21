# Task Management Specification

## Purpose

Enable users to view and interact with OpenSpec tasks directly in the VSCode UI, eliminating the need to manually edit markdown files.

## Requirements

### Requirement: Task List Display
The system SHALL display all tasks from `tasks.md` in an interactive format.

#### Scenario: Hierarchical task display
- GIVEN a `tasks.md` file with nested tasks
- WHEN the user views the task list
- THEN tasks MUST be displayed with proper indentation
- AND parent tasks MUST be distinguishable from subtasks
- AND task hierarchy MUST match the markdown structure

#### Scenario: Task metadata display
- GIVEN a task in the list
- WHEN displayed
- THEN it MUST show:
  - Checkbox (checked/unchecked state)
  - Task text/description
  - Indentation level (visual hierarchy)

#### Scenario: Mixed content handling
- GIVEN a `tasks.md` with non-task content (headings, paragraphs)
- WHEN displayed
- THEN non-task content MUST be rendered as-is
- AND task checkboxes MUST only appear for actual task items

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

### Requirement: Task State Persistence
The system SHALL correctly read and write task state to markdown files.

#### Scenario: Parse task state
- GIVEN a line `- [x] Implement feature`
- WHEN parsed
- THEN the task state MUST be recognized as "completed"
- AND the task text MUST be "Implement feature"

#### Scenario: Parse unchecked task
- GIVEN a line `- [ ] Review code`
- WHEN parsed
- THEN the task state MUST be recognized as "incomplete"
- AND the task text MUST be "Review code"

#### Scenario: Preserve formatting
- GIVEN a `tasks.md` with custom formatting
- WHEN a task is toggled
- THEN only the checkbox state MUST change
- AND all other content (spacing, text, other tasks) MUST remain unchanged
- AND file format MUST be preserved

#### Scenario: Handle edge cases
- GIVEN tasks with special characters or formatting
- WHEN toggled
- THEN the system MUST correctly identify task boundaries
- AND MUST NOT corrupt the markdown syntax

### Requirement: Progress Tracking
The system SHALL calculate and display task completion progress.

#### Scenario: Calculate progress
- GIVEN a change with 5 tasks, 3 completed
- WHEN progress is calculated
- THEN it MUST show "3/5 tasks complete"
- AND the percentage MUST be 60%

#### Scenario: Nested task progress
- GIVEN nested tasks:
  ```
  - [ ] Parent task
    - [x] Subtask 1
    - [ ] Subtask 2
  ```
- WHEN progress is calculated
- THEN all tasks MUST be counted equally
- AND the count MUST be "1/3 tasks complete"

#### Scenario: No tasks defined
- GIVEN a `tasks.md` with no task items
- WHEN progress is calculated
- THEN it MUST show "No tasks defined"
- AND the progress bar SHOULD be hidden

### Requirement: Task Navigation
The system SHALL allow navigation to task context in files.

#### Scenario: Click task to open file (Phase 2)
- GIVEN a task in the list
- WHEN the user clicks the task text (not checkbox)
- THEN `tasks.md` SHOULD open in the editor
- AND the cursor SHOULD jump to that task line

### Requirement: Bulk Operations (Phase 2)
The system MAY support batch task operations.

#### Scenario: Mark all complete
- GIVEN multiple incomplete tasks
- WHEN the user selects "Mark all complete"
- THEN all tasks MUST be toggled to `[x]`
- AND the file MUST be updated once (batch write)

#### Scenario: Clear all
- GIVEN multiple completed tasks
- WHEN the user selects "Clear all"
- THEN all tasks MUST be toggled to `[ ]`
- AND the file MUST be updated once

### Requirement: Error Handling
The system SHALL gracefully handle task file errors.

#### Scenario: File not found
- GIVEN a change with no `tasks.md`
- WHEN tasks are requested
- THEN a message MUST show "No tasks.md found"
- AND an option to create one SHOULD be offered

#### Scenario: File read error
- GIVEN `tasks.md` is locked or unreadable
- WHEN tasks are loaded
- THEN an error message MUST be shown
- AND the error MUST be logged
- AND the UI MUST remain functional

#### Scenario: File write error
- GIVEN `tasks.md` is read-only
- WHEN a task toggle is attempted
- THEN an error notification MUST appear
- AND the checkbox state MUST revert
- AND the error MUST suggest how to fix it

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

### Requirement: Task execution entry
The system SHALL provide an execution entry for each task in the task list so the user can trigger Agent execution or fillChat from the UI.

#### Scenario: Execute entry visible per task
- GIVEN a task list is displayed for a change
- WHEN the user views a task row
- THEN an execution entry (e.g. button or link) MUST be available for that task
- AND the entry MUST be clearly associated with the task (e.g. "执行" or "Run")

#### Scenario: Trigger sends request to extension
- GIVEN the user clicks the execution entry for a task
- WHEN the message is sent to the extension host
- THEN the extension MUST receive the change name, task index, and task text
- AND MUST proceed to dependency check and then execute or fillChat according to configuration

### Requirement: Dependency check before execution
The system SHALL enforce dependency order before allowing task execution or fillChat.

#### Scenario: Dependencies defined by document order
- GIVEN a change's tasks.md with tasks in document order (index 0, 1, 2, ...)
- WHEN dependency is evaluated for a task at index i
- THEN all tasks at indices j < i MUST be considered dependencies
- AND the task at index i MUST be executable only when all such preceding tasks are completed (checkbox [x])

#### Scenario: Block when dependencies incomplete (default)
- GIVEN dependency policy is "block" (default)
- AND at least one preceding task is incomplete
- WHEN the user triggers execution for a task
- THEN the system MUST block execution
- AND MUST show a message listing which preceding tasks are not yet complete
- AND MUST NOT call the adapter's executeTask or fillChat

#### Scenario: Warn when dependencies incomplete (optional policy)
- GIVEN dependency policy is "warn"
- AND at least one preceding task is incomplete
- WHEN the user triggers execution for a task
- THEN the system MUST show a warning listing incomplete preceding tasks
- AND MUST allow the user to proceed or cancel
- AND if the user proceeds, MUST call the adapter as usual

### Requirement: Execution mode and adapter delegation
The system SHALL use the configured execution mode and selected adapter when the user triggers execution (after dependency check passes).

#### Scenario: Auto mode calls executeTask
- GIVEN taskExecutionMode is "auto" and dependency check passes
- WHEN the user triggers execution for a task
- THEN the system MUST call the selected adapter's executeTask(request)
- AND MUST NOT open Chat or copy to clipboard as the primary action

#### Scenario: FillChat mode calls fillChat
- GIVEN taskExecutionMode is "fillChat" and dependency check passes
- WHEN the user triggers execution for a task
- THEN the system MUST call the selected adapter's fillChat(request)
- AND the adapter MAY prefill Chat or use clipboard fallback; the plugin treats both as success

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
- AND this behavior MUST be independent of the execution/fillChat trigger

## Design Constraints

- Task parsing MUST support standard Markdown checkbox syntax
- File writes MUST be atomic (no partial updates)
- Task state MUST be immediately visible after toggle
- Multiple rapid toggles MUST be handled gracefully (debounce writes)
- The system MUST NOT modify task text or other markdown content

## Dependencies

- Access to `openspec/changes/<name>/tasks.md`
- File system read/write permissions
- Markdown parsing library or custom parser
- File watcher for external changes
