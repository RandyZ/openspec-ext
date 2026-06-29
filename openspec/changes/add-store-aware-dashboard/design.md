## Context

See `explore.md` for the product direction and selected approach. This design covers how to implement the new runtime and scope model inside the existing VS Code extension architecture.

Current state:

- `OpenSpecCliResolver` resolves one executable command.
- `OpenSpecCliService` appends command arguments directly to that executable.
- `DataManager` owns one `workspaceRoot` and constructs one `FileManagerService` rooted at `workspaceRoot/openspec`.
- Webview messages such as `getDashboardData`, `openArtifact`, `toggleTask`, and `openSpecInEditor` do not carry scope identity.
- Dashboard UI renders one root's changes/specs and exposes workflow buttons for that implicit root.

Target state:

```text
Runtime resolution
  chooses installed/custom/local-source OpenSpec command

Scope resolution
  chooses local root/store/declared store as active writable root

Data access
  runs CLI and content reads against active scope

Webview
  shows active scope and sends scope-bound user intents
```

## Goals / Non-Goals

**Goals:**

- Add local OpenSpec source runtime mode for unreleased CLI features.
- Add feature detection for store/context/doctor/workset support.
- Add selected root scope state and make dashboard data/actions scope-aware.
- Preserve existing single-root behavior by default.
- Add compact product UI for active runtime, active scope, health, references, and worksets.
- Keep references read-only unless explicitly selected as the active store scope.
- Provide a TDD path for resolver, scope, command args, content access, and webview state.

**Non-Goals:**

- Implement store setup/register onboarding UI in this change.
- Implement rich workset create/edit/remove UI in this change.
- Implement Git clone/pull/push/sync orchestration.
- Implement cross-root apply/verify/archive coordination.
- Replace OpenSpec CLI JSON with filesystem inference for store-aware data.
- Change OpenSpec core semantics.

## Decisions

### Decision 1: Introduce `ResolvedOpenSpecRuntime`

Replace the resolver's implicit "one command" model with a richer runtime shape:

```ts
type OpenSpecRuntimeSource = 'installed' | 'customPath' | 'localSource';

interface ResolvedOpenSpecRuntime {
  command: string;
  argsPrefix: string[];
  env: NodeJS.ProcessEnv;
  version: string;
  source: OpenSpecRuntimeSource;
  sourceLabel: string;
  diagnostics: string[];
}
```

Local source mode should produce:

```text
command: process.execPath
argsPrefix: ["/path/to/OpenSpec/bin/openspec.js"]
```

Then `OpenSpecCliService.execOpenSpecOnce(args)` spawns:

```text
runtime.command [...runtime.argsPrefix, ...args]
```

Alternatives considered:

- Use `openspec.cliPath` directly for local source. Rejected because source checkout readiness, build output, source labels, and feature support are product state, not merely executable path state.
- Shell out through `pnpm dev:cli`. Rejected because it introduces package-manager coupling, slower startup, and harder process/timeout control.

### Decision 2: Add explicit runtime settings without removing `cliPath`

New settings:

```json
{
  "openspec.cliMode": "auto",
  "openspec.localOpenSpecSourcePath": "",
  "openspec.localOpenSpecAutoBuild": "off"
}
```

Allowed `cliMode` values:

- `auto`: existing resolution behavior, with custom path honored if set.
- `installed`: installed CLI only; ignores local source settings.
- `customPath`: validates and uses `openspec.cliPath` only.
- `localSource`: validates and uses `openspec.localOpenSpecSourcePath` only.

`localOpenSpecAutoBuild` should default to `off` for MVP. `prompt` can be implemented as a guided recovery action if build output is missing, but no build runs silently.

### Decision 3: Split CLI activation diagnostics from feature diagnostics

Runtime failure means the extension cannot run OpenSpec and should use existing CLI activation diagnostic surfaces.

Feature probe failure means the resolved runtime works, but store-aware features are unavailable or unhealthy. It should not blank the base dashboard.

```text
CLI activation diagnostic
  blocks dashboard when no cached data exists

Feature diagnostic
  keeps current dashboard, hides store controls, explains why
```

This prevents a stable installed CLI from looking "broken" simply because it has not shipped store commands yet.

### Decision 4: Add `OpenSpecScope` and `OpenSpecScopeManager`

Introduce scope state in the extension host:

