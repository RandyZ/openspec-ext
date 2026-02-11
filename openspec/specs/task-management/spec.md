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
The system SHALL allow users to toggle task completion state.

#### Scenario: Toggle task via checkbox
- GIVEN an incomplete task `[ ]`
- WHEN the user clicks the checkbox
- THEN the checkbox MUST visually change to checked
- AND the `tasks.md` file MUST be updated to `[x]`
- AND the change MUST be saved immediately
- AND file watcher MUST detect and refresh

#### Scenario: Untoggle completed task
- GIVEN a completed task `[x]`
- WHEN the user clicks the checkbox
- THEN the checkbox MUST visually change to unchecked
- AND the `tasks.md` file MUST be updated to `[ ]`
- AND the change MUST be saved immediately

#### Scenario: Toggle feedback
- GIVEN any task
- WHEN the user clicks the checkbox
- THEN visual feedback MUST be immediate (< 100ms)
- AND a subtle animation SHOULD play
- AND the progress indicator MUST update

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
- WHEN toggled
- THEN UI feedback MUST be < 100ms
- AND file write MUST complete < 500ms

#### Scenario: Large task files
- GIVEN a `tasks.md` with 100+ tasks
- WHEN displayed
- THEN rendering MUST complete < 1 second
- AND scrolling MUST remain smooth (60fps)

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
