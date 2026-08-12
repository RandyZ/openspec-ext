# Task 8. i18n、兼容与验证

<!-- covers: Task 8.1, Task 8.2, Task 8.3, Task 8.4, Task 8.5, Task 8.6, Task 8.7, Task 8.8 -->

## Automated Verification

Run:

```bash
pnpm test
pnpm run build
openspec validate add-change-lifecycle-filtering-and-pagination --strict
```

All existing tests must remain green.

## Required Test Areas

### Shared domain

- lifecycle boundary table;
- dynamic Artifact ids;
- invalid task progress;
- Attention reason;
- workflow action map.

### Extension Host

- lifecycle enrichment;
- Root-scoped counts;
- filesystem fallback;
- Archived count;
- local/store isolation.

### Webview

- status filter UI;
- compact Sidebar selector;
- filter before pagination;
- search/sort ordering;
- page reset;
- root-scoped persistence;
- Archived read-only;
- ChangeCard action consistency.

## Manual Smoke Matrix

| Surface | Root | Status | Expected |
| --- | --- | --- | --- |
| Editor | Local | All | Active + Archived, paginated |
| Editor | Local | Applying | Full Applying set before pagination |
| Editor | Store | Ready to Verify | Only Store data |
| Editor | Store | Archived | Only Store archives |
| Sidebar | Local | Planning | Compact selector |
| Sidebar | Store | All | Counts and cards do not leak Local data |

## Boundary Fixtures

Create fixtures for:

```text
no artifacts
custom schema artifacts
all artifacts done + 0 tasks
all artifacts done + 3 tasks / 0 completed
all artifacts done + 3 tasks / 1 completed
all artifacts done + 3 tasks / 3 completed
invalid 4/3 task progress
archived item
same change name in Local and Store
```

## Accessibility Smoke

- Tab through status controls, search, sort, filters, cards, pagination.
- Screen-reader names exist for icon-only controls.
- Selected status is announced.
- Disabled page controls are not actionable.
- Focus does not jump when results refresh.

## Performance Check

With at least 500 generated Change summaries:

- filtering and paging remain local;
- typing search does not call CLI;
- status switching does not trigger refresh;
- no repeated lifecycle derivation in render loops.

## Documentation

Update:

- README feature list;
- Chinese README;
- CHANGELOG;
- screenshots if the UI changed materially.

## Completion Evidence

Record in the implementation PR or final report:

```text
test command + result
build command + result
strict validation result
manual smoke surfaces
known limitations
```

## Execution details

### Task 8.1: 更新 `en.json` 和 `zh-cn.json` 的生命周期、筛选、分页、Attention 和空状态文案

**Spec coverage:** dashboard and workflow-control localization requirements.
**Dependencies / order:** after UI labels and action descriptors are finalized.
**Files:** Modify `src/i18n/locales/en.json`, `src/i18n/locales/zh-cn.json`; Test `test/i18n/i18n.test.ts`.
**Implementation notes:** keep locale keys identical, use concise labels for Sidebar and descriptive tooltips for Editor.
**Verification:** i18n test confirms both locales resolve every new key.
**Risks / edge cases:** avoid embedding English fallback text in components.
- [ ] Step 1: Add failing key-completeness assertions.
- [ ] Step 2: Run `pnpm test -- test/i18n/i18n.test.ts`; expect FAIL on missing keys.
- [ ] Step 3: Add matching English and Chinese entries.
- [ ] Step 4: Re-run; expect PASS with no missing-key warnings.

### Task 8.2: 更新旧 tests/fixtures，使生产路径显式提供 lifecycleStatus

**Spec coverage:** dashboard compatibility and fixture contract.
**Dependencies / order:** after Host contract and lifecycle derivation.
**Files:** Modify fixtures under `test/extension/` and `test/webview/`; Test `pnpm test`.
**Implementation notes:** production-path fixtures include lifecycle and counts; legacy-only fixtures remain isolated to the adapter test.
**Verification:** full test suite has no implicit lifecycle inference failures.
**Risks / edge cases:** do not mask production omissions by globally defaulting lifecycle fields.
- [ ] Step 1: Add a failing fixture assertion requiring explicit lifecycle data.
- [ ] Step 2: Run the affected test; expect FAIL on stale fixture shape.
- [ ] Step 3: Update only the fixture producers that represent production data.
- [ ] Step 4: Re-run affected tests; expect PASS.

### Task 8.3: 为缺少 lifecycleStatus 的 legacy fixture 保留一次性兼容 adapter 并增加 TODO

