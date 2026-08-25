# Task 1. Status-backed workflow snapshot

<!-- covers: Task 1.1, Task 1.2, Task 1.3 -->

### Task 1.1: Normalize dynamic artifact graphs and concrete output paths with TDD

**Spec coverage:** `cli-integration` / `Status-backed Change workflow snapshot` / `Preserve arbitrary schema artifact graph`, `Preserve CLI declaration order`

**Dependencies / order:** First implementation task; establish the DTO before resolver or UI work.

**Files:**
- Create: `src/shared/changeWorkflow.ts`
- Modify: `src/extension/services/types.ts`, `src/extension/services/openspecCli.ts`
- Test: `test/extension/services/openspecCli.test.ts`

**Implementation notes:** Extend the existing status normalization path; preserve declaration order, dependencies, status-owned paths, and `skipped`. Keep `complete → done` compatibility and fail closed for unknown states.

**Verification:** `zsh -c 'source ~/.zshrc && pnpm exec vitest run test/extension/services/openspecCli.test.ts'` must pass with custom-schema, parallel-ready, skipped, and multi-output fixtures.

**Risks / edge cases:** Missing `artifactPaths` entries, duplicate artifact ids, unknown status values, and CLI responses that use `complete`.

- [ ] **Step 1:** Add fixtures and assertions for custom ids, two ready artifacts, requires/missingDeps, skipped, and existingOutputPaths.
- [ ] **Step 2:** Run the focused test and confirm RED because the current normalizer drops graph fields and paths.
- [ ] **Step 3:** Add the shared DTO and minimally extend the current normalizer without a new service.
- [ ] **Step 4:** Re-run the focused test and confirm PASS with CLI order unchanged.

---

### Task 1.2: Propagate bound snapshots through Project data and Webview contracts with TDD

**Spec coverage:** `cli-integration` / `Status-backed Change workflow snapshot` / `Snapshot remains bound to producing root`; `Workflow instructions are loaded on demand` / both scenarios

**Dependencies / order:** Requires Task 1.1 DTO and normalization.

**Files:**
- Modify: `src/extension/services/projectDataGateway.ts`, `src/extension/services/types.ts`, `src/webview/types/messages.ts`, `src/extension/providers/changeDetailPanelManager.ts`
- Test: `test/extension/services/projectDataGateway.test.ts`, `test/extension/providers/changeDetailPanelManager.test.ts`

**Implementation notes:** Reuse `OpenSpecRootBinding`; attach its stable identity to snapshots and carry the snapshot through existing Project/sidebar/detail payloads. Do not add instructions calls to list refresh.

**Verification:** Focused gateway and panel-manager tests must pass and assert that list refresh uses status data only.

**Risks / edge cases:** Store scope, same-named Changes, detail opened outside a card, and stale Webview payloads.

- [ ] **Step 1:** Add failing tests for bound snapshot propagation and zero list-time instructions calls.
- [ ] **Step 2:** Run both focused files and confirm RED on missing snapshot/binding fields.
- [ ] **Step 3:** Extend existing DTO/message payloads and resolve a fresh bound snapshot when Detail opens without one.
- [ ] **Step 4:** Re-run focused tests and confirm PASS without additional list-time CLI calls.

---

### Task 1.3: Reject malformed, stale, or cross-root workflow snapshots with TDD

**Spec coverage:** `cli-integration` / `Status-backed Change workflow snapshot` / `Snapshot remains bound to producing root`; `Workflow instructions are loaded on demand` / `Detail or action requests current instructions`

**Dependencies / order:** Requires Task 1.2 propagation path.

**Files:**
- Modify: `src/shared/changeWorkflow.ts`, `src/extension/services/projectDataGateway.ts`, `src/extension/providers/changeDetailPanelManager.ts`, `src/webview/types/messages.ts`
- Test: `test/extension/services/projectDataGateway.test.ts`, `test/extension/providers/changeDetailPanelManager.test.ts`

**Implementation notes:** Validate required snapshot shape and binding equality at trust boundaries. A mismatched or unknown state disables actions and triggers fresh status; it never falls back to the fixed lifecycle.

**Verification:** Focused tests must pass for malformed artifact arrays, stale binding keys, and same-name cross-root fixtures.

**Risks / edge cases:** Partial disk cache, host/Webview version skew, future CLI fields, and root path canonicalization.

- [ ] **Step 1:** Add failing rejection tests for malformed nodes, missing binding, and cross-root snapshot reuse.
- [ ] **Step 2:** Run focused tests and confirm RED because current payloads accept or ignore those cases.
- [ ] **Step 3:** Add minimal guards at snapshot ingestion and panel message boundaries.
- [ ] **Step 4:** Re-run focused tests and confirm invalid data is non-actionable while valid data remains usable.
