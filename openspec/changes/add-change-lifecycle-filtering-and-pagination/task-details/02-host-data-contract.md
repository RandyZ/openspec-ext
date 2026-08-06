# Task Detail 02: Extension Host Data Contract

## Objective

由 Extension Host 发布完整、Root 隔离的生命周期状态和状态计数。

## Data Contract

```ts
export interface ChangeStatusCounts {
  all: number;
  planning: number;
  readyToApply: number;
  applying: number;
  readyToVerify: number;
  archived: number;
  needsAttention: number;
}

export interface DashboardData {
  changes: ChangeInfo[];
  archivedChanges: ArchivedChangeInfo[];
  changeStatusCounts: ChangeStatusCounts;
  // existing fields
}
```

## DataManager Flow

```text
list active changes for resolved scope
→ normalize artifacts/tasks
→ derive lifecycle
→ derive attention
→ list archives for same scope
→ count active + archived
→ publish dashboardData
```

## Scope Invariant

The following MUST share one resolved scope:

```text
changes
archivedChanges
changeStatusCounts
specs
```

A stale response from another scope must not overwrite current scope data.

## Filesystem Fallback

Fallback may not know a custom Schema's complete Artifact graph.

Rules:

- use existing fallback artifact list;
- do not infer Ready to Apply unless all known Schema artifacts are confidently done;
- when uncertain, prefer `planning`;
- do not mark uncertainty as an error unless data is structurally invalid.

## Count Function

Implement a pure count function:

```ts
buildChangeStatusCounts(activeChanges, archivedChanges)
```

`all` must equal:

```text
activeChanges.length + archivedChanges.length
```

`needsAttention` counts only Active Change attention in the first release unless archived diagnostics are explicitly available.

## Contract Tests

- current scope active and archived counts;
- local/store same-name Change isolation;
- stale scope response ignored;
- all = sum lifecycle buckets;
- fallback produces conservative state;
- malformed data produces Attention, not crash.

## Done When

- DashboardData always includes counts on production paths.
- Counts and list belong to the same Root.
- Webview does not recalculate lifecycle.
