# Store-Aware Dashboard Claude Code Goal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` if available, or `superpowers:executing-plans` if subagents are unavailable. If Claude Code goal mode does not expose these skills, follow this document task-by-task and keep one implementation checkpoint per task group. Steps use checkbox syntax for tracking.

**Goal:** Implement OpenSpec extension support for the unreleased multi-project workflow: local OpenSpec source runtime mode, store-aware scope selection, read-only references, local workset entry points, and scope-safe workflow actions.

**Architecture:** Add two host-side foundations first: a richer OpenSpec runtime resolver and an explicit `OpenSpecScopeManager`. Then thread scope through CLI calls, filesystem content access, webview messages, dashboard UI, change detail panels, and workflow launch paths. Preserve the current single-root dashboard as the default when store-aware features are unavailable.

**Tech Stack:** VS Code extension host on Node.js, TypeScript, React 19 webview, Tailwind/Radix-flavored existing UI patterns, Vitest, OpenSpec CLI, Vite/esbuild, pnpm.

---

## Goal Mode Prompt

Paste or adapt this as the Claude Code goal:

```text
Implement the OpenSpec change `add-store-aware-dashboard` completely in /Users/randy/workspace/projects/github/openspec-ext.

Use the OpenSpec artifacts under openspec/changes/add-store-aware-dashboard as the source of truth. Build the feature with TDD, task group by task group:
1. Runtime source resolution
2. Feature probes and scope model
3. Scoped data and content access
4. Dashboard scope experience
5. Change detail and workflow scope binding
6. Documentation, localization, and verification

Do not implement non-goals from design.md. Do not remove existing single-root behavior. Do not commit or push unless Randy explicitly asks. Keep tasks.md and task-details checkboxes current as implementation progresses. The goal is complete only after focused tests, pnpm test, pnpm run build, and openspec validate add-store-aware-dashboard --strict pass, plus manual QA notes are recorded or clearly explained if manual QA cannot be run.
```

## Mandatory Startup

- [ ] Read project instructions:

```bash
rtk sed -n '1,260p' AGENTS.md
```

- [ ] Confirm the change is complete and valid before coding:

```bash
rtk zsh -c 'source ~/.zshrc && openspec status --change add-store-aware-dashboard'
rtk zsh -c 'source ~/.zshrc && openspec validate add-store-aware-dashboard --strict'
```

- [ ] Read these artifacts fully:

```bash
rtk sed -n '1,260p' openspec/changes/add-store-aware-dashboard/proposal.md
rtk sed -n '1,360p' openspec/changes/add-store-aware-dashboard/design.md
rtk sed -n '1,220p' openspec/changes/add-store-aware-dashboard/tasks.md
rtk sed -n '1,420p' openspec/changes/add-store-aware-dashboard/task-details/01-runtime-source-resolution.md
rtk sed -n '1,380p' openspec/changes/add-store-aware-dashboard/task-details/02-feature-probes-and-scope-model.md
rtk sed -n '1,300p' openspec/changes/add-store-aware-dashboard/task-details/03-scoped-data-and-content-access.md
rtk sed -n '1,420p' openspec/changes/add-store-aware-dashboard/task-details/04-dashboard-scope-experience.md
rtk sed -n '1,320p' openspec/changes/add-store-aware-dashboard/task-details/05-change-detail-and-workflow-scope-binding.md
rtk sed -n '1,260p' openspec/changes/add-store-aware-dashboard/task-details/06-docs-localization-and-verification.md
```

- [ ] Inspect current worktree before editing:

```bash
rtk git status --short
```

If there are unrelated user changes, do not revert them. Work around them or ask only if they block implementation.

## Source Of Truth

The following files are authoritative:

- `openspec/changes/add-store-aware-dashboard/proposal.md`: product scope, MVP, later work.
- `openspec/changes/add-store-aware-dashboard/design.md`: architecture decisions and message flow.
- `openspec/changes/add-store-aware-dashboard/specs/**/*.md`: requirements and scenarios.
- `openspec/changes/add-store-aware-dashboard/tasks.md`: implementation checklist.
- `openspec/changes/add-store-aware-dashboard/task-details/*.md`: TDD steps, exact target files, and example tests.

