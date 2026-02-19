## Context

- Each OpenSpec change may have a `.openspec.yaml` (e.g. `schema`, `created`). OpenSpec CLI and tooling may read top-level keys; the extension must not overwrite or remove them.
- Task execution state is currently in a single global `openspec/.execution-state.json` keyed by change name and task index. We want it per change in that change's `.openspec.yaml` under a dedicated `extension` section so (1) data travels with the change (e.g. on archive), (2) OpenSpec-defined content stays intact, (3) the plugin has a clear namespace for runtime/execution info.

## Goals / Non-Goals

**Goals:**

- Store extension runtime/execution state in each change's `.openspec.yaml` under a single top-level key `extension`.
- Define and implement only read/write of the `extension` subtree; preserve all other top-level keys when writing.
- Replace use of `openspec/.execution-state.json` with per-change `.openspec.yaml` for task execution state.
- Keep existing UI behavior (Tasks tab: last run time + ✓/✗; execute button; webview ↔ extension message flow unchanged except data source).

**Non-Goals:**

- Changing OpenSpec's schema or CLI behavior for `.openspec.yaml`.
- Adding new UI features or new extension state fields in this change (only the storage location and format for existing task execution state).

## Decisions

### 1. Use a single top-level key `extension` in `.openspec.yaml`

- **Choice:** All plugin-owned data lives under `extension` (e.g. `extension.taskExecution`).
- **Rationale:** Clear namespace; OpenSpec and other tools can ignore it; future plugin state (e.g. lastActiveTab, lastExecutorId) can be added under `extension` without touching top-level keys.
- **Alternatives:** Separate top-level keys per feature (e.g. `taskExecution` at top level) was rejected to avoid polluting OpenSpec’s namespace.

### 2. File path for per-change state

- **Choice:** `openspec/changes/<changeName>/.openspec.yaml` for draft changes; `openspec/changes/archive/<archiveDir>/.openspec.yaml` when `changeName` is `archive:<archiveDir>`.
- **Rationale:** Same path pattern as existing artifacts (e.g. `getArtifactPath(changeName, 'tasks')` → same base dir); `.openspec.yaml` already exists or is created there by OpenSpec.
- **Implementation:** Resolve base path via existing content-access layer (e.g. directory of `getArtifactPath(changeName, 'tasks')`) and append `.openspec.yaml`.

### 3. YAML dependency

- **Choice:** Use a small YAML library (e.g. `yaml` or `js-yaml`) to parse and stringify `.openspec.yaml`. Read full file → update only `extension` (or `extension.taskExecution`) → write back, preserving other keys and key order where possible.
- **Rationale:** Safe merge of a subtree without hand-written YAML; avoids corrupting comments or key order of the rest of the file.
- **Alternatives:** Hand-written minimal parser was rejected for maintainability and risk of breaking valid YAML.

### 4. Shape of `extension.taskExecution`

- **Choice:** Same semantic as today: `Record<number, { success: boolean; timestamp: number }>`. In YAML, keys are stringified task indices (e.g. `"0"`, `"1"`) for JSON compatibility; values are `{ success: true/false, timestamp: <ms> }`.
- **Rationale:** No change to webview or message types; only DataManager’s persistence layer changes.

### 5. Migration and backward compatibility

- **Choice:** (a) On read: if a change has no `extension` or `extension.taskExecution`, return empty object. (b) Optional one-time migration: if `openspec/.execution-state.json` exists, for each change name in it, read existing state and write into that change’s `.openspec.yaml` under `extension.taskExecution`, then delete or stop using the global file.
- **Rationale:** No breaking change for users who already have execution state; they can keep using it after migration or accept “empty” state for existing changes if we don’t migrate.

## Data flow (unchanged except persistence)

```
Webview (Tasks tab)                Extension (DataManager)
        |                                    |
        | getTaskExecutionState(changeName)  |
        |----------------------------------->|  read .openspec.yaml for change
        | taskExecutionState                 |  → parse, return extension.taskExecution
        |<-----------------------------------|
        | executeTask(...)                   |
        |----------------------------------->|  run task → setTaskExecutionState(...)
        |                                    |  read .openspec.yaml → set extension.taskExecution
        |                                    |  write .openspec.yaml (preserve other keys)
        | taskExecutionFinished(executionState)
        |<-----------------------------------|
```

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| YAML write corrupts or drops other keys | Use parse → modify only `extension` → stringify; avoid manual string replacement. |
| Concurrent writes to same file | Single writer (extension process); file watcher only reads. If needed, read-modify-write with short retry on conflict. |
| `.openspec.yaml` missing for a change | On first write, create file with minimal content (e.g. `schema: spec-driven` if known, or only `extension: …`); or create only when we have state to write and ensure directory exists. |
| Full refresh on any `.openspec.yaml` change | Already accepted: FileWatcher watches `openspec/**/*.yaml`; writing triggers refresh; UI updates correctly. |

## Migration Plan

1. Implement per-change read/write in DataManager (YAML under `extension.taskExecution`); keep reading from global JSON until migration step is decided.
2. Optional: one-time migration script or startup path: if `.execution-state.json` exists, for each key (change name), ensure change dir exists, read/create `.openspec.yaml`, merge state into `extension.taskExecution`, write back; then remove or stop reading `.execution-state.json`.
3. Remove `getExecutionStatePath()` and all references to `openspec/.execution-state.json`.
4. Deploy; verify Tasks tab shows and updates execution state per change.

## Open Questions

- Whether to run one-time migration from `.execution-state.json` to each change’s `.openspec.yaml` automatically on first load (and then delete the global file), or leave migration as a manual/optional step.
