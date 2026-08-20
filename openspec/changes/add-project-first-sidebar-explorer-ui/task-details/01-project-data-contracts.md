# Task 1. Project-first data contracts

<!-- covers: Task 1.1, Task 1.2, Task 1.3 -->

### Task 1.1: Define page-specific Sidebar and Explorer payload/message contracts with explicit Project/root identity

**Spec coverage:** `project-first-explorers` / `Explicit Project Binding and Isolation` / `Switching projects does not leak stale data`, `Same-named changes remain isolated by binding`; `dashboard` / `Cache-aware dashboard rendering` / `Cached data is project-scoped`, `Cached data is scoped`; `openspec-scope-management` / `Selected OpenSpec scope` / `Local root scope`, `Declared store scope is reported`.

**Dependencies / order:** First task. Tasks 1.2-4.3 must use these contracts instead of extending `DashboardData`.

**Files:**
- Create: none
- Modify: `src/extension/services/types.ts`, `src/webview/types/messages.ts`
- Test: `test/extension/providers/dashboardViewProvider.test.ts`, `test/webview/components/dashboard.test.tsx`

**Implementation notes:**
- Add three wire payloads named `ProjectSidebarData`, `ProjectChangesExplorerData`, and `ProjectSpecsExplorerData`. Each payload carries the complete existing `ProjectContext` and `OpenSpecRootBinding`, not a label or resource name alone.
- `ProjectSidebarData` contains only active Changes plus the existing runtime diagnostic, cache state, and workflow-launch fields needed by the compact Sidebar. `ProjectChangesExplorerData` contains active and archived Changes. `ProjectSpecsExplorerData` contains canonical Project Specs and referenced Store groups.
- Add the smallest discriminated message variants needed to request/post these payloads and to open `changesExplorer` or `specsExplorer`. Open-resource messages must include the originating binding.
- Keep legacy `DashboardData`, `scopeId`, and existing messages intact for compatibility. Do not add Store registry, Workset, router, or global Project Registry fields to the new contracts.
- Use one shared binding equality/key helper only if two production callers need it; otherwise compare the four required inputs directly: `projectId`, `rootPath`, `rootSource`, and optional `storeId`.

**Verification:** Type checking rejects Explorer/open requests without a Project/root binding; host tests observe distinct discriminants and bindings for Sidebar, Changes Explorer, and Specs Explorer; existing `DashboardData` tests still compile.

**Risks / edge cases:** JSON payloads are mutable at runtime even if TypeScript marks them readonly, so receiver-side identity checks remain required. Do not trust a webview-supplied path until the host matches it against a binding it created.

- [ ] **Step 1 (RED): Write failing contract tests**

Add host message assertions for all three page payloads and compile-time/runtime fixtures proving two same-labeled Projects remain distinct by binding.

- [ ] **Step 2 (RED): Run the focused tests**

Run: `rtk pnpm exec vitest run test/extension/providers/dashboardViewProvider.test.ts test/webview/components/dashboard.test.tsx -t "project page contract|project binding"`

Expected: FAIL because page-specific message variants and payload types do not exist.

- [ ] **Step 3 (GREEN): Add the minimum contracts**

Define only the three payloads, page discriminants, and binding-carrying request variants required by this Change; leave legacy contracts unchanged.

- [ ] **Step 4 (GREEN): Re-run the focused tests**

Run: `rtk pnpm exec vitest run test/extension/providers/dashboardViewProvider.test.ts test/webview/components/dashboard.test.tsx -t "project page contract|project binding"`

Expected: PASS; each page message is distinguishable and carries its full binding.

---

### Task 1.2: Extend ProjectDataGateway to load archived Changes for the resolved binding

**Spec coverage:** `project-first-explorers` / `Changes Explorer for the Current Project` / `All Changes opens a project-bound explorer`; `dashboard` removed `Scoped archive overview` and `Archive Overview` with migration to the project-bound Changes Explorer.

**Dependencies / order:** Depends on Task 1.1 payload types and the completed `add-project-data-gateway` binding/content-reader path. Task 4.2 consumes this result.

**Files:**
- Create: none
- Modify: `src/extension/services/projectDataGateway.ts`, `src/extension/services/types.ts`
- Test: `test/extension/services/projectDataGateway.test.ts`

**Implementation notes:**
- Replace `BoundReaders.contentAccess: unknown` with the minimum typed `Pick<FileManagerService, 'listArchivedChanges'>`; update the injected factory type accordingly.
- Add `loadArchivedChanges(project, explicitStoreId?)` returning `{ project, binding, archivedChanges }`. It must call `bind()` and then the existing `FileManagerService.listArchivedChanges()` rooted at `binding.rootPath/openspec`.
- Preserve the existing `archive:<directoryName>` identifier convention when later constructing detail navigation; do not normalize or rescan archive directories in the webview.
- Wrap overall failures as `ProjectDataAccessError` with phase `archived-changes` and the resolved binding when available. Never fall back to the workspace root, selected legacy scope, or another Project's archives.
- Reuse `FileManagerService`; do not create another archive reader or cache.

