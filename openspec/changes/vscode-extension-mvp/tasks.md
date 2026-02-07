# Implementation Tasks

This task list breaks down the MVP implementation into actionable items. Tasks are organized by phase and can be completed in roughly sequential order, though some can be done in parallel.

## Phase 1: Project Setup & Foundation

### 1.1 Project Initialization
- [x] Create project directory structure
- [x] Initialize package.json with pnpm init
- [x] Setup TypeScript configuration (tsconfig.json)
- [x] Configure esbuild for extension build
- [x] Configure Vite for webview build
- [x] Setup Git repository and .gitignore
- [x] Create pnpm-workspace.yaml if needed
- [x] Create .npmrc to configure pnpm settings

### 1.2 Development Environment
- [x] Setup ESLint and Prettier
- [x] Configure VSCode settings for development
- [x] Setup launch.json for debugging extension
- [x] Create pnpm scripts for dev, build, watch
- [x] Test extension loading in VSCode dev host

### 1.3 Extension Scaffold
- [x] Create extension.ts entry point
- [x] Implement activate() function
- [x] Implement deactivate() function
- [ ] Add extension manifest (package.json contributions)
- [ ] Setup basic logging infrastructure

## Phase 2: CLI Integration Layer

### 2.1 OpenSpec CLI Service
- [ ] Create OpenSpecCliService class
- [ ] Implement checkAvailability() method
- [ ] Implement getVersion() method
- [ ] Implement execOpenSpec() helper
- [ ] Add timeout handling for CLI commands
- [ ] Implement JSON parsing with error handling

### 2.2 CLI Commands
- [ ] Implement listChanges() method
- [ ] Implement showChange() method
- [ ] Implement listSpecs() method
- [ ] Implement validateChange() method
- [ ] Implement createChange() method
- [ ] Implement archiveChange() method

### 2.3 Error Handling
- [ ] Create OpenSpecCliError class
- [ ] Add retry logic with exponential backoff
- [ ] Implement user-friendly error messages
- [ ] Add CLI not found error notification
- [ ] Add workspace not initialized error handling

### 2.4 Unit Tests
- [ ] Test CLI availability check
- [ ] Test JSON parsing with valid data
- [ ] Test JSON parsing with malformed data
- [ ] Test command execution success cases
- [ ] Test command execution error cases
- [ ] Test timeout handling

## Phase 3: File System Layer

### 3.1 File Manager Service
- [ ] Create FileManagerService class
- [ ] Implement artifact path resolution
- [ ] Implement readArtifact() method
- [ ] Implement artifactExists() method
- [ ] Implement readSpec() method
- [ ] Implement readDeltaSpec() method

### 3.2 Task Management
- [ ] Implement parseTasksMarkdown() method
- [ ] Implement readTasks() method
- [ ] Implement toggleTask() method
- [ ] Implement getTaskProgress() method
- [ ] Add task parsing edge case handling
- [ ] Ensure task toggle preserves formatting

### 3.3 File Watcher
- [ ] Setup FileSystemWatcher for openspec/**/*.md
- [ ] Setup FileSystemWatcher for openspec/**/*.yaml
- [ ] Implement debounced refresh logic
- [ ] Handle file create events
- [ ] Handle file change events
- [ ] Handle file delete events

### 3.4 Unit Tests
- [ ] Test task markdown parsing
- [ ] Test task toggle functionality
- [ ] Test artifact reading
- [ ] Test file path resolution
- [ ] Test error handling for missing files

## Phase 4: Data Cache Layer

### 4.1 Cache Service
- [ ] Create DataCacheService class
- [ ] Implement get() method with TTL check
- [ ] Implement set() method
- [ ] Implement invalidate() method
- [ ] Implement invalidateAll() method
- [ ] Implement invalidatePattern() method

### 4.2 Cache Integration
- [ ] Integrate cache with CLI service
- [ ] Add cache invalidation on file changes
- [ ] Configure cache TTL (default 10s)
- [ ] Add cache statistics logging

## Phase 5: Command Registration

### 5.1 Command Definitions
- [ ] Define openspec.openDashboard command
- [ ] Define openspec.refreshData command
- [ ] Define openspec.newChange command
- [ ] Define openspec.openChange command
- [ ] Define openspec.archiveChange command
- [ ] Define openspec.copyOpsxCommand command

### 5.2 Command Handlers
- [ ] Implement handleOpenDashboard()
- [ ] Implement handleRefreshData()
- [ ] Implement handleNewChange() with input prompt
- [ ] Implement handleOpenChange()
- [ ] Implement handleArchiveChange() with confirmation
- [ ] Implement handleCopyCommand() with clipboard

### 5.3 Command Registration
- [ ] Register all commands in activate()
- [ ] Add commands to package.json contributions
- [ ] Add keyboard shortcuts (optional)
- [ ] Add context menu items (optional)

