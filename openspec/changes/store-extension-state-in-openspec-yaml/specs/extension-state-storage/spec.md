## ADDED Requirements

### Requirement: Extension state stored under `extension` in change's `.openspec.yaml`

The extension SHALL store its runtime and execution state in each change's `.openspec.yaml` file under a single top-level key `extension`. All other top-level keys (e.g. `schema`, `created`) SHALL be preserved when the extension writes to the file.

#### Scenario: File has only OpenSpec keys

- **GIVEN** a change's `.openspec.yaml` contains only OpenSpec-defined keys (e.g. `schema`, `created`)
- **WHEN** the extension reads or writes extension state for that change
- **THEN** the extension SHALL read/write only the `extension` subtree
- **AND** all other top-level keys SHALL remain unchanged after a write

#### Scenario: Extension writes task execution state

- **GIVEN** a change with a valid `.openspec.yaml` path (draft or archive)
- **WHEN** the extension persists task execution state for that change (e.g. after a task run)
- **THEN** the extension SHALL update only `extension.taskExecution` (or equivalent) in that file
- **AND** the structure SHALL map task index to `{ success: boolean, timestamp: number }` (e.g. keys as string indices)

#### Scenario: No extension key present

- **WHEN** the extension reads extension state for a change and the file has no `extension` key (or no `extension.taskExecution`)
- **THEN** the extension SHALL treat execution state as empty (e.g. return `{}` for task execution state)
- **AND** the extension MAY create the `extension` key (and nested keys) on first write

### Requirement: Task execution state location per change

Task execution state SHALL be stored in the change's own directory, not in a global file keyed by change name.

#### Scenario: State read from change directory

- **GIVEN** a change name (draft or `archive:<dir>`)
- **WHEN** the extension loads task execution state for that change
- **THEN** the extension SHALL read from `openspec/changes/<name>/.openspec.yaml` or `openspec/changes/archive/<dir>/.openspec.yaml` respectively
- **AND** SHALL NOT read from a global execution-state file for that change

#### Scenario: State written to change directory

- **WHEN** the extension persists task execution state for a change
- **THEN** the extension SHALL write only to that change's `.openspec.yaml` (under `extension.taskExecution` or equivalent)
- **AND** SHALL NOT update a global execution-state file for that change
