# Resolve CLI Path From Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make OpenSpec CLI discovery work when Cursor/VS Code is launched from the GUI and the Extension Host PATH cannot see the user's terminal-installed `openspec`.

**Architecture:** Add a focused CLI resolver in the Extension Host. `OpenSpecCliService` asks the resolver for a validated executable path, then uses that path for every CLI spawn while preserving the existing CLI Gateway boundary and no file-state fallback rule.

**Tech Stack:** TypeScript, VS Code extension API, Node.js `child_process.spawn`, Vitest.

---

## File Structure

- Create `src/extension/services/openspecCliResolver.ts`: Resolve and validate the OpenSpec executable path using config, current PATH, login shell, and known path candidates.
- Modify `src/extension/services/openspecCli.ts`: Use the resolver instead of hard-coded `spawn('openspec')`; surface diagnostics from resolution failures.
- Modify `package.json`: Add `openspec.cliPath` configuration.
- Modify `src/i18n/locales/en.json` and `src/i18n/locales/zh-cn.json`: Add setting and diagnostic strings.
- Test `src/extension/services/openspecCliResolver.test.ts`: Cover resolver precedence, shell fallback, known path fallback, cache invalidation, and failure diagnostics.

## Task 1: Resolver foundation

**Files:**
- Create: `src/extension/services/openspecCliResolver.ts`
- Test: `src/extension/services/openspecCliResolver.test.ts`

- [ ] **Step 1: Write failing tests for config-first resolution**

Create tests where `openspec.cliPath` is set to `/custom/bin/openspec`; the resolver must validate that path with `--version`, return it, and not attempt PATH or shell lookup.

- [ ] **Step 2: Write failing tests for Extension Host PATH resolution**

Create tests where config is empty and direct `openspec --version` succeeds; the resolver must return command `openspec` and skip shell fallback.

- [ ] **Step 3: Implement minimal resolver API**

Add `OpenSpecCliResolver.resolve()` returning `{ command: string; version: string }`, with config and direct PATH support only.

- [ ] **Step 4: Run resolver tests and refactor**

Run `pnpm test -- src/extension/services/openspecCliResolver.test.ts`; keep helper names and injected spawn function small enough to test without real shell calls.

## Task 2: Shell and known-path fallback

**Files:**
- Modify: `src/extension/services/openspecCliResolver.ts`
- Test: `src/extension/services/openspecCliResolver.test.ts`

- [ ] **Step 1: Write failing tests for login shell fallback**

Simulate direct `openspec` ENOENT, shell `command -v openspec` returning `/opt/homebrew/bin/openspec`, and `--version` succeeding for that resolved path.

- [ ] **Step 2: Write failing tests for shell failure continuing to known paths**

Simulate shell timeout/error/empty output and a known candidate path succeeding.

- [ ] **Step 3: Implement shell fallback safely**

Run only fixed command `command -v openspec` through a safe shell path, apply a short timeout, parse one stdout line, and validate the resulting path with `--version`.

- [ ] **Step 4: Implement known path candidates**

Try `/opt/homebrew/bin/openspec`, `/usr/local/bin/openspec`, and `/usr/bin/openspec` after shell fallback fails; validate each with `--version`.

## Task 3: Wire resolver into OpenSpecCliService

**Files:**
- Modify: `src/extension/services/openspecCli.ts`
- Test: existing CLI service tests or new focused tests if no coverage exists.

- [ ] **Step 1: Write failing service test for spawn ENOENT recovery**

Simulate initial direct spawn failure but resolver finding an absolute path; `checkAvailability()` must return true.

- [ ] **Step 2: Replace hard-coded command**

Change `execOpenSpecOnce()` so it gets the resolved command path before spawning CLI commands.

- [ ] **Step 3: Cache successful resolution**

Reuse the validated path for subsequent commands in the same extension session; clear and retry resolution once if a cached absolute path later returns ENOENT.

- [ ] **Step 4: Preserve existing retry semantics**

Keep command failure retry behavior for non-resolution failures, but avoid three slow retries for plain command-not-found before resolver fallback runs.

## Task 4: Configuration and diagnostics

**Files:**
- Modify: `package.json`
- Modify: `src/i18n/locales/en.json`
- Modify: `src/i18n/locales/zh-cn.json`
- Modify: `src/extension/services/openspecCli.ts`
- Modify: `src/extension/services/openspecCliResolver.ts`

- [ ] **Step 1: Add `openspec.cliPath` setting**

Add a string configuration with default `""` and description explaining that empty value auto-detects from PATH and login shell.

- [ ] **Step 2: Write failing tests for diagnostics**

Failure diagnostics must include whether `openspec.cliPath` was set, current PATH, current SHELL, attempted fallback paths, and shell fallback errors/timeouts.

- [ ] **Step 3: Improve CLI not found notification**

Keep install documentation action and add an action to open settings for `openspec.cliPath`; write detailed diagnostics to the OpenSpec output log, not the user-facing toast.

- [ ] **Step 4: Update localization**

Add English and Simplified Chinese strings for CLI path setting, invalid configured path, shell fallback diagnostics, and open settings action.

## Task 5: Verification

**Files:**
- Modify as needed based on tests.

- [ ] **Step 1: Run resolver and CLI service tests**

Run `pnpm test -- src/extension/services/openspecCliResolver.test.ts` and any updated CLI service test file.

- [ ] **Step 2: Run full automated checks**

Run `pnpm test` and `pnpm run build`.

- [ ] **Step 3: Manual Extension Development Host verification**

Launch the extension with a constrained PATH that hides `openspec`, confirm shell fallback resolves it, and then confirm setting `openspec.cliPath` overrides auto-detection.

- [ ] **Step 4: Record evidence**

Capture logs or a short walkthrough showing activation succeeds in the constrained PATH scenario and diagnostics are clear when all resolution methods fail.
