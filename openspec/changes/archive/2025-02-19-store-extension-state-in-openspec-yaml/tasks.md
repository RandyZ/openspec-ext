## 1. Dependencies and path

- [x] 1.1 Add a YAML dependency (e.g. `yaml` or `js-yaml`) to the extension and use it for parsing/stringifying `.openspec.yaml`
- [x] 1.2 Add a method to resolve the path to a change's `.openspec.yaml` (draft: `openspec/changes/<name>/.openspec.yaml`; archive: `openspec/changes/archive/<dir>/.openspec.yaml`), reusing existing change-dir logic (e.g. from content access / getArtifactPath)

## 2. Read/write extension state in `.openspec.yaml`

- [x] 2.1 Implement reading: load the change's `.openspec.yaml`, parse YAML, return `extension.taskExecution` as `Record<number, { success, timestamp }>`; if `extension` or `extension.taskExecution` is missing, return `{}`; on file missing or parse error, return `{}`
- [x] 2.2 Implement writing: read the change's `.openspec.yaml` (or create minimal content if missing), parse, set only `extension.taskExecution` with the given task index and `{ success, timestamp }`, preserve all other top-level keys, write back to the same file; ensure parent directory exists

## 3. DataManager switch to per-change storage

- [x] 3.1 Replace `getTaskExecutionState(changeName)` to use the new per-change `.openspec.yaml` read (no global JSON)
- [x] 3.2 Replace `setTaskExecutionState(changeName, taskIndex, success)` to use the new per-change `.openspec.yaml` write (no global JSON)
- [x] 3.3 Remove `getExecutionStatePath()` and all references to `openspec/.execution-state.json`

## 4. Migration and cleanup (optional)

- [x] 4.1 Optional: one-time migration: if `openspec/.execution-state.json` exists, for each change name in it, write that change's state into `extension.taskExecution` in that change's `.openspec.yaml`, then delete or stop using the global file; document or gate behind a flag if desired

## 5. Verification

- [x] 5.1 Run `pnpm openspec validate store-extension-state-in-openspec-yaml --strict` and ensure it passes
- [x] 5.2 Manually verify: open a change's Tasks tab, run a task, confirm last run time and ✓/✗ appear and persist after reload; confirm state is stored in that change's `.openspec.yaml` under `extension.taskExecution`