Do not invent additional feature areas unless they are required to satisfy the specs. In particular, do not implement store setup/register onboarding, rich workset editing, Git orchestration, cross-root sync, or OpenSpec core semantics changes.

## Working Rules

- Always run shell commands through `rtk`.
- When invoking OpenSpec or environment-dependent commands, use zsh and source the user's zsh config:

```bash
rtk zsh -c 'source ~/.zshrc && openspec validate add-store-aware-dashboard --strict'
```

- Use TDD for every task group:
  - Write the failing test from the matching `task-details/*.md`.
  - Run the focused test and confirm it fails for the expected reason.
  - Implement the smallest code path.
  - Run the focused test and confirm it passes.
  - Broaden to adjacent tests before moving on.

- Do not use ad hoc filesystem inference for store-aware OpenSpec data when CLI JSON exists.
- Keep existing installed CLI behavior working. Store-aware features are progressive enhancement.
- Keep references read-only. A referenced store becomes writable only when selected as an explicit active store scope.
- Include `scopeId` on high-impact webview actions and reject stale actions when the rendered scope no longer matches.
- Do not commit, push, or create PRs unless Randy explicitly requests it.

## File Responsibility Map

### Runtime And CLI

- `package.json`
  - Add settings: `openspec.cliMode`, `openspec.localOpenSpecSourcePath`, `openspec.localOpenSpecAutoBuild`.
  - Preserve existing `openspec.cliPath`.

- `src/extension/services/openspecCliResolver.ts`
  - Resolve installed, custom path, and local source runtime.
  - Return `command`, `argsPrefix`, `env`, `version`, `source`, `sourceLabel`, and diagnostics.
  - Local source mode must run `process.execPath` with `argsPrefix: [<source>/bin/openspec.js]`.
  - Local source mode must not silently fall back when invalid.

- `src/extension/services/openspecCli.ts`
  - Prepend `runtime.argsPrefix` for every CLI invocation.
  - Add `runJson(args)`.
  - Add scope options for root-resolving commands.

- `src/extension/services/cliActivationDiagnostic.ts`
  - Classify local source failures as a distinct recoverable diagnostic.

### Feature And Scope Model

- `src/extension/services/openspecFeatures.ts`
  - Probe store/context/doctor/workset support.
  - Probe failure must not break the base dashboard.

- `src/extension/services/openspecScope.ts`
  - Define `OpenSpecScope`, scope factories, scope manager, and relationship loading.
  - Manage selected scope and scope change listeners.
  - Load local root plus `openspec store list --json` options when supported.

- `src/extension/services/types.ts`
  - Add shared extension-host view models if the project keeps dashboard types there.

### Scoped Data And Content

- `src/extension/services/dataManager.ts`
  - Depend on `OpenSpecScopeManager`.
  - Cache dashboard data by selected scope or clear cache when scope changes.
  - Build scoped content access for each selected root.
  - Expose `selectScope`, `getSelectedScope`, `resolveScope`, `readArtifact`, `toggleTask`, and `openWorkset` with scope awareness.

- `src/extension/services/stateReader.ts`
  - Pass selected scope to CLI-backed reads.

- `src/extension/services/fileManager.ts`
  - Continue serving one OpenSpec directory, but allow callers to create instances for a selected root.

- `src/extension/services/contentAccess.ts`
  - Keep the content access contract root-parameterizable.

- `src/extension/utils/pathSafety.ts`
  - Add `isPathUnderRoot(candidatePath, rootPath)` based on normalized paths.

### Webview Messages And Providers

- `src/webview/types/messages.ts`
  - Add `OpenSpecScopeView`, relationships/workset view types, `selectScope`, `openWorkset`, and `scopeId` on artifact/workflow messages.

