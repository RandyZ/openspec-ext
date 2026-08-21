# Task 4. Project Dashboard and compatibility

<!-- covers: Task 4.1, Task 4.2, Task 4.3 -->

### Task 4.1: Add RED route, singleton, metric-semantics, and binding-isolation regressions for Project Dashboard.

**Spec coverage:** `dashboard` / Cache-aware dashboard rendering / Project Dashboard reuses the warm Sidebar snapshot; One refresh updates both Project surfaces. Project Dashboard summary surface / all scenarios. `project-sidebar-tabs` / Open Project Dashboard; One payload serves multiple surfaces.

**Dependencies / order:** Tasks 1–3 interfaces and launcher messages are stable. Must be RED before Task 4.2.

**Implementation notes:** Test at App/provider boundaries and use one pure summary derivation function. Prefer deterministic message/panel spies and fixed timestamps; do not add chart libraries, timing benchmarks, or a test-only data service.

**Files:**
- Modify: `test/extension/providers/dashboardViewProvider.test.ts`
- Modify: `test/webview/app.test.tsx`
- Create: `test/webview/components/projectDashboard.test.tsx`
- Modify: `test/extension/services/projectDataGateway.test.ts` only for snapshot isolation
- Read: `src/extension/providers/dashboardViewProvider.ts`
- Read: `src/webview/App.tsx`
- Read: `src/webview/context/AppContext.tsx`

- [ ] **Step 1: Write the failing App route test**
  - Send `setContext/view: 'dashboard'` with Project data and assert App selects a distinct Project Dashboard component rather than the Sidebar or legacy Dashboard.
  - Assert `view: 'sidebar'` continues to render the existing Project-first Sidebar path.
- [ ] **Step 2: Write the failing singleton/warm-open tests**
  - Open Project Dashboard twice and assert one Panel is created and the second action reveals it.
  - Seed a matching provider memory snapshot and assert opening Dashboard posts it without another Gateway/root-resolution call.
  - Assert mismatched Project/binding memory is rejected.
- [ ] **Step 3: Write the failing metric semantics tests**
  - Assert Total, Active, Ready to Verify, Archived, Active Tasks, and summed completion rate from fixed Change data.
  - Assert zero tasks has a defined value, Store groups do not affect metrics, and lifecycle buckets use Host statuses.
  - Assert readiness uses actual artifact ids and recent updates use bounded `lastModified` order.
- [ ] **Step 4: Run the focused RED command**
  - Run: `pnpm test -- test/extension/providers/dashboardViewProvider.test.ts test/webview/app.test.tsx test/webview/components/projectDashboard.test.tsx test/extension/services/projectDataGateway.test.ts`
  - Expected: FAIL because the Dashboard route/component and warm-open summary contract are not implemented.

**Verification:** RED failures identify route, singleton, snapshot reuse, or metric semantics rather than legacy Dashboard fixtures.

**Risks / edge cases:** Same-named Changes/Specs in another binding must not satisfy the warm-open test. Time ordering must use explicit fixed timestamps, not the current clock.

---

### Task 4.2: Implement the Dashboard surface route, warm-open singleton Panel, and shared refresh publishing.

**Spec coverage:** `dashboard` / Dashboard Actions / Open Project Dashboard. Cache-aware dashboard rendering / Project Dashboard reuses the warm Sidebar snapshot; One refresh updates both Project surfaces. `project-sidebar-tabs` / Open Project Dashboard; One payload serves multiple surfaces.

**Dependencies / order:** Task 4.1 RED tests exist; Task 1.3 provides surface-aware publishing.

**Implementation notes:** Reuse the existing `dashboardPanel`, Webview bundle, CSP, binding checks, and generation guard. Add one route value and one explicit request; do not create a second provider, cache entry, or Panel manager.

**Files:**
- Modify: `src/webview/types/messages.ts`
- Modify: `src/webview/App.tsx`
- Modify: `src/webview/context/AppContext.tsx`
- Modify: `src/extension/providers/dashboardViewProvider.ts`
- Modify: `src/extension/providers/webviewMessageHandler.ts`
- Create: `src/webview/components/ProjectDashboard.tsx` with the minimum route-safe shell and exported pure summary function
- Modify: `test/extension/providers/dashboardViewProvider.test.ts`
- Modify: `test/webview/app.test.tsx`

- [ ] **Step 1: Extend the Project page context union**
  - Add `view: 'dashboard'` carrying the existing Project payload.
  - Teach route resolution and App state to distinguish Project Dashboard from `sidebar` and legacy `dashboardData`.
