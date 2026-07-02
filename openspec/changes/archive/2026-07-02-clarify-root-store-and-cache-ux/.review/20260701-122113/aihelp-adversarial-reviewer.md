# Adversarial Review — `clarify-root-store-and-cache-ux`

Reviewer stance: try to break this change, not validate it. Scope = working-tree implementation delta only (modified files + new `StoresAndWorksetsPanel.tsx`, `scopeLabels.ts`).

## Summary

The change is largely well-structured: scopeId is now threaded through nearly every message handler, `resolveScopeRoot` falls back safely, zh-cn is fully in parity (51/51 keys), and `selectScope` got an honest try/catch. The main residual risks are concentrated in (1) a destructive-action regression in the new cache-menu path, (2) the archived-changes race the design explicitly flagged but the implementation did **not** close, and (3) the overlay menu's missing dismissal/keyboard semantics.

---

## Findings

### Critical

1. **`src/extension/providers/webviewMessageHandler.ts` — `cacheAction: 'clear'` runs a destructive cache wipe with NO confirmation, regressing the previous behavior**
   - Problem: The new `clear` branch calls `await dataManager.clearCache()` immediately on click, then posts `dashboardData` (a full refresh) and a forced `cacheStats` scan. There is **no confirmation dialog**. The old path (`commandManager.handleClearCache`, lines ~136–146) showed a **modal** `showWarningMessage(t('cache.clearConfirm'), { modal: true }, clearLabel)` and bailed if the user dismissed it. The locale string `cache.clearConfirm` was added in this very change but is **never referenced** anywhere in the new code path (grep shows it only in `commandManager.ts` — the path the webview no longer triggers).
   - Why it matters: `clearCache()` does `fs.rm(cacheRoot, { recursive: true })` (openSpecCacheService.ts:120). A mis-click on "Clear Cache" in the rail menu now immediately deletes the entire cache tree with no recourse. For an action class explicitly called out as destructive elsewhere in the codebase, removing the guard is a genuine data/state-loss regression, not a style issue. Worse, the menu items are tightly packed and visually similar ("Open Folder" / "Copy Path" / "Clear Cache" / "Show Details"), making an accidental "Clear" realistic. There is also no undo and no audit.
   - Confidence: 0.95, High
   - Fix: Mirror the existing guard before mutating: `const clearLabel = t('cache.clear'); const choice = await vscode.window.showWarningMessage(t('cache.clearConfirm'), { modal: true }, clearLabel); if (choice !== clearLabel) { /* post a no-op cacheActionResult and return */ }`. Re-use the same i18n key that is already defined. Alternatively, gate the action with the capability check used by the old command.

### High

