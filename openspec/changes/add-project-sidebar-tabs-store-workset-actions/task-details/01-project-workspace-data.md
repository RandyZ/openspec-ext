# Task 1. Unified Project workspace data

<!-- covers: Task 1.1, Task 1.2, Task 1.3 -->

### Task 1.1: Add RED Gateway tests for one binding-scoped payload, cache identity, and official referenced Store data.

**Spec coverage:** `project-sidebar-tabs` / Unified Project workspace payload / First load has a valid cache; Fresh load reuses one binding. `referenced-store-specs` / Official referenced Store Specs / Project declares a referenced Store; Project and Store contain Specs with the same id.

**Dependencies / order:** Requires the current `ProjectDataGateway`, `ProjectSidebarData`, and existing binding tests. Must be RED before Task 1.2.

**Implementation notes:** Keep the payload binding-scoped and reuse existing Gateway/cache primitives; do not add a parallel registry.

**Files:**
- Modify: `test/extension/services/projectDataGateway.test.ts`
- Modify: `test/extension/providers/dashboardViewProvider.test.ts`
- Modify: `test/webview/app.test.tsx`
- Read: `src/extension/services/projectDataGateway.ts`, `src/extension/providers/dashboardViewProvider.ts`, `src/extension/services/openSpecCacheService.ts`

- [ ] **Step 1: Write the failing tests**
  - Stub `getContext`, `listChanges`, `listSpecs`, `listArchivedChanges`, and referenced Store `listSpecs` for one Project binding.
  - Assert the unified payload contains Project Changes, archived Changes, Project Specs, Store group, and the Store binding.
  - Assert repeated data assembly reuses the binding and rejects a cache payload whose Project/root/store identity differs.
- [ ] **Step 2: Run test — expect FAIL**
  - Run: `pnpm test -- test/extension/services/projectDataGateway.test.ts test/extension/providers/dashboardViewProvider.test.ts test/webview/app.test.tsx`
  - Expected: FAIL because the unified payload and identity assertions are not implemented.
- [ ] **Step 3: Record the official fixture shape**
  - Use `context.references` when present and `members[].role=referenced_store` as the compatibility shape.
  - Keep `list --specs --json --store <id>` as the Store Specs command under test.
- [ ] **Step 4: Confirm RED remains specific**
  - Verify failures name missing payload fields or duplicate binding calls, not unrelated setup errors.

**Verification:** The focused command exits non-zero for the new assertions and existing tests still execute.

**Risks / edge cases:** Same-named Project and Store Specs must remain separate; malformed reference entries must fail closed or produce a safe Store group error.

---

### Task 1.2: Implement unified Project Sidebar data loading with binding reuse and fail-soft Store groups.

**Spec coverage:** `project-sidebar-tabs` / Unified Project workspace payload / Fresh load reuses one binding; Refresh fails after cached data is shown. `referenced-store-specs` / all requirements.

**Dependencies / order:** Task 1.1 RED tests must exist. Reuse `ProjectDataGateway.resolveBindingContext`, `OpenSpecCacheService`, and existing `ProjectReferencedStoreSpecGroup`; do not add a registry.

**Implementation notes:** Prefer one resolved root/binding per refresh and isolate Store failures to their group while preserving Project data.

**Files:**
- Modify: `src/extension/services/types.ts`
- Modify: `src/webview/types/messages.ts`
- Modify: `src/extension/services/projectDataGateway.ts`
- Modify: `src/extension/providers/dashboardViewProvider.ts`
- Modify: `src/extension/services/openSpecCacheService.ts` only if the existing payload validator requires a field/version update

- [ ] **Step 1: Add the smallest data contract**
  - Extend the Project-first Sidebar payload with archived Changes, Project Specs, and referenced Store groups while preserving existing binding fields.
  - Keep Store binding optional only for an error group; never synthesize a root from a path or registry entry.
- [ ] **Step 2: Reuse one resolved binding**
  - Add or refactor a Gateway method that resolves the current Project once, creates bound readers once, and loads Project data in parallel.
  - Pass the already resolved Project context into referenced Store resolution instead of calling the Project root resolver again for the same request.
- [ ] **Step 3: Add cache-first/background refresh behavior**
  - Publish only cache entries whose Project id, command cwd, root path, root source, and Store id match the current binding.
  - Keep matching cached data on fresh-load failure and mark it stale; do not publish data from another Project.
- [ ] **Step 4: Run the focused tests — expect PASS**
  - Run: `pnpm test -- test/extension/services/projectDataGateway.test.ts test/extension/providers/dashboardViewProvider.test.ts`
  - Expected: PASS for the Task 1.1 assertions.

**Verification:** Gateway tests prove one binding identity, correct Store selector, separated groups, and fail-soft errors.

**Risks / edge cases:** A Store query may fail after Project data succeeds; only that group may degrade. A missing cache field must be treated as stale, not as a valid empty list.

---

### Task 1.3: Add GREEN provider/cache coverage for stale-safe refresh and no duplicate tab scans.

**Spec coverage:** `project-sidebar-tabs` / First load has a valid cache; Refresh fails after cached data is shown. `dashboard` / Existing cache avoids click-time reload.

**Dependencies / order:** Task 1.2 implementation complete.

**Implementation notes:** Prove cache-first ordering and generation safety with message spies rather than timing-based tests.

**Files:**
- Modify: `test/extension/providers/dashboardViewProvider.test.ts`
- Modify: `test/webview/app.test.tsx`

- [ ] **Step 1: Assert cache-first ordering**
  - Capture Webview messages and verify matching cached Project workspace data arrives before fresh data.
  - Verify a fresh error keeps the cached binding and emits a stale/recoverable state.
- [ ] **Step 2: Assert no duplicate tab load**
  - Simulate Changes/Specs tab requests and verify no `openChangesExplorer` or `openSpecsExplorer` list load is triggered.
- [ ] **Step 3: Run focused tests**
  - Run: `pnpm test -- test/extension/providers/dashboardViewProvider.test.ts test/webview/app.test.tsx`
  - Expected: PASS with no unrelated failures.

**Verification:** Message order, binding identity, and no duplicate CLI/panel path are directly asserted.

**Risks / edge cases:** A delayed old request must not overwrite a newer Project switch; retain the existing generation guard.
