## Context

See `proposal.md` for motivation. Current baseline after `add-complete-artifact-inventory`:

- Host can enrich `getChangeDetails` with `artifacts` + `otherArtifacts` and open/reveal works.
- Webview Change Detail still centers a fixed `WorkflowStepIndicator` and a compact Other chip strip.
- Dashboard has no selected-change Complete Artifact Inventory; cards only show coarse badges.

Design references: `docs/new-design/OpenSpec_UI_ChangeDetail_HighFidelity.png`, `docs/new-design-append-2/OpenSpec_UI_v4_ChangesWorkspace.png`, PRD v4 §9.4 / §10 / §22.

## Goals / Non-Goals

**Goals:**

- One Host-built `ArtifactInventory` (`defined` + `other`) per change+scope, shared by Dashboard selected panel and Change Detail.
- Reusable webview Inventory / Plan Readiness components (same data props; layout variants allowed).
- Change Detail: remove fixed stepper as primary readiness UI; add Plan Readiness cards, shared Inventory Other section, Execution Progress, richer header context.
- Dashboard: selected-change Complete Artifact Inventory with Schema cards + Other section.

**Non-Goals:**

- Full Store Add Operation modal / Store Quick View IA (keep existing compact store controls).
- Workset Workspace redesign.
- Full Rendered|Source dual-mode editor chrome for every artifact.
- Treating apply/verify/archive as Schema inventory artifacts (PRD text wins over mock boxes).
- Replacing lifecycle filtering/pagination work (`add-change-lifecycle-filtering-and-pagination`); integrate with existing list, don’t rewrite status model here.

## Decisions

### D1: Canonical inventory type lives in shared module

Introduce `ArtifactInventory` / `ArtifactInventoryItem` in a shared types module (aligned with PRD §22), built once in Extension Host (extend/replace ad-hoc `otherArtifacts` attachment in `getChangeDetails`).

Dashboard and Detail both receive this structure via messages (`changeDetails` / dashboard selected-change payload). Webview MUST NOT re-diff the filesystem.

**Alternative considered:** Let each surface call different APIs and “mostly agree” — rejected; user explicitly requires one inventory.

### D2: Plan Readiness cards are a presentation of `defined`

Plan Readiness is not a second data source. It is a card layout over `inventory.defined` (status, counts, deps, actions). Content tabs remain for reading markdown/tasks.

```
Host: buildArtifactInventory(change, scope)
        │
        ├─► Dashboard selected panel ── ArtifactInventoryView(variant=workspace)
        └─► Change Detail ──────────── PlanReadiness(defined)
                                       ArtifactInventoryView(variant=detail)
                                       ExecutionProgress(tasks)
                                       Content tabs(defined ids + other entry)
```

### D3: Remove fixed stepper from Detail primary chrome

`WorkflowStepIndicator` with hardcoded Proposal→Archive MUST leave Change Detail primary layout. Keep Apply/Verify/Archive as ActionBar / VerifyArchive panel / workflow launch actions.

**Alternative:** Restyle stepper to look like cards — rejected; PRD forbids fixed phase UI.

### D4: Dashboard selected panel placement

MVP: when a change card is selected (or when Detail isn’t open, on explicit select), show inventory in an expandable section under the changes list / in the dashboard main column without requiring opening the editor Detail panel first. Opening Detail still uses the same inventory fetch/cache key `(scopeId, changeName)`.

If current Dashboard has no true “selected change” state beyond navigation into Detail, add lightweight selection: click selects + shows inventory; double-click or “Open” opens Detail (preserve existing open behavior with clear affordance). Prefer: single click opens Detail today — add an inventory preview region that loads for the last-focused/opened change from the list (including when Detail is open), keyed by selection state already used by the UI if present.

**Concrete MVP choice:** Introduce `selectedChangeName` in Dashboard; clicking a card sets selection and requests inventory; a dedicated “Open detail” control / card title action opens Change Detail. If that is too breaking, fall back to: inventory panel shows for the change currently open in Detail (synced), AND for hover/focus preview — but primary acceptance is “Workspace shows inventory without relying on a different Other list.” Prefer selection state.

### D5: Visual system

Follow existing Tailwind + VS Code CSS variables (no new design system). Schema cards: compact colored tiles with name + count + status. Other: secondary section title `Other Artifacts · Not defined in schema` / `其他工件 (未定义)` + chips/cards with counts + More (Open / Reveal / Copy path).

### D6: Compatibility with prior inventory change

Keep `buildOtherArtifacts` / `openAndRevealPath`; wrap them inside `buildArtifactInventory`. Retain message types where possible; evolve payloads to include `inventory: { defined, other }` and deprecate parallel-only `otherArtifacts` once both surfaces migrate (temporary dual-field ok during migration).

## Risks / Trade-offs

- [Dashboard click behavior change] → Mitigate with explicit Open affordance + preserve keyboard/accessibility; document in tasks.
- [Status mapping incomplete when CLI status fails] → Reuse filesystem fallback statuses; show Unknown rather than omit.
- [Visual scope creep into Store Quick View] → Hard Non-Goal; reject in review if PRs expand there.
- [Duplicate fetches] → Cache inventory on Host per `(scopeId, changeName)` short TTL / invalidate with existing file watcher.

## Migration Plan

1. Ship shared types + Host builder behind existing `getChangeDetails`.
2. Switch Change Detail to Plan Readiness + shared Other section; remove stepper.
3. Add Dashboard selected inventory panel consuming same message/builder.
4. Remove temporary dual fields after both surfaces read `inventory` only.
5. Rollback: revert webview layout; Host inventory field is additive.

## Open Questions

- None that block specs/tasks: Dashboard selection UX default locked in D4 (selectedChangeName + inventory panel; Open detail is explicit).
