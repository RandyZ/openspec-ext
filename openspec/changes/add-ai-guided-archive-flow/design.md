## Context

See `proposal.md` for motivation. The current codebase already has the primitives this Change needs:

- `resolveWorkflowActions()` computes recommended, available, high-impact and attention actions from a binding-aware workflow snapshot;
- Dashboard high-impact actions can open the bound Change Detail;
- `VerifyArchivePanel` owns interactive Verify/Archive terminal sessions;
- `confirmDirectArchive()` and the `archiveChange` message own explicit direct CLI archive.

The old design predates these primitives and would add a split-button component plus a second archive action model. The implementation must instead connect the existing seams.

```text
Dashboard priority / high-impact action
              |
              v
bound Change Detail -> Verify & Archive
                         |          |
                         |          +-> Archive Now
                         |              resolver-gated
                         |              -> confirmDirectArchive
                         |              -> archiveChange message
                         |              -> scope-aware CLI + refresh
                         |
                         +-> Review & Archive
                             -> existing interactive terminal session
                             -> /opsx-archive <change>
```

## Goals / Non-Goals

**Goals:**

- Reuse the shared resolver as the only archive eligibility source.
- Keep Dashboard high-impact actions navigation-only.
- Make AI review the primary Detail action and direct archive an explicit secondary action.
- Preserve binding, confirmation, refresh, error and interactive-session behavior.

**Non-Goals:**

- No new workflow state, message protocol, generic split-button/dropdown component or dependency.
- No Dashboard `Archive Now` control.
- No reimplementation of `/opsx-archive`, adapter routing, terminal management or CLI archive.
- No change to Command Palette direct archive semantics.

## Decisions

### 1. Shared resolver owns direct-archive eligibility

`resolveWorkflowActions()` already returns Archive as a high-impact action only when the workflow snapshot is healthy, planning is complete and all tasks are done. Change Detail will derive `canArchiveNow` and the disabled reason from that result instead of recreating artifact/task rules inside `VerifyArchivePanel`.

Alternative rejected: add `archiveReviewAction` / `archiveNowAction` to another workflow state. That duplicates the current resolver and creates cross-surface drift.

### 2. Dashboard only navigates to the bound safety surface

Ready-to-Verify and Archive high-impact entries open or reveal the Change Detail bound to the same Project/Store root and select `Verify & Archive`. Dashboard cards do not render a split button, menu or direct archive handler.

Alternative rejected: card-local `Archive Now`. It makes a destructive action too easy to trigger and repeats Detail logic in a narrow surface.

### 3. Detail uses two ordinary actions, not a new component abstraction

`VerifyArchivePanel` keeps the existing interactive Archive card, relabeled `Review & Archive`, and adds one secondary `Archive Now` button with disabled reason and standard keyboard/focus behavior. Two buttons in one dedicated panel do not justify a reusable split-button abstraction.

### 4. Execution paths remain intentionally different

`Review & Archive` continues through the existing interactive terminal runner and `InteractiveWorkflowState`, as required by the current workflow-control contract. `Archive Now` sends the existing direct `archiveChange` message; Extension Host performs `confirmDirectArchive()`, scope-aware CLI archive, cache invalidation and refresh. The two paths must not call each other.

### 5. Existing binding and failure guards remain controlling

All actions use the Change Detail's existing snapshot binding and scope. Stale or cross-binding data stays fail-closed. A canceled confirmation performs no write; CLI failure remains visible and does not optimistically mark the Change archived.

## Risks / Trade-offs

- [Risk] Users may confuse Review with immediate archive. -> Use `Review & Archive`, session state and a separate secondary `Archive Now` label.
- [Risk] Snapshot data changes while Detail is open. -> Recompute eligibility from the latest bound snapshot/task progress and rely on Host-side confirmation/error handling.
- [Risk] Dashboard and Detail drift. -> Dashboard only navigates; Detail owns both executable archive actions.

## Migration Plan

1. Lock shared resolver gating and current direct archive behavior with regression tests.
2. Add the Detail `Archive Now` secondary action and relabel the interactive primary action.
3. Ensure Dashboard Verify/Archive entries only open the bound Detail tab.
4. Update locales/docs and run focused, full, lint, build, strict and real Extension Host verification.

Rollback: remove the Detail secondary button while retaining `Review & Archive` and Command Palette direct archive; no data migration is required.
