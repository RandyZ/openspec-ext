# Spec Review — clarify-root-store-and-cache-ux

**Reviewer:** aihelp-spec-reviewer
**Date:** 2026-07-01
**Scope:** Implementation delta in working tree for change `clarify-root-store-and-cache-ux`.
**Method:** Read `proposal.md`, `design.md`, `tasks.md`, `specs/dashboard/spec.md`, `specs/extension-cache/spec.md`; reviewed full diffs of all in-scope files and the new untracked files; verified i18n parity programmatically; ran the 6 targeted test files (74 tests, all passing).

## Summary

The implementation is well-structured and covers the bulk of both delta specs. The core architectural goals are met:

- Cache actions moved into a positioned overlay menu (`ScopeBar.tsx`) — no inline `details` reflow. ✅
- Cache stats kept global; `selectScope` no longer forces a cache-stat recalculation (verified by `dashboard.test.tsx:171` and host `selectScope` handler). ✅
- Root selector relabeled to `OpenSpec Root` with `Local Root` / `Store: <id>` / `Declared Root: <label>` via `scopeLabels.ts`. ✅
- `getArchivedChanges` now resolves and forwards the selected scope (`webviewMessageHandler.ts:603`). ✅
- Root-scoped empty states in `ChangesSection` / `SpecsSection`. ✅
- `StoresAndWorksetsPanel` composes stores / references / worksets. ✅
- i18n key parity between `en.json` and `zh-cn.json` is **perfect** (0 missing keys, 0 placeholder mismatches).

The main gaps are (1) keyboard/overlay robustness for the cache menu (partial miss on an `extension-cache` scenario), (2) a stale-response race on archived changes that the design itself flagged but was not mitigated, and (3) two duplication smells (store-action buttons, `formatBytes`).

---

## Plan Alignment Check

### dashboard spec

| Requirement | Status | Notes |
|---|---|---|
| OpenSpec root selector clarity | ✅ | `scopeLabels.ts` + `ScopeBar` aria-label `OpenSpec Root`. `scopeBar.test.tsx:74` covers the three label variants. |
| └ Root switch drives primary content | ⚠️ | Active/specs/archived content is scoped end-to-end, **but** archived responses carry no `scopeId` and the webview applies them unconditionally — see Finding H2. |
| Root-scoped empty states | ✅ | `ChangesSection`/`SpecsSection` accept `rootLabel`; `changesSection`/`specsSection` tests cover the store-root copy. |
| Scoped archive overview | ✅ (host) / ⚠️ (stale) | Host resolves scope (`webviewMessageHandler.test.ts:1071`); failure falls back to `items: []` (covered). Stale-response gap is the only miss. |
| Stores & worksets maintenance panel | ✅ | Stores/references/worksets rendered separately; `requestRegisterStore`/`requestSetupStore` wired. ⚠️ see M1 for duplicate action buttons. |

### extension-cache spec

| Requirement | Status | Notes |
|---|---|---|
| Stable cache status rail controls | ⚠️ | Overlay menu replaces `details` (no reflow). Trigger is focusable with `aria-haspopup`/`aria-expanded`. **But** no Escape-to-close, no click-outside, no focus restoration on close — partial miss on "Cache actions remain accessible". |
| └ Cache action state is visible | ⚠️ | No per-action pending state: a running `clear` does not disable the clear button (see M2). |
| Cache statistics refresh semantics | ✅ | Root switch no longer calls `getCacheStats`; explicit refresh + mutation call `force: true` (`webviewMessageHandler.ts:206,222`; `Dashboard.handleRefresh` line 167). |

### tasks.md

Tasks 1–4 are marked complete and are genuinely implemented. **Task 5 (verification) is unchecked**, and indeed Task 5.3 (sidebar visual QA) and the full build/OpenSpec validation were not run as part of this review — recommend the implementer complete Task 5 before merge, particularly the narrow-viewport overlay clipping QA flagged as a risk in `design.md`.

---

