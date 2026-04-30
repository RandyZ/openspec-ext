# OpenSpec Extension

> Visual interface for managing OpenSpec workflows in VSCode, Cursor.

English | [简体中文](README.zh-CN.md)

## Overview

A VSCode/Cursor extension that provides a visual dashboard for [OpenSpec](https://github.com/Fission-AI/OpenSpec), making it easier to manage changes, view specs, and track tasks without leaving your editor.

### Features

- **Visual Dashboard**: Changes grouped by status, progress bars, Proposal Why summaries, and search
- **Change Detail**: Tabs for Proposal, Specs, Design, Tasks, and Verify; markdown viewer; task execution controls
- **CLI Integration**: OpenSpec CLI (list, status, new, archive) with retry, timeout, and `openspec.cliPath` fallback
- **Quick Actions**: Continue, FF, Apply, Verify, Archive, Open in Editor, Refresh
- **Commands**: Open Dashboard, Refresh Data, Create New Change, Archive Change
- **Logging**: Output panel "OpenSpec" channel

## Screenshots

### Dashboard sidebar

![OpenSpec dashboard sidebar](docs/images/openspec-dashboard.png)

The sidebar shows active changes grouped by status, searchable change cards, task progress, artifact badges, and Proposal Why summaries.

### Change details and task confirmation

![OpenSpec change detail and task confirmation](docs/images/openspec-change-detail.png)

The change detail view provides workflow actions, artifact tabs, task execution, and a webview confirmation dialog before changing task completion state.

## Installation

- **From marketplace**: Install **OpenSpec** from the [VS Code Marketplace](https://marketplace.visualstudio.com/) or [Open VSX](https://open-vsx.org/) (e.g. in Cursor).
- **Requirements**: [OpenSpec CLI](https://github.com/Fission-AI/OpenSpec#quick-start); a workspace that contains (or will contain) `openspec/config.yaml`. The extension activates when it finds an OpenSpec workspace.

If Cursor or VS Code cannot see the CLI that works in your terminal, set `openspec.cliPath` to the absolute executable path, for example `/opt/homebrew/bin/openspec` or `/usr/local/bin/openspec`.

## Usage

### Quick start

1. Open a workspace that contains `openspec/config.yaml`.
2. Open Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`).
3. Run **OpenSpec: Open Dashboard**.
4. Select a change to inspect Proposal, Specs, Design, Tasks, and Verify tabs.
5. Use the action bar or change-card actions to copy/fill `/opsx:continue`, `/opsx:ff`, `/opsx:apply`, and `/opsx:verify` commands.

### Commands

Open Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`):

| Command | Description |
|---------|-------------|
| **OpenSpec: Open Dashboard** | Open visual dashboard (sidebar or editor) |
| **OpenSpec: Refresh Data** | Manually refresh from CLI |
| **OpenSpec: Create New Change** | Create new change (with validation) |
| **OpenSpec: Archive Change** | Archive completed change |

### Keyboard shortcuts

- `Cmd+Shift+P` (Mac) / `Ctrl+Shift+P` (Windows/Linux): Command Palette — then type "OpenSpec" to run any command.
- No default keybindings; you can assign them in Keyboard Shortcuts (e.g. for "OpenSpec: Open Dashboard").

### Configuration

| Setting | Default | Description |
|--------|---------|-------------|
| `openspec.focusSidebarViewWhenOpeningChangeDetail` | `false` | Focus OpenSpec sidebar when opening change detail |
| `openspec.focusSidebarViewWhenOpeningDashboard` | `false` | Focus OpenSpec sidebar when opening dashboard |
| `openspec.cliPath` | `""` | Optional absolute path to OpenSpec CLI; empty = auto-detect from PATH and login shell |
| `openspec.taskExecutionMode` | `fillChat` | When clicking task execute: `auto` = run via adapter; `fillChat` = fill chat or copy to clipboard |
| `openspec.preferredAgentAdapter` | `""` | Preferred agent executor adapter id (e.g. `cursor`, `clipboard`). Empty = use first available |
| `openspec.taskDependencyPolicy` | `block` | When preceding tasks are incomplete: `block` = prevent execution; `warn` = show warning and allow proceed |
| `openspec.agentModel` | `auto` | Cursor agent CLI model (only when using Cursor adapter). Use `auto` or a specific model name |
| `openspec.debug` | `false` | Enable debug: Verify tab and full prompt in Output when executing tasks |

**Task execution & Adapters**

- **Clipboard** (`clipboard`): Always available. In fillChat mode it copies the prompt to the clipboard and notifies you; in auto mode it also copies (no direct execution).
- **Cursor** (`cursor`): Available when the Cursor `agent` CLI is on PATH (e.g. in Cursor IDE). Executes tasks via the agent CLI or fills chat / copies to clipboard.
- You can choose the adapter in the change detail UI (Adapter dropdown) or set `openspec.preferredAgentAdapter` in settings. If the selected adapter is unavailable, the extension falls back to the first available one (often clipboard).

### Dashboard

- Search changes by name, status, artifact, or Proposal Why text.
- Review progress, status, artifact badges, and Proposal Why summaries in the sidebar.
- Open change details with Proposal / Specs / Design / Tasks / Verify tabs.
- Execute tasks through the selected adapter, or fill/copy workflow commands into chat.
- Toggle task completion only after confirming in the webview dialog.

### Viewing Logs

1. Open Output panel: `View > Output` or `Cmd+Shift+U`
2. Select **"OpenSpec"** from dropdown
3. View timestamped logs (INFO, WARN, ERROR, DEBUG)

### Troubleshooting

- **Extension doesn’t activate**: Open a folder that contains (or will contain) an OpenSpec workspace (`openspec/config.yaml`). The extension only activates in OpenSpec workspaces.
- **"OpenSpec CLI not found"**: Install [OpenSpec CLI](https://github.com/Fission-AI/OpenSpec#quick-start) and ensure it’s on your PATH.
- **Dashboard empty**: Run **OpenSpec: Refresh Data**; check the **OpenSpec** output channel for errors.

---
<!-- Below: development/contributing only; above: user-facing (packaged as extension README) -->

[![Status](https://img.shields.io/badge/status-in%20development-yellow)](openspec/changes/vscode-extension-mvp/PROGRESS.md)
[![Progress](https://img.shields.io/badge/progress-MVP-blue)](openspec/changes/vscode-extension-mvp/tasks.md)

## 🏗️ Architecture

```
Extension Host (Node.js)          Webview (Browser)
├── DataManager                   ├── HTML (current)
│   ├── OpenSpecCliService        └── React App (Phase 7-9)
│   ├── FileManagerService            ├── Dashboard
│   └── FileWatcherService            ├── TaskList
├── CommandManager                    └── ArtifactViewer
└── DashboardProvider
```

**Design Decisions:**

- Data Source: Hybrid (CLI + FileWatcher + Direct reads)
- Backend: OpenSpec CLI via `child_process`
- Frontend: React + Tailwind CSS + Radix UI (planned)
- Build: esbuild + Vite
- Package Manager: pnpm

See [ARCHITECTURE.md](ARCHITECTURE.md) for details.

***

## 🛠️ Development

### Prerequisites

- **Node.js** 18.0.0+
- **pnpm** 8.0.0+ (`npm install -g pnpm`)
- **VSCode** 1.85.0+
- **OpenSpec CLI** 1.1.0+ ([installation](https://github.com/Fission-AI/OpenSpec#quick-start))

### Development Setup

```bash
# Clone and install
git clone <repo-url>
cd openspce-ui
pnpm install

# Build
pnpm run compile    # One-time build
pnpm run watch      # Watch mode

# Debug
# Press F5 in VSCode to launch Extension Development Host
```

### Publishing

To package and publish the extension to [VS Code Marketplace](https://marketplace.visualstudio.com/) and [Open VSX](https://open-vsx.org/) (e.g. for Cursor), see **[docs/PUBLISHING.md](docs/PUBLISHING.md)** for publisher setup, tokens, and release steps.

### Project Structure

```
openspce-ui/
├── src/
│   ├── extension/              # Extension host (Node.js)
│   │   ├── services/           # CLI, FileManager, DataManager
│   │   ├── commands/           # Command handlers
│   │   ├── providers/          # Webview providers
│   │   └── utils/              # Logger, helpers
│   └── webview/                # React app (coming)
├── openspec/                   # OpenSpec workspace
│   ├── changes/
│   │   └── vscode-extension-mvp/  # This project
│   ├── specs/
│   └── config.yaml
├── .vscode/
│   ├── launch.json             # Debug config
│   └── tasks.json              # Build tasks
├── esbuild.js                  # Extension bundler
├── vite.config.ts              # Webview bundler
└── package.json
```

### Scripts

```bash
pnpm run compile       # Build extension once
pnpm run watch         # Watch extension changes
pnpm run build         # Build everything (future)
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | TypeScript, Node.js, VSCode API |
| Frontend | React 19, Tailwind CSS, Radix UI (planned) |
| Build | esbuild (extension), Vite (webview) |
| Tools | pnpm, ESLint, Prettier |

***

## 📊 Progress

**Current**: MVP complete (Phases 1–12). Post-MVP: Sidebar tree, Spec diff, Archive browser.

### ✅ Completed Phases

- ✅ **Phase 1–6**: Setup, CLI, File system, Cache, Commands, Dashboard provider
- ✅ **Phase 7–10**: React webview, Dashboard & Change detail UI, UI component library
- ✅ **Phase 11**: Testing & polish (manual checklist, edge cases, performance, docs)
- ✅ **Phase 12**: Documentation, package config, release prep

**Detailed progress**: [tasks.md](openspec/changes/vscode-extension-mvp/tasks.md)

***

## 🐛 Known Issues & Troubleshooting

### Troubleshooting

- **Extension doesn’t activate**  
  Ensure the workspace root contains `openspec/config.yaml`. Check Output → Extension Host.

- **Dashboard or webview blank**  
  Run `pnpm run build` and ensure `dist/webview/` exists. In Extension Development Host, use "Developer: Toggle Developer Tools" and check the webview iframe console.

- **OpenSpec CLI not found**  
  Install [OpenSpec CLI](https://github.com/Fission-AI/OpenSpec#quick-start) and ensure `openspec` is on PATH in the environment where VSCode is launched.

- **Tasks don’t update on disk**  
  Ensure the workspace has write access to `openspec/changes/<name>/tasks.md`. Check Output → OpenSpec for errors.

- **Build or test failures**  
  `rm -rf dist node_modules && pnpm install && pnpm run build && pnpm test`

### Fixed

- ✅ JSON parse error with "No specs found" (v0.1.0)

***

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [ARCHITECTURE.md](ARCHITECTURE.md) | High-level architecture |
| [PROGRESS.md](openspec/changes/vscode-extension-mvp/PROGRESS.md) | Development log |
| [proposal.md](openspec/changes/vscode-extension-mvp/proposal.md) | Project proposal |
| [design.md](openspec/changes/vscode-extension-mvp/design.md) | Technical design |
| [tasks.md](openspec/changes/vscode-extension-mvp/tasks.md) | Task breakdown |

***

## 🤝 Contributing

Currently in active development. Contributions welcome after MVP release.

**To contribute:**

1. Review [ARCHITECTURE.md](ARCHITECTURE.md)
2. Check [tasks.md](openspec/changes/vscode-extension-mvp/tasks.md)
3. Follow code style (ESLint + Prettier)

***

## 📄 License

MIT (TBD)

***

## 🙏 Acknowledgments

- [OpenSpec](https://github.com/Fission-AI/OpenSpec) - Spec-driven workflow tool
- [VSCode Extension Samples](https://github.com/microsoft/vscode-extension-samples)

***

**Version**: 0.1.0  
**Last Updated**: 2026-02  
**Status**: 🟢 MVP complete