```ts
type OpenSpecScopeSource = 'local' | 'store' | 'declared';

interface OpenSpecScope {
  id: string;
  label: string;
  rootPath: string;
  source: OpenSpecScopeSource;
  storeId?: string;
  runtimeSource: OpenSpecRuntimeSource;
  capabilities: OpenSpecCapabilities;
  health?: RelationshipHealthView;
  diagnostics: ScopeDiagnostic[];
}
```

The manager owns:

- Current selected scope.
- Available scope options from local root plus `openspec store list --json`.
- Feature support from probes.
- Scope switching and cache invalidation events.
- Relationship data from `openspec context --json` and `openspec doctor --json`.

DataManager should depend on this manager rather than independently deciding roots.

### Decision 5: Make CLI commands scope-aware at the service boundary

Add a scope option to root-resolving CLI operations:

```ts
interface CommandScopeOptions {
  scope?: OpenSpecScope;
}
```

The service appends `--store <id>` only when `scope.storeId` is present and the command is root-resolving.

```text
list/status/show/validate/instructions/new/archive/doctor/context
  scope-aware

schemas/templates/static config helpers
  not automatically scope-aware unless OpenSpec documents support
```

This centralizes `--store` handling and keeps UI code from manually string-building CLI flags.

### Decision 6: Parameterize content access by root path

`FileManagerService` should accept an OpenSpec root path or project root path consistently. The cleanest shape is:

```ts
interface OpenSpecContentRoot {
  projectRoot: string;
  openspecDir: string;
  scopeId: string;
}
```

`DataManager` can create a scoped content access instance per selected root or make `ContentAccess` methods accept root context. Prefer a small scoped factory:

```text
DataManager
  getScopedServices(scope)
    -> StateReader(cliService, contentAccessFor(scope))
    -> FileManagerService(scope.rootPath/openspec)
```

This keeps existing `FileManagerService` behavior mostly intact while preventing same-name changes across roots from sharing reads or state.

### Decision 7: Include scope identity in webview data and messages

Dashboard data should include a scope snapshot:

```ts
interface DashboardData {
  scope: OpenSpecScopeView;
  scopes: OpenSpecScopeOptionView[];
  relationships?: RelationshipPanelData;
  featureDiagnostics?: FeatureDiagnosticView[];
  changes: ChangeInfo[];
  specs: SpecInfo[];
  lastRefresh: number;
}
```

New webview messages:

```text
selectScope(scopeId)
getScopeOptions()
openWorkset(name)
copyReferenceFetchCommand(storeId, specId)
```

Existing change/action messages should either carry `scopeId` or be handled against the server-side current scope snapshot. For safety, high-impact messages should include `scopeId` from the rendered data. The handler rejects the action if the selected scope changed before the click is processed.

### Decision 8: Bind change detail panels to a scope

Change detail panels should receive:

```ts
{
  changeName,
  scopeId,
  scopeLabel,
  storeId?
}
```

Panel behavior:

- Artifact cache keys include `scopeId`.
- Header shows scope label when not local root.
- Task toggles and execution state use the panel scope.
- If global dashboard scope changes, existing panels remain bound to their original scope unless explicitly reopened.

This avoids the "same change name in two roots" confusion.

### Decision 9: UI layout stays compact and operational

Dashboard first viewport:

```text
┌───────────────────────────────────────────────┐
│ OpenSpec                                      │
│ Runtime: Local Source  Scope: team-plans  OK  │
│ [scope selector] [refresh] [new change]       │
├───────────────────────────────────────────────┤
│ Changes                                       │
│   in-progress / draft / complete              │
├───────────────────────────────────────────────┤
│ References                                    │
│   platform-reqs  ok  billing, auth            │
│   design-system  not registered  Fix setup    │
├───────────────────────────────────────────────┤
│ Worksets                                      │
│   platform  code  team-plans + api + web      │
└───────────────────────────────────────────────┘
```

Controls:

- Use a native select or compact dropdown for scope selection.
- Use existing icon button style for refresh/settings/copy/open.
- Use VS Code theme variables and existing utility classes.
- Keep relationship and workset sections collapsible or below primary changes to avoid burying work-in-motion.

### Decision 10: Message flow

