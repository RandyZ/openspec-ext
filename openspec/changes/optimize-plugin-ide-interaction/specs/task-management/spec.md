# Task Management Specification (Delta)

## Purpose

This delta adds the "task execution trigger" behavior to task management: an execution entry per task, dependency check, and delegation to the selected IDE adapter (execute or fillChat). Task completion state updates remain the responsibility of the Agent/OpenSpec workflow, not the plugin.

## ADDED Requirements

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

#### Scenario: Toggle remains a separate action
- GIVEN the existing task toggle (checkbox) behavior
- WHEN the user clicks the checkbox
- THEN the plugin MUST continue to update tasks.md as today (toggle [ ] / [x])
- AND this behavior MUST be independent of the execution/fillChat trigger

## MODIFIED Requirements

None. Existing task list display, toggle, persistence, progress, navigation, bulk operations, error handling, and performance requirements are unchanged.