- `src/extension/providers/webviewMessageHandler.ts`
  - Handle `selectScope`.
  - Resolve supplied `scopeId` for artifact reads, editor opens, task toggles, and workflows.
  - Use selected root path for path safety checks.

- `src/extension/providers/dashboardViewProvider.ts`
  - Include scope data in dashboard messages.

- `src/extension/providers/changeDetailPanelManager.ts`
  - Bind each panel to the scope used when it was opened.

### Webview UI

- `src/webview/components/Dashboard.tsx`
  - Render `ScopeBar`, `ReferencesPanel`, and `WorksetsPanel`.
  - Pass scope selection and workset open handlers.
  - Keep primary changes/specs visible and operational.

- `src/webview/components/ScopeBar.tsx`
  - Compact runtime/scope/health display.
  - Scope selector only appears when there is more than one option.

- `src/webview/components/ReferencesPanel.tsx`
  - Read-only relationship view.
  - Allow copy fetch command.
  - Allow "Work in this store" only for registered references with a root.
  - Never render apply/verify/archive/continue controls.

- `src/webview/components/WorksetsPanel.tsx`
  - Label worksets as local personal views.
  - Open workset through extension host, not direct filesystem mutation.

- `src/webview/components/ChangeDetail.tsx`
  - Show scope badge for non-local scopes.
  - Include `scopeId` in artifact, task, and workflow messages.
  - Key artifact caches by scope.

### Workflow

- `src/extension/services/interactiveAgentTerminalManager.ts`
  - Use `scope.rootPath` as terminal cwd when a scope is provided.
  - Include store context in workflow payloads.

- `src/shared/workflowCommand.ts`
  - Carry optional `scopeLabel` and `storeId` metadata without breaking existing slash command behavior.

### Localization And Docs

- `src/i18n/locales/en.json`
- `src/i18n/locales/zh-cn.json`
  - Add strings for runtime source, scope, health, references, and worksets.

- `README.md`
- `README.zh-CN.md`
  - Document installed CLI versus local source mode.
  - Explain that local source mode is for unreleased store-aware OpenSpec features.

## Data Contracts To Keep Stable

Use these names unless existing code strongly suggests a better local convention.

```ts
export type OpenSpecRuntimeSource = 'installed' | 'customPath' | 'localSource';

export interface ResolvedOpenSpecRuntime {
  command: string;
  argsPrefix: string[];
  env: NodeJS.ProcessEnv;
  version: string;
  source: OpenSpecRuntimeSource;
  sourceLabel: string;
  diagnostics: string[];
}
```

```ts
export interface OpenSpecCapabilities {
  stores: boolean;
  context: boolean;
  doctor: boolean;
  worksets: boolean;
  diagnostics: {
    code: string;
    message: string;
    severity: 'info' | 'warning' | 'error';
  }[];
}
```

```ts
export type OpenSpecScopeSource = 'local' | 'store' | 'declared';

export interface OpenSpecScope {
  id: string;
  label: string;
  rootPath: string;
  source: OpenSpecScopeSource;
  storeId?: string;
  capabilities: OpenSpecCapabilities;
  diagnostics: {
    code: string;
    message: string;
    severity: 'info' | 'warning' | 'error';
  }[];
}
```

```ts
export interface OpenSpecScopeView {
  id: string;
  label: string;
  source: 'local' | 'store' | 'declared';
  rootPath: string;
  storeId?: string;
  runtimeSource: 'installed' | 'customPath' | 'localSource';
}
```

```ts
export interface DashboardData {
  scope?: OpenSpecScopeView;
  scopes?: OpenSpecScopeView[];
  relationships?: RelationshipPanelData;
  featureDiagnostics?: FeatureDiagnosticView[];
  changes: ChangeInfo[];
  specs: SpecInfo[];
  lastRefresh: number;
}
```

## Implementation Sequence

### Phase 1: Runtime Source Resolution

Source task file: `openspec/changes/add-store-aware-dashboard/task-details/01-runtime-source-resolution.md`

