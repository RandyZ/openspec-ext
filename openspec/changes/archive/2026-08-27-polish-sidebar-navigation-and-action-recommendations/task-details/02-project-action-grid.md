# Task 2. Project action card grid

<!-- covers: Task 2.1, Task 2.2, Task 2.3 -->

## Objective

把 Project-first Sidebar 的四个入口改为稳定、可访问的 2×2 原生主题卡片；保留现有本地视图与 Dashboard Editor 行为。

### Task 2.1: Add RED Header tests for card hierarchy and accessible states

**Spec coverage:** `Project action launcher and local browsing` 的 `Render the four actions in a stable card grid`、`Browse Changes locally`、`Browse Specs locally`、`Open Workset mode locally`、`Worksets action is unavailable`、`Open Project Dashboard`、`Narrow Sidebar remains operable` 场景。
**Dependencies / order:** may start after Task 1.1; must be RED before Header implementation.
**Files:** Modify `test/webview/components/header.test.tsx`; exercise `src/webview/components/Header.tsx`.
**Implementation notes:** assert DOM order Changes, Specs, Worksets, Dashboard; four bounded card buttons; icons/titles/supporting text; `aria-pressed` only for local views; Dashboard Editor cue; full disabled Worksets reason; keyboard focusability. Assert Dashboard activation leaves the selected local view unchanged and disabled Worksets emits no navigation.
**Verification:** new semantic and behavior assertions fail against the current plain-button launcher.
**Risks / edge cases:** do not model the mixed launcher as an ARIA tablist; query by roles and accessible names rather than CSS class strings alone.
- [ ] Step 1: Add failing role/order/state assertions for available Worksets.
- [ ] Step 2: Add failing disabled-reason and no-op assertions for unavailable Worksets.
- [ ] Step 3: Run `rtk zsh -c 'source ~/.zshrc && pnpm exec vitest run test/webview/components/header.test.tsx'`; expect the new cases to FAIL.
- [ ] Step 4: Confirm existing Changes, Specs, Worksets, and Dashboard callbacks are still the test seams.

### Task 2.2: Implement the theme-native 2×2 Project action card grid

**Spec coverage:** all scenarios under `Project action launcher and local browsing` except Change/Spec detail, whose existing route remains unchanged.
**Dependencies / order:** after Task 2.1 RED.
**Files:** Modify `src/webview/components/Header.tsx`; use existing webview styles/Tailwind and installed `@vscode/codicons` already loaded by `src/webview/index.css`; test `test/webview/components/header.test.tsx`.
**Implementation notes:** render a fixed two-column grid in required order. Each card uses VS Code theme variables for border/background/foreground, a Codicon, bounded title and helper copy, hover and `focus-visible` states. Changes, Specs, and available Worksets use semantic buttons with `aria-pressed`; Dashboard uses an Editor/external-open cue and never reports local selection. Keep unavailable Worksets visible with real `disabled` and a complete accessible reason. Reuse current callbacks and selection state; New Change and Refresh stay outside the grid.
**Verification:** Task 2.1 becomes GREEN without new dependencies or Host messages.
**Risks / edge cases:** long translated labels must truncate or wrap within the card; two columns must not create horizontal scrolling at narrow Sidebar widths; disabled styling cannot rely only on opacity or color.
- [ ] Step 1: Replace the current four plain targets with the minimum shared card markup inside Header.
- [ ] Step 2: Wire existing callbacks and `aria-pressed` state without changing Host behavior.
- [ ] Step 3: Add only the CSS/Tailwind classes needed for two columns, theme states, bounds, and focus.
- [ ] Step 4: Re-run the Task 2.1 test; expect PASS.

### Task 2.3: Run Header and Project navigation focused tests to GREEN

**Spec coverage:** all `Project action launcher and local browsing` scenarios.
**Dependencies / order:** after Task 2.2; gate before acceptance.
**Files:** Test `test/webview/components/header.test.tsx` and `test/webview/components/dashboard.test.tsx`.
**Implementation notes:** verify that local view actions do not open Editors, Dashboard still calls the existing Editor path, and Worksets stays local/no-op according to availability. Do not introduce a new navigation component unless duplication remains after the minimal Header change.
**Verification:** focused tests exit 0.
**Risks / edge cases:** visual changes can accidentally turn Dashboard into a selected local tab or enable unavailable Worksets.
- [ ] Step 1: Run `rtk zsh -c 'source ~/.zshrc && pnpm exec vitest run test/webview/components/header.test.tsx test/webview/components/dashboard.test.tsx'`.
- [ ] Step 2: Trace any failure to the existing callback or selection contract.
- [ ] Step 3: Fix the smallest shared markup/state issue.
- [ ] Step 4: Re-run the same command; expect exit code 0.