## Phase 6: Dashboard Webview Provider

### 6.1 Provider Setup
- [ ] Create DashboardProvider class
- [ ] Implement show() method to create webview panel
- [ ] Implement getWebviewContent() for HTML shell
- [ ] Setup webview options (scripts, resources)
- [ ] Add panel state management (singleton)

### 6.2 Message Passing
- [ ] Implement setupMessageHandler()
- [ ] Handle 'requestData' message
- [ ] Handle 'toggleTask' message
- [ ] Handle 'openChange' message
- [ ] Handle 'copyCommand' message
- [ ] Handle 'createChange' message
- [ ] Handle 'archiveChange' message

### 6.3 Data Sending
- [ ] Implement sendData() method
- [ ] Implement sendInitialData() on panel creation
- [ ] Format data for webview consumption
- [ ] Add error handling for failed sends

### 6.4 Integration
- [ ] Connect provider to CLI service
- [ ] Connect provider to File Manager
- [ ] Connect provider to Cache service
- [ ] Connect provider to File Watcher events

## Phase 7: React Webview Application

### 7.1 React Setup
- [ ] Create React app entry point (index.tsx)
- [ ] Create App.tsx component
- [ ] Setup Tailwind CSS
- [ ] Add Radix UI dependencies
- [ ] Configure Vite build

### 7.2 VSCode Integration
- [ ] Create useVscode hook for API access
- [ ] Implement message posting helper
- [ ] Implement message receiving handler
- [ ] Add VSCode theme color support

### 7.3 State Management
- [ ] Create AppContext with reducer
- [ ] Define state shape (changes, specs, selected, etc.)
- [ ] Define actions (SET_CHANGES, SET_SPECS, etc.)
- [ ] Implement reducer logic
- [ ] Provide context to app

### 7.4 Data Loading
- [ ] Request initial data on mount
- [ ] Handle updateData message from extension
- [ ] Update state on data received
- [ ] Add loading states
- [ ] Add error states

## Phase 8: Dashboard View

### 8.1 Layout Structure
- [ ] Create Dashboard component
- [ ] Add Header with title and actions
- [ ] Create ChangesSection component
- [ ] Create SpecsSection component
- [ ] Create ArchiveSection component (placeholder)
- [ ] Add responsive layout (CSS Grid or Flexbox)

### 8.2 Changes Section
- [ ] Create ChangeCard component
- [ ] Display change name, progress, last modified
- [ ] Add progress bar visualization
- [ ] Group changes by status (draft/active/completed)
- [ ] Add status section headers with counts
- [ ] Implement click to navigate to change detail

### 8.3 Empty States
- [ ] Create EmptyState component
- [ ] Show empty state when no changes
- [ ] Add "Create New Change" button
- [ ] Show empty state for specs when none exist

### 8.4 Quick Actions
- [ ] Add hover actions on ChangeCard
- [ ] Implement "Copy /opsx:ff" button
- [ ] Implement "Copy /opsx:apply" button
- [ ] Implement "Archive" button (conditional)
- [ ] Add clipboard copy notification

### 8.5 Specs Display
- [ ] Create SpecCard component
- [ ] Display spec name and requirement count
- [ ] Add click to view spec details
- [ ] Style spec cards

### 8.6 Global Actions
- [ ] Add "New Change" button in header
- [ ] Add "Refresh" button in header
- [ ] Implement new change dialog/prompt
- [ ] Implement refresh data action

## Phase 9: Change Detail View

### 9.1 View Structure
- [ ] Create ChangeDetail component
- [ ] Add tabs for artifacts (Proposal, Specs, Design, Tasks)
- [ ] Implement tab switching logic
- [ ] Add back navigation to dashboard
- [ ] Display change name in header

### 9.2 Artifact Viewer
- [ ] Create ArtifactViewer component
- [ ] Request artifact content from extension
- [ ] Handle artifact loading state
- [ ] Handle artifact not found state
- [ ] Display artifact content

### 9.3 Markdown Rendering
- [ ] Choose markdown library (marked or markdown-it)
- [ ] Create MarkdownRenderer component
- [ ] Implement markdown to HTML conversion
- [ ] Add syntax highlighting for code blocks
- [ ] Style markdown output to match VSCode theme
- [ ] Handle internal links

### 9.4 Task List View
- [ ] Create TaskList component
- [ ] Create TaskCheckbox component
- [ ] Display tasks with proper indentation
- [ ] Implement task toggle interaction
- [ ] Add optimistic UI update
- [ ] Show task completion animation

### 9.5 Action Bar
- [ ] Create ActionBar component
- [ ] Add "Copy /opsx:ff" button
- [ ] Add "Copy /opsx:apply" button
- [ ] Add "Open in Editor" button
- [ ] Add "Archive Change" button (conditional)
- [ ] Add "Refresh" button

## Phase 10: UI Components Library

