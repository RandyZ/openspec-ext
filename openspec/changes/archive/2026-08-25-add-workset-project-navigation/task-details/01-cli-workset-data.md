# Task 1. CLI-backed Workset navigation data

<!-- covers: Task 1.1, Task 1.2, Task 1.3 -->

### Task 1.1: Add RED gateway tests for official Workset/Store membership parsing, canonical paths, Store classification, and Git worktree metadata.

**Spec coverage:** `workset-project-navigation` / Official Workset membership discovery / current Project membership; `workset-project-navigation` / Project-only Workset selection / Store member and Git worktree scenarios; `openspec-scope-management` / Workset Project and Planning Store boundaries / Store classification.

**Dependencies / order:** none; this is the first RED step.

**Files:**
- Create: none
- Modify: `test/extension/services/projectDataGateway.test.ts`
- Test: `test/extension/services/projectDataGateway.test.ts`

**Implementation notes:**
- Add fixtures with real temporary Project directories, two Worksets sharing the current Project, another Project, a same-repository worktree path, a registered Store root, an unresolvable member, and official payloads shaped like `workset list --json` / `store list --json`.
- Assert selector-free list calls, canonical member paths, reverse membership, `Planning Store` classification, and best-effort Git repo/branch fields.
- Assert the new gateway API shape before implementation so the focused test fails for the missing behavior rather than passing through the old legacy `WorksetView` parser.

**Verification:**
- Primary command: `pnpm exec vitest run test/extension/services/projectDataGateway.test.ts -t "Workset navigation"`
- Expected result: FAIL because the new navigation loader/resolver and member metadata contract do not yet exist.

**Risks / edge cases:**
- Do not use the real global registry in this unit test; all paths and CLI payloads stay temporary and injected.

- [ ] **Step 1: Write the failing focused test**

```ts
const data = await gateway.loadWorksetNavigation(currentProject);
expect(data.worksets).toHaveLength(2);
expect(data.worksets[0].members.find((member) => member.role === 'store')?.selectable).toBe(false);
```

- [ ] **Step 2: Run focused verification — expect FAIL before implementation when TDD applies**

Run: `pnpm exec vitest run test/extension/services/projectDataGateway.test.ts -t "Workset navigation"`

Expected: FAIL with the new gateway method or expected navigation data unavailable.

- [ ] **Step 3: Implement only the test fixture helpers needed for deterministic CLI/Git inputs**

Keep all filesystem cleanup in `afterEach`; do not write machine-global Store or Workset data.

- [ ] **Step 4: Re-run focused verification and keep the RED evidence**

Run the same Vitest command and record the failing assertion before Task 1.2 implementation.

---

### Task 1.2: Implement selector-free CLI Workset/Store queries and host-created navigation models with fail-soft invalid-member handling.

**Spec coverage:** `workset-project-navigation` / Official Workset membership discovery / malformed CLI; `workset-project-navigation` / Project-only Workset selection / Project and Store members; `openspec-scope-management` / Workset Project and Planning Store boundaries / metadata unavailable.

**Dependencies / order:** Task 1.1 RED evidence.

**Files:**
- Create: none unless a small existing service utility is required by the implementation
- Modify: `src/extension/services/openspecCli.ts`, `src/extension/services/projectDataGateway.ts`, `src/extension/services/types.ts`
- Test: `test/extension/services/projectDataGateway.test.ts`, `test/extension/services/openspecCli.test.ts`

**Implementation notes:**
- Add typed CLI methods for `workset list --json` and `store list --json`; never append `--store` to these machine-global probes.
- Extend ProjectDataGateway with host-owned navigation data and a resolver that canonicalizes paths, compares Store roots, drops invalid members, and reads Git repository/branch metadata best-effort.
- Return no Workset navigation when the current Project is not a canonical member; preserve valid Worksets when an individual member cannot be inspected.
- Keep the existing legacy `DataManager.worksets` parser and management commands compatible; do not create a persistent registry or cache as authority.

**Verification:**
- Primary command: `pnpm exec vitest run test/extension/services/projectDataGateway.test.ts test/extension/services/openspecCli.test.ts -t "Workset|workset|Store"`
- Expected result: PASS for the new parser/gateway tests and no regression in existing CLI argument assertions.

**Risks / edge cases:**
- A Store member can have a symlink alias; compare real paths, not display names or raw strings.
- Git metadata failure is non-fatal and must not convert a selectable Project to a Store or hide it.

- [ ] **Step 1: Implement the smallest typed CLI methods and gateway model**

Use the existing `createCli(project.projectPath)` factory and preserve the selector-free call contract.

- [ ] **Step 2: Run focused verification — expect PASS**

Run: `pnpm exec vitest run test/extension/services/projectDataGateway.test.ts test/extension/services/openspecCli.test.ts -t "Workset|workset|Store"`

Expected: PASS for all matching tests.

- [ ] **Step 3: Add fail-soft assertions for malformed/failed list payloads and Git inspection**

The result must contain no guessed member path, Store selector, or cross-project fallback.

- [ ] **Step 4: Re-run focused verification — expect PASS**

Run the same command and confirm all new and legacy matching tests pass.

---

### Task 1.3: Add GREEN coverage for current-Project reverse membership, multiple Worksets, and empty/unsupported CLI results.

**Spec coverage:** `workset-project-navigation` / Official Workset membership discovery / eligible and ineligible current Project; `workset-project-navigation` / Workset selection / empty selectable members.

**Dependencies / order:** Task 1.2.

**Files:**
- Create: none
- Modify: `test/extension/services/projectDataGateway.test.ts`
- Test: `test/extension/services/projectDataGateway.test.ts`

**Implementation notes:**
- Cover one current Project in two Worksets, one Workset with only Store/invalid members, no membership, and list command rejection.
- Assert that Workset names/members come only from the current official payload and that selection candidates are canonical Project identities.

**Verification:**
- Primary command: `pnpm exec vitest run test/extension/services/projectDataGateway.test.ts -t "Workset navigation"`
- Expected result: PASS with all reverse-membership and fail-soft cases covered.

**Risks / edge cases:**
- Do not assert a fixed Workset ordering unless the gateway explicitly preserves CLI order; use stable fixture order only where the contract requires it.

- [ ] **Step 1: Add the remaining assertions after the minimal implementation is green**

- [ ] **Step 2: Run focused verification — expect PASS**

Run: `pnpm exec vitest run test/extension/services/projectDataGateway.test.ts -t "Workset navigation"`

Expected: PASS.

- [ ] **Step 3: Review the gateway diff for selector, root, and registry boundaries**

Confirm no `--store` flag, guessed root, persistent registry, or webview-derived binding was introduced.

- [ ] **Step 4: Run the complete gateway service test file**

Run: `pnpm exec vitest run test/extension/services/projectDataGateway.test.ts`

Expected: PASS with existing Project binding and Proposal Why tests unchanged.
