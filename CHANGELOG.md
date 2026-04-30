# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Resolve OpenSpec CLI path using the user login shell (`SHELL`), so `openspec` on `PATH` from shell profiles is found when VS Code inherits a minimal environment.
- Dashboard responsiveness improvements and search-related UX updates.

### Changed

- Updated OpenSpec / related dependency alignment (`update openspec`).

## [0.1.3] - 2026-03-29

### Added

- Internationalization: English (`en`) and Chinese (`zh-cn`), `t()`-based strings across extension host and webview; i18n unit tests.
- Executor adapters: VS Code Copilot Chat (pre-filled chat), Claude Code, OpenCode.
- Superpowers skill library for Cursor, Claude Code, and OpenCode.
- Workflow state model, step indicator, dynamic action bar, and fill-chat integration in change detail views.

### Changed

- Prompts simplified to short `/opsx:<action> <change-name>` commands; change ID included consistently.
- Removed redundant dedicated “Copy /opsx:ff” and “Copy /opsx:apply” controls where workflow bar covers the flow.

### Fixed

- Specs panel: show main specs after archive; render in webview correctly.
- Spec preview panel timing; sidebar requirement tree + editor preview layout.
- Webview locale detection.
- Spec document tabs: reuse existing tab when opening the same spec again.

### Documentation

- `AGENTS.md`: i18n, adapter priority, workflow commands, CLI setup notes.

## [0.1.2] - 2026-02-22

### Added

- VS Code extension scaffold and activation when `openspec/config.yaml` is present.
- OpenSpec CLI service with retry, timeout, and integration for list/status/new/archive-style flows.
- File manager for artifacts and tasks; data cache and debounced file watcher.
- Dashboard webview: changes with progress, specs, empty states, quick actions.
- Change detail: tabs (Proposal, Specs, Design, Tasks), markdown artifact viewer with highlighting, task list with checkboxes, action bar.
- UI primitives (Button, Card, Tabs, Progress, LoadingSpinner, ErrorBoundary, Tooltip, Badge, EmptyState, ConfirmDialog).
- Unit tests for CLI service and file manager.
- Documentation: README, TESTING.md, ARCHITECTURE.md; marketplace / OVSX publish flow work.

### Configuration

- `openspec.focusSidebarViewWhenOpeningChangeDetail`
- `openspec.focusSidebarViewWhenOpeningDashboard`

### Fixed

- Workspace and bundled path resolution for extension resources.

[Unreleased]: https://github.com/RandyZ/openspec-ext/compare/v0.1.3...HEAD
[0.1.3]: https://github.com/RandyZ/openspec-ext/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/RandyZ/openspec-ext/releases/tag/v0.1.2