- [ ] **Step 2: Reuse the singleton Editor Panel**
  - Route `openProjectDashboard` and the existing command-palette action to `openInEditor()`.
  - If the Panel exists, reveal it; otherwise create it once and register disposal.
- [ ] **Step 3: Implement warm-open and refresh behavior**
  - Post a matching accepted memory snapshot immediately as `view: 'dashboard'`.
  - If no snapshot exists, show loading and use the unified Project load.
  - Publish one accepted explicit/watcher refresh to both matching surfaces; reject older generations.
- [ ] **Step 4: Run the focused GREEN command**
  - Run: `pnpm test -- test/extension/providers/dashboardViewProvider.test.ts test/webview/app.test.tsx`
  - Expected: PASS with one Panel, zero click-time reload on warm open, and surface-specific messages sharing one snapshot.

**Verification:** Provider and App tests prove distinct rendering without duplicating data acquisition or weakening legacy routes.

**Risks / edge cases:** Disposed Panels must not remain publish targets. Opening Dashboard before Sidebar resolution must still converge through one in-flight Project load. Legacy scope-only `openspec.openDashboard` behavior must remain supported.

---

### Task 4.3: Implement the accessible Project summary UI and GREEN compatibility/performance coverage.

**Spec coverage:** `dashboard` / Project Dashboard summary surface / all scenarios; Cache-aware dashboard rendering / existing cached, fresh, and scoped scenarios; Dashboard Actions / all workflow quick-action scenarios. `dashboard` / Performance / all existing scenarios. `cli-integration` / Command Execution / Create new change; Archive change; Validate change. All compatibility-sensitive scenarios in `project-sidebar-tabs`, `referenced-store-specs`, and `workset-cli-open`.

**Dependencies / order:** Task 4.2 routes valid Project data to the new component.

**Implementation notes:** Derive every value from `ProjectSidebarData` in a pure function exported from `ProjectDashboard.tsx`. Use responsive CSS/Tailwind and VS Code theme variables. No Chart.js/CDN, custom theme, fake timeline, new cache, or new dependency.

**Files:**
- Modify: `src/webview/components/ProjectDashboard.tsx`
- Modify: `src/i18n/locales/en.json`
- Modify: `src/i18n/locales/zh-cn.json`
- Modify: `test/webview/components/projectDashboard.test.tsx`
- Modify: `test/webview/components/dashboard.test.tsx`
- Modify: `test/extension/providers/dashboardViewProvider.test.ts`
- Modify: `test/extension/providers/webviewMessageHandler.test.ts`
- Modify: `package.json` only to verify no dependency addition and finalized view-title contribution
- Modify: `test/extension/services/openspecCli.test.ts` and `test/extension/services/dataManager.test.ts` only for existing command regressions

- [ ] **Step 1: Implement the pure summary derivation**
  - Compute the six KPI values, lifecycle buckets, dynamic artifact readiness, and bounded recent updates.
  - Exclude referenced Store groups and define zero-task behavior.
- [ ] **Step 2: Render the wide Dashboard**
  - Add responsive KPI cards, textual lifecycle distribution with a CSS-only visual, Artifact Readiness rows, and Recent Updates.
  - Add stale/loading/empty/error states, accessible names/text equivalents, focus styles, and reduced-motion-safe behavior.
- [ ] **Step 3: Add compatibility and command-count regressions**
  - Assert legacy scope Dashboard, Store/Workset management, detail panels, workflow quick actions, and watcher routing retain their original messages.
  - Assert existing create, archive, and validate command routing retains its canonical arguments, exit checks, refresh/navigation, and diagnostic behavior.
  - Assert legacy cached/fresh/scoped Dashboard behavior remains intact alongside the new Project Dashboard snapshot route.
  - Assert local view changes and warm Dashboard open do not increase root/Store selector counts.
  - Assert Store failure and invalid cache identity preserve usable Project data.
- [ ] **Step 4: Run the combined GREEN suite**
  - Run: `pnpm test -- test/webview/components/projectDashboard.test.tsx test/webview/components/dashboard.test.tsx test/extension/providers/dashboardViewProvider.test.ts test/extension/providers/webviewMessageHandler.test.ts test/extension/services/projectDataGateway.test.ts test/extension/services/openspecCli.test.ts test/extension/services/dataManager.test.ts`
  - Expected: PASS with truthful metrics, accessible states, no duplicate scan, and legacy behavior intact.

**Verification:** Tests cover pure calculations, textual output, route/messages, command counts, failure states, and compatibility; package diff contains no new visualization dependency.

**Risks / edge cases:** Artifact ids may differ by schema and must be rendered dynamically. Long names/timestamps need bounded layout. Reduced motion must disable non-essential transitions without hiding state changes.
