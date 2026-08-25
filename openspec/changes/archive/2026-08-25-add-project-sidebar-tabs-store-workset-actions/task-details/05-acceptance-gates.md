# Task 5. Real CLI fixture, GUI acceptance, and final gates

<!-- covers: Task 5.1, Task 5.2, Task 5.3 -->

### Task 5.1: Verify real Project and referenced Store Specs remain separately rooted through official CLI JSON.

**Spec coverage:** `referenced-store-specs` / all scenarios. `project-sidebar-tabs` / Unified Project workspace payload / Fresh load reuses one binding. `dashboard` / Referenced Store data does not alter Project metrics.

**Dependencies / order:** Tasks 1–4 complete. Use the named real Project read-only; if unavailable, use an isolated XDG fixture and remove only files created by the task.

**Implementation notes:** Treat official CLI JSON as the source of truth. Never mutate the real Store registry, Worksets, referenced Project, or another repository. Record root/store identities without copying unrelated sensitive content.

**Files:**
- Modify: `test/extension/services/projectDataGateway.test.ts` only for a durable official-shape regression
- Create: temporary fixture files outside the repository only when fallback is required; remove them after verification
- Read: `/Users/randy/workspace/projects/aihelp/ai/aihelp-knowledge-agent/openspec/config.yaml`

- [ ] **Step 1: Probe the real Project context**
  - From `aihelp-knowledge-agent`, run `openspec context --json` and `openspec doctor --json`.
  - Confirm `aihelp-workspace` is reported as a referenced Store and capture only the root/source/store identity needed for evidence.
- [ ] **Step 2: Probe Project and Store canonical Specs**
  - Run selector-free `openspec list --specs --json` for the Project.
  - Run `openspec list --specs --json --store aihelp-workspace` for the Store.
  - Confirm the outputs remain separately rooted and same-id entries, if present, are not merged.
- [ ] **Step 3: Exercise the Gateway and summary fixture**
  - Feed the official-shaped responses into Gateway tests.
  - Assert separate groups/bindings, Store fail-soft behavior, one Project binding, and Store exclusion from Project Dashboard metrics.
- [ ] **Step 4: Clean fallback artifacts and record result**
  - Remove only temporary XDG/config/fixture paths created in this task.
  - If the real Store is unavailable, record the exact safe failure classification and the isolated fallback result separately.

**Verification:** Official CLI and deterministic Gateway/summary evidence agree on Project versus Store ownership.

**Risks / edge cases:** A real Store outage is not permission to guess a root. Same-id absence in the live fixture does not replace the deterministic same-id regression.

---

### Task 5.2: Verify the launcher, local views, Project Dashboard, Project switching, and official Workset open in the Extension Host.

**Spec coverage:** All user-facing scenarios in `project-sidebar-tabs`, `referenced-store-specs`, `workset-cli-open`, and `dashboard` / Project Dashboard summary surface.

**Dependencies / order:** Task 5.1 and all focused automated tests complete.

**Implementation notes:** Use the official VS Code Extension Development Host with a real or isolated Project fixture. Cursor coverage is additional; if authentication or host behavior prevents it, report the gap without reducing the official Host acceptance.

**Files:**
- Create: screenshots/evidence only under `/Users/randy/.codex/visualizations/...`
- Read: real or isolated Project/Store/Workset fixtures selected for acceptance
- Modify: no repository source or planning files during GUI observation

- [ ] **Step 1: Verify the Project-first Sidebar shell**
  - Launch the Extension Development Host and open the target Project.
  - Confirm native New Change/Refresh title actions and the stable 2×2 Changes/Specs/Worksets/Dashboard grid.
  - Confirm Changes is default and no list Editor opens when switching local views.
- [ ] **Step 2: Verify Specs and dynamic Worksets**
  - Confirm Project Specs and `aihelp-workspace` Store Specs render as separate groups and a Store Spec opens from its Store binding.
  - Confirm Worksets is enabled with trusted memberships and opens only the local picker.
  - In a no-membership/unsupported fixture, confirm the Worksets grid position remains visibly unavailable and does not guess.
- [ ] **Step 3: Verify Project Dashboard behavior**
  - Open Dashboard and confirm a distinct wide Editor with truthful KPI, lifecycle, readiness, recent updates, and accessible text.
  - Activate Dashboard again and confirm the existing Panel is revealed rather than duplicated.
  - Refresh with Sidebar and Dashboard open and confirm both update for the same binding without visible cross-Project data.
- [ ] **Step 4: Verify Workset granularity and capture evidence**
  - Confirm Project picker changes only the Sidebar Project.
  - Confirm the management card invokes official whole-Workset open and honors CLI tool preference.
  - Capture same-viewport evidence for grid, Changes, Specs/Store, Worksets enabled/disabled, Dashboard, Project switch, and whole-Workset open; then close temporary Hosts.

**Verification:** GUI evidence covers every changed surface and distinguishes observed VS Code Host success from any unavailable Cursor coverage.

**Risks / edge cases:** External tool launch may open another window; verify the originating action and CLI result without assuming the new window proves correct members. Missing Dashboard text equivalents or duplicate Panels is a failed acceptance item.

---

### Task 5.3: Run full tests, lint, build, strict OpenSpec validation, task-detail validation, and final diff review.

**Spec coverage:** `cli-integration`, `dashboard`, and every new capability's final acceptance gate.

**Dependencies / order:** Tasks 5.1 and 5.2 complete with recorded evidence.

**Implementation notes:** Mark `tasks.md` checkboxes only after fresh evidence for each Task group. Keep archive, push, merge, and worktree deletion outside this Change unless separately authorized.

**Files:**
- Read: all current Change artifacts, task-details, implementation diff, and GUI evidence
- Modify: only the matching Task checkboxes in `tasks.md` after their requirements pass

- [ ] **Step 1: Run automated project gates**
  - Run: `pnpm test`
  - Run: `npx eslint src/`
  - Run: `pnpm run build`
  - Run: `git diff --check`
  - Expected: tests/build/diff exit 0 and lint reports 0 errors.
- [ ] **Step 2: Run OpenSpec planning gates**
  - Run: `openspec validate add-project-sidebar-tabs-store-workset-actions --strict --json`
  - Run fresh `openspec list --json`, `openspec status --change add-project-sidebar-tabs-store-workset-actions --json`, and `openspec instructions apply --change add-project-sidebar-tabs-store-workset-actions --json`.
  - Run the AIHelp plugin validator with the status-owned canonical changeRoot.
  - Expected: strict valid, task-details 0 errors, and implementation progress 15/15.
- [ ] **Step 3: Review scope and dependency diff**
  - Confirm only approved implementation/planning paths changed, no temporary fixture is tracked, and `package.json` adds no chart or Dashboard data dependency.
  - Confirm every spec scenario maps to at least one Task and every Task id maps bidirectionally to exactly one task-detail block.
- [ ] **Step 4: Produce the evidence-backed handoff**
  - Report worktree/root, branch/commit if one exists, Git status, 15 Task results, focused/full commands, real CLI evidence, GUI evidence paths, and remaining gaps.
  - Do not archive, push, merge, or delete a worktree without explicit authorization.

**Verification:** The final handoff distinguishes automated tests, official CLI fixture, GUI observations, and any unverified environment-specific behavior.

**Risks / edge cases:** Build success or HTTP/process exit alone is not GUI acceptance. A missing fresh screenshot or real CLI failure remains an explicit gap rather than an assumed pass.