## Architecture Analysis

**No layer inversions or SOLID violations of note.** The handler correctly stays in the extension-host layer and routes everything through `DataManager`/`vscode` APIs; the webview performs no filesystem access (store actions go through messages, as the spec requires). `scopeLabels.ts` is a clean view-boundary mapper exactly as design decision #3 prescribes (scope model untouched, labels derived at the view layer).

**One structural smell worth surfacing — over-defensive casting of `DataManager`** (`webviewMessageHandler.ts:36,1047`). The handler repeatedly casts the concrete `DataManager` to `DataManager & { resolveScope?: ... }` and calls `resolveScope?.(...)`, `getCacheStats?.(...)`, etc., even though these are concrete public methods. This is evidently done to keep the handler unit-testable with partial mock objects (the tests pass minimal `{}` dataManagers), and it is applied consistently. The trade-off is real: the compiler will not flag signature drift between the handler and `DataManager` (e.g., if `resolveScope`'s return type changes, the handler keeps compiling). This is a maintainability concern, not a correctness one — flagged as L1 below.

---

## Findings

### High

1. **[webviewMessageHandler.ts:603-611, Dashboard.tsx:113-115]** Archive stale-response race is unguarded (design flagged it; not mitigated)
   - **Problem:** `getArchivedChanges` posts `{ type: 'archivedChanges', items }` with **no `scopeId`**, and `Dashboard` does `setArchivedItems(message.items ?? [])` unconditionally. If the user expands archives on root A, then switches to root B while that request is in flight, root A's archives will overwrite root B's archive list (or vice-versa).
   - **Why it matters:** This directly risks the dashboard scenario *"the dashboard MUST NOT show content from the previously selected root as if it belonged to the new root"* (dashboard spec, "Root switch drives primary dashboard content") and *"the dashboard MUST NOT show archived changes from another root as a fallback"* ("Scoped archive overview"). The `design.md` risks section explicitly calls this out and decision #4 says "prefer adding [`scopeId`] to the response so the webview can ignore stale archive data" — but it was not added.
   - **Confidence:** 0.8 (High). The gap is unambiguous in the code; the real-world blast radius depends on archive-load latency vs. root-switch speed.
   - **Fix:** (a) Echo `scopeId` in the `archivedChanges` message and have `Dashboard` ignore it when it no longer matches `state.data?.scope?.id`; or (b) track the last requested scopeId in a ref and drop mismatched responses. Option (a) mirrors the existing `dashboardData` cache-meta pattern and is the smallest change.

### Medium

2. **[ScopeBar.tsx:174-211]** Cache menu has no Escape/close-on-outside-click and no focus management
   - **Problem:** The overlay menu is toggled purely by the trigger `onClick`. Pressing Escape does nothing; clicking elsewhere in the rail does nothing; focus is not moved into the menu on open nor restored to the trigger on close. Menu items are buttons (so they are individually reachable via Tab), but there is no roving/arrow-key navigation and the menu does not close on selection-of-non-action areas.
   - **Why it matters:** The `extension-cache` scenario "Cache actions remain accessible" requires that *"opening or closing the action surface MUST preserve a predictable focus target"* and that actions are reachable/activatable. The current implementation satisfies the letter of "focusable trigger + activatable items" but misses the predictable-focus-on-close expectation and leaves an orphaned open menu if the user clicks away (a real usability defect in a narrow sidebar, and exactly the "overlay can be clipped / hard to dismiss" risk in `design.md`).
   - **Confidence:** 0.7 (High).
   - **Fix:** Add a `useEffect` registering a `mousedown`/`focusin` outside-click handler on the menu container + an `onKeyDown` (Escape) handler on the trigger that closes and returns focus to the trigger. Consider `onKeyDown` arrow navigation between `role="menuitem"`s for full menu semantics. This is a ~15-line, well-contained addition.

3. **[ScopeBar.tsx:113, Dashboard.tsx:169-172]** Running cache action has no pending state; destructive actions are not disabled in-flight
   - **Problem:** `cacheActionDisabled` is derived only from scope activity (`disableScopeActions`), not from whether a cache action is running. A `clear` (the destructive, slowest action — it runs `dataManager.clearCache()` + `refresh()` + `getCacheStats(force)`) leaves the clear button enabled, so the user can re-trigger it before the first completes. There is also no spinner/"clearing…" affordance.
   - **Why it matters:** Direct partial miss on `extension-cache` scenario "Cache action state is visible": *"the running action MUST show pending state"* and *"duplicate destructive cache actions MUST be disabled until the operation completes"*.
   - **Confidence:** 0.75 (High).
   - **Fix:** Track an in-flight action in `Dashboard` (e.g. `const [pendingCacheAction, setPendingCacheAction] = useState<CacheAction | null>(null)`), set it on `handleCacheAction`, clear it on `cacheActionResult`, pass it down, and use it to (a) disable menu items while non-null and (b) show a spinner on the running one.

4. **[ScopeBar.tsx:277-298 vs StoresAndWorksetsPanel.tsx:43-50]** Duplicate Register/Create Store buttons rendered simultaneously
   - **Problem:** When `capabilities.stores === true` and no store scopes exist, `ScopeBar`'s "no stores registered" hint renders Register/Create Store buttons **and** `StoresAndWorksetsPanel` (which always renders) shows the same two buttons in its header. Both bind to the same `handleRegisterStore`/`handleSetupStore`. So the user sees the identical action pair twice, in two adjacent regions, for the exact same state.
   - **Why it matters:** Duplicated policy / divergent-change smell — the "how to add a store" affordance now lives in two components that can drift. It also clutters the rail. The panel already owns the store-maintenance concern per the spec ("Stores and worksets maintenance panel"), so the rail buttons are redundant.
   - **Confidence:** 0.7 (High).
   - **Fix:** Keep the hint text in `ScopeBar` (it is valuable as an in-rail prompt) but drop the two action buttons there, leaving the actionable buttons to `StoresAndWorksetsPanel`. Alternatively keep the rail buttons and drop the panel-header pair — pick one owner.

5. **[webviewMessageHandler.ts:52-58 vs commandManager.ts:195-205]** Duplicated `formatBytes` with divergent behavior
   - **Problem:** A new exported `formatBytes` was added to `webviewMessageHandler.ts` while an equivalent private `formatBytes` already exists in `commandManager.ts`. They differ: the handler version caps at MB and always uses `.toFixed(1)` for KB/MB; the command version supports up to TB and rounds to integer at ≥10. Same cache size will now render differently depending on which surface the user hits.
   - **Why it matters:** Divergent formatting of the same statistic across surfaces is a small but real consistency bug and a duplicated-policy smell; future cache-size changes will need to touch two places.
   - **Confidence:** 0.8 (High).
   - **Fix:** Extract one shared formatter (e.g. `src/extension/utils/formatBytes.ts` or extend the existing `cacheService`), and have both call sites use it.

### Low

6. **[webviewMessageHandler.ts:36-41, 1047-1050]** Over-defensive optional-method casting of a concrete `DataManager`
   - **Problem:** `resolveScope`, `getCacheStats`, `getCacheRootPath`, `registerStore`, `setupStore`, `getCachedDashboardData`, `getCachedArtifactContent`, `writeArtifactContentCache` are all concrete public methods, yet the handler casts to `DataManager & { method?: ... }` and calls with `?.`. This weakens compile-time safety — if a method signature changes on `DataManager`, the handler still type-checks against the looser cast.
   - **Why it matters:** Maintainability/DRY concern; the real type contract is hidden behind optional shims. The pattern is consistent and clearly motivated by partial-mock testability, so it is low-severity.
   - **Confidence:** 0.6 (Medium).
   - **Fix:** Define a narrow interface (e.g. `interface ScopeAwareDataManager { resolveScope(...); getCacheStats(...); ... }`) that `DataManager` satisfies, and type the handler parameter against that interface. Keeps testability while restoring compile-time guarantees.

7. **[i18n: `cache.clearConfirm`] Unused i18n string + cache clear has no confirmation
   - **Problem:** `cache.clearConfirm` is defined in both locales but never referenced anywhere. The `clear` cache action executes immediately with no confirmation dialog.
   - **Why it matters:** Dead string (minor); also a UX nit — a destructive cache clear with no confirmation is surprising, though `design.md` did not mandate a confirm.
   - **Confidence:** 0.8 (High) for "unused string"; 0.5 (Medium) for "should confirm".
   - **Fix:** Either wire `showWarningMessage` confirmation into the `clear` branch using `cache.clearConfirm`, or delete the unused string if confirmation was intentionally deferred.

8. **[Dashboard.tsx:120-123]** `cacheActionMessage` persists indefinitely after a successful action
   - **Problem:** On `cacheActionResult`, the message is set and never auto-cleared (only cleared when a *new* action starts at line 170). A successful "Open Folder" leaves "Open Folder" sitting in the rail forever.
   - **Why it matters:** Minor staleness/UX nit; no correctness impact.
   - **Confidence:** 0.7 (High).
   - **Fix:** Clear `cacheActionMessage` on a short timeout for success results (errors can persist until next interaction), or clear it on the next dashboard data refresh.

9. **[StoresAndWorksetsPanel.tsx:73-74]** Store row shows `store.rootPath` in the body *and* repeats it in the `title` tooltip on the same element
   - **Problem:** The path is both visible text and the element's own `title` — redundant; the tooltip adds nothing over the already-visible (truncated) text.
   - **Why it matters:** Trivial; `design.md` risk note says "keep path details in titles/tooltips" precisely when the path is *not* otherwise shown. Here it is shown.
   - **Confidence:** 0.6 (Medium).
   - **Fix:** Either rely only on the `title` (drop the visible path for very narrow rails) or only on the visible text. Cosmetic.

---

## Removal / Iteration Plan

| Location | Evidence | Risk | Action |
|----------|----------|------|--------|
| `i18n cache.clearConfirm` (both locales) | Defined, never referenced (grep confirms zero call sites) | None | **Defer** if a confirm dialog is planned; otherwise **safe delete** the two keys. |
| `ScopeBar` store-action buttons (lines 277-298) | Duplicated by `StoresAndWorksetsPanel` header buttons | Low | **Safe delete** in the rail (the panel is the spec-mandated maintenance owner); keep the hint text. Recommend doing this alongside M4. |
| `commandManager.ts:195 formatBytes` private impl | Superseded conceptually by the new exported `webviewMessageHandler.formatBytes`; divergent behavior | Low | **Defer** — consolidate into a shared util (M5) rather than delete, since the command version has more units. |

---

## Notes / What I Did Not Flag

- I treated `dataManager.ts`, `interactiveAgentTerminalManager.ts`, `dashboardViewProvider.ts`, `AppContext.tsx`, and `messages.ts` as supporting context (out of the explicit review scope) and verified only that the in-scope handler calls match those files' signatures — which they do (`resolveScope`, `getCacheStats({force})`, `registerStore(path)`, `setupStore(id,path)`, `reveal/stop/clear/getState(...,scope)`, `LoadingReason`, `InteractiveWorkflowScope`). I did not deep-review those files.
- The webview message/effect logic for spec-requirements scope-reset (`lastScopeIdRef`) is correct and avoids the store-scope-leaks-local-requirements bug noted in the code comment.
- Runtime failure paths (empty `stats`, thrown `refresh`, `cacheAction` errors) are handled defensively in the host and surfaced via typed messages — within the aihelp-adversarial-reviewer's domain, not this review.
- All 6 targeted test files pass (74/74). Tests verify real behavior (rendered HTML assertions, reducer transitions, message-routing assertions) rather than just mock interactions, with good coverage of cancellation paths for store setup/register.
