# Task 1. Unified Project workspace data

<!-- covers: Task 1.1, Task 1.2, Task 1.3 -->

### Task 1.1: Add RED Gateway tests for one binding-scoped Project snapshot and official Store isolation.

**Spec coverage:** `project-sidebar-tabs` / Unified Project workspace payload / First load has a valid cache; Fresh load reuses one binding; One payload serves multiple surfaces. `referenced-store-specs` / Official referenced Store Specs / Project declares a referenced Store; Project and Store contain Specs with the same id; Store Specs are excluded from Project Dashboard metrics.

**Dependencies / order:** Start from the current `ProjectDataGateway`, `ProjectSidebarData`, provider cache tests, and immutable binding helpers. This Task MUST be RED before Task 1.2.

**Implementation notes:** Test one Project snapshot rather than separate tab or Dashboard DTOs. Use official-shaped CLI responses and deterministic spies; do not create a registry, scan repository layout, or call a real Store in unit tests.

**Files:**
- Modify: `test/extension/services/projectDataGateway.test.ts`
- Modify: `test/extension/providers/dashboardViewProvider.test.ts`
- Modify: `test/webview/app.test.tsx`
- Read: `src/extension/services/projectDataGateway.ts`
- Read: `src/extension/providers/dashboardViewProvider.ts`
- Read: `src/extension/services/openSpecCacheService.ts`

- [ ] **Step 1: Write the failing Gateway snapshot test**
  - Stub one `context` response, active Changes, archived Changes, canonical Project Specs, referenced Store Specs, and Workset navigation.
  - Assert the result retains one Project binding and separate Store bindings while containing every Project workspace field.
- [ ] **Step 2: Write the failing identity and metrics-isolation tests**
  - Assert a same-id Project/Store Spec remains in separate groups.
  - Assert Store groups are data inputs for Specs only and cannot appear in Project Change/task/artifact collections.
  - Assert a cache entry with a different Project id, command cwd, root path, root source, or Store id is rejected.
- [ ] **Step 3: Run the focused RED command**
  - Run: `pnpm test -- test/extension/services/projectDataGateway.test.ts test/extension/providers/dashboardViewProvider.test.ts test/webview/app.test.tsx`
  - Expected: FAIL on missing unified fields, repeated binding work, or unsupported Dashboard surface routing; existing test setup MUST still run.
- [ ] **Step 4: Confirm RED is specific**
  - Verify failures name the new snapshot/identity expectations rather than fixture imports, timers, or unrelated legacy Dashboard behavior.

**Verification:** The focused command exits non-zero only for the newly introduced contract assertions.

**Risks / edge cases:** Missing/malformed references must fail closed or become a safe Store group error; same-name Store content must never be accepted under the Project binding.

---

### Task 1.2: Implement one-binding Project payload assembly with fail-soft Store and Workset groups.

**Spec coverage:** `project-sidebar-tabs` / Unified Project workspace payload / Fresh load reuses one binding; Refresh fails after cached data is shown. `referenced-store-specs` / all scenarios. `workset-cli-open` / Dynamic Worksets launcher / Current Project has no trusted Workset membership.

**Dependencies / order:** Task 1.1 RED assertions exist. Reuse `resolveBindingContext`, bound CLI/content access, official Store selectors, and current Workset member validation.

**Implementation notes:** Add the smallest Gateway aggregation path. Resolve the Project root once, then pass bound readers/context into Project loaders. Each Store still receives its own verified Store binding. Workset or Store failures may degrade only their optional group.

**Files:**
- Modify: `src/extension/services/types.ts`
- Modify: `src/webview/types/messages.ts`
- Modify: `src/extension/services/projectDataGateway.ts`
- Modify: `src/extension/services/openSpecCacheService.ts` only when schema validation/versioning requires the new fields
- Modify: `test/extension/services/projectDataGateway.test.ts`

- [ ] **Step 1: Extend the existing payload contract**
  - Add archived Changes, canonical Project Specs, referenced Store groups, and optional Workset navigation to `ProjectSidebarData`.
  - Keep `project`, `binding`, cache metadata, workflow config, and last refresh semantics compatible.
- [ ] **Step 2: Add one Project aggregation path**
  - Resolve one Project binding/context and create bound readers once.
  - Load Project Changes, Archives, canonical Specs, references, and navigation in parallel where dependencies allow.
  - Reuse the accepted Project context when resolving referenced Store ids instead of repeating selector-free Project context resolution.
- [ ] **Step 3: Preserve fail-closed and fail-soft boundaries**
  - Reject malformed Project root/reference identity.
  - Convert an individual Store failure into its safe group error.
  - Return unavailable/empty trusted Workset navigation without guessing membership.
- [ ] **Step 4: Run the focused GREEN command**
  - Run: `pnpm test -- test/extension/services/projectDataGateway.test.ts`
  - Expected: PASS with one Project resolution, correct Store selectors, separated same-id Specs, and safe optional-group failures.

**Verification:** Gateway tests prove one immutable Project binding per snapshot and independent verified Store bindings.

**Risks / edge cases:** Old cache payloads missing new required fields must be stale/invalid, not interpreted as valid empty collections. Workset Git metadata remains display-only and cannot change binding acceptance.

---

### Task 1.3: Add GREEN provider/cache coverage for one accepted snapshot shared across Project surfaces.

**Spec coverage:** `project-sidebar-tabs` / One payload serves multiple surfaces; Refresh fails after cached data is shown. `dashboard` / Cache-aware dashboard rendering / Project Dashboard reuses the warm Sidebar snapshot; One refresh updates both Project surfaces.

**Dependencies / order:** Task 1.2 returns the unified snapshot. Complete this before implementing the visible Dashboard route in Task 4.

**Implementation notes:** Generalize the existing provider publish path with a surface argument and keep one accepted in-memory snapshot. Reuse the existing Project page cache; do not add a Dashboard page kind or duplicate refresh subscription.

**Files:**
- Modify: `src/extension/providers/dashboardViewProvider.ts`
- Modify: `src/webview/types/messages.ts`
- Modify: `test/extension/providers/dashboardViewProvider.test.ts`
- Modify: `test/webview/app.test.tsx`

- [ ] **Step 1: Write provider message assertions before implementation**
  - Capture `setContext` messages for `view: 'sidebar'` and `view: 'dashboard'`.
  - Assert both can carry the same accepted snapshot while keeping surface-specific route values.
  - Assert the test fails before provider publishing is generalized.
- [ ] **Step 2: Implement the smallest shared publish path**
  - Store one accepted memory snapshot after generation and binding checks.
  - Publish it to the requested surface without a second Gateway call.
  - On explicit refresh/watcher acceptance, publish one fresh result to every open matching Project surface.
- [ ] **Step 3: Cover cache/stale/generation behavior**
  - Verify matching cache is posted before fresh data.
  - Verify fresh failure preserves matching cached data with stale state.
  - Verify an older request cannot overwrite a Project switch or publish to a mismatched Dashboard Panel.
- [ ] **Step 4: Run the focused GREEN command**
  - Run: `pnpm test -- test/extension/providers/dashboardViewProvider.test.ts test/webview/app.test.tsx`
  - Expected: PASS; command counts show no extra root resolution for a surface-only publish.

**Verification:** Message order, identity, generation safety, and absence of a second Dashboard cache/load path are directly asserted.

**Risks / edge cases:** A disposed Panel must be removed from publish targets; a legacy Dashboard refresh must continue through its original path when Project-first context is absent.
