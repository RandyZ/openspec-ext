# Dashboard Responsiveness and Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve the OpenSpec Dashboard sidebar so it reuses cached data, auto-updates after OpenSpec changes, supports local search and Proposal Why summaries, and uses fast webview task confirmation.

**Architecture:** Keep the current Extension Host/Webview split. `DataManager.refresh()` remains the single data refresh entry point, but refresh events carry `DashboardData` to `DashboardViewProvider`, which pushes `dashboardData` to the sidebar webview. Proposal summary extraction happens in Extension Host, while search and task confirmation are local React interactions.

**Tech Stack:** TypeScript, React 19, VS Code Webview API, Vitest, pnpm.

---

## File Structure

- Modify `src/extension/services/types.ts`: add optional `ChangeInfo` summary/search fields.
- Modify `src/webview/types/messages.ts`: mirror the `ChangeInfo` fields for webview messages.
- Modify `src/extension/services/dataManager.ts`: carry refresh data through callbacks, enrich changes with Proposal Why summaries, and keep `getDashboardData()` cache-first.
- Modify `src/extension/providers/dashboardViewProvider.ts`: subscribe to refresh events and push `dashboardData` to the active sidebar webview.
- Modify `src/extension/providers/webviewMessageHandler.ts`: remove VS Code modal confirmation from `toggleTask`; keep archive/read-only and write/refresh behavior.
- Modify `src/webview/components/ChangesSection.tsx`: add search input and local filtering before grouping.
- Modify `src/webview/components/ChangeCard.tsx`: render Proposal Why summary and full-text tooltip.
- Modify `src/webview/components/ChangeDetail.tsx`: own pending task confirmation state and render `ConfirmDialog`.
- Modify `src/webview/components/TaskList.tsx`: pass clicked task metadata to confirmation instead of directly toggling.
- Modify locale files under `src/i18n/locales/`: add search, no-results, summary, and confirmation labels.
- Add/update focused Vitest coverage for data enrichment, search filtering, and task confirmation behavior.

## Task 1: Dashboard refresh push channel

**Files:**
- Modify: `src/extension/services/dataManager.ts`
- Modify: `src/extension/providers/dashboardViewProvider.ts`
- Test: existing DataManager/dashboard provider tests or add focused tests under `src/**/__tests__` following current conventions.

- [ ] **Step 1: Write failing tests for refresh callback data**

Add a test that registers `dataManager.onRefresh((data) => seen = data)`, stubs change/spec loading, calls `refresh()`, and expects the callback to receive the same `DashboardData` object with `changes`, `specs`, and `lastRefresh`.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `pnpm test -- --runInBand`
Expected: the new test fails because `onRefresh` does not currently pass `DashboardData`.

- [ ] **Step 3: Implement refresh data callbacks**

Change `refreshCallbacks` from `Set<() => void>` to `Set<(data: DashboardData) => void>`, update `onRefresh`, and call `notifyRefresh(data)` after `cachedData` is assigned.

- [ ] **Step 4: Wire sidebar push**

In `DashboardViewProvider`, store the disposable returned by `dataManager.onRefresh`. When `_view` exists, call `_view.webview.postMessage({ type: 'dashboardData', data, debug })`. Dispose the subscription when the provider is disposed through extension subscriptions or provider lifecycle.

- [ ] **Step 5: Verify GREEN**

Run: `pnpm test -- --runInBand`
Expected: refresh callback tests pass and existing tests remain green.

## Task 2: Proposal Why summary enrichment

**Files:**
- Modify: `src/extension/services/types.ts`
- Modify: `src/webview/types/messages.ts`
- Modify: `src/extension/services/dataManager.ts`
- Test: add focused tests for summary extraction.

- [ ] **Step 1: Write failing tests for Why extraction**

Cover:
- `## Why` followed by another `##` extracts only the Why section.
- Markdown markers and extra whitespace are normalized.
- Long text is truncated to 150 characters plus `...`.
- Missing proposal or missing Why returns empty strings without throwing.

- [ ] **Step 2: Run extraction tests and verify RED**

Run: `pnpm test -- --runInBand`
Expected: tests fail because no extractor/enrichment exists.

- [ ] **Step 3: Add optional fields and extractor**

Add `proposalWhySummary?: string`, `proposalWhyFullText?: string`, and `searchText?: string` to both `ChangeInfo` definitions. Implement a small pure helper near `DataManager` or in a focused utility module that extracts and truncates Why text.