**Verification:** Local and externally resolved roots return only their own archive entries; a path/read failure is explicit; the content reader is constructed only after root containment validation.

**Risks / edge cases:** Same archive display name can occur under different roots; retain `directoryName` and binding together. An empty archive directory is valid data, while a failed root/read is an error.

- [ ] **Step 1 (RED): Write failing gateway tests**

Add local-root, external-root, empty archive, failure, and same-named archive fixtures using the injected content-access factory.

- [ ] **Step 2 (RED): Run the focused tests**

Run: `rtk pnpm exec vitest run test/extension/services/projectDataGateway.test.ts -t "archived changes"`

Expected: FAIL because `loadArchivedChanges()` and the typed content reader do not exist.

- [ ] **Step 3 (GREEN): Implement the bound archive read**

Type the existing reader narrowly, call its existing method once, and return the purpose-specific DTO with no new filesystem traversal.

- [ ] **Step 4 (GREEN): Re-run the focused tests**

Run: `rtk pnpm exec vitest run test/extension/services/projectDataGateway.test.ts -t "archived changes"`

Expected: PASS; every archive result and error remains tied to the resolved binding.

---

### Task 1.3: Load referenced Store Specs only from CLI-confirmed project references

**Spec coverage:** `project-first-explorers` / `Specs Explorer Separates Project and Referenced Store Specs` / `Project specs and referenced store specs are separated`, `Installed but unreferenced stores stay hidden`; `openspec-scope-management` / `Selected OpenSpec scope` / `Explicit store scope`, `Declared store scope is reported`; `dashboard` removed `Read-only references panel` and `Store selection` with migration to read-only referenced Spec groups.

**Dependencies / order:** Depends on Task 1.1 and existing `loadCanonicalSpecs()`. Task 4.3 renders the returned groups.

**Files:**
- Create: none
- Modify: `src/extension/services/projectDataGateway.ts`, `src/extension/services/types.ts`
- Test: `test/extension/services/projectDataGateway.test.ts`, `test/extension/services/openspecCli.test.ts`

**Implementation notes:**
- Add a narrow typed view of the official `getContext()` reference entries and a `loadReferencedStoreSpecs(project)` result grouped by Store id. Parse only the CLI response shape covered by fixtures; malformed entries fail explicitly rather than being guessed.
- For every CLI-confirmed referenced Store id, call the existing `listSpecs({ storeId })` canonical-spec surface. The Project's own canonical Specs continue through `loadCanonicalSpecs()` and are never merged into Store groups.
- Do not call `store list` to populate groups: registration proves installation, not a Project reference. Do not read registry YAML or keep a plugin mirror.
- Do not expose create/apply/sync/verify/archive actions in referenced groups. If a referenced Store cannot be resolved/read, return an explicit project-bound error state rather than silently substituting an empty or registered Store.
- Keep requests stateless and CLI-backed. If avoiding a duplicate `context` call requires a helper, extract only the existing context-plus-binding operation; do not introduce a session or repository abstraction.

**Verification:** A referenced Store appears in its own group, an installed-only Store never triggers `listSpecs`, Project canonical Specs stay separate, malformed/unresolved reference data does not leak another Store's Specs.

**Risks / edge cases:** Store ids and Spec ids may repeat across groups, so navigation identity must include Project binding plus referenced `storeId`. Partial Store failures must remain distinguishable from a valid empty spec list.

- [ ] **Step 1 (RED): Write failing reference tests**

Add fixtures for one referenced Store, one installed-but-unreferenced Store, duplicate Spec ids across Project/Store, empty referenced Specs, malformed context reference, and Store CLI failure.

- [ ] **Step 2 (RED): Run the focused tests**

Run: `rtk pnpm exec vitest run test/extension/services/projectDataGateway.test.ts test/extension/services/openspecCli.test.ts -t "referenced Store Specs|listSpecs"`

Expected: FAIL because the gateway does not yet derive Store Spec reads from CLI-confirmed references.

- [ ] **Step 3 (GREEN): Implement the minimum CLI-backed grouping**

Parse confirmed Store ids, invoke existing Store-scoped `listSpecs`, and return separate groups with the originating Project/root binding.

- [ ] **Step 4 (GREEN): Re-run the focused tests**

Run: `rtk pnpm exec vitest run test/extension/services/projectDataGateway.test.ts test/extension/services/openspecCli.test.ts -t "referenced Store Specs|listSpecs"`

Expected: PASS; only confirmed references are queried and no Store registry mirror is introduced.