### 10.1 Base Components
- [ ] Setup Radix UI primitives
- [ ] Create Button component (with variants)
- [ ] Create Card component
- [ ] Create Tabs component
- [ ] Create Progress component
- [ ] Create LoadingSpinner component

### 10.2 Utility Components
- [ ] Create ErrorBoundary component
- [ ] Create Tooltip component
- [ ] Create Badge component (for status)
- [ ] Create EmptyState component
- [ ] Create ConfirmDialog component

### 10.3 Styling
- [ ] Setup Tailwind utility classes
- [ ] Create shared color palette
- [ ] Add VSCode theme variable integration
- [ ] Create component variants (CVA)
- [ ] Add animations and transitions

## Phase 11: Testing & Polish

### 11.1 Manual Testing
- [ ] Test extension activation
- [ ] Test CLI not found scenario
- [ ] Test workspace without openspec/
- [ ] Test dashboard loading
- [ ] Test change list display
- [ ] Test change detail navigation
- [ ] Test task toggle functionality
- [ ] Test file watching and auto-refresh
- [ ] Test all quick action buttons
- [ ] Test error scenarios

### 11.2 Edge Cases
- [ ] Test with no changes
- [ ] Test with no specs
- [ ] Test with large task files (100+ tasks)
- [ ] Test with deeply nested tasks
- [ ] Test with special characters in names
- [ ] Test rapid task toggles
- [ ] Test external file modifications

### 11.3 Performance
- [ ] Profile initial load time
- [ ] Test responsiveness with 50+ changes
- [ ] Verify cache is working
- [ ] Verify debouncing is effective
- [ ] Optimize bundle size if needed

### 11.4 Polish
- [ ] Add loading indicators for all async operations
- [ ] Ensure all errors have helpful messages
- [ ] Add keyboard shortcuts documentation
- [ ] Improve UI feedback (animations, transitions)
- [ ] Review accessibility (keyboard navigation)

## Phase 12: Documentation & Release

### 12.1 Documentation
- [ ] Update README.md with features and usage
- [ ] Add screenshots to README
- [ ] Create CHANGELOG.md
- [ ] Document keyboard shortcuts
- [ ] Add troubleshooting section
- [ ] Document configuration options

### 12.2 Package Configuration
- [ ] Update package.json metadata (description, keywords)
- [ ] Add icon.png
- [ ] Add LICENSE file
- [ ] Configure .vscodeignore
- [ ] Set version to 0.1.0

### 12.3 Release Preparation
- [ ] Run final build and test
- [ ] Package extension (.vsix)
- [ ] Test installation from .vsix
- [ ] Prepare release notes
- [ ] Tag release in git

### 12.4 Publishing (Optional)
- [ ] Create publisher account on VSCode Marketplace
- [ ] Publish to marketplace
- [ ] Verify listing looks correct
- [ ] Share with OpenSpec community

## Post-MVP Enhancements (Phase 2)

### Sidebar Tree View
- [ ] Create SidebarProvider class
- [ ] Implement tree view structure
- [ ] Display changes as tree items
- [ ] Display specs as tree items
- [ ] Add expand/collapse functionality
- [ ] Add click to navigate

### Spec Diff Viewer
- [ ] Create DiffViewer component
- [ ] Implement diff algorithm (or use library)
- [ ] Highlight additions (green)
- [ ] Highlight modifications (yellow)
- [ ] Highlight deletions (red)
- [ ] Add side-by-side view option

### Archive Browser
- [ ] Implement archive listing
- [ ] Create ArchiveBrowser view
- [ ] Display archived changes with dates
- [ ] Add search/filter for archives
- [ ] Add archive detail view

### File Navigation
- [ ] Add "Open in Editor" for artifacts
- [ ] Jump to specific line in tasks.md
- [ ] Add breadcrumb navigation
- [ ] Link requirements to implementation files

## Summary

**Total Tasks: ~200**

**Estimated Timeline:**
- Phase 1-6 (Foundation & Backend): 1-2 weeks
- Phase 7-9 (Frontend Core): 1-2 weeks
- Phase 10-11 (UI & Testing): 1 week
- Phase 12 (Documentation & Release): 3-5 days

**MVP Completion: ~4 weeks** (with focused development)

**Key Milestones:**
- ✅ Phase 2 complete: Can call OpenSpec CLI
- ✅ Phase 3 complete: Can read/write task files
- ✅ Phase 7 complete: React app loads in webview
- ✅ Phase 8 complete: Dashboard displays changes
- ✅ Phase 9 complete: Can view change details and toggle tasks
- ✅ Phase 11 complete: All features tested and polished
- ✅ Phase 12 complete: MVP ready for release

## Next Steps

1. Review and adjust task breakdown as needed
2. Set up development environment (Phase 1)
3. Begin implementation starting with Phase 2
4. Track progress by checking off completed tasks
5. Iterate based on feedback and discoveries