- [ ] **Step 4: Enrich changes during refresh**

After `stateReader.listChanges()`, enrich active changes by reading `proposal.md` via `contentAccess.readArtifact(change.name, 'proposal')`. Catch per-change read failures and keep refresh successful.

- [ ] **Step 5: Verify GREEN**

Run: `pnpm test -- --runInBand`
Expected: summary extraction/enrichment tests pass.

## Task 3: Sidebar search and card summary UI

**Files:**
- Modify: `src/webview/components/ChangesSection.tsx`
- Modify: `src/webview/components/ChangeCard.tsx`
- Modify: `src/i18n/locales/en.json`
- Modify: `src/i18n/locales/zh-cn.json`
- Test: component tests for filtering/card rendering if existing setup supports React component tests; otherwise add pure filter helper tests.

- [ ] **Step 1: Write failing tests for filtering**

Create a pure `filterChanges` helper or equivalent testable function. Assert it matches by change name, status, artifact id, summary text, and full Why text; assert empty query returns all changes.

- [ ] **Step 2: Run UI/filter tests and verify RED**

Run: `pnpm test -- --runInBand`
Expected: tests fail because the helper/UI does not exist.

- [ ] **Step 3: Implement local search**

Add a VS Code themed search input above grouped changes. Use memoized filtering and show filtered counts. Display an empty-match state when the original list is non-empty but no filtered changes match.

- [ ] **Step 4: Render Proposal Why summary**

In `ChangeCard`, render `proposalWhySummary` below the title when present. Set `title` or an accessible tooltip to `proposalWhyFullText` so hover exposes the complete Why text.

- [ ] **Step 5: Verify GREEN**

Run: `pnpm test -- --runInBand`
Expected: filtering/card tests pass.

## Task 4: Webview task confirmation

**Files:**
- Modify: `src/webview/components/TaskList.tsx`
- Modify: `src/webview/components/ChangeDetail.tsx`
- Modify: `src/webview/components/ui/ConfirmDialog.tsx` if needed for accessibility only.
- Modify: `src/extension/providers/webviewMessageHandler.ts`
- Modify: locale files under `src/i18n/locales/`
- Test: task toggle confirmation tests and message handler tests.

- [ ] **Step 1: Write failing tests for confirm-before-toggle**

Assert clicking a task checkbox opens confirmation state/dialog and does not call `postMessage(toggleTask)` until confirm is clicked. Assert cancel closes the dialog and does not send `toggleTask`.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `pnpm test -- --runInBand`
Expected: tests fail because checkbox currently sends `toggleTask` immediately.

- [ ] **Step 3: Move confirmation into webview**

Change `TaskList` to pass the selected task object/index upward. Add `pendingTaskToggle` state in `ChangeDetail`, render `ConfirmDialog`, and send `toggleTask` only from confirm.

- [ ] **Step 4: Remove host modal for task toggle**

Remove `vscode.window.showWarningMessage` confirmation from the `toggleTask` message handler. Keep archive read-only handling, file write, refresh, `dashboardData`, and `artifactContent` response.

- [ ] **Step 5: Verify GREEN**

Run: `pnpm test -- --runInBand`
Expected: confirmation tests and existing task tests pass.

## Task 5: End-to-end verification

**Files:**
- No production files unless defects are found.

- [ ] **Step 1: Build the extension and webview**

Run: `pnpm run build`
Expected: extension and webview bundles build successfully.

- [ ] **Step 2: Run full unit tests**

Run: `pnpm test`
Expected: all test files pass.

- [ ] **Step 3: Run VS Code Extension Development Host manual test**

Launch: `code --no-sandbox --user-data-dir=/tmp/vscode-openspec-dev --extensionDevelopmentPath=/workspace /workspace`
Verify:
- Sidebar opens without extra wait when cached data exists.
- Editing a change artifact or toggling a task refreshes the sidebar without manual reload.
- Search filters change cards by name and Proposal Why text.
- Change card shows a 150-character Why summary and hover shows full Why.
- Task checkbox opens a fast webview confirmation; cancel does not write; confirm writes and refreshes.

- [ ] **Step 4: Capture walkthrough artifact**

Record a short video showing search, summary hover, auto-refresh, and task confirmation.

## Self-Review Notes

- Spec coverage maps to the three delta specs: dashboard search/summary/auto-refresh, cli-integration cache/shared refresh, task-management confirm-before-write.
- No external dependencies are required.
- Implementation is split so data contract changes happen before UI features that consume them.
