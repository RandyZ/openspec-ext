# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

- React dashboard with change list, specs, and change detail view
- Task toggle from webview with file write-back
- Markdown artifact viewer with syntax highlighting
- OpenSpec CLI integration (list, status, new, archive)
- File watcher with 300ms debounce and cache (10s TTL)
- Commands: Open Dashboard, Refresh, New Change, Archive Change, Copy /opsx:ff and /opsx:apply

## [0.1.0] - TBD

### Added

- Initial VSCode extension scaffold
- OpenSpec CLI service with retry and timeout (30s)
- File manager for artifact and task file read/write
- Data cache and file watcher integration
- Dashboard webview provider and message passing
- React + Tailwind + Radix UI webview app
- Dashboard view: changes (with progress), specs, empty states, quick actions
- Change detail view: tabs (Proposal, Specs, Design, Tasks), artifact viewer, task list with checkboxes, action bar
- UI component library (Button, Card, Tabs, Progress, LoadingSpinner, ErrorBoundary, Tooltip, Badge, EmptyState, ConfirmDialog)
- Unit tests for CLI service and file manager
- Documentation: README, TESTING.md, ARCHITECTURE.md

### Configuration

- `openspec.focusSidebarViewWhenOpeningChangeDetail` – focus sidebar when opening change detail
- `openspec.focusSidebarViewWhenOpeningDashboard` – focus sidebar when opening dashboard

[Unreleased]: https://github.com/your-org/openspce-ui/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/your-org/openspce-ui/releases/tag/v0.1.0
