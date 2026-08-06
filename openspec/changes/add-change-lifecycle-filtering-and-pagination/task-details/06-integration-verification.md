# Task Detail 06: Integration and Verification

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
