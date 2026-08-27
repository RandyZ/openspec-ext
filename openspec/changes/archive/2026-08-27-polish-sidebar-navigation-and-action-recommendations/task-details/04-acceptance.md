# Task 4. Localization and release acceptance

<!-- covers: Task 4.1, Task 4.2, Task 4.3, Task 4.4 -->

## Objective

补齐中英文文案，并用自动化、真实 VS Code Extension Development Host 和独立审查证明窄侧栏交互可发布。

### Task 4.1: Add paired English and Chinese copy with locale parity tests

**Spec coverage:** supporting text, unavailable reason, status/reason labels, CTA labels, accessible names, and Editor cue required by both modified requirements.
**Dependencies / order:** after visible labels in Tasks 2-3 are known.
**Files:** Modify `src/i18n/locales/en.json`, `src/i18n/locales/zh-cn.json`; test `test/i18n/i18n.test.ts`, `test/webview/components/header.test.tsx`, `test/webview/components/dashboard.test.tsx`.
**Implementation notes:** add identical keys in both locales for card supporting text, Worksets unavailability, Dashboard Editor cue, priority reasons, and action accessibility. Components must call `t()`; do not embed English fallbacks.
**Verification:** locale parity and component accessible-name tests pass in English and Chinese.
**Risks / edge cases:** translated helper text must remain concise enough for narrow cards; the full Worksets disabled reason remains available to accessibility APIs even if visible text is truncated.
- [ ] Step 1: Add failing locale parity and translated accessible-name assertions.
- [ ] Step 2: Run `rtk zsh -c 'source ~/.zshrc && pnpm exec vitest run test/i18n/i18n.test.ts test/webview/components/header.test.tsx test/webview/components/dashboard.test.tsx'`; expect missing-key/text failures.
- [ ] Step 3: Add paired locale entries and replace any hard-coded UI string with `t()`.
- [ ] Step 4: Re-run the same command; expect PASS.

### Task 4.2: Run full tests, lint, build, strict validation, task-details validation, and diff checks

**Spec coverage:** compile and regression coverage for all scenarios in the two delta specs.
**Dependencies / order:** after all code and locale changes; before GUI acceptance.
**Files:** verification only, except minimal fixes for failures caused by this Change.
**Implementation notes:** run fresh gates from the worker worktree and distinguish existing warnings from errors. Do not mark completion from focused tests alone.
**Verification:** full Vitest, ESLint, build, strict OpenSpec validation, task-details validator, and diff check all exit 0; lint warnings are reported separately.
**Risks / edge cases:** generated `dist/`, ignored schema bundles, and lockfiles must not be committed accidentally.
- [ ] Step 1: Run `rtk zsh -c 'source ~/.zshrc && pnpm test'`, then fix only Change-caused failures and re-run to exit 0.
- [ ] Step 2: Run `rtk zsh -c 'source ~/.zshrc && pnpm exec eslint src/'` and `rtk zsh -c 'source ~/.zshrc && pnpm run build'`; require zero lint errors and a successful build.
- [ ] Step 3: Run `rtk openspec validate polish-sidebar-navigation-and-action-recommendations --strict --json` and `rtk node /Users/randy/.codex/plugins/cache/aihelp-dev/aihelp-agent-plugin/0.1.7/skills/aihelp-writing-task/scripts/validate-task-details.mjs --change-dir /Users/randy/workspace/projects/github/openspec-ext/openspec/changes/polish-sidebar-navigation-and-action-recommendations --json`.
- [ ] Step 4: Run `rtk git diff --check`; expect no output and exit code 0.

### Task 4.3: Verify the narrow dark-theme Sidebar and keyboard flow in a real Extension Development Host

**Spec coverage:** `Narrow Sidebar remains operable` and the rendered/activation scenarios from both delta requirements.
**Dependencies / order:** after Task 4.2 build succeeds.
**Files:** manual verification in one isolated VS Code Extension Development Host; no fixture or product write unless a real defect is found.
**Implementation notes:** verify identity before every screenshot/action: App is Visual Studio Code and title contains `[Extension Development Host]` plus the expected fixture/workspace. Use a real Project binding. At narrow width and dark theme, verify the 2×2 grid order, no horizontal overflow, local Changes/Specs selection, Worksets available or truthful safe-disabled state, Dashboard Editor cue/open, max-three action rail, correct CTA routes, keyboard Tab/Enter/Space, focus visibility, long-label bounds, and English/Chinese labels where practical. Do not fabricate Store/Workset membership; record positive Worksets smoke as conditional when no trusted fixture exists.
**Verification:** persist screenshots plus an AX/text matrix for applicable cases; extension logs show no OpenSpec UI errors. A screenshot from DingTalk, a normal Code window, or the wrong Host is invalid evidence.
**Risks / edge cases:** VS Code platform warnings are not extension failures; a wrong-window capture must be discarded immediately rather than rationalized.
- [ ] Step 1: Start one isolated Extension Development Host with the built worker checkout and verify App/title/workspace identity.
- [ ] Step 2: Execute the narrow dark-theme visual and keyboard matrix, capturing identity-backed evidence.
- [ ] Step 3: If a product defect appears, add a RED regression, apply the smallest fix, re-run affected/full gates, rebuild, and repeat only the failed GUI cases.
- [ ] Step 4: Close the Host, remove only its exact temporary profile/fixture, and confirm no matching process/listener remains.

### Task 4.4: Complete final code review and resolve every blocking finding

**Spec coverage:** all scenarios and design constraints, especially binding safety, resolver reuse, and no new protocol/cache/dependency.
**Dependencies / order:** final task after automated and GUI evidence.
**Files:** read-only review of the complete Change diff; source/test changes only when a concrete finding is fixed.
**Implementation notes:** delegate the final OpenSpec code review. Review for P0-P3 regressions, duplicate policy, stale/cross-binding action leakage, direct high-impact execution, inaccessible states, unbounded layout, and accidental scope additions. Every blocking finding requires RED-to-GREEN repair and fresh affected/full gates.
**Verification:** reviewer returns approval with no unresolved P0/P1; all required fixes are committed; worker tree is clean.
**Risks / edge cases:** do not mark 14/14, commit, or report completion before review findings and fresh validation are resolved.
- [ ] Step 1: Request final read-only review of planning-to-diff alignment and the complete implementation.
- [ ] Step 2: For each blocking finding, add a failing regression test and confirm RED.
- [ ] Step 3: Apply the minimum root-cause fix and confirm focused then full GREEN.
- [ ] Step 4: Re-run OpenSpec/list/status/instructions, strict validation, task-details validator, diff check, and confirm a clean committed branch.
