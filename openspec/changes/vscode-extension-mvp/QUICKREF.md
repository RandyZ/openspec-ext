# OpenSpec VSCode Extension - Quick Reference

## 🚀 Quick Start

```bash
# Build
pnpm run compile

# Debug (F5 in VSCode)
# Make sure to open a workspace with openspec/config.yaml
```

## 📋 Commands

| Command | Shortcut | Description |
|---------|----------|-------------|
| OpenSpec: Open Dashboard | - | Open main dashboard |
| OpenSpec: Refresh Data | - | Refresh from CLI |
| OpenSpec: Create New Change | - | Create new change |
| OpenSpec: Archive Change | - | Archive change |

## 🔍 Debugging

### View Console Logs

1. **Extension Logs** (most important):
   - `View > Output` (`Cmd+Shift+U`)
   - Select "OpenSpec" from dropdown

2. **Console.log output**:
   - In Extension Development Host
   - `Cmd+Option+I` → Console tab

### Common Issues

**Extension not activating?**
- Check workspace has `openspec/config.yaml`
- Check Running Extensions panel

**Dashboard shows errors?**
- Check OpenSpec CLI: `openspec --version`
- Check Output logs for details

**Data not refreshing?**
- Manually run `OpenSpec: Refresh Data`
- Check file watcher is active in logs

## 🏗️ Architecture at a Glance

```
┌─────────────────────────────────────────┐
│  Extension Host (Node.js)               │
│  ┌─────────────────────────────────┐   │
│  │ DataManager                     │   │
│  │  ├─ OpenSpecCliService          │   │
│  │  ├─ FileManagerService          │   │
│  │  └─ FileWatcherService          │   │
│  └─────────────────────────────────┘   │
│  ┌─────────────────────────────────┐   │
│  │ CommandManager                  │   │
│  └─────────────────────────────────┘   │
│  ┌─────────────────────────────────┐   │
│  │ DashboardProvider               │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
                  │
                  │ postMessage
                  ▼
┌─────────────────────────────────────────┐
│  Webview (Browser)                      │
│  ┌─────────────────────────────────┐   │
│  │ HTML (current)                  │   │
│  │ React App (Phase 7-9)           │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

## 📁 Key Files

| File | Purpose |
|------|---------|
| `src/extension/extension.ts` | Entry point |
| `src/extension/services/dataManager.ts` | Core data orchestration |
| `src/extension/services/openspecCli.ts` | CLI integration |
| `src/extension/commands/commandManager.ts` | Command handlers |
| `src/extension/providers/dashboardProvider.ts` | Webview management |
| `package.json` | Extension manifest |

## 🧪 Testing Checklist

- [ ] Extension activates in workspace with openspec/
- [ ] Dashboard opens and shows data
- [ ] Create new change works
- [ ] Refresh updates data
- [ ] File changes trigger auto-refresh
- [ ] Logs appear in Output panel
- [ ] No errors in console

## 📊 Current Status (2026-02-07)

**Version**: 0.1.0  
**Progress**: 37% (100/270 tasks)  
**Status**: 🟢 Backend complete, frontend pending

### What Works
✅ All CLI integration  
✅ File watching  
✅ Commands  
✅ Basic dashboard  

### What's Missing
❌ React UI  
❌ Interactive tasks  
❌ Markdown rendering  
❌ Nice styling  

## 🔗 Quick Links

- [Full README](../README.md)
- [Architecture](../ARCHITECTURE.md)
- [Progress](PROGRESS.md)
- [Tasks](tasks.md)
- [Design](design.md)
