<!-- Copy one file per ## Task N group to: openspec/changes/<change>/task-details/NN-<slug>.md -->
<!-- Do NOT duplicate Goal/Architecture from design.md — see openspec-writing-task SKILL -->

# Task 3. Worksets Page Redesign

<!-- covers: Task 3.1, Task 3.2, Task 3.3, Task 3.4 -->

### Task 3.1: Derive readable workset member display metadata

**Spec coverage:** `dashboard` / `Requirement: Workset Cards Are Readable And Actionable` / `Scenario: Primary and member type are identified`

**Files:**
- Modify: `src/webview/components/WorksetsPage.tsx`
- Test: `test/webview/components/worksetsPage.test.tsx`

- [ ] **Step 1: Write the failing test**
  Assert primary member detection, store-root member detection from registered store roots, and project fallback member labels.

- [ ] **Step 2: Run test — expect FAIL**
  Run: `pnpm test -- --run test/webview/components/worksetsPage.test.tsx`
  Expected: FAIL because WorksetsPage does not derive member type metadata yet.

- [ ] **Step 3: Write minimal implementation**
  Pass store scopes or store root paths into WorksetsPage and derive `Primary`, `Store root`, and `Project` labels using normalized paths.

- [ ] **Step 4: Run test — expect PASS**
  Run: `pnpm test -- --run test/webview/components/worksetsPage.test.tsx`
  Expected: PASS.

---

### Task 3.2: Redesign workset cards with Open and Remove actions

**Spec coverage:** `dashboard` / `Requirement: Workset Cards Are Readable And Actionable`

**Files:**
- Modify: `src/webview/components/WorksetsPage.tsx`
- Modify: `src/webview/components/Dashboard.tsx`
- Test: `test/webview/components/worksetsPage.test.tsx`

- [ ] **Step 1: Write the failing test**
  Assert workset name is the primary title, tool/member count are secondary metadata, paths remain inspectable, and both `Open` and `Remove` actions render in the card action area.

- [ ] **Step 2: Run test — expect FAIL**
  Run: `pnpm test -- --run test/webview/components/worksetsPage.test.tsx`
  Expected: FAIL with current compact layout and no Remove button.

- [ ] **Step 3: Write minimal implementation**
  Rework the card layout using existing VS Code theme colors, stable spacing, action grouping, and narrow-sidebar wrapping.

- [ ] **Step 4: Run test — expect PASS**
  Run: `pnpm test -- --run test/webview/components/worksetsPage.test.tsx`
  Expected: PASS.

---

### Task 3.3: Update workset and store i18n strings

**Spec coverage:** `dashboard` / `Requirement: Workset Cards Are Readable And Actionable`, `Requirement: Workset Remove Flow Is Confirmed And Non-Destructive`, `Requirement: Store Cards Distinguish Current State From Switching`

**Files:**
- Modify: `src/i18n/locales/en.json`
- Modify: `src/i18n/locales/zh-cn.json`
- Test: `test/i18n/i18n.test.ts` if present

- [ ] **Step 1: Write the failing test**
  Add or update i18n coverage for `Current`, `Switch`, `Remove`, confirmation copy, upgrade notice, and member labels.

- [ ] **Step 2: Run test — expect FAIL**
  Run: `pnpm test -- --run test/i18n/i18n.test.ts`
  Expected: FAIL if required keys are missing.

- [ ] **Step 3: Write minimal implementation**
  Add matching English and Simplified Chinese strings.

- [ ] **Step 4: Run test — expect PASS**
  Run: `pnpm test -- --run test/i18n/i18n.test.ts`
  Expected: PASS.

---

### Task 3.4: Cover redesigned workset cards with webview tests

**Spec coverage:** `dashboard` / `Requirement: Workset Cards Are Readable And Actionable`

**Files:**
- Test: `test/webview/components/worksetsPage.test.tsx`

- [ ] **Step 1: Write the failing test**
  Cover title hierarchy, member order, path title attributes, primary/store/project labels, Open action, and Remove action callback.

- [ ] **Step 2: Run test — expect FAIL**
  Run: `pnpm test -- --run test/webview/components/worksetsPage.test.tsx`
  Expected: FAIL until Tasks 3.1-3.3 are complete.

- [ ] **Step 3: Write minimal implementation**
  Complete WorksetsPage rendering and Dashboard callback wiring.

- [ ] **Step 4: Run test — expect PASS**
  Run: `pnpm test -- --run test/webview/components/worksetsPage.test.tsx`
  Expected: PASS.
