# Task 5. Real CLI fixture, GUI acceptance, and final gates

<!-- covers: Task 5.1, Task 5.2, Task 5.3 -->

### Task 5.1: Verify a real reference Project plus registered Store returns separate Project and Store Specs through official CLI JSON.

**Spec coverage:** `referenced-store-specs` / Project declares a referenced Store; Project and Store contain Specs with the same id; Project has no references. `project-sidebar-tabs` / Fresh load reuses one binding.

**Dependencies / order:** Tasks 1–4 complete; use an isolated XDG data/config directory or a read-only real fixture and clean all temporary files afterward.

**Implementation notes:** Treat official CLI output as the source of truth and never mutate the real Store registry or Worksets during fixture setup.

**Files:**
- Modify: `test/extension/services/projectDataGateway.test.ts` only for a durable fixture regression
- Create: temporary fixture files outside the repository, removed after verification
- Read: `/Users/randy/workspace/projects/aihelp/ai/aihelp-knowledge-agent/openspec/config.yaml`

- [ ] **Step 1: Probe the real Project**
  - Run `openspec context --json` and `openspec doctor --json` from `aihelp-knowledge-agent`.
  - Confirm `aihelp-workspace` is a referenced Store member and the health response is readable.
- [ ] **Step 2: Probe both Spec roots**
  - Run `openspec list --specs --json` from the Project and `openspec list --specs --json --store aihelp-workspace` for the Store.
  - Confirm outputs remain separately rooted and same-named ids, if present, are not merged.
- [ ] **Step 3: Exercise the extension Gateway**
  - Feed the official-shaped context into the Gateway fixture and assert separate groups, Store binding, and safe failure behavior.
- [ ] **Step 4: Clean the fixture**
  - Remove only temporary XDG/config/fixture paths created by this task; do not modify the real Store registry, Worksets, or referenced Project.

**Verification:** CLI JSON and Gateway evidence both show Project Specs and referenced Store Specs with correct roots.

**Risks / edge cases:** If the real Store is unavailable, report the exact failure and run the isolated fixture fallback; never silently substitute a guessed Store root.

---

### Task 5.2: Verify Sidebar tabs, Store Spec binding, Project switching, and official Workset open in the real Extension Development Host.

**Spec coverage:** all user-facing scenarios in `project-sidebar-tabs`, `referenced-store-specs`, and `workset-cli-open`.

**Dependencies / order:** Task 5.1 and all implementation/tests complete.

**Implementation notes:** GUI evidence belongs to the delegated Luna/xhigh execution thread; report unavailable Cursor coverage explicitly.

**Files:**
- Create: screenshots/evidence only under `/Users/randy/.codex/visualizations/...`
- Read: `/Users/randy/.local/share/openspec/worksets/`

- [ ] **Step 1: Launch the isolated Host**
  - Use the existing Extension Development Host workflow from the execution thread with a real or isolated Project fixture.
  - Confirm the Sidebar shows Changes and Specs tabs without opening list Editors.
- [ ] **Step 2: Verify referenced Store behavior**
  - Open the Specs tab for `aihelp-knowledge-agent`.
  - Confirm Project Specs and `aihelp-workspace` Store Specs are separate, and a Store Spec opens from the correct Store root.
- [ ] **Step 3: Verify Workset granularity**
  - Confirm Project picker member action switches only the Sidebar Project.
  - Confirm Workset management card action invokes official `workset open` and opens the saved whole Workset using its tool preference.
- [ ] **Step 4: Capture and clean evidence**
  - Capture same-viewport screenshots for initial Sidebar, Changes tab, Specs/Store group, Project switch, and Workset open.
  - Close temporary Hosts and remove only temporary fixtures.

**Verification:** GUI evidence covers the changed UX; the execution thread must report model `gpt-5.6-luna` and reasoning `xhigh`.

**Risks / edge cases:** Cursor may require login; if unavailable, record that limitation and complete the official VS Code Host path without claiming Cursor success.

---

### Task 5.3: Run full tests, lint, build, strict OpenSpec validation, task-detail validation, diff checks, and final status review.

**Spec coverage:** `cli-integration`, `dashboard`, and every new capability's final acceptance gate.

**Dependencies / order:** Tasks 5.1 and 5.2.

**Implementation notes:** Mark task checkboxes only after fresh command output and evidence are captured; keep archive/merge/push outside this Change.

**Files:**
- Read: all current Change artifacts and implementation diff
- Modify: only task checkboxes in `tasks.md` after the corresponding verification succeeds

- [ ] **Step 1: Run automated gates**
  - Run `pnpm test`, `npx eslint src/`, `pnpm run build`, and `git diff --check`.
  - Expected: tests/build exit 0; lint has 0 errors; diff check is clean.
- [ ] **Step 2: Run OpenSpec gates**
  - Run `openspec validate add-project-sidebar-tabs-store-workset-actions --strict --json`, fresh `openspec list --json`, `openspec status --change ... --json`, and `openspec instructions apply --change ... --json`.
  - Run `node /Users/randy/.codex/plugins/cache/aihelp-dev/aihelp-agent-plugin/0.1.7/skills/aihelp-writing-task/scripts/validate-task-details.mjs --change-dir <resolved-change-dir> --json`.
  - Expected: valid=true, task-detail validator has no error findings, and progress is 15/15.
- [ ] **Step 3: Review final diff and status**
  - Confirm only the intended Change and implementation files changed, no temporary fixture is tracked, and the execution thread reports the exact worktree, branch, commit, tests, GUI evidence, and model/reasoning.
- [ ] **Step 4: Preserve integration boundary**
  - Do not archive, push, delete the worktree, or merge into the main checkout until the user explicitly authorizes the finishing step.

**Verification:** Final receipt is evidence-backed and distinguishes automated gates, official CLI fixture, and real GUI acceptance.

**Risks / edge cases:** A missing fresh GUI screenshot is a reported acceptance gap, not a reason to claim full UX verification.
