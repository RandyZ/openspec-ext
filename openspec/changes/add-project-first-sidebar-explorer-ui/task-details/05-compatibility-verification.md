# Task 5. Compatibility and verification

<!-- covers: Task 5.1, Task 5.2, Task 5.3 -->

### Task 5.1: Prove cache, refresh, and same-named resource isolation across Project/root bindings

**Spec coverage:** `project-first-explorers` / `Explicit Project Binding and Isolation` / both scenarios; `dashboard` / `Cache-aware dashboard rendering` / all six retained Project/scoped cache scenarios; `dashboard` / `Real-time Updates` / `Existing cache avoids click-time reload`, `Task completion updates status`, `Sidebar receives refreshed dashboard data`; `openspec-scope-management` / `Selected OpenSpec scope` / `Scope selection clears stale dashboard data`.

**Dependencies / order:** Depends on Tasks 2-4. This task hardens their cross-page/cache behavior before the final regression pass.

**Files:**
- Create: none
- Modify: `src/extension/services/openSpecCacheService.ts`, `src/extension/providers/dashboardViewProvider.ts`
- Test: `test/extension/services/openSpecCacheService.test.ts`, `test/extension/providers/dashboardViewProvider.test.ts`

**Implementation notes:**
- Reuse `OpenSpecCacheService` envelope/path/hash machinery. Add one generic Project-page read/write path only for page kinds that are actually cached; do not create a second cache service.
- Derive every Project-page cache key from `pageKind`, canonical `projectId`, canonical `rootPath`, `rootSource`, and optional `storeId`. Validate the same fields on read before returning a payload.
- Cache the compact Sidebar because the spec requires cached-first rendering. Explorer payloads may remain uncached in this Change; if they are cached, they must use the same binding-complete key.
- On binding change, ignore/invalidate the previous binding's visible data. Concurrent refreshes publish only when their captured binding still equals the provider's current binding.
- A click that opens a matching detail/Explorer reuses current valid data and must not call a full Project scan solely for navigation.

**Verification:** Cache entries for Project A/B, local/declared Store roots, and same-named resources never collide; cached-then-fresh ordering is correct; a late A refresh cannot replace B; navigation alone does not trigger a full reload.

**Risks / edge cases:** Existing cache schema/envelopes must remain readable for legacy Dashboard paths. Normalize paths consistently before hashing; do not expose raw absolute paths in UI diagnostics.

- [ ] **Step 1 (RED): Write failing isolation tests**

Add cache-key matrix fixtures for all binding fields, legacy-envelope compatibility, cached/fresh race ordering, late response rejection, and click-time call counts.

- [ ] **Step 2 (RED): Run the focused tests**

Run: `rtk pnpm exec vitest run test/extension/services/openSpecCacheService.test.ts test/extension/providers/dashboardViewProvider.test.ts -t "Project cache|binding isolation|late refresh|click-time"`

Expected: FAIL because cache/page refresh identity is not yet complete for Project-first payloads.

- [ ] **Step 3 (GREEN): Extend the existing cache minimally**

Add the binding-complete Project-page key/read/write path and provider guards; leave legacy Dashboard/artifact methods unchanged.

- [ ] **Step 4 (GREEN): Re-run the focused tests**

Run: `rtk pnpm exec vitest run test/extension/services/openSpecCacheService.test.ts test/extension/providers/dashboardViewProvider.test.ts -t "Project cache|binding isolation|late refresh|click-time"`

Expected: PASS; no Project/root/cache collision or stale overwrite remains.

---

### Task 5.2: Verify legacy details, workflow delivery, Store/Workset services, and scoped actions remain compatible

**Spec coverage:** `dashboard` / `Dashboard Actions` / all retained workflow/copy/Verify/Archive scenarios; `dashboard` / `CLI Activation Failure State` / all retained scenarios; `openspec-scope-management` / `Selected OpenSpec scope` / `Explicit store scope`, `Declared store scope is reported`; design decisions 1 and 4 requiring `DataManager`, details, workflow adapters, and legacy Store scope compatibility to remain.

**Dependencies / order:** Depends on Tasks 2.3, 3.2-3.3, 4.2-4.3, and 5.1. Run before Task 5.3 full verification.

**Files:**
- Create: none
- Modify: only production files where a focused regression test proves compatibility broke
- Test: `test/extension/providers/changeDetailPanelManager.test.ts`, `test/extension/providers/webviewMessageHandler.test.ts`, `test/extension/services/workflowLaunchConfig.test.ts`, `test/extension/services/openspecScope.test.ts`, `test/webview/components/changeDetailRouting.test.ts`, `test/webview/components/storesAndWorksetsPanel.test.tsx`, `test/webview/components/worksetsPage.test.tsx`

**Implementation notes:**
- Prove legacy scope-only Change/Spec detail opens still work while Project-first requests use verified bindings. Do not convert every legacy caller in this Change.
- Prove Clipboard/Copilot/Cursor routing, colon versus Cursor hyphen commands, default clipboard safety, and interactive Verify/Archive remain unchanged.
- Prove Store registration/doctor/unregister and Workset list/open/remove services/messages still function even though their default Sidebar UI is absent.
- Prove explicit legacy Store selection still scopes compatible operations but cannot redirect current Project-first payloads.
- Fix only observed regressions at their shared boundary; do not redesign `DataManager`, delivery adapters, Store/Workset services, or detail UI.

