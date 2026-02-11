# Proposal: OpenSpec VSCode Extension MVP

## Problem

OpenSpec provides a powerful spec-driven workflow through CLI and slash commands, but lacks visual tooling. Developers need to:

- Manually check change status with `openspec list`
- Open multiple markdown files to review artifacts
- Edit `tasks.md` in text editor to mark tasks complete
- Switch between terminal, editor, and AI chat constantly
- Remember complex file paths like `openspec/changes/add-feature/specs/auth/spec.md`

This creates friction and reduces the value of OpenSpec's structured approach.

## Solution

Build a dedicated VSCode extension that provides a visual dashboard and interactive UI for OpenSpec workflows.

### Core Value Proposition

**"See your OpenSpec workflow, don't hunt for it."**

Users get:
1. **Visual Dashboard** - See all changes, their progress, and status at a glance
2. **Interactive Tasks** - Click to toggle task completion instead of editing markdown
3. **Artifact Navigation** - Browse proposals, specs, designs, tasks in a unified view
4. **Quick Actions** - Copy opsx commands, archive changes, navigate to files with one click

## Scope

### MVP (In Scope)

**Core Features:**
1. Dashboard webview showing all changes grouped by status (draft/active/completed)
2. Change detail view with tabs for each artifact type
3. Interactive task checklist - click checkbox to toggle completion
4. Quick action buttons to copy `/opsx:ff`, `/opsx:apply`, `/opsx:archive` commands
5. Real-time updates via file watching

**Technical Foundation:**
- Extension activation and workspace detection
- OpenSpec CLI integration (`list`, `show`, `validate`)
- File system watching for live updates
- Message passing between extension and webview
- Basic task markdown parsing and updating

**Target Users:**
- Individual developers using OpenSpec in VSCode
- Teams already familiar with OpenSpec workflow

### Phase 2 (Future)

- Sidebar tree view for navigation
- Spec viewer with requirement/scenario rendering
- Spec diff viewer (delta vs main)
- Archive browser
- File navigation (click to open in editor)
- Search and filtering

### Phase 3 (Future)

- Comment system for artifacts
- AI command integration
- Bulk operations
- Multi-language UI
- Settings panel
- Keyboard shortcuts

## Non-Goals

- Replace the OpenSpec CLI (extension augments CLI, doesn't replace it)
- Support non-VSCode editors (VSCode only for MVP)
- Offline mode without openspec CLI installed
- Custom workflow schemas (use OpenSpec's default schemas)
- Real-time collaboration features
- Git integration

## Success Criteria

**MVP is successful if:**

1. Users can see all their changes and progress without running CLI commands
2. Task completion is faster via checkbox clicks vs manual markdown editing
3. Users prefer the dashboard over manually navigating file tree
4. Extension accurately reflects OpenSpec state (no sync issues)
5. File watching keeps UI updated without manual refresh

**Metrics to track:**
- Extension activation rate among OpenSpec users
- Time spent in dashboard vs file explorer
- Number of task toggles via extension vs direct file edits
- User feedback on value vs friction

## Alternatives Considered

**1. Web-based dashboard (like `openspec view`)**
- Pros: Cross-editor support, no VSCode coupling
- Cons: Loses editor integration, requires separate window, harder to navigate to files
- Decision: VSCode extension provides better integration for target users

**2. Fork reference project (spec-workflow-mcp)**
- Pros: Fast start, proven UI patterns
- Cons: Requires heavy adaptation, includes features we don't need, license concerns
- Decision: Build from scratch but reference UI patterns

**3. CLI-only with better TUI**
- Pros: No new tools to learn
- Cons: Limited interactivity, doesn't solve visual navigation problem
- Decision: Visual UI provides more value

## Implementation Approach

**Architecture:** Independent project, calls `openspec` CLI for data, watches files for updates

**Tech Stack:**
- Extension: TypeScript + Node.js + VSCode Extension API
- Webview: React + Tailwind CSS + Radix UI
- Build: esbuild (extension) + Vite (webview)

**Data Flow:**
1. Extension calls `openspec list --json` on activation
2. FileSystemWatcher monitors `openspec/**/*.{md,yaml}`
3. On file change, refresh affected data
4. Webview requests data via message passing
5. Extension reads files directly for artifact content

**Development Phases:**
1. Project setup and basic extension scaffold
2. CLI integration and data models
3. Dashboard webview with React
4. Change detail view and artifact rendering
5. Task checkbox interaction
6. File watching and auto-refresh
7. Polish and testing

## Timeline Estimate

**MVP Development:**
- Week 1: Setup, CLI integration, basic extension structure
- Week 2: Dashboard webview, React components
- Week 3: Change detail view, task interaction
- Week 4: File watching, polish, testing

**Total: 4 weeks for single developer**

(Note: This is an estimate based on working 20-30 hours/week. Actual timeline depends on available time and complexity discoveries.)

## Dependencies

**Required:**
- Node.js 20.19.0+ (OpenSpec requirement)
- VSCode 1.85.0+
- `@fission-ai/openspec` installed globally
- OpenSpec initialized in workspace (`openspec/` directory exists)

**Development:**
- TypeScript 5.7+
- React 19+
- Vite 6+
- esbuild 0.25+
- Radix UI components

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| OpenSpec CLI output changes | High | Pin to specific OpenSpec version, use semantic versioning |
| File watching performance on large repos | Medium | Debounce events, only watch `openspec/` directory |
| Webview state management complexity | Medium | Use simple message passing, keep state in extension |
| Task markdown parsing fragility | Medium | Test extensively, handle edge cases gracefully |
| Users don't have CLI installed | Low | Check on activation, show helpful error with install link |

## Open Questions

1. Should we bundle OpenSpec CLI with the extension, or require separate installation?
   - **Decision needed before MVP release**
   - Leaning toward: Require separate install to stay lightweight and respect user control

2. How to handle changes created outside VSCode (e.g., via CLI in terminal)?
   - **Decision:** FileSystemWatcher will detect and refresh automatically

3. Should task toggling be atomic (one click saves) or batched (save button)?
   - **Decision needed in Week 3**
   - Leaning toward: Atomic for immediate feedback

4. Error handling when `openspec` command is not found?
   - **Decision:** Show notification with installation instructions, disable extension features

## Conclusion

This MVP provides immediate value to OpenSpec users by making the workflow visual and interactive. It respects the existing CLI-first design while reducing context switching and manual file navigation.

By starting with core features (dashboard, tasks, quick actions), we can validate the approach and gather feedback before investing in advanced features.

**Next Steps:**
1. ✅ Create this proposal
2. Create specs defining requirements for each feature
3. Create design document detailing architecture and implementation
4. Create tasks breaking down development into actionable items
5. Begin implementation