**Spec coverage:** dashboard legacy compatibility scenario.
**Dependencies / order:** after Task 8.2; before removing legacy field.
**Files:** Modify the compatibility adapter in `src/extension/`; Test `test/extension/services/dataManagerCliFallback.test.ts`.
**Implementation notes:** adapter is one-way, emits a diagnostic/TODO marker, and is not used by new production messages.
**Verification:** legacy fixture still renders while the test proves the adapter boundary is exercised.
**Risks / edge cases:** adapter must not silently reinterpret malformed data as a healthy lifecycle.
- [ ] Step 1: Add failing legacy-fixture compatibility test.
- [ ] Step 2: Run it; expect FAIL after explicit lifecycle is required.
- [ ] Step 3: Add the narrow adapter and TODO marker.
- [ ] Step 4: Re-run; expect PASS with adapter coverage.

### Task 8.4: 运行 `pnpm test`

**Spec coverage:** all automated scenarios in dashboard and workflow-control specs.
**Dependencies / order:** after Tasks 1–8.3.
**Files:** Test command only.
**Implementation notes:** run the complete Vitest suite from the repository root with pnpm.
**Verification:** expected output is zero failed tests and the existing suite's pass count.
**Risks / edge cases:** distinguish pre-existing environment warnings from assertion failures.
- [ ] Step 1: Add or confirm the final regression test before the run.
- [ ] Step 2: Run `pnpm test`; record any expected failing test names.
- [ ] Step 3: Fix only failures caused by this change.
- [ ] Step 4: Re-run; expect exit code 0.

### Task 8.5: 运行 `pnpm run build`

**Spec coverage:** extension/webview compile compatibility.
**Dependencies / order:** after tests and all source changes.
**Files:** Test command only.
**Implementation notes:** build both esbuild extension host and Vite webview bundles.
**Verification:** expected output ends with successful extension and webview builds.
**Risks / edge cases:** existing esbuild warning is cosmetic; treat type or bundling errors as blockers.
- [ ] Step 1: Run `pnpm run build` once to expose compile failures.
- [ ] Step 2: Confirm any failure points to changed source or contract.
- [ ] Step 3: Fix the smallest build issue.
- [ ] Step 4: Re-run; expect exit code 0 and generated dist artifacts.

### Task 8.6: 运行 `openspec validate add-change-lifecycle-filtering-and-pagination --strict`

**Spec coverage:** OpenSpec artifact and numbering contract.
**Dependencies / order:** after all task-detail files are written.
**Files:** Test command only.
**Implementation notes:** strict validation must be run from the resolved repository Root.
**Verification:** expected output is `Change ... is valid` with exit code 0.
**Risks / edge cases:** any orphan or duplicate `Task N.M` heading is a hard blocker.
- [ ] Step 1: Run strict validation before final review to expose mapping errors.
- [ ] Step 2: Confirm any failure names the exact artifact or task id.
- [ ] Step 3: Fix only planning artifact structure/content.
- [ ] Step 4: Re-run; expect valid output.

### Task 8.7: 执行 Sidebar 与 Editor 宽度的手工 smoke test

**Spec coverage:** dashboard responsive and accessibility scenarios.
**Dependencies / order:** after build succeeds.
**Files:** Test manual in VS Code Extension Development Host.
**Implementation notes:** verify All, each lifecycle, Archived, Attention, search, sort, page size, Root switch, card actions, and keyboard focus at both widths.
**Verification:** record a compact matrix with no console errors and no cross-Root data leakage.
**Risks / edge cases:** test both empty and populated Roots, including an out-of-range restored page.
- [ ] Step 1: Start the Extension Development Host with the repository workspace.
- [ ] Step 2: Execute the smoke matrix and record any failing surface.
- [ ] Step 3: Fix only UI regressions found in the matrix.
- [ ] Step 4: Repeat both widths; expect all matrix cells PASS.

### Task 8.8: 更新 README/CHANGELOG，记录新状态模型、筛选语义和分页顺序

**Spec coverage:** dashboard documentation requirement.
**Dependencies / order:** final task after behavior and verification are stable.
**Files:** Modify `README.md` and the repository changelog file; Test `rtk git diff --check`.
**Implementation notes:** document lifecycle values, Needs Attention orthogonality, filter-before-page order, Archived read-only semantics, and Root-scoped persistence.
**Verification:** documentation review confirms examples match the shipped labels and controls.
**Risks / edge cases:** do not document excluded Store/Workset features as part of this change.
- [ ] Step 1: Add a failing documentation checklist item for each user-visible behavior.
- [ ] Step 2: Review current docs and note missing sections.
- [ ] Step 3: Update the minimal README/CHANGELOG sections.
- [ ] Step 4: Run `rtk git diff --check`; expect clean output.