**Verification:** All listed focused suites pass without weakening Project binding checks; compatibility components/services remain callable; no retired UI is reintroduced to make a test pass.

**Risks / edge cases:** Legacy tests may encode the old default Dashboard layout. Update only expectations intentionally superseded by delta specs; retain behavioral coverage for services and non-default surfaces.

- [ ] **Step 1 (RED): Add/adjust compatibility assertions**

Add explicit legacy-versus-Project-first cases for detail resolution, workflow delivery, Store/Workset service calls, diagnostic actions, and selected Store scope isolation.

- [ ] **Step 2 (RED): Run the compatibility suites**

Run: `rtk pnpm exec vitest run test/extension/providers/changeDetailPanelManager.test.ts test/extension/providers/webviewMessageHandler.test.ts test/extension/services/workflowLaunchConfig.test.ts test/extension/services/openspecScope.test.ts test/webview/components/changeDetailRouting.test.ts test/webview/components/storesAndWorksetsPanel.test.tsx test/webview/components/worksetsPage.test.tsx`

Expected: New assertions expose any compatibility break; unrelated existing behavior remains green.

- [ ] **Step 3 (GREEN): Fix only proven shared-boundary regressions**

Make the smallest compatibility adjustment needed by failing tests; do not restore removed Dashboard branches or add new abstraction layers.

- [ ] **Step 4 (GREEN): Re-run the compatibility suites**

Run: `rtk pnpm exec vitest run test/extension/providers/changeDetailPanelManager.test.ts test/extension/providers/webviewMessageHandler.test.ts test/extension/services/workflowLaunchConfig.test.ts test/extension/services/openspecScope.test.ts test/webview/components/changeDetailRouting.test.ts test/webview/components/storesAndWorksetsPanel.test.tsx test/webview/components/worksetsPage.test.tsx`

Expected: PASS; legacy service/detail/delivery paths coexist with Project-first pages.

---

### Task 5.3: Run strict OpenSpec validation, focused tests, full tests, lint, build, and VS Code Extension Host smoke checks

**Spec coverage:** All requirements/scenarios in this Change; proposal Impact and design rollback boundary; AGENTS.md TDD and Extension Host verification requirements.

**Dependencies / order:** Final task after Tasks 1.1-5.2 are green. It verifies rather than adding features.

**Files:**
- Create: none
- Modify: `openspec/changes/add-project-first-sidebar-explorer-ui/tasks.md` only to mark tasks complete after their evidence passes; production/test files only for failures found by these checks
- Test: all project tests and the built Extension Development Host

**Implementation notes:**
- Run strict OpenSpec validation first, then the focused gateway/provider/webview suites, full unit tests, source lint, and build from the CLI-resolved project root.
- Treat pre-existing documented lint global errors separately, but do not dismiss new lint errors in touched files. Record exact new-versus-existing evidence in the apply handoff.
- Launch the VS Code Extension Development Host using the built extension, open this initialized workspace, and manually exercise Sidebar, All Changes, Specs, same-named/bound detail navigation where fixtures permit, workflow copy/interactive entry, refresh, cache warning, and CLI diagnostic recovery.
- Inspect Extension Host and webview console logs for errors. Stop any process started for smoke testing when complete.
- Do not archive the Change here; verification/archive remains a separate user-authorized workflow.

**Verification:** Strict validation reports valid; focused and full tests pass; build succeeds; no new touched-file lint failures; Extension Host shows Project-first Sidebar and both bound Explorers with no console/runtime error.

**Risks / edge cases:** Unit tests cannot prove VS Code panel lifecycle or narrow-sidebar layout. The smoke check is required. CLI/VS Code availability failures must be reported as blocked evidence, not converted into a success claim.

- [ ] **Step 1: Validate planning and run focused automated checks**

Run:
- `rtk openspec validate add-project-first-sidebar-explorer-ui --strict --json`
- `rtk pnpm exec vitest run test/extension/services/projectDataGateway.test.ts test/extension/services/openSpecCacheService.test.ts test/extension/providers/dashboardViewProvider.test.ts test/extension/providers/changeDetailPanelManager.test.ts test/extension/providers/webviewMessageHandler.test.ts test/webview/app.test.tsx test/webview/components/dashboard.test.tsx test/webview/components/changesExplorer.test.tsx test/webview/components/specsExplorer.test.tsx`

Expected: OpenSpec returns `valid: true`; focused tests exit 0.

- [ ] **Step 2: Run the full automated quality gates**

Run:
- `rtk pnpm test`
- `rtk npx eslint src/`
- `rtk pnpm run build`

Expected: tests/build exit 0; lint has no new error in touched source files, with any known baseline globals reported explicitly.

- [ ] **Step 3: Smoke-test the built extension in VS Code**

Run the repository's `.vscode/launch.json` “Run Extension” configuration (or the documented `code --extensionDevelopmentPath=/Users/randy/workspace/projects/github/openspec-ext /Users/randy/workspace/projects/github/openspec-ext --no-sandbox` equivalent), then execute the UI checks above and inspect logs.

Expected: Sidebar and both Explorer panels load/refresh/navigate with the correct Project identity; retained workflows/details work; no stale cross-binding data or runtime error appears.

- [ ] **Step 4: Re-run affected checks and record completion evidence**

After any fix, rerun the smallest failing check and then the full test/build gates. Mark a checklist item complete only when its focused RED/GREEN evidence and applicable final gate are both recorded.

Expected: final evidence is fresh, reproducible, and contains no unsupported completion claim.
