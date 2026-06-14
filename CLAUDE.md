# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

This is **OpenSpec**, a VS Code/Cursor extension that provides a visual dashboard for OpenSpec workflows. It has two runtime layers:

- **Extension host** (`src/extension/`, Node.js): CLI integration, file watching, caching, VS Code commands, and webview providers. Bundled with esbuild to `dist/extension.js`.
- **Webview** (`src/webview/`, React 19 + Tailwind CSS + Radix UI): Dashboard, change detail, task list, and spec viewers. Bundled with Vite to `dist/webview/`.

The extension activates only in workspaces that contain `openspec/config.yaml`. Runtime requires the OpenSpec CLI (`openspec`) to be on PATH or configured via `openspec.cliPath`.

## Common commands

All scripts use pnpm. Run from the repository root.

| Task | Command |
|---|---|
| Install dependencies | `pnpm install` |
| Full build (extension + webview) | `pnpm run build` |
| Build extension only | `pnpm run compile` |
| Watch extension (rebuilds on change) | `pnpm run watch` |
| Dev webview standalone | `pnpm run dev:webview` |
| Run all unit tests | `pnpm test` |
| Run tests in watch mode | `pnpm run test:watch` |
| Run a single test file | `pnpm test -- test/extension/services/openspecCli.test.ts` |
| Lint source only | `npx eslint src/` |
| Format | `npx prettier --write .` |
| Package extension to `.vsix` | `pnpm run package` |
| Publish to VS Code Marketplace | `pnpm run publish:marketplace` |
| Publish to Open VSX | `OVSX_TOKEN=<token> pnpm run publish:openvsx` or `make publish-ovsx` if using `.env` |

Debug in VS Code: press `F5` (configuration "Run Extension" in `.vscode/launch.json`). The prelaunch task runs `pnpm run compile`.

## Build pipeline

- `esbuild.js` bundles `src/extension/extension.ts` to `dist/extension.js` as a CommonJS module, with `vscode` external.
- `vite.config.ts` bundles the React webview from `src/webview/index.html` to `dist/webview/` (`index.html`, `index.js`, `index.css`).
- `package.json` `main` points to `./dist/extension.js`; the packaged extension reads `dist/webview/` at runtime.

## Architecture

### Extension host

- `extension.ts` — activation/deactivation, wires services and providers.
- `services/dataManager.ts` — central data layer. Caches dashboard data, shells out to the OpenSpec CLI, reads/writes change artifacts and tasks, and exposes `onRefresh` callbacks.
- `services/openspecCli.ts` — wraps the `openspec` binary with retry, timeout, and JSON parsing.
- `services/fileManager.ts` — reads artifact files (`proposal.md`, `design.md`, `specs/`, `tasks.md`) and parses tasks.
- `services/interactiveAgentTerminalManager.ts` — runs interactive `/opsx-verify` and `/opsx-archive` workflows in a real VS Code terminal editor.
- `providers/dashboardViewProvider.ts` — sidebar webview provider (`openspec.dashboard`). Also opens dashboard/spec previews in editor panels.
- `providers/changeDetailPanelManager.ts` — manages one editor webview panel per change.
- `providers/webviewMessageHandler.ts` — single dispatcher for messages coming from the webview.
- `commands/commandManager.ts` — registers VS Code command palette commands.
- `adapters/` — agent adapter implementations (clipboard, cursor, vscode-copilot, claude-code, opencode) for workflow command dispatch.
- `utils/logger.ts` — logs to the "OpenSpec" output channel.

### Webview

- `App.tsx` — top-level router between Dashboard and ChangeDetail views based on `setContext` messages.
- `components/Dashboard.tsx` — change list, search, status grouping, progress bars.
- `components/ChangeDetail.tsx` — tabs for Proposal, Specs, Design, Tasks, Verify & Archive.
- `context/` — shared React state (locale, theme, workflow launch config).
- `hooks/` — data fetching, message passing, and UI state hooks.
- `types/messages.ts` — typed contract for all extension ↔ webview messages.

### Shared

- `src/shared/interactiveWorkflow.ts` — types and helpers for interactive workflow actions (Verify/Archive).
- `src/shared/workflowCommand.ts` — command format for `/opsx:*` workflow actions.
- `src/shared/workflowLaunchConfig.ts` — resolves user settings into the effective adapter used by workflow buttons.

### Cross-layer communication

All communication between extension host and webview uses `vscode.postMessage` / `onDidReceiveMessage`. The message contract is defined in `src/webview/types/messages.ts`. Key message families:

- `getDashboardData` / `dashboardData` — initial and refresh data flow.
- `setContext` — tells the webview which view (dashboard vs. change detail) and which change to render.
- `launchWorkflowAction` / `runInteractiveWorkflow` / `executeTask` — trigger agent adapters or task execution.
- `artifactInvalidated` — pushed when upstream files change so open panels can refresh cached artifact content.

## Testing

- Framework: Vitest (`vitest.config.ts`).
- Environment: Node with `globals: true`.
- Path aliases: `@` → `src`, `@extension` → `src/extension`, `vscode` → `test/setup/vscode-stub.ts`.
- Tests live under `test/`, mirroring `src/` structure. Unit tests mock `child_process` so they do not require the OpenSpec CLI.
- VS Code integration testing is manual via the Extension Development Host (`F5`). See `TESTING.md` for the manual checklist.

## i18n

All user-facing strings go through `t('key')` from `src/i18n/`. Locales are in `src/i18n/locales/en.json` (default) and `zh-cn.json`. The extension detects locale from `vscode.env.language`; the webview detects it from `document.documentElement.lang`.

## Non-obvious caveats

- Run `npx eslint src/` rather than `npx eslint .` — the project has pre-existing `no-undef` issues on Node/browser globals, and linting `dist/` or `esbuild.js` is not intended.
- `pnpm-lock.yaml` is not committed; `pnpm install` resolves fresh each time.
- esbuild may log a cosmetic warning about ignored build scripts; the binary still resolves correctly.
- The package does not set `"type": "module"`, so `eslint.config.js` and `postcss.config.js` use ESM syntax and Node logs a cosmetic `MODULE_TYPELESS_PACKAGE_JSON` warning.
- `DataManager.initialize()` throws if the OpenSpec CLI is unavailable, which prevents extension activation. Unit tests bypass this by mocking CLI calls.
- The `openspec` workspace under `openspec/` in this repo is used for extension development and manual testing.
- Workflow buttons default to `clipboard` mode (copy `/opsx:<action>` only). Adapters are selected via `openspec.workflowLaunchMode`, `openspec.preferredAgentAdapter`, and `openspec.cursorLaunchMode`.
- Verify and Archive always open the dedicated `Verify & Archive` tab and run in a real VS Code terminal editor, even when other workflow actions are routed through headless adapters.

## Publishing

See `docs/PUBLISHING.md` for full details. Short version:

1. Bump `version` in `package.json` and commit.
2. `pnpm run package` produces a `.vsix`.
3. `pnpm run publish:marketplace` (requires `vsce login` or `VSCE_PAT`).
4. `OVSX_TOKEN=<token> pnpm run publish:openvsx` or `make publish-ovsx` (loads `.env` if present).

Do not commit tokens or `.env`.
