## Why

Task execution state (last run time, success/failure per task) is currently stored in a single global file `openspec/.execution-state.json`. Storing it in each change's `.openspec.yaml` under a dedicated `extension` section keeps data with the change, respects OpenSpec's definition of `.openspec.yaml` (top-level fields unchanged), and gives the plugin a clear namespace for runtime and execution info.

## What Changes

- Persist extension runtime/execution state per change in that change's `.openspec.yaml` under a top-level `extension` key.
- Remove use of global `openspec/.execution-state.json` for task execution state.
- Read/write only the `extension` subtree when updating state; preserve all other top-level keys (e.g. `schema`, `created`) so OpenSpec CLI and tooling are unaffected.
- Task execution state continues to be shown in the Tasks tab (time + ✓/✗) and updated when the user runs a task; only the storage location and format change.

## Capabilities

### New Capabilities

- `extension-state-storage`: Defines the contract for the extension's data in each change's `.openspec.yaml`: the `extension` key, its structure (e.g. `taskExecution`), and that only this subtree is written by the extension while other keys are preserved.

### Modified Capabilities

- (none)

## Impact

- **DataManager**: Replace `getExecutionStatePath()` / single JSON file with per-change `.openspec.yaml` read/write; add or use YAML parse/stringify (e.g. dependency).
- **File paths**: State lives at `openspec/changes/<name>/.openspec.yaml` (and archive equivalents); no more `openspec/.execution-state.json`.
- **FileWatcher**: Already watches `openspec/**/*.yaml`; writing `.openspec.yaml` will trigger refresh (acceptable).
- **Backward compatibility**: On first read, if a change has no `extension.taskExecution`, treat as empty; optionally migrate existing `.execution-state.json` into each change's `.openspec.yaml` once, then remove the global file.