- [ ] Implement Task 1.1 settings and package configuration tests.
- [ ] Implement Task 1.2 resolver metadata and local source command shape.
- [ ] Implement Task 1.3 local source readiness diagnostics.
- [ ] Implement Task 1.4 CLI execution through `argsPrefix`.
- [ ] Run the phase tests:

```bash
rtk pnpm vitest run test/extension/packageConfiguration.test.ts test/extension/services/openspecCliResolver.test.ts test/extension/services/cliActivationDiagnostic.test.ts test/extension/services/openspecCli.test.ts
```

- [ ] Mark Task 1.1 through Task 1.4 complete in `openspec/changes/add-store-aware-dashboard/tasks.md` after tests pass.

Checkpoint expectations:

- Installed and auto modes still resolve the installed CLI as before.
- Custom path mode does not fall back when invalid.
- Local source mode validates the configured checkout and runs Node plus `bin/openspec.js`.
- No CLI command loses existing environment behavior.

### Phase 2: Feature Probes And Scope Model

Source task file: `openspec/changes/add-store-aware-dashboard/task-details/02-feature-probes-and-scope-model.md`

- [ ] Implement Task 2.1 store-aware feature probes.
- [ ] Implement Task 2.2 scope types and factory helpers.
- [ ] Implement Task 2.3 scope option loading, selection, and data cache invalidation.
- [ ] Implement Task 2.4 relationship loading from `context --json` and `doctor --json`.
- [ ] Run the phase tests:

```bash
rtk pnpm vitest run test/extension/services/openspecFeatures.test.ts test/extension/services/openspecScope.test.ts test/extension/services/openspecRelationships.test.ts test/extension/services/dataManager.test.ts
```

- [ ] Mark Task 2.1 through Task 2.4 complete after tests pass.

Checkpoint expectations:

- Store feature probe errors become feature diagnostics, not activation failures.
- Local root is always a valid default scope.
- Registered store scopes use stable ids such as `store:team-plans`.
- Scope switching clears stale dashboard data.

### Phase 3: Scoped Data And Content Access

Source task file: `openspec/changes/add-store-aware-dashboard/task-details/03-scoped-data-and-content-access.md`

- [ ] Implement Task 3.1 selected-scope CLI state reads.
- [ ] Implement Task 3.2 scoped content access for artifacts and specs.
- [ ] Implement Task 3.3 selected-root editor path safety.
- [ ] Implement Task 3.4 scoped task toggles and execution state.
- [ ] Run the phase tests:

```bash
rtk pnpm vitest run test/extension/services/openspecCli.test.ts test/extension/services/stateReader.test.ts test/extension/services/dataManager.test.ts test/extension/services/fileManager.test.ts test/extension/providers/webviewMessageHandler.test.ts test/extension/services/taskExecutorService.test.ts
```

- [ ] Mark Task 3.1 through Task 3.4 complete after tests pass.

Checkpoint expectations:

- Root-resolving CLI commands append `--store <id>` only for store scopes.
- Same change name in two roots cannot share artifact reads, task state, or cache entries.
- Opening a file outside the selected root is rejected.
- Store roots outside the VS Code workspace are allowed only when selected through scope.

### Phase 4: Dashboard Scope Experience

Source task file: `openspec/changes/add-store-aware-dashboard/task-details/04-dashboard-scope-experience.md`

- [ ] Implement Task 4.1 dashboard models with scope data.
- [ ] Implement Task 4.2 compact `ScopeBar`.
- [ ] Implement Task 4.3 `selectScope` message and scoped refresh.
- [ ] Implement Task 4.4 read-only `ReferencesPanel`.
- [ ] Implement Task 4.5 local personal `WorksetsPanel`.
- [ ] Run the phase tests:

```bash
rtk pnpm vitest run test/webview/components/dashboard.test.tsx test/webview/components/scopeBar.test.tsx test/webview/components/referencesPanel.test.tsx test/webview/components/worksetsPanel.test.tsx test/extension/providers/webviewMessageHandler.test.ts
```

