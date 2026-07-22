<!-- Copy one file per ## Task N group to: openspec/changes/<change>/task-details/NN-<slug>.md -->
<!-- Do NOT duplicate Goal/Architecture from design.md — see openspec-writing-task SKILL -->

# Task 2. Root Action Rail And Store States

<!-- covers: Task 2.1, Task 2.2, Task 2.3, Task 2.4 -->

### Task 2.1: Move root selection into the primary dashboard action rail

**Spec coverage:** `dashboard` / `Requirement: Primary Action Rail Owns Root Context` / `Scenario: Root selector appears with primary actions`

**Files:**
- Modify: `src/webview/components/Dashboard.tsx`
- Modify: `src/webview/components/Header.tsx` or introduce a small action rail component if the current Header owns primary actions
- Modify: `src/webview/components/ScopeBar.tsx`
- Test: `test/webview/components/dashboard.test.tsx`
- Test: `test/webview/components/scopeBar.test.tsx`

- [ ] **Step 1: Write the failing test**
  Assert that root selection renders with the primary action area and that the CLI/cache status no longer owns the selector.

- [ ] **Step 2: Run test — expect FAIL**
  Run: `pnpm test -- --run test/webview/components/dashboard.test.tsx test/webview/components/scopeBar.test.tsx`
  Expected: FAIL until root controls move.

- [ ] **Step 3: Write minimal implementation**
  Move selector props/actions from the status-oriented area into the primary action rail while preserving `handleSelectScope`, pending state, and grouped project/store options.

- [ ] **Step 4: Run test — expect PASS**
  Run: `pnpm test -- --run test/webview/components/dashboard.test.tsx test/webview/components/scopeBar.test.tsx`
  Expected: PASS.

---

### Task 2.2: Keep Local Root single-project mode lightweight while exposing Register Store

**Spec coverage:** `dashboard` / `Requirement: Primary Action Rail Owns Root Context` / `Scenario: Register store is available from Local Root`, `Scenario: Local Root without store context remains lightweight`

**Files:**
- Modify: `src/webview/components/Dashboard.tsx`
- Modify: `src/webview/components/StoresAndWorksetsPanel.tsx`
- Test: `test/webview/components/dashboard.test.tsx`
- Test: `test/webview/components/storesAndWorksetsPanel.test.tsx`

- [ ] **Step 1: Write the failing test**
  Add Local Root cases with no references/stores where the dashboard exposes Register Store without rendering a dominant management panel.

- [ ] **Step 2: Run test — expect FAIL**
  Run: `pnpm test -- --run test/webview/components/dashboard.test.tsx test/webview/components/storesAndWorksetsPanel.test.tsx`
  Expected: FAIL before layout is updated.

- [ ] **Step 3: Write minimal implementation**
  Render a lightweight `Register Store`/`Connect Store` action in the action rail and conditionally reduce or hide the lower maintenance panel for plain Local Root usage.

- [ ] **Step 4: Run test — expect PASS**
  Run: `pnpm test -- --run test/webview/components/dashboard.test.tsx test/webview/components/storesAndWorksetsPanel.test.tsx`
  Expected: PASS.

---

### Task 2.3: Render registered stores with Current and Switch states

**Spec coverage:** `dashboard` / `Requirement: Store Cards Distinguish Current State From Switching`

**Files:**
- Modify: `src/webview/components/StoresAndWorksetsPanel.tsx`
- Modify: `src/i18n/locales/en.json`
- Modify: `src/i18n/locales/zh-cn.json`
- Test: `test/webview/components/storesAndWorksetsPanel.test.tsx`

- [ ] **Step 1: Write the failing test**
  Assert current store cards show `Current`, inactive store cards show enabled `Switch`, and store paths remain inspectable.

- [ ] **Step 2: Run test — expect FAIL**
  Run: `pnpm test -- --run test/webview/components/storesAndWorksetsPanel.test.tsx`
  Expected: FAIL with current `Open`/disabled behavior.

- [ ] **Step 3: Write minimal implementation**
  Replace disabled current-store `Open` with selected-state display and inactive-store `Switch` action.

- [ ] **Step 4: Run test — expect PASS**
  Run: `pnpm test -- --run test/webview/components/storesAndWorksetsPanel.test.tsx`
  Expected: PASS.

---

### Task 2.4: Cover root action rail and store state rendering with webview tests

**Spec coverage:** `dashboard` / `Requirement: Primary Action Rail Owns Root Context`, `Requirement: Store Cards Distinguish Current State From Switching`

**Files:**
- Test: `test/webview/components/dashboard.test.tsx`
- Test: `test/webview/components/scopeBar.test.tsx`
- Test: `test/webview/components/storesAndWorksetsPanel.test.tsx`

- [ ] **Step 1: Write the failing test**
  Add regression tests for action placement, current root visibility, pending state, and store switch actions.

- [ ] **Step 2: Run test — expect FAIL**
  Run: `pnpm test -- --run test/webview/components/dashboard.test.tsx test/webview/components/scopeBar.test.tsx test/webview/components/storesAndWorksetsPanel.test.tsx`
  Expected: FAIL until Tasks 2.1-2.3 are complete.

- [ ] **Step 3: Write minimal implementation**
  Complete component updates and i18n support.

- [ ] **Step 4: Run test — expect PASS**
  Run: `pnpm test -- --run test/webview/components/dashboard.test.tsx test/webview/components/scopeBar.test.tsx test/webview/components/storesAndWorksetsPanel.test.tsx`
  Expected: PASS.