2. **`src/webview/components/Dashboard.tsx` (lines ~106–140) + handler `getArchivedChanges` — the archive race the design flagged is real and unmitigated**
   - Problem: The design (`design.md:126`, Risk list `156`) explicitly calls out that archive requests can race with root switches and that "the archive response should eventually carry the `scopeId`… so stale responses can be ignored." That mitigation was **not implemented**. Evidence:
     - The `archivedChanges` message (`webviewMessageHandler.ts:607/610`) is posted as `{ type: 'archivedChanges', items }` with **no `scopeId`** field, even though the request now carries `scopeId`.
     - The handler `resolveScopeRoot(message.scopeId)` calls `resolveScope()` which, for an **unknown** scopeId, **silently falls back to `getSelectedScope()`** (dataManager.ts:215–224). So if a stale `getArchivedChanges(storeA)` arrives after the user switched to storeB, the request is resolved against the *current* selection — storeB — and returns storeB's archives labeled as if for the request.
     - Dashboard's `setArchivedItems(message.items ?? [])` (Dashboard.tsx:114) applies whatever arrives to the current view with no scope check.
   - Failure scenario: user expands Archives in storeA (request in flight), switches to storeB. Two `archivedChanges` messages may arrive; order is not guaranteed, and neither carries a scope tag. Final `archivedItems` is whichever response lands last — can show storeA's archived changes under storeB's root label ("No archived changes in Store: B" is *false* — it shows storeA's list). The result is a user opening an archived change from the wrong root, or being told the wrong root has/hasn't archives.
   - Why it matters: this is a cross-root data-bleed correctness bug on a user-facing list, and the design already identified the fix. It is hard to detect (no error, no log) and persists until the user manually re-toggles the archive section in the correct root.
   - Confidence: 0.8, High
   - Fix: (a) Echo `scopeId` on the `archivedChanges` response and in Dashboard ignore it when `message.scopeId !== state.data?.scope?.id`; and/or (b) clear `archivedItems`/collapse `archivedExpanded` on scope switch (see finding 3, which overlaps). At minimum, capture the scopeId at request time in the handler and include it in the posted items.

3. **`src/webview/components/Dashboard.tsx` — `archivedItems` / `archivedExpanded` are never reset on scope switch, so stale archive data survives a root change**
   - Problem: On receiving `dashboardData`, Dashboard clears `specRequirements` when `lastScopeIdRef` changed (lines ~108–111) but does **not** clear `archivedItems` or reset `archivedExpanded`. `archivedItems` is only ever written in the `archivedChanges` branch (line 114). So after a root switch, the previous root's archived list remains rendered under the new root's label until the user collapses/re-expands the section. Combined with finding 2 (no scopeId on the response), the previous root's archives can be shown indefinitely under the wrong root.
   - Why it matters: same cross-root staleness class as finding 2, but this half is fixable purely client-side and trivially. The `specRequirements` reset shows the authors knew the pattern but only applied it to one of the two scope-cached collections.
   - Confidence: 0.85, High
   - Fix: In the `dashboardData` branch, when `lastScopeIdRef.current !== scopeId`, also `setArchivedItems([])` and optionally `setArchivedExpanded(false)` and `setArchivedLoading(false)`.

4. **`src/webview/components/ScopeBar.tsx` — overlay cache menu has no click-outside, Escape, or blur dismissal, and no focus management**
   - Problem: `cacheMenuOpen` is toggled only by the trigger `onClick`. There is no `onBlur`, no document-level `mousedown`/`pointerdown`-outside listener, no `keydown` Escape handler, and no focus movement into the menu (`role="menu"`/`role="menuitem"` are set but the items are not keyboard-focusable as a proper menu — Tab will leave the menu, arrows do nothing). The only way to close it is to click the trigger again or pick an item.
   - Why it matters: (a) If the user opens the menu and then clicks elsewhere in the webview (or the webview loses focus), the menu stays open and visually floats over stale content — including across a scope switch (the menu state is component-local `useState` and is **not** reset when `scope.id` changes, so a menu opened under storeA can persist showing cache actions while storeB renders). (b) Keyboard/screen-reader users get a `role="menu"` that does not implement any of the WAI-ARIA menu keyboard pattern (arrow navigation, Escape to close, focus return to trigger). For a menu that now hosts a destructive action (finding 1), leaving it stuck open is not just cosmetic.
   - Confidence: 0.8, High
   - Fix: Add a `useEffect` keyed on `cacheMenuOpen` that registers a `pointerdown` (capture) + `keydown` Escape listener to call `setCacheMenuOpen(false)`, move focus to the first menuitem on open and back to the trigger on close, and reset `cacheMenuOpen` to `false` when `scope.id` changes.

### Medium

5. **`src/extension/providers/webviewMessageHandler.ts` — double-click on "Clear Cache" / "Register Store" / "Create Store" is only partially guarded; "Clear" and "Show Details" have no in-flight protection**
   - Problem: `ScopeBar` disables its cache-action trigger via `cacheActionDisabled` while `disableScopeActions` is true — but `disableScopeActions` is derived from scope-switch/store activity and `(loading && !activity && !loadingReason)`. A pure cache action (Clear/Show Details/Copy) does **not** set any activity/loadingReason: `handleCacheAction` (Dashboard.tsx) just `postMessage(sendMessage.cacheAction(action))` and clears the local message — it does **not** dispatch `START_LOADING`. So two rapid clicks on "Clear Cache" fire two `cacheAction:'clear'` messages before the first `cacheActionResult` returns. The handler is `async` and has no mutex; each will independently `clearCache()` + `refresh()` + forced `getCacheStats`. Similarly `showDetails` fires a forced stats scan per click.
   - The "Register/Create Store" buttons are guarded in two places (ScopeBar hint buttons and StoresAndWorksetsPanel) by `disableScopeActions`/`pending`, and those flows dispatch `START_LOADING` with `store-register`/`store-setup` reasons, so they are reasonably protected — but the panel's `pending` is `loadingReason === 'store-register' || 'store-setup'`, which is only set **before** posting and cleared on the next `SET_DATA`. Acceptable.
   - Why it matters: for the destructive `clear` action this compounds finding 1 — two concurrent `clearCache()`/`refresh()` cycles on the same cache root can race the file-watcher-driven refresh (`runRefresh` queues at most one extra refresh via `queuedRefresh`, so it won't loop, but two `fs.rm(recursive)` + `createDirectory` sequences are still wasteful and the second `showInformationMessage` is noisy). Non-fatal but real.
   - Confidence: 0.7, Medium
   - Fix: Either disable the menu trigger/items from click until `cacheActionResult` returns (dispatch a transient loading state in `handleCacheAction`), or guard the `clear` branch in the handler with a module-level `cacheClearInFlight` flag. Given finding 1 adds a modal, the modal itself naturally serializes "Clear".

6. **`src/extension/providers/webviewMessageHandler.ts` `selectScope` — cached (stale) dashboard payload is posted from the *extension host's* current selected scope, which may not match the just-requested scopeId**
   - Problem: After `await dataManager.selectScope(message.scopeId)` (synchronous, mutates selected scope) the handler does `scopeAwareDataManager.resolveScope?.(message.scopeId)` and then `getCachedDashboardData(selectedScope)`. Because `selectScope` already mutated the global selection, `resolveScope(message.scopeId)` will return the now-selected scope (or, for an unknown id, the selected scope anyway). So the cached payload is always read for the host's *new* current scope — which is usually correct. The subtle hole: `getCachedDashboardData` returns `undefined` for no match and the stale post is skipped, but if a stale **disk** cache exists for the target scope from a previous session, it is shown with `stale:true`. That is the intended behavior. The actual residual risk is ordering: the stale `dashboardData` (cache) and the fresh `dashboardData` are two separate `postMessage` calls; if the host's `refresh()` is very fast (or fails and the queued path returns), the webview reducer's `SET_DATA` with `cache.stale===true` then `cache.stale===false` is order-dependent. The reducer handles both correctly (it keys off `cache.stale`), and there's a test for the failure-stays-stale case. So this is **defensible** but fragile: any future code that posts an extra `dashboardData` without a `cache` field between these two would be interpreted as `fresh` (stale defaults to `false`), prematurely clearing the stale indicator.
   - Why it matters: the two-message protocol is correct today but relies on an implicit invariant ("every dashboardData during a switch carries an explicit cache flag") that is not enforced at the type level (`cache?` is optional) and not documented at the post site.
   - Confidence: 0.55, Medium
   - Fix: Make `cache` required on `dashboardData` messages, or assert at the post sites in `selectScope` that both calls carry an explicit `cache`. Minor, but it future-proofs a load-bearing optional.

7. **`src/webview/utils/scopeLabels.ts` + `StoresAndWorksetsPanel.tsx` — `formatOpenSpecRootLabel` for a store with `storeId === undefined` falls back to `label`, which may be a generic/local-looking string, hiding the "Store:" distinction**
   - Problem: `scope.root.storeLabel` = `"Store: {id}"` where `id = scope.storeId ?? scope.label`. For a store scope whose `storeId` is missing (CLI version skew — the design lists "Store CLI shape can vary" as a risk), the label becomes `Store: <label>`, and `label` for store scopes is frequently the root path or a generic name. The empty-state copy then reads e.g. "No active changes in Store: /Users/…/plans", which is confusing and can leak a filesystem path into the UI. The panel also uses `store.rootPath` in a `title` and as visible text (line 74), so paths are already somewhat exposed, but baking it into the *label* used by empty states is worse because it's shown prominently.
   - Why it matters: degrades the exact "clarify which root you're in" goal of this change under the CLI-version-skew conditions the design itself flags. Not a crash, but it inverts the UX intent.
   - Confidence: 0.6, Medium
   - Fix: When `scope.source === 'store'` and `storeId` is missing, fall back to a stable placeholder like `t('scope.root.unknown')` (or a new `scope.root.storeUnknown`) rather than `label`, so the path isn't promoted into the visible root label.

### Low

8. **`src/webview/components/Dashboard.tsx` — `cacheActionMessage` is never auto-cleared; it persists until the next cache action**
   - Problem: `setCacheActionMessage` is set on `cacheActionResult` and cleared at the start of `handleCacheAction`, but there is no timeout or dismissal. After a successful "Copy Path", the "Cache path copied." status text stays in the rail indefinitely (it is rendered unconditionally when truthy, Dashboard→ScopeBar `cacheActionMessage`). This is a minor staleness/observability nit, not a correctness issue.
   - Confidence: 0.7, Low
   - Fix: Auto-clear `cacheActionMessage` after a few seconds via a `setTimeout` cleaned up on unmount, or clear it on scope switch.

9. **`src/webview/components/StoresAndWorksetsPanel.tsx` — `onCopyFetch` silently swallows clipboard failures and has no success feedback; clipboard may be unavailable**
   - Problem: The panel calls `onCopyFetch` (Dashboard wires it to `navigator.clipboard.writeText(text).catch(() => {})`). In some webview hosts `navigator.clipboard` is undefined or `writeText` rejects (permissions); the failure is swallowed and the user gets no indication the copy didn't happen. The extension-host `copyPath` cache action, by contrast, surfaces `showInformationMessage` on success. Inconsistent and silent on the one path most likely to actually fail (webview clipboard).
   - Confidence: 0.6, Low
   - Fix: Surface a fallback (e.g., post the text to the extension host which has reliable clipboard access, like the `copyPath` action does) or at least show an error inline on rejection.

---

## Things that are solid (do not block)

- `resolveScopeRoot` never throws on a minimal/stub DataManager (optional-chaining on `resolveScope`, fallback to `getWorkspaceRoot()`). Confirmed by a dedicated test (`'calls resolveScope with the data manager receiver intact'`).
- `isPathUnderRoot` correctly allows `rel === ''` (the root file itself) and rejects absolute/`..` relatives; switching the artifact/open path guards from `isPathUnderWorkspace(workspaceRoot)` to `isPathUnderRoot(rootPath)` is the right fix for opening store artifacts outside the workspace. The comment at handler line ~433 documents *why* the gate root changed.
- zh-cn locale parity is complete: 51 keys added to en, 0 missing in zh-cn (verified by JSON diff, not grep).
- `selectScope` failure path now posts an `error` instead of leaving the webview stuck loading (`postError`), and the reducer's `SET_ERROR` clears `pendingScopeId`/`activity`.
- `getCachedArtifactContent` / `writeArtifactContentCache` / `getCacheStats` all swallow internal errors and return `undefined`/empty, so a cache-service failure degrades rather than crashes the dashboard.

## Final check

Each finding above is tied to a concrete file/line, traceable to a real failure scenario (destructive click, root-switch race, stuck menu, version skew, silent clipboard failure), and actionable. The two findings I'd block on before merge are **#1** (destructive action lost its confirmation — clear data-loss/UX regression) and the **#2/#3** pair (archive cross-root staleness the design itself called out and the implementation deferred). #4 should be fixed in the same PR given the menu now hosts the destructive action.