- [ ] Mark Task 4.1 through Task 4.5 complete after tests pass.

Checkpoint expectations:

- Dashboard first screen remains operational, not a landing page.
- Scope controls are compact and use existing VS Code theme variables.
- References never show workflow write actions.
- Worksets are presented as local personal views, not shared project relationships.

### Phase 5: Change Detail And Workflow Scope Binding

Source task file: `openspec/changes/add-store-aware-dashboard/task-details/05-change-detail-and-workflow-scope-binding.md`

- [ ] Implement Task 5.1 scope-bound change detail panels.
- [ ] Implement Task 5.2 scope-aware artifact message and cache keys.
- [ ] Implement Task 5.3 scope-aware workflow and terminal actions.
- [ ] Implement Task 5.4 writable controls blocked for referenced stores.
- [ ] Run the phase tests:

```bash
rtk pnpm vitest run test/webview/components/changeDetailRouting.test.ts test/extension/providers/webviewMessageHandler.test.ts test/extension/services/interactiveAgentTerminalManager.test.ts test/shared/workflowCommand.test.ts test/webview/components/referencesPanel.test.tsx
```

- [ ] Mark Task 5.1 through Task 5.4 complete after tests pass.

Checkpoint expectations:

- Existing change detail panels remain bound to the scope they were opened with.
- Artifact cache keys include scope identity.
- Terminal workflows start from `scope.rootPath` for store scopes.
- Workflow launch payloads carry store context without breaking existing slash commands.

### Phase 6: Documentation, Localization, And Verification

Source task file: `openspec/changes/add-store-aware-dashboard/task-details/06-docs-localization-and-verification.md`

- [ ] Implement Task 6.1 English and Simplified Chinese strings.
- [ ] Implement Task 6.2 README docs for installed CLI versus local source mode.
- [ ] Implement Task 6.3 verification commands.
- [ ] Implement Task 6.4 manual verification notes.
- [ ] Run the phase tests:

```bash
rtk pnpm vitest run test/i18n/i18n.test.ts test/extension/packageConfiguration.test.ts
```

- [ ] Mark Task 6.1 through Task 6.4 complete after tests and verification pass.

Checkpoint expectations:

- All new user-facing strings use `t('key')` or the project's existing localization pattern.
- README docs mention `openspec.cliMode=localSource` and `openspec.localOpenSpecSourcePath`.
- Manual verification notes are saved to `openspec/changes/add-store-aware-dashboard/verification.md` if manual checks are run.

## Required Final Verification

Run focused tests from Task 6.3:

```bash
rtk pnpm vitest run \
  test/extension/packageConfiguration.test.ts \
  test/extension/services/openspecCliResolver.test.ts \
  test/extension/services/openspecCli.test.ts \
  test/extension/services/openspecFeatures.test.ts \
  test/extension/services/openspecScope.test.ts \
  test/extension/services/openspecRelationships.test.ts \
  test/extension/services/dataManager.test.ts \
  test/extension/services/fileManager.test.ts \
  test/extension/providers/webviewMessageHandler.test.ts \
  test/webview/components/dashboard.test.tsx \
  test/webview/components/scopeBar.test.tsx \
  test/webview/components/referencesPanel.test.tsx \
  test/webview/components/worksetsPanel.test.tsx \
  test/webview/components/changeDetailRouting.test.ts \
  test/extension/services/interactiveAgentTerminalManager.test.ts \
  test/shared/workflowCommand.test.ts \
  test/i18n/i18n.test.ts
```

Run the full suite:

```bash
rtk pnpm test
```

Run build:

```bash
rtk pnpm run build
```

Validate OpenSpec:

```bash
rtk zsh -c 'source ~/.zshrc && openspec validate add-store-aware-dashboard --strict'
```

Check planning status:

```bash
rtk zsh -c 'source ~/.zshrc && openspec status --change add-store-aware-dashboard'
```

Inspect final diff:

