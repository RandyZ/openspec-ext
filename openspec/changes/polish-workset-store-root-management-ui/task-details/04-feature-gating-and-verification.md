<!-- Copy one file per ## Task N group to: openspec/changes/<change>/task-details/NN-<slug>.md -->
<!-- Do NOT duplicate Goal/Architecture from design.md — see openspec-writing-task SKILL -->

# Task 4. Feature Gating And Verification

<!-- covers: Task 4.1, Task 4.2, Task 4.3 -->

### Task 4.1: Add OpenSpec 1.5 upgrade messaging for unavailable store/workset features

**Spec coverage:** `dashboard` / `Requirement: Multi-Project Controls Are Feature-Gated` / `Scenario: OpenSpec 1.5 features are unavailable`

**Files:**
- Modify: `src/webview/components/Dashboard.tsx`
- Modify: `src/webview/components/StoresAndWorksetsPanel.tsx`
- Modify: `src/i18n/locales/en.json`
- Modify: `src/i18n/locales/zh-cn.json`
- Test: `test/webview/components/dashboard.test.tsx`
- Test: `test/webview/components/storesAndWorksetsPanel.test.tsx`

- [ ] **Step 1: Write the failing test**
  Render dashboard data with `capabilities.stores=false` or `capabilities.worksets=false` and assert an OpenSpec 1.5.0 upgrade message appears.

- [ ] **Step 2: Run test — expect FAIL**
  Run: `pnpm test -- --run test/webview/components/dashboard.test.tsx test/webview/components/storesAndWorksetsPanel.test.tsx`
  Expected: FAIL because upgrade messaging is missing or incomplete.

- [ ] **Step 3: Write minimal implementation**
  Add concise upgrade notices driven by `data.scope.capabilities` or root-level feature diagnostics without blocking Local Root content.

- [ ] **Step 4: Run test — expect PASS**
  Run: `pnpm test -- --run test/webview/components/dashboard.test.tsx test/webview/components/storesAndWorksetsPanel.test.tsx`
  Expected: PASS.

---

### Task 4.2: Hide or disable unsupported store/workset controls without breaking Local Root

**Spec coverage:** `dashboard` / `Requirement: Multi-Project Controls Are Feature-Gated`

**Files:**
- Modify: `src/webview/components/Dashboard.tsx`
- Modify: `src/webview/components/ScopeBar.tsx`
- Modify: `src/webview/components/StoresAndWorksetsPanel.tsx`
- Modify: `src/webview/components/WorksetsPage.tsx`
- Test: `test/webview/components/dashboard.test.tsx`
- Test: `test/webview/components/scopeBar.test.tsx`
- Test: `test/webview/components/storesAndWorksetsPanel.test.tsx`
- Test: `test/webview/components/worksetsPage.test.tsx`

- [ ] **Step 1: Write the failing test**
  Assert store controls are hidden/disabled when stores are unsupported, Worksets page entry/actions are hidden/disabled when worksets are unsupported, and Local Root changes/specs still render.

- [ ] **Step 2: Run test — expect FAIL**
  Run: `pnpm test -- --run test/webview/components/dashboard.test.tsx test/webview/components/scopeBar.test.tsx test/webview/components/storesAndWorksetsPanel.test.tsx test/webview/components/worksetsPage.test.tsx`
  Expected: FAIL before gating is applied.

- [ ] **Step 3: Write minimal implementation**
  Apply independent capability checks for stores and worksets throughout root/action rail and maintenance components.

- [ ] **Step 4: Run test — expect PASS**
  Run: `pnpm test -- --run test/webview/components/dashboard.test.tsx test/webview/components/scopeBar.test.tsx test/webview/components/storesAndWorksetsPanel.test.tsx test/webview/components/worksetsPage.test.tsx`
  Expected: PASS.

---

### Task 4.3: Run focused tests, full test suite, build, and OpenSpec validation

**Spec coverage:** all requirements in `specs/dashboard/spec.md`

**Files:**
- Validate: `openspec/changes/polish-workset-store-root-management-ui`
- Test: all touched extension/webview tests

- [ ] **Step 1: Run focused tests**
  Run focused tests for DataManager, webview message handler, Dashboard, ScopeBar, StoresAndWorksetsPanel, WorksetsPage, and i18n.

- [ ] **Step 2: Run full test suite**
  Run: `pnpm test`
  Expected: PASS.

- [ ] **Step 3: Run build**
  Run: `pnpm run build`
  Expected: PASS.

- [ ] **Step 4: Validate OpenSpec change**
  Run: `openspec validate polish-workset-store-root-management-ui --json`
  Expected: valid.
