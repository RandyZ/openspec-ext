# Task 4. Editor Explorers

<!-- covers: Task 4.1, Task 4.2, Task 4.3 -->

### Task 4.1: Route host page context to Sidebar, Changes Explorer, and Specs Explorer without a router dependency

**Spec coverage:** `project-first-explorers` / `Project-first Sidebar Home`, `Changes Explorer for the Current Project`, `Specs Explorer Separates Project and Referenced Store Specs`; `dashboard` / `Dashboard Actions` / `Entry points open explorer pages`.

**Dependencies / order:** Depends on Tasks 1.1, 2.2, and 3.1. Complete before Tasks 4.2-4.3 page components.

**Files:**
- Create: `test/webview/app.test.tsx`
- Modify: `src/webview/App.tsx`, `src/webview/context/AppContext.tsx`, `src/webview/types/messages.ts`
- Test: `test/webview/app.test.tsx`

**Implementation notes:**
- Extend the existing host-pushed `setContext` switch with `sidebar`, `changesExplorer`, and `specsExplorer` page kinds while preserving `changeDetail` and `specContent` behavior.
- Store each Explorer payload and its binding in `AppContext`; replace it only when the incoming discriminant and binding match the target page. Clear incompatible page data during a real binding transition.
- Keep search/filter/sort/page state inside the Explorer component instance so VS Code `retainContextWhenHidden` preserves it when detail panels open. Do not duplicate that state in host messages.
- Render `Dashboard`, `ChangesExplorer`, or `SpecsExplorer` with a direct component switch. Do not install React Router or create URL/history state.
- Unknown/malformed contexts render the existing loading/error path and do not reuse data from the previous page under a new heading.

**Verification:** Each host context renders one matching page; existing Change Detail/Spec Viewer routing remains intact; malformed or mismatched context cannot reveal stale page data.

**Risks / edge cases:** `specContent` is an existing message as well as a new Specs Explorer concept; keep discriminants distinct. Webview reload can replay messages, so page state initialization must be idempotent.

- [ ] **Step 1 (RED): Write failing App routing tests**

Cover all five existing/new page kinds, unknown context, mismatched binding, repeated identical context, and preservation of existing detail/spec routing.

- [ ] **Step 2 (RED): Run the focused tests**

Run: `rtk pnpm exec vitest run test/webview/app.test.tsx`

Expected: FAIL because App does not recognize the two Explorer page contexts or explicit Sidebar context.

- [ ] **Step 3 (GREEN): Add a direct discriminated switch**

Extend the current context reducer and component switch only; add no routing dependency or navigation store.

- [ ] **Step 4 (GREEN): Re-run the focused tests**

Run: `rtk pnpm exec vitest run test/webview/app.test.tsx`

Expected: PASS; one host context maps deterministically to one page component.

---

### Task 4.2: Build the Changes Explorer with project-bound active and archived filtering, sorting, and pagination

**Spec coverage:** `project-first-explorers` / `Changes Explorer for the Current Project` / both scenarios; `dashboard` / `Change List Display` / `Changes grouped by status`, `Search changes by loaded metadata`, `Search empty result`, all retained Change-card metadata scenarios; `dashboard` / `Change Navigation` / `Click to open change`, `Quick actions do not steal card navigation`, `Hover and focus reveal workflow actions`; removed `Archive Overview`, `Root-scoped empty states`, and `Scoped archive overview` migrations.

**Dependencies / order:** Depends on Tasks 1.2, 2.2-2.3, and 4.1. Can proceed independently of Task 4.3 after those dependencies.

**Files:**
- Create: `src/webview/components/ChangesExplorer.tsx`, `test/webview/components/changesExplorer.test.tsx`
- Modify: `src/webview/App.tsx`, `src/webview/components/ChangesSection.tsx`, `src/webview/utils/changeListPipeline.ts`
- Test: `test/webview/components/changesExplorer.test.tsx`, `test/webview/utils/changeListPipeline.test.ts`, `test/webview/state/changesViewState.test.ts`

**Implementation notes:**
- Compose the Explorer from existing `ChangesSection`, `ArchivedChangeCard`, lifecycle filter, advanced filter, sort, pagination, and `changeListPipeline`; add a mode/normalized item adapter instead of duplicating these components.
- Combine active and archived entries only for list processing/display while retaining a source discriminator and archive directory id. Search/filter/sort/pagination run entirely on the loaded Project-bound payload and never trigger CLI per keystroke.
- Show Project identity and a project-bound empty/search-empty state. Do not include Changes from any other payload or selected legacy scope.
- Open active and archived details through Task 2.3 binding-carrying messages. Returning/revealing the Explorer must keep local query, filter, sort, and page state.
- Reuse the current page size and list-state helpers. Add no server-side pagination or new state library.