```bash
rtk git status --short
rtk git diff --stat
```

## Manual QA Checklist

If VS Code Extension Development Host can be launched in the environment, verify these scenarios:

- [ ] Default or installed CLI mode:
  - Dashboard loads the current repository's local root.
  - Scope Bar shows Local Root and installed or auto runtime.
  - Store controls are hidden or disabled when the installed CLI lacks store support.

- [ ] Local source mode:
  - Set:

```json
{
  "openspec.cliMode": "localSource",
  "openspec.localOpenSpecSourcePath": "/Users/randy/workspace/projects/github/OpenSpec"
}
```

  - Build local OpenSpec source first:

```bash
rtk zsh -c 'source ~/.zshrc && cd /Users/randy/workspace/projects/github/OpenSpec && pnpm run build'
```

  - Reload Extension Development Host.
  - Scope Bar shows Local Source.
  - Feature probes enable store-aware controls when local OpenSpec supports them.
  - CLI activation diagnostic card is not shown.

- [ ] Store scope switching:
  - Select a registered store in Scope Bar.
  - Changes and specs refresh for that store.
  - Artifact open uses the selected store root.
  - Returning to Local Root restores this repository's dashboard.

- [ ] References and worksets:
  - References panel shows upstream stores as read-only.
  - Copy fetch command works.
  - Unresolved references show fix text.
  - Worksets are labeled as local personal views.
  - Opening a workset delegates through OpenSpec without writing into referenced folders.

If manual QA cannot be run, write the reason in the final response and keep `verification.md` absent unless actual manual evidence was collected.

## Definition Of Done

- [ ] All Task 1 through Task 6 checkboxes are complete in `openspec/changes/add-store-aware-dashboard/tasks.md`.
- [ ] Any completed detailed step checkboxes are updated in `openspec/changes/add-store-aware-dashboard/task-details/*.md`.
- [ ] All focused tests listed above pass.
- [ ] `rtk pnpm test` passes.
- [ ] `rtk pnpm run build` passes.
- [ ] `rtk zsh -c 'source ~/.zshrc && openspec validate add-store-aware-dashboard --strict'` passes.
- [ ] Manual QA is completed, or the final response clearly states why it was not possible.
- [ ] No unrelated user changes were reverted.
- [ ] Final response summarizes changed files, verification evidence, and any residual risk.

## Common Failure Modes

- Local source mode accidentally falls back to installed CLI. This is incorrect. It must fail with local-source diagnostics.
- Store feature probe failure blocks the whole dashboard. This is incorrect. It should produce feature diagnostics and preserve base dashboard behavior.
- Artifact caches ignore scope. This causes same-name changes in different roots to show wrong content.
- Editor path safety checks use only workspace root. Store roots may live outside the workspace, so checks must use selected scope root.
- References expose Apply, Verify, Archive, Continue, or task toggles. References are read-only.
- Worksets are treated as shared store relationships. Worksets are local personal convenience views.
- Workflow terminal cwd remains the VS Code workspace for store-scoped actions. It must use the active store root.

## Final Response Template

Use this shape when reporting completion:

```text
已完成 add-store-aware-dashboard 的实现。

主要变化：
- 新增本地 OpenSpec 源码运行时、scope 管理、store-aware CLI 调用、Dashboard Scope Bar、References/Worksets 面板、scope-bound Change Detail 和 workflow action。

验证：
- rtk pnpm vitest run <focused test list from Required Final Verification> 通过
- rtk pnpm test 通过
- rtk pnpm run build 通过
- rtk zsh -c 'source ~/.zshrc && openspec validate add-store-aware-dashboard --strict' 通过

手工验证：
- 已验证默认 CLI 模式、本地源码模式、store 切换、references 只读语义和 workset 打开入口；或者说明无法运行 Extension Development Host 的具体原因。

剩余风险：
- 说明未能覆盖的环境限制、未发布 OpenSpec CLI 行为变化风险，或写明没有已知剩余风险。
```
