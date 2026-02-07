# OpenSpec VSCode Extension

> Visual interface for managing OpenSpec workflows in VSCode

[![Status](https://img.shields.io/badge/status-in%20development-yellow)](openspec/changes/vscode-extension-mvp/PROGRESS.md)
[![Progress](https://img.shields.io/badge/progress-37%25-blue)](openspec/changes/vscode-extension-mvp/tasks.md)

## 📖 Overview

A VSCode extension that provides a visual dashboard for [OpenSpec](https://github.com/Fission-AI/OpenSpec), making it easier to manage changes, view specs, and track tasks without leaving your editor.

### ✅ Current Features (v0.1.0)

- **Visual Dashboard**: See all changes and specs with progress indicators
- **CLI Integration**: Full integration with OpenSpec CLI commands
- **Real-time Updates**: Auto-refresh when files change (300ms debounce)
- **Change Management**: Create and archive changes via commands
- **Smart Logging**: Detailed logs in Output panel ("OpenSpec" channel)
- **Error Handling**: Robust error handling with retry logic

### 🚀 Coming Soon

- React-based UI with Tailwind CSS
- Interactive task toggling (click checkboxes)
- Markdown artifact viewer
- Drag-and-drop task reordering
- Enhanced filtering and search

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

Open Command Palette (`Cmd+Shift+P`):

| Command | Description |
|---------|-------------|
| **OpenSpec: Open Dashboard** | Open visual dashboard |
| **OpenSpec: Refresh Data** | Manually refresh from CLI |
| **OpenSpec: Create New Change** | Create new change (with validation) |
| **OpenSpec: Archive Change** | Archive completed change |

### Dashboard

Current dashboard shows:
- List of all changes with task progress
- List of all specs
- Last refresh timestamp
- JSON data view (React UI coming in Phase 7-9)

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

**Current**: 37% (100/270 tasks)

### ✅ Completed Phases

- ✅ **Phase 1**: Project Setup (18 tasks)
- ✅ **Phase 2**: CLI Integration (17 tasks)
- ✅ **Phase 3**: File System Layer (18 tasks)
- ✅ **Phase 4**: Data Cache (10 tasks)
- ✅ **Phase 5**: Commands (13 tasks)
- ✅ **Phase 6**: Dashboard Webview (26 tasks)

### 🚧 In Progress

- 🚧 **Phase 7-9**: React UI Development
- 🔜 **Phase 10**: Task Management UI
- 🔜 **Phase 11**: Testing
- 🔜 **Phase 12**: Documentation & Polish

**Detailed progress**: [PROGRESS.md](openspec/changes/vscode-extension-mvp/PROGRESS.md)

---

## 🐛 Known Issues

### Current Issues

- Dashboard UI is basic HTML (React UI in Phase 7-9)
- No interactive task toggling yet
- No markdown rendering
- Missing loading/error indicators

### Fixed Issues

- ✅ JSON parse error with "No specs found" (v0.1.0)

Report issues in the issue tracker (when available).

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

**Version**: 0.1.0 (MVP in progress)  
**Last Updated**: 2026-02-07  
**Status**: 🟢 Backend stable, frontend pending
