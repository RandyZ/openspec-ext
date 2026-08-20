# Task 2. Sidebar Changes / Specs tabs

<!-- covers: Task 2.1, Task 2.2, Task 2.3 -->

### Task 2.1: Add RED Webview tests for local tabs, Project/Store Specs grouping, and narrow keyboard operation.

**Spec coverage:** `project-sidebar-tabs` / Project-first Sidebar tab browsing / Switch between Changes and Specs tabs; Open a Change or Spec detail; Narrow Sidebar remains operable. `referenced-store-specs` / Project and Store contain Specs with the same id.

**Dependencies / order:** Requires the Task 1 data shape and existing `Dashboard`, `Header`, `ChangesSection`, `SpecsSection`, and Specs Explorer tests.

**Implementation notes:** Keep tabs local to the Project-first Sidebar and preserve existing detail message contracts.

**Files:**
- Modify: `test/webview/components/dashboard.test.tsx`
- Modify: `test/webview/components/header.test.tsx`
- Modify: `test/webview/components/specsSection.test.tsx`
- Create or modify: `test/webview/components/projectSidebarTabs.test.tsx`

- [ ] **Step 1: Write failing tab tests**
  - Render Project-first data with active Changes, Project Specs, and a duplicate-id Store Spec group.
  - Assert tab activation changes local content and does not emit an Explorer-open message.
- [ ] **Step 2: Write failing accessibility tests**
  - Assert both tabs have keyboard-focusable controls, labels, and bounded long paths/names in narrow layout.
  - Assert Store groups are labeled and their entries remain distinct from Project entries.
- [ ] **Step 3: Write failing detail routing tests**
  - Select a Change/Spec row and assert the existing detail message includes the current Project/Store binding.
- [ ] **Step 4: Run test — expect FAIL**
  - Run: `pnpm test -- test/webview/components/dashboard.test.tsx test/webview/components/header.test.tsx test/webview/components/specsSection.test.tsx test/webview/components/projectSidebarTabs.test.tsx`
  - Expected: FAIL because Project-first actions still open list Explorers.

**Verification:** RED failures are limited to tab state, grouping, accessibility, and message routing.

**Risks / edge cases:** Empty Project Specs, Store error groups, duplicate ids, and no referenced Stores must all render without collapsing the tab.

---

### Task 2.2: Implement Sidebar tab state and render Changes, archived Changes, Project Specs, and Store Specs in place.

**Spec coverage:** `project-sidebar-tabs` / all requirements. `dashboard` / Existing cache avoids click-time reload.

**Dependencies / order:** Task 2.1 RED tests and Task 1.2 payload implementation.

**Implementation notes:** Reuse existing section components where possible; add only the smallest tab state and grouped Store rendering.

**Files:**
- Modify: `src/webview/components/Dashboard.tsx`
- Modify: `src/webview/components/Header.tsx`
- Modify: `src/webview/components/ChangesSection.tsx` or `src/webview/components/SpecsSection.tsx` only when existing props cannot represent the unified payload
- Modify: `src/i18n/locales/en.json`
- Modify: `src/i18n/locales/zh-cn.json`

- [ ] **Step 1: Add local tab state**
  - Add a Project-first tab state with Changes as the default and reset it only when the Project binding changes.
  - Make Header All Changes/Specs actions call local tab setters rather than post list Explorer messages.
- [ ] **Step 2: Render grouped content**
  - Render active/archived Changes in the Changes tab and Project/Referenced Store Specs in the Specs tab.
  - Show safe loading, empty, and Store-error states without hiding Project Specs.
- [ ] **Step 3: Preserve narrow keyboard behavior**
  - Use semantic buttons/tabs, visible focus styles, truncation, titles, and stable tab order.
- [ ] **Step 4: Run focused tests — expect PASS**
  - Run: `pnpm test -- test/webview/components/dashboard.test.tsx test/webview/components/header.test.tsx test/webview/components/specsSection.test.tsx test/webview/components/projectSidebarTabs.test.tsx`
  - Expected: PASS.

**Verification:** No tab click creates a WebviewPanel or posts an Explorer list request.

**Risks / edge cases:** Do not accidentally alter legacy Dashboard tab/scope state; guard the new state behind Project-first data.

---

### Task 2.3: Preserve binding-aware Change/Spec detail actions while removing list Explorer creation from tab navigation.

**Spec coverage:** `project-sidebar-tabs` / Open a Change or Spec detail. `referenced-store-specs` / Store binding selection.

**Dependencies / order:** Task 2.2.

**Implementation notes:** Remove list-panel navigation only from Project-first tab actions; leave detail and legacy Explorer callers intact.

**Files:**
- Modify: `src/webview/components/SpecsExplorer.tsx` or shared Specs row component
- Modify: `src/extension/providers/dashboardViewProvider.ts`
- Modify: `test/extension/providers/dashboardViewProvider.test.ts`
- Modify: `test/webview/components/specsExplorer.messages.test.tsx`

- [ ] **Step 1: Keep detail messages explicit**
  - Project Specs use the current Project binding; Store Specs use the group binding and store id.
  - Reject a missing Store binding with the existing safe error path.
- [ ] **Step 2: Remove only list-panel entry points**
  - Stop Project-first Header tab actions from invoking `openExplorerPanel` while retaining direct detail handlers and legacy callers.
- [ ] **Step 3: Run focused tests**
  - Run: `pnpm test -- test/extension/providers/dashboardViewProvider.test.ts test/webview/components/specsExplorer.messages.test.tsx`
  - Expected: PASS with detail isolation preserved.

**Verification:** Detail messages remain binding-scoped; no list Explorer is created by tab navigation.

**Risks / edge cases:** Same-named Specs in Project and Store must open different roots; verify both bindings in assertions.
