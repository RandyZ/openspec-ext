# Task 2. Project action launcher and local views

<!-- covers: Task 2.1, Task 2.2, Task 2.3 -->

### Task 2.1: Add RED Webview tests for the four-action grid, dynamic Worksets, and accessible narrow layout.

**Spec coverage:** `project-sidebar-tabs` / Project action launcher and local browsing / all scenarios. `workset-cli-open` / Dynamic Worksets launcher / both scenarios. `referenced-store-specs` / Project and Store contain Specs with the same id.

**Dependencies / order:** Task 1 data shape is available. Reuse current `Dashboard`, `Header`, `ChangesSection`, `SpecsSection`, and `WorksetProjectPicker` tests. Must be RED before Task 2.2.

**Implementation notes:** The grid mixes local views with an Editor-opening Dashboard action. Test semantic buttons and `aria-pressed` for local selection; do not require one ARIA tablist. Prefer existing test files over a new launcher test abstraction.

**Files:**
- Modify: `test/webview/components/dashboard.test.tsx`
- Modify: `test/webview/components/header.test.tsx`
- Modify: `test/webview/components/specsSection.test.tsx`
- Modify: `test/webview/components/worksetProjectPicker.test.tsx`
- Modify: `test/webview/app.test.tsx`

- [ ] **Step 1: Write the failing grid contract test**
  - Render Project-first data and assert Changes, Specs, Worksets, Dashboard appear in stable 2×2 order.
  - Assert Changes is the default local view and local selection does not emit Explorer-open messages.
- [ ] **Step 2: Write dynamic Worksets tests**
  - Assert a trusted membership enables Worksets and exposes its count.
  - Assert no membership, unsupported capability, or unavailable trusted navigation keeps the grid cell visible but non-operable with an explanation.
  - Assert Worksets activation shows the local picker and never emits `openWorkset`.
- [ ] **Step 3: Write accessibility and routing tests**
  - Assert keyboard focus, accessible names, visible selection semantics, and bounded long labels.
  - Assert Dashboard emits the dedicated Host request without changing the active local view.
  - Assert Project and same-id Store Spec rows retain separate detail bindings.
- [ ] **Step 4: Run the focused RED command**
  - Run: `pnpm test -- test/webview/components/dashboard.test.tsx test/webview/components/header.test.tsx test/webview/components/specsSection.test.tsx test/webview/components/worksetProjectPicker.test.tsx test/webview/app.test.tsx`
  - Expected: FAIL because the current Header is not the approved launcher and Dashboard has no distinct request/route.

**Verification:** RED failures are limited to launcher order/state, dynamic Worksets, local view behavior, and accessibility.

**Risks / edge cases:** An empty Specs view or failed Store group must not disable unrelated launcher actions. Dashboard action must remain available even when Worksets is unavailable.

---

### Task 2.2: Implement native title actions and local Changes, Specs, and Worksets views.

**Spec coverage:** `project-sidebar-tabs` / Render the four actions in a stable grid; Browse Changes locally; Browse Specs locally; Open Workset mode locally; Worksets action is unavailable; Narrow Sidebar remains operable. `dashboard` / Dashboard Actions / Create new change; Refresh data.

**Dependencies / order:** Task 2.1 RED tests and Task 1.2 payload are complete.

**Implementation notes:** Reuse existing New Change/Refresh commands and current section components. Keep one local `changes | specs | worksets` state in Project-first Dashboard; reset only when accepted Project/root binding changes.

**Files:**
- Modify: `package.json`
- Modify: `src/webview/components/Dashboard.tsx`
- Modify: `src/webview/components/Header.tsx`
- Modify: `src/webview/components/ChangesSection.tsx` only if the existing props cannot render active/archived groups
- Modify: `src/webview/components/SpecsSection.tsx` only if the existing props cannot render Project/Store groups
- Modify: `src/i18n/locales/en.json`
- Modify: `src/i18n/locales/zh-cn.json`

