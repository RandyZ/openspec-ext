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
- [x] Add extension manifest (package.json contributions)
- [x] Setup basic logging infrastructure

## Phase 2: CLI Integration Layer

### 2.1 OpenSpec CLI Service
- [x] Create OpenSpecCliService class
- [x] Implement checkAvailability() method
- [x] Implement getVersion() method
- [x] Implement execOpenSpec() helper
- [x] Add timeout handling for CLI commands
- [x] Implement JSON parsing with error handling

### 2.2 CLI Commands
- [x] Implement listChanges() method
- [x] Implement showChange() method
- [x] Implement listSpecs() method
- [x] Implement validateChange() method
- [x] Implement createChange() method
- [x] Implement archiveChange() method

### 2.3 Error Handling
- [x] Create OpenSpecCliError class
- [x] Add retry logic with exponential backoff
- [x] Implement user-friendly error messages
- [x] Add CLI not found error notification
- [x] Add workspace not initialized error handling

### 2.4 Unit Tests
- [ ] Test CLI availability check
- [ ] Test JSON parsing with valid data
- [ ] Test JSON parsing with malformed data
- [ ] Test command execution success cases
- [ ] Test command execution error cases
- [ ] Test timeout handling

## Phase 3: File System Layer

### 3.1 File Manager Service
- [x] Create FileManagerService class
- [x] Implement artifact path resolution
- [x] Implement readArtifact() method
- [x] Implement artifactExists() method
- [x] Implement readSpec() method
- [x] Implement readDeltaSpec() method

### 3.2 Task Management
- [x] Implement parseTasksMarkdown() method
- [x] Implement readTasks() method
- [x] Implement toggleTask() method
- [x] Implement getTaskProgress() method
- [x] Add task parsing edge case handling
- [x] Ensure task toggle preserves formatting

### 3.3 File Watcher
- [x] Setup FileSystemWatcher for openspec/**/*.md
- [x] Setup FileSystemWatcher for openspec/**/*.yaml
- [x] Implement debounced refresh logic
- [x] Handle file create events
- [x] Handle file change events
- [x] Handle file delete events

### 3.4 Unit Tests
- [x] Test task markdown parsing
- [x] Test task toggle functionality
- [x] Test artifact reading
- [ ] Test file path resolution
- [ ] Test error handling for missing files

## Phase 4: Data Cache Layer

### 4.1 Cache Service
- [x] Create DataCacheService class (integrated into DataManager)
- [x] Implement get() method with TTL check
- [x] Implement set() method
- [x] Implement invalidate() method
- [x] Implement invalidateAll() method
- [x] Implement invalidatePattern() method

### 4.2 Cache Integration
- [x] Integrate cache with CLI service
- [x] Add cache invalidation on file changes
- [x] Configure cache TTL (default 10s)
- [x] Add cache statistics logging

## Phase 5: Command Registration

### 5.1 Command Definitions
- [x] Define openspec.openDashboard command
- [x] Define openspec.refreshData command
- [x] Define openspec.newChange command
- [x] Define openspec.openChange command
- [x] Define openspec.archiveChange command
- [x] Define openspec.copyOpsxCommand command

### 5.2 Command Handlers
- [x] Implement handleOpenDashboard()
- [x] Implement handleRefreshData()
- [x] Implement handleNewChange() with input prompt
- [x] Implement handleOpenChange()
- [x] Implement handleArchiveChange() with confirmation
- [x] Implement handleCopyCommand() with clipboard

### 5.3 Command Registration
- [x] Register all commands in activate()
- [x] Add commands to package.json contributions
- [x] Add keyboard shortcuts (optional)
- [x] Add context menu items (optional)

## Phase 6: Dashboard Webview Provider

### 6.1 Provider Setup
- [x] Create DashboardProvider class
- [x] Implement show() method to create webview panel
- [x] Implement getWebviewContent() for HTML shell
- [x] Setup webview options (scripts, resources)
- [x] Add panel state management (singleton)

### 6.2 Message Passing
- [x] Implement setupMessageHandler()
- [x] Handle 'requestData' message
- [x] Handle 'toggleTask' message
- [x] Handle 'openChange' message
- [x] Handle 'copyCommand' message
- [x] Handle 'createChange' message
- [x] Handle 'archiveChange' message

### 6.3 Data Sending
- [x] Implement sendData() method
- [x] Implement sendInitialData() on panel creation
- [x] Format data for webview consumption
- [x] Add error handling for failed sends

### 6.4 Integration
- [x] Connect provider to CLI service
- [x] Connect provider to File Manager
- [x] Connect provider to Cache service
- [x] Connect provider to File Watcher events

## Phase 7: React Webview Application

### 7.1 React Setup
- [x] Create React app entry point (index.tsx)
- [x] Create App.tsx component
- [x] Setup Tailwind CSS
- [x] Add Radix UI dependencies
- [x] Configure Vite build

### 7.2 VSCode Integration
- [x] Create useVscode hook for API access
- [x] Implement message posting helper
- [x] Implement message receiving handler
- [x] Add VSCode theme color support

### 7.3 State Management
- [x] Create AppContext with reducer
- [x] Define state shape (changes, specs, selected, etc.)
- [x] Define actions (SET_CHANGES, SET_SPECS, etc.)
- [x] Implement reducer logic
- [x] Provide context to app

### 7.4 Data Loading
- [x] Request initial data on mount
- [x] Handle updateData message from extension
- [x] Update state on data received
- [x] Add loading states
- [x] Add error states

## Phase 8: Dashboard View

### 8.1 Layout Structure
- [x] Create Dashboard component
- [x] Add Header with title and actions
- [x] Create ChangesSection component
- [x] Create SpecsSection component
- [x] Create ArchiveSection component (placeholder)
- [x] Add responsive layout (CSS Grid or Flexbox)

### 8.2 Changes Section
- [x] Create ChangeCard component
- [x] Display change name, progress, last modified
- [x] Add progress bar visualization
- [x] Group changes by status (draft/active/completed)
- [x] Add status section headers with counts
- [x] Implement click to navigate to change detail

### 8.3 Empty States
- [x] Create EmptyState component
- [x] Show empty state when no changes
- [x] Add "Create New Change" button
- [x] Show empty state for specs when none exist

### 8.4 Quick Actions
- [x] Add hover actions on ChangeCard
- [x] Implement "Copy /opsx:ff" button
- [x] Implement "Copy /opsx:apply" button
- [x] Implement "Archive" button (conditional)
- [x] Add clipboard copy notification

### 8.5 Specs Display
- [x] Create SpecCard component
- [x] Display spec name and requirement count
- [x] Add click to view spec details
- [x] Style spec cards

### 8.6 Global Actions
- [x] Add "New Change" button in header
- [x] Add "Refresh" button in header
- [x] Implement new change dialog/prompt
- [x] Implement refresh data action

## Phase 9: Change Detail View

### 9.1 View Structure
- [x] Create ChangeDetail component
- [x] Add tabs for artifacts (Proposal, Specs, Design, Tasks)
- [x] Implement tab switching logic
- [x] Add back navigation to dashboard
- [x] Display change name in header

### 9.2 Artifact Viewer
- [x] Create ArtifactViewer component
- [x] Request artifact content from extension
- [x] Handle artifact loading state
- [x] Handle artifact not found state
- [x] Display artifact content

### 9.3 Markdown Rendering
- [x] Choose markdown library (marked or markdown-it)
- [x] Create MarkdownRenderer component
- [x] Implement markdown to HTML conversion
- [ ] Add syntax highlighting for code blocks
- [x] Style markdown output to match VSCode theme
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