```text
Webview Dashboard
  ├─ getDashboardData
  │    -> DataManager.getDashboardData()
  │       -> ScopeManager.getSelectedScope()
  │       -> OpenSpecCliService.listChanges(scope)
  │       -> StateReader.listSpecs(scope)
  │       -> ScopeManager.loadRelationships(scope)
  │    <- dashboardData(scope, scopes, relationships, changes, specs)
  │
  ├─ selectScope(scopeId)
  │    -> ScopeManager.select(scopeId)
  │    -> DataManager.refresh()
  │    <- dashboardData(...)
  │
  ├─ openChangeDetailInEditor(changeName, scopeId)
  │    -> ChangeDetailPanelManager.open(changeName, scope)
  │
  └─ openWorkset(name)
       -> OpenSpecCliService.worksetOpen(name)
```

Change detail flow:

```text
ChangeDetail Panel
  ├─ getArtifactContent(change, artifact, scopeId)
  │    -> DataManager.readArtifact(change, artifact, scope)
  │       -> ContentAccess(scope).readArtifact(...)
  │
  ├─ toggleTask(change, taskIndex, scopeId)
  │    -> DataManager.toggleTask(change, taskIndex, scope)
  │       -> ContentAccess(scope).toggleTask(...)
  │
  └─ runInteractiveWorkflow(change, action, scopeId)
       -> InteractiveAgentTerminalManager.start(change, action, scope)
```

### Decision 11: Testing strategy

Use TDD slices:

1. Resolver mode tests:
   - `auto` preserves existing resolution.
   - `customPath` does not fall back.
   - `localSource` produces Node command plus args prefix.
   - settings changes invalidate cache.

2. CLI service tests:
   - args prefix is prepended.
   - store scope appends `--store`.
   - local root scope does not append `--store`.
   - feature probe failure is separate from CLI activation failure.

3. Scope manager tests:
   - local root default.
   - registered store options parse from JSON.
   - selected scope changes clear dashboard cache.
   - relationship diagnostics are retained.

4. Content access tests:
   - artifact reads use selected root.
   - same change name in two roots stays isolated.
   - open path escaping is rejected.

5. Webview/component tests:
   - Scope Bar displays runtime/scope/health.
   - unsupported store features hide controls.
   - references panel shows resolved and unresolved references.
   - workset section labels local-only semantics.

6. Integration smoke:
   - run build and unit tests.
   - run local source OpenSpec against a fixture if available.
   - manually inspect dashboard in Extension Development Host for local and local-source settings.

## Risks / Trade-offs

- Local source mode may fail when OpenSpec source has not been built -> Mitigation: explicit readiness diagnostics and no silent fallback.
- Store root may live outside the VS Code workspace -> Mitigation: validate paths against selected root rather than workspace root; open documents best-effort.
- Same change name can exist in multiple roots -> Mitigation: scope-bound caches and scope-bound detail panels.
- Feature probes can be slow if run on every refresh -> Mitigation: cache capability results per runtime version/source until settings change or retry.
- Store-aware CLI JSON is beta and may change -> Mitigation: tolerant parsing, diagnostics, and small view models isolated from raw CLI shapes.
- UI can become crowded in sidebar -> Mitigation: Scope Bar stays one compact band; references/worksets are secondary collapsible sections.
- Interactive agent adapters may not understand store scope from slash command text alone -> Mitigation: extension-owned CLI calls use `--store`; agent workflows show scope and should include store context in generated or filled prompts where supported.

## Migration Plan

1. Add settings with safe defaults so existing users stay on current behavior.
2. Extend resolver and CLI service while keeping installed CLI path behavior compatible.
3. Add feature probes and diagnostics without changing dashboard UI yet.
4. Add scope manager and make DataManager refresh scoped data.
5. Add content access factory and bind artifact/detail operations to scope.
6. Add Scope Bar and scope selection UI.
7. Add references and workset sections behind feature support checks.
8. Update README and settings documentation.
9. Run unit tests, build, and manual Extension Development Host validation.

Rollback strategy:

- If local source mode is unstable, users can switch `openspec.cliMode` back to `auto` or `installed`.
- Store-aware UI can be hidden when feature detection fails while preserving the current dashboard.
- The existing `openspec.cliPath` path remains available for emergency custom runtime selection.

## Open Questions

- Should `localOpenSpecAutoBuild=prompt` be implemented in MVP or deferred until after manual local source mode works?
- Should scope selection persist globally, per workspace, or only for the current extension session in MVP?
- Should `workset open` be invoked through a VS Code terminal or as an extension-host child process for MVP?
- How should filled agent prompts express store scope for adapters that only receive `/opsx:* <change>` slash commands?

## Spec Amendments

No unresolved spec amendments.