**Verification:** Active and archived items share one Project-bound Explorer, all existing list controls work locally, search-empty is distinct from data-empty, archive opens use `archive:<directoryName>`, and state survives detail navigation.

**Risks / edge cases:** Archived entries have less metadata than active Changes; sorting/filtering must use deterministic fallbacks and not fabricate task/artifact status. Changing filters may reduce page count, so reuse the existing page clamp behavior.

- [ ] **Step 1 (RED): Write failing Explorer behavior tests**

Cover mixed active/archive data, same display names, lifecycle filter, metadata search, sort, pagination clamp, empty/search-empty, no CLI-on-type, detail navigation, and state after reveal.

- [ ] **Step 2 (RED): Run the focused tests**

Run: `rtk pnpm exec vitest run test/webview/components/changesExplorer.test.tsx test/webview/utils/changeListPipeline.test.ts test/webview/state/changesViewState.test.ts`

Expected: FAIL because `ChangesExplorer` and its archive-aware adapter do not exist.

- [ ] **Step 3 (GREEN): Compose the Explorer from existing list pieces**

Add one page component and the smallest pipeline adjustment needed for archive-discriminated items; preserve current helpers and UI controls.

- [ ] **Step 4 (GREEN): Re-run the focused tests**

Run: `rtk pnpm exec vitest run test/webview/components/changesExplorer.test.tsx test/webview/utils/changeListPipeline.test.ts test/webview/state/changesViewState.test.ts`

Expected: PASS; list behavior remains local, deterministic, and bound to one Project/root.

---

### Task 4.3: Build the Specs Explorer with separate Project and referenced Store groups

**Spec coverage:** `project-first-explorers` / `Specs Explorer Separates Project and Referenced Store Specs` / both scenarios; `project-first-explorers` / `Explicit Project Binding and Isolation` / `Switching projects does not leak stale data`; removed `Specs Overview`, `Read-only references panel`, and `Store selection` migrations.

**Dependencies / order:** Depends on Tasks 1.3, 2.2-2.3, and 4.1. Can proceed independently of Task 4.2 after those dependencies.

**Files:**
- Create: `src/webview/components/SpecsExplorer.tsx`, `test/webview/components/specsExplorer.test.tsx`
- Modify: `src/webview/App.tsx`, `src/webview/components/SpecsSection.tsx`, `src/webview/components/SpecCard.tsx`
- Test: `test/webview/components/specsExplorer.test.tsx`, `test/webview/components/specsSection.test.tsx`

**Implementation notes:**
- Render one canonical Project Specs group and one clearly labeled read-only group per CLI-confirmed referenced Store. Reuse `SpecsSection`/`SpecCard` through small props for heading, source identity, empty state, and open callback.
- Do not flatten Project and Store Specs. A duplicate Spec id remains distinct because its open message includes the current Project binding and, for a reference, the Store id.
- Do not render registered-only Stores, Worksets, Store Changes, or write/workflow actions for referenced Store Specs.
- Show a valid empty Project group and explicit referenced-load error without substituting data from another binding. Ignore/reject late payloads for a previous Project binding.
- Use existing theme/i18n/accessibility patterns; no tree widget or data-fetching library.

**Verification:** Project and referenced groups are visually/semantically separate; installed-unreferenced fixtures never appear; duplicate ids open correct bound content; empty/error states do not leak another Project's Specs.

**Risks / edge cases:** A referenced Store can have zero Specs or fail resolution; these are different states. Long Store ids need controlled wrapping/truncation while remaining available to assistive text.

- [ ] **Step 1 (RED): Write failing Specs Explorer tests**

Cover Project plus referenced groups, installed-only exclusion, duplicate ids, empty Project, empty Store, Store failure, read-only actions, binding transition, and accessible headings.

- [ ] **Step 2 (RED): Run the focused tests**

Run: `rtk pnpm exec vitest run test/webview/components/specsExplorer.test.tsx test/webview/components/specsSection.test.tsx`

Expected: FAIL because the grouped project-bound Specs Explorer is not implemented.

- [ ] **Step 3 (GREEN): Compose grouped Specs from existing cards**

Add one page component and minimal group/source props to reused Spec components; send binding-aware open messages.

- [ ] **Step 4 (GREEN): Re-run the focused tests**

Run: `rtk pnpm exec vitest run test/webview/components/specsExplorer.test.tsx test/webview/components/specsSection.test.tsx`

Expected: PASS; only canonical Project and CLI-confirmed referenced Store Specs render.
