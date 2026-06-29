<!-- Exploration output for openspec/changes/add-store-aware-dashboard/explore.md - input for proposal, not the contract. -->

## Clarified requirements and constraints

This change upgrades the extension from a single-root OpenSpec dashboard into a store-aware, multi-project OpenSpec companion while preserving the current compact VS Code/Cursor experience.

The immediate product need is driven by unreleased OpenSpec CLI capabilities. The latest OpenSpec source introduces stores, references, working context, and personal worksets, but those features are not guaranteed to be available in the globally installed CLI. The extension therefore needs a first-class local source runtime mode before it can reliably expose the new multi-project workflow.

The OpenSpec model to preserve:

```text
One command acts on one OpenSpec root.

store
  standalone planning repo, writable only when selected explicitly

references
  read-only upstream context, never a write target

workset
  local personal view for opening several folders together
```

Current extension constraints:

- The extension is a VS Code/Cursor extension with an extension host service layer and React webview.
- State comes primarily from OpenSpec CLI JSON; the extension should not invent a new file-only data source for CLI-backed state.
- Artifact body reads and task toggles currently use `ContentAccess` rooted at `workspaceRoot/openspec`.
- `OpenSpecCliResolver` currently resolves a single executable command through `openspec.cliPath`, PATH, login shell, or known install paths.
- Dashboard, change detail, artifact viewing, workflow routing, and CLI diagnostic patterns already exist and should be extended rather than replaced.
- All UI should stay compact, utilitarian, and native to VS Code theme tokens.

Non-negotiables:

- A referenced store is read-only context in the dashboard unless the user selects that store as the active scope.
- Store-scoped actions must make the acting root visible before users create, apply, sync, verify, or archive.
- Local OpenSpec source mode must be explicit and diagnosable, because it can use unreleased behavior.
- Existing users with a globally installed stable CLI should keep the current single-root dashboard path.
- Settings and diagnostics must avoid leaking raw PATH values, home directory details, or secrets.

## Agreed design direction

Selected direction: introduce an OpenSpec runtime layer and a root scope layer before adding store-aware dashboard UI.

The flow becomes:

```text
OpenSpec Runtime
  installed CLI | custom path | local source repo
        |
        v
Root Scope Resolver
  local root | explicit store | declared store
        |
        v
Dashboard Data
  changes/specs/artifacts for selected writable root
        |
        +-- Relationship Panel
            references, health, fetch commands, unresolved fixes
        |
        +-- Worksets
            local named open-together views
```

The first user-facing experience should be a top dashboard scope bar:

- Shows the active runtime: Installed, Custom Path, or Local Source.
- Shows the active OpenSpec scope: Local Root, Store, or Declared Store.
- Shows path and store id when available.
- Shows a health indicator from `openspec doctor --json`.
- Offers a store selector only when the runtime supports stores.
- Keeps New Change, Refresh, Continue, FF, Apply, Verify, and Archive scoped to the selected writable root.

Multi-project information should appear in two separate areas:

- References panel: read-only upstream context, including store ids, spec summaries, fetch commands, and unresolved registration fixes.
- Worksets panel: personal local views that can open planning and code repos together. This is convenience, not source of truth.

Local source runtime mode should be a named setting, not a hidden use of `openspec.cliPath`:

```text
openspec.cliMode = auto | installed | localSource | customPath
openspec.localOpenSpecSourcePath = /path/to/OpenSpec
openspec.localOpenSpecAutoBuild = off | prompt | beforeUse
```

The local source runner should spawn the extension host's Node executable with the OpenSpec source entrypoint as an argument:

```text
node /path/to/OpenSpec/bin/openspec.js <args>
```

This requires the resolved CLI shape to support `command` plus `argsPrefix`, not only one executable path.

## Key decisions

- Use `add-store-aware-dashboard` as the change scope, with local source runtime included as a prerequisite capability.
- Keep `openspec.cliPath` for custom executable path compatibility, but add `openspec.cliMode` and `openspec.localOpenSpecSourcePath` for explicit product semantics.
- Extend the CLI resolver to return `{ command, argsPrefix, env, version, source }`.
- Treat local source mode as healthy only when the configured folder contains `package.json`, `bin/openspec.js`, and a runnable built `dist/cli/index.js` or an approved build path.
- Feature-detect store support with lightweight CLI probes instead of version assumptions, because unreleased local source and global release versions can both be present.
- Introduce a selected `OpenSpecScope` in extension state. It should include root path, source, optional store id, capabilities, health, and diagnostics.
- Parameterize CLI commands with the selected scope. Store scope adds `--store <id>` to root-resolving commands.
- Parameterize content access by resolved root path. Open-in-editor and artifact reads must use the selected root, not always `workspaceRoot`.
- Preserve root visibility in every high-impact action. The UI should show the active scope near workflow buttons and in change detail.
- Do not inline referenced store specs into dashboard cards. Show summaries and fetch commands, matching OpenSpec's "index, not inline" direction.
- Do not make worksets shared, editable project relationships. They are local open-together shortcuts.
- Use existing CLI activation diagnostic and dashboard diagnostic patterns for local source failures and unsupported feature states.
- Add tests around resolver modes, scope command args, dashboard messages, and content access root selection before implementing behavior.
