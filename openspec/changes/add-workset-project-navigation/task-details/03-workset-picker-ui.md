# Task 3. Project-first Workset picker UI

<!-- covers: Task 3.1, Task 3.2, Task 3.3 -->

### Task 3.1: Add RED Webview tests for separate Project/picker scenes, Project-only selection, Planning Store rows, empty state, and keyboard-safe narrow layout.

**Spec coverage:** `dashboard` / Project-first Workset navigation scene / eligibility and scene separation; `workset-project-navigation` / Project-only Workset selection / Store, empty, Git, and keyboard scenarios.

**Dependencies / order:** Task 1.2 for the navigation payload shape; Task 2.1 for message names.

**Files:**
- Create: `test/webview/components/worksetProjectPicker.test.tsx`
- Modify: `test/webview/components/dashboard.test.tsx`, `test/webview/components/header.test.tsx`
- Test: the files above

**Implementation notes:**
- Render static markup with a ProjectSidebar payload containing two Worksets, one selectable Project, one current Project, one Planning Store, and Git metadata.
- Assert the Project scene does not render picker rows, picker scene does not render Changes cards as a second dashboard, Store rows are not buttons, and empty/unsupported payloads hide the Workset entry.
- Assert buttons have native focusable semantics, `aria-label`/`title`, visible bounded text classes, and the exact selection/return message shape.

**Verification:**
- Primary command: `pnpm exec vitest run test/webview/components/worksetProjectPicker.test.tsx test/webview/components/dashboard.test.tsx test/webview/components/header.test.tsx -t "Workset|Project navigation|narrow"`
- Expected result: FAIL before the picker component, payload field, and scene controls exist.

**Risks / edge cases:**
- Do not make the test depend on browser layout measurement; assert stable DOM semantics and classes that support the real narrow-sidebar smoke.

- [ ] **Step 1: Write the failing static-render tests**

- [ ] **Step 2: Run focused verification — expect FAIL**

Run the command above and record the missing picker/control assertion.

- [ ] **Step 3: Confirm the RED test uses only host-supplied data**

No test may construct a root binding from a member path in the Webview.

- [ ] **Step 4: Keep the RED checkpoint before Task 3.2**

Do not add production UI in this task.

---

### Task 3.2: Implement Workset picker payload types, scene state, Header navigation actions, and accessible Project selection messages.

**Spec coverage:** `dashboard` / Project-first Workset navigation scene / scene separation and navigation; `workset-project-navigation` / Project-only Workset selection and Project view reuse.

**Dependencies / order:** Task 3.1 RED evidence; Task 2.2 message contracts.

**Files:**
- Create: `src/webview/components/WorksetProjectPicker.tsx`
- Modify: `src/webview/types/messages.ts`, `src/webview/components/Dashboard.tsx`, `src/webview/components/Header.tsx`, `src/i18n/locales/en.json`, `src/i18n/locales/zh-cn.json`
- Test: `test/webview/components/worksetProjectPicker.test.tsx`, `test/webview/components/dashboard.test.tsx`, `test/webview/components/header.test.tsx`

**Implementation notes:**
- Add readonly navigation types carrying Workset name/tool, member role/selectable flag, canonical display path, Project identity, and optional Git metadata. Keep binding host-created and do not add a webview root field to selection messages.
- Add a small picker scene in the existing Dashboard, with Current Project marker, Workset/Project hierarchy, selectable Project buttons, non-action Planning Store rows, and a return button.
- Keep Header's existing vertical Project identity and All Changes/Specs navigation. Add optional Workset/return actions without moving workflow controls into a new rail.
- Use existing `useVscode` and `sendMessage`; do not add React Router, a global state store, or a duplicate Changes/Specs component.

**Verification:**
- Primary command: `pnpm exec vitest run test/webview/components/worksetProjectPicker.test.tsx test/webview/components/dashboard.test.tsx test/webview/components/header.test.tsx -t "Workset|Project navigation|narrow"`
- Expected result: PASS.

**Risks / edge cases:**
- Store member rows must not have `onClick`; malformed/empty navigation must render a concise no-selectable-project state.
- Keep translations in both existing locale files; no user-facing hardcoded copy.

- [ ] **Step 1: Implement the types, sender helpers, and picker component**

- [ ] **Step 2: Wire scene transitions and Header actions in Dashboard**

- [ ] **Step 3: Run focused verification — expect PASS**

Run the command above. Expected: PASS.

- [ ] **Step 4: Verify no legacy dashboard path changed**

Run: `pnpm exec vitest run test/webview/components/storesAndWorksetsPanel.test.tsx test/webview/components/worksetsPage.test.tsx test/webview/components/worksetsPanel.test.tsx`

Expected: PASS with legacy management UI behavior intact.

---

### Task 3.3: Add GREEN Webview coverage proving selected Project content reuses existing Sidebar, All Changes, Specs, and detail entry points.

**Spec coverage:** `dashboard` / Project-first Workset navigation scene / switching Project; `workset-project-navigation` / Project view reuse and return navigation / selected Project content.

**Dependencies / order:** Task 3.2.

**Files:**
- Create: none
- Modify: `test/webview/components/dashboard.test.tsx`, `test/webview/app.test.tsx`
- Test: the files above

**Implementation notes:**
- Add assertions for active Changes, All Changes, Specs, and existing `openChangeDetailInEditor`/Explorer message helpers when the selected Project Sidebar payload is rendered.
- Verify a new Sidebar payload resets picker scene state to Project scene and clears previous Project content through the existing reducer path.

**Verification:**
- Primary command: `pnpm exec vitest run test/webview/components/dashboard.test.tsx test/webview/app.test.tsx -t "Project|Workset|Explorer|detail"`
- Expected result: PASS.

**Risks / edge cases:**
- Do not introduce a second route registry; `AppPage` remains the existing sidebar/explorer/detail model.

- [ ] **Step 1: Add assertions for current/selected Project content and entry points**

- [ ] **Step 2: Run focused verification — expect PASS**

- [ ] **Step 3: Run all Webview component tests**

Run: `pnpm exec vitest run test/webview/components test/webview/app.test.tsx`

Expected: PASS.

- [ ] **Step 4: Review narrow static output for overflow-prone controls**

Confirm long Project/member labels are truncated with title/aria text and action buttons remain in the DOM for keyboard use.
