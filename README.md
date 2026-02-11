# OpenSpec VSCode Extension

> Visual interface for managing OpenSpec workflows in VSCode

[![Status](https://img.shields.io/badge/status-in%20development-yellow)](openspec/changes/vscode-extension-mvp/PROGRESS.md)
[![Progress](https://img.shields.io/badge/progress-MVP-blue)](openspec/changes/vscode-extension-mvp/tasks.md)

## 📖 Overview

A VSCode extension that provides a visual dashboard for [OpenSpec](https://github.com/Fission-AI/OpenSpec), making it easier to manage changes, view specs, and track tasks without leaving your editor.

### ✅ Current Features (v0.1.0)

- **Visual Dashboard**: React UI with changes and specs, progress bars, empty states
- **Change Detail**: Tabs for Proposal, Specs, Design, Tasks; markdown artifact viewer; task checkboxes with write-back
- **CLI Integration**: OpenSpec CLI (list, status, new, archive) with retry and 30s timeout
- **Real-time Updates**: File watcher (openspec/**/*.md, *.yaml) with 300ms debounce; cache 10s TTL
- **Quick Actions**: Copy /opsx:ff, /opsx:apply; Archive; Open in Editor; Refresh
- **Commands**: Open Dashboard, Refresh Data, Create New Change, Archive Change
- **Logging**: Output panel "OpenSpec" channel
- **Error Handling**: User-facing messages, CLI-not-found and timeout handling

---

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

---

## 📦 Installation

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

---

## 🚀 Usage

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

### Dashboard

- Changes list with progress and status; quick actions (Copy /opsx:ff, /opsx:apply, Archive)
- Specs list; empty states with "Create New Change"
- Change detail: Proposal / Specs / Design / Tasks tabs; markdown rendering; task toggles; action bar

### Viewing Logs

1. Open Output panel: `View > Output` or `Cmd+Shift+U`
2. Select **"OpenSpec"** from dropdown
3. View timestamped logs (INFO, WARN, ERROR, DEBUG)

---

## 🛠️ Development

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

---

## 📊 Progress

**Current**: MVP complete (Phases 1–12). Post-MVP: Sidebar tree, Spec diff, Archive browser.

### ✅ Completed Phases

- ✅ **Phase 1–6**: Setup, CLI, File system, Cache, Commands, Dashboard provider
- ✅ **Phase 7–10**: React webview, Dashboard & Change detail UI, UI component library
- ✅ **Phase 11**: Testing & polish (manual checklist, edge cases, performance, docs)
- ✅ **Phase 12**: Documentation, package config, release prep

**Detailed progress**: [tasks.md](openspec/changes/vscode-extension-mvp/tasks.md)

---

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

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [ARCHITECTURE.md](ARCHITECTURE.md) | High-level architecture |
| [PROGRESS.md](openspec/changes/vscode-extension-mvp/PROGRESS.md) | Development log |
| [proposal.md](openspec/changes/vscode-extension-mvp/proposal.md) | Project proposal |
| [design.md](openspec/changes/vscode-extension-mvp/design.md) | Technical design |
| [tasks.md](openspec/changes/vscode-extension-mvp/tasks.md) | Task breakdown |

---

## 🤝 Contributing

Currently in active development. Contributions welcome after MVP release.

**To contribute:**
1. Review [ARCHITECTURE.md](ARCHITECTURE.md)
2. Check [tasks.md](openspec/changes/vscode-extension-mvp/tasks.md)
3. Follow code style (ESLint + Prettier)

---

## 📄 License

MIT (TBD)

---

## 🙏 Acknowledgments

- [OpenSpec](https://github.com/Fission-AI/OpenSpec) - Spec-driven workflow tool
- [VSCode Extension Samples](https://github.com/microsoft/vscode-extension-samples)

---

**Version**: 0.1.0  
**Last Updated**: 2026-02  
**Status**: 🟢 MVP complete