- [ ] **Step 1: Expose existing commands in the native view title**
  - Add `view/title` menu entries and icons for existing Refresh and New Change commands scoped to `openspec.dashboard`.
  - Do not add a duplicate command or use a grid slot for either operation.
- [ ] **Step 2: Replace stacked Project-first actions with the 2×2 launcher**
  - Render the fixed order and local selection state.
  - Keep Dashboard as an external action and preserve the selected local view.
- [ ] **Step 3: Render local content from the shared snapshot**
  - Changes view renders active and archived Changes.
  - Specs view renders Project Specs plus independently labeled Store groups and safe group errors.
  - Worksets view renders the existing picker only when trusted navigation is available; otherwise its action is disabled.
- [ ] **Step 4: Run the focused GREEN command**
  - Run: `pnpm test -- test/webview/components/dashboard.test.tsx test/webview/components/header.test.tsx test/webview/components/specsSection.test.tsx test/webview/components/worksetProjectPicker.test.tsx`
  - Expected: PASS without any Project-first list Explorer message.

**Verification:** All local view changes are Webview state transitions, native title commands remain callable, and narrow keyboard operation passes.

**Risks / edge cases:** Guard the launcher behind Project-first data so legacy scope Dashboard controls and state remain unchanged. Do not remove remaining legacy Explorer components.

---

### Task 2.3: Preserve binding-aware detail routing and connect the Dashboard action without list Explorers.

**Spec coverage:** `project-sidebar-tabs` / Open Project Dashboard; Open a Change or Spec detail. `referenced-store-specs` / Project and Store contain Specs with the same id. `dashboard` / Dashboard Actions / Open Project Dashboard.

**Dependencies / order:** Task 2.2 renders the launcher. Task 1.3 supplies surface-aware messages; Task 4 will implement the distinct Dashboard view.

**Implementation notes:** Add one explicit `openProjectDashboard` Webview request and route it to existing `DashboardViewProvider.openInEditor()`. Remove only Project-first list Explorer entry points; keep detail and legacy callers.

**Files:**
- Modify: `src/webview/types/messages.ts`
- Modify: `src/webview/components/Dashboard.tsx`
- Modify: `src/extension/providers/dashboardViewProvider.ts`
- Modify: `src/extension/providers/webviewMessageHandler.ts`
- Modify: `src/webview/components/SpecsSection.tsx` or the shared Spec row only if binding props are missing
- Modify: `test/extension/providers/dashboardViewProvider.test.ts`
- Modify: `test/extension/providers/webviewMessageHandler.test.ts`
- Modify: `test/webview/components/specsExplorer.messages.test.tsx`

- [ ] **Step 1: Write failing message-routing assertions**
  - Assert Dashboard action emits `openProjectDashboard`.
  - Assert Changes/Specs local actions emit neither `openChangesExplorer` nor `openSpecsExplorer`.
  - Assert the Host request calls the existing Dashboard Editor entry point.
- [ ] **Step 2: Implement the explicit Dashboard request**
  - Add the smallest message type, builder, and Host handler.
  - Keep local view state unchanged when the request is sent.
- [ ] **Step 3: Preserve detail binding isolation**
  - Project rows send current Project binding.
  - Store Spec rows send the verified Store group binding and Store id.
  - Missing Store binding follows the existing safe error path.
- [ ] **Step 4: Run the focused GREEN command**
  - Run: `pnpm test -- test/extension/providers/dashboardViewProvider.test.ts test/extension/providers/webviewMessageHandler.test.ts test/webview/components/specsExplorer.messages.test.tsx test/webview/components/dashboard.test.tsx`
  - Expected: PASS with distinct Dashboard routing and no Project-first list Panel creation.

**Verification:** Dashboard request reaches one Editor entry point; Change/Spec detail messages remain root-isolated; local lists stay in Sidebar.

**Risks / edge cases:** Do not alter the command-palette `openspec.openDashboard` path or legacy Explorer callers. Same-name Specs must never fall back to the current Project root when a Store binding is missing.
