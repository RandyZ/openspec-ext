# Task Detail 01: Lifecycle Domain Model

## Objective

建立 Change 生命周期的唯一领域模型，使 Dashboard 状态标签、筛选和 workflow 快捷操作不再各自推导。

## Files

```text
src/shared/changeLifecycle.ts
src/extension/services/types.ts
src/webview/types/messages.ts
test/shared/changeLifecycle.test.ts
```

## Required Types

```ts
export type ActiveChangeLifecycleStatus =
  | 'planning'
  | 'ready-to-apply'
  | 'applying'
  | 'ready-to-verify';

export type ChangeLifecycleStatus =
  | ActiveChangeLifecycleStatus
  | 'archived';

export type ChangeAttentionReason =
  | 'invalid-task-progress'
  | 'invalid-artifact-status'
  | 'invalid-artifact-path'
  | 'metadata-read-failed'
  | 'validation-failed'
  | 'root-write-unavailable';

export interface ChangeAttention {
  required: boolean;
  reasons: ChangeAttentionReason[];
}
```

## Lifecycle Rules

| Condition | Result |
| --- | --- |
| Artifact list empty | planning |
| Any Schema Artifact not done | planning |
| totalTasks = 0 | planning |
| all artifacts done, totalTasks > 0, completed = 0 | ready-to-apply |
| 0 < completed < total | applying |
| total > 0, completed = total | ready-to-verify |
| archived input | archived |

## Defensive Rules

- `completedTasks < 0` → clamp for display, Attention `invalid-task-progress`, lifecycle `planning`.
- `completedTasks > totalTasks` → Attention `invalid-task-progress`, lifecycle `planning`.
- Unknown Artifact status → normalize conservatively, Attention `invalid-artifact-status`.
- Artifact id must not influence lifecycle.
- `blocked` alone must not generate Attention.

## Workflow Mapping

| Lifecycle | Actions |
| --- | --- |
| planning | Continue, FF |
| ready-to-apply | Apply |
| applying | Apply |
| ready-to-verify | Verify |
| archived | none |

Verify must route to the existing interactive `Verify & Archive` experience.

## Tests

Use table-driven tests for every boundary:

```text
0/0
0/N
1/N
N/N
N+1/N
empty artifacts
custom artifact ids
ready and blocked artifacts
unknown status
archived
```

## Done When

- No React component contains a second lifecycle derivation.
- Pure functions have full boundary coverage.
- Existing legacy `status` remains compile-compatible.
