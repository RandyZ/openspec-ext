# OpenSpec VSCode Extension

> A visual dashboard and interactive UI for OpenSpec workflows

## 🎯 Project Overview

This is a VSCode extension specifically designed for [OpenSpec](https://github.com/Fission-AI/OpenSpec) that provides:

- 📊 **Visual Dashboard**: See all changes, specs, and progress at a glance
- ✅ **Interactive Tasks**: Click to toggle task completion instead of editing markdown
- 📑 **Artifact Viewer**: Browse proposals, specs, designs, and tasks in a unified view
- ⚡ **Quick Actions**: Copy opsx commands, archive changes, navigate files with one click
- 🔄 **Real-time Updates**: File watching keeps UI synced automatically

## 🏗️ Project Status

**Current Phase**: Planning & Design Complete ✅

We've completed the full planning process using OpenSpec itself! All artifacts are in `openspec/changes/vscode-extension-mvp/`:

- ✅ **Proposal** - Problem statement, solution, scope, and success criteria
- ✅ **Specs** - Detailed requirements for Dashboard, Task Management, Artifact Viewing, and CLI Integration
- ✅ **Design** - Complete technical architecture and implementation details
- ✅ **Tasks** - 269 actionable tasks broken down into 12 phases

**Next Step**: Begin implementation (Phase 1 - Project Setup)

## 📐 Architecture Decisions

Based on our exploration, we've made the following key decisions:

### 1. **Independent Project**
- Not part of OpenSpec core repository
- Maintains its own release cycle
- Can target specific OpenSpec versions

### 2. **Mixed Data Source (Hybrid Approach)**
```
Extension ──initial data──> OpenSpec CLI (via child_process)
          ──real-time updates──> FileSystemWatcher
          ──artifact details──> Direct file reads
```

### 3. **Technology Stack**
- **Extension**: TypeScript + Node.js + VSCode Extension API
- **Webview**: React 19 + Tailwind CSS + Radix UI
- **Build**: esbuild (extension) + Vite (webview)
- **Backend**: Calls `openspec` CLI commands

### 4. **Three Development Phases**

**MVP (Phase 1)** - Core functionality (~4 weeks)
- Dashboard showing all changes
- Task checkbox interaction
- Artifact viewing
- Quick actions (copy commands)

**Phase 2** - Enhanced experience
- Sidebar tree view
- Spec diff viewer
- Archive browser
- File navigation

**Phase 3** - Advanced features
- Comment system
- AI integration
- Multi-language UI
- Keyboard shortcuts

## 📚 Documentation

- **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** - Detailed architectural design and diagrams
- **[docs/EXPLORATION_SUMMARY.md](docs/EXPLORATION_SUMMARY.md)** - Exploration process summary and key decisions
- **[docs/PROJECT_STRUCTURE.md](docs/PROJECT_STRUCTURE.md)** - Project file structure and document index
- **[openspec/changes/vscode-extension-mvp/](openspec/changes/vscode-extension-mvp/)** - Complete planning artifacts
  - `proposal.md` - What and why
  - `specs/` - Requirements and scenarios
  - `design.md` - Technical implementation
  - `tasks.md` - Implementation breakdown

## 🚀 Getting Started (When Ready)

### Prerequisites

- Node.js 20.19.0+
- VSCode 1.85.0+
- OpenSpec CLI installed (`npm install -g @fission-ai/openspec`)

### Development Setup (Phase 1 tasks)

```bash
# Install dependencies
npm install

# Build extension
npm run build

# Watch for changes
npm run watch

# Run extension
# Press F5 in VSCode to open Extension Development Host
```

## 🎯 MVP Success Criteria

The MVP will be successful if:

1. ✅ Users can see all their changes and progress without running CLI commands
2. ✅ Task completion is faster via checkbox clicks vs manual markdown editing
3. ✅ Users prefer the dashboard over manually navigating file tree
4. ✅ Extension accurately reflects OpenSpec state (no sync issues)
5. ✅ File watching keeps UI updated without manual refresh

## 📊 Progress Tracking

View implementation progress:
```bash
openspec list
openspec show vscode-extension-mvp
```

Current status: **0/269 tasks complete** (Ready to start!)

## 🔗 References

- **OpenSpec Source**: `/Users/randy/workspace/project/opensource/AI/OpenSpec`
- **Reference VSCode Extension**: [spec-workflow-mcp](https://github.com/Pimzino/spec-workflow-mcp/tree/main/vscode-extension)
- **OpenSpec Documentation**: [Getting Started](https://github.com/Fission-AI/OpenSpec/blob/main/docs/getting-started.md)

## 🤝 Contributing

This project uses OpenSpec for development workflow. To contribute:

1. Review the planning artifacts in `openspec/changes/vscode-extension-mvp/`
2. Pick a task from `tasks.md`
3. Implement and test
4. Update task status in `tasks.md`

## 📝 License

MIT (same as OpenSpec)

---

**Built with [OpenSpec](https://github.com/Fission-AI/OpenSpec)** - Practice what we preach!
