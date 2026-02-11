# Artifact Viewing Specification

## Purpose

Enable users to view and navigate OpenSpec artifacts (proposal, specs, design, tasks) within the extension UI.

## Requirements

### Requirement: Artifact List Display
The system SHALL display all artifacts for a given change.

#### Scenario: Show available artifacts
- GIVEN a change with multiple artifacts
- WHEN the user opens change details
- THEN all existing artifacts MUST be shown as tabs or list items
- AND artifacts MUST include: proposal, specs, design, tasks
- AND missing artifacts MUST be indicated as "Not created"

#### Scenario: Artifact status indication
- GIVEN artifacts in various states
- WHEN displayed
- THEN each artifact MUST show:
  - Name (e.g., "Proposal", "Design")
  - Status (exists, missing, or empty)
  - Last modified time (if exists)
  - File size (optional)

### Requirement: Artifact Content Rendering
The system SHALL render artifact content in a readable format.

#### Scenario: Render proposal
- GIVEN a `proposal.md` file
- WHEN the user views it
- THEN the markdown MUST be rendered as formatted HTML
- AND headings, lists, code blocks MUST be styled correctly
- AND links SHOULD be clickable

#### Scenario: Render specs
- GIVEN a `specs/<domain>/spec.md` file
- WHEN the user views it
- THEN requirements and scenarios MUST be clearly distinguished
- AND requirement keywords (SHALL, MUST, SHOULD) SHOULD be highlighted
- AND scenario Given/When/Then structure SHOULD be formatted

#### Scenario: Render design
- GIVEN a `design.md` with ASCII diagrams
- WHEN displayed
- THEN ASCII diagrams MUST preserve formatting (monospace font)
- AND code blocks MUST have syntax highlighting
- AND headings MUST create a navigable outline

#### Scenario: Render tasks
- GIVEN a `tasks.md` file
- WHEN displayed
- THEN tasks MUST show as interactive checkboxes (see Task Management spec)
- AND non-task content MUST render as markdown
- AND task hierarchy MUST be visually clear

### Requirement: Artifact Navigation
The system SHALL provide easy navigation between artifacts.

#### Scenario: Tab-based navigation
- GIVEN multiple artifacts exist
- WHEN the user is viewing change details
- THEN artifacts MUST be organized in tabs
- AND clicking a tab MUST switch to that artifact's content
- AND the current tab MUST be visually highlighted

#### Scenario: Artifact quick links
- GIVEN an artifact references another artifact
- WHEN such a reference is detected (e.g., "See design.md")
- THEN it SHOULD be rendered as a clickable link
- AND clicking SHOULD navigate to the referenced artifact

### Requirement: Markdown Rendering
The system SHALL correctly render GitHub-flavored markdown.

#### Scenario: Standard markdown elements
- GIVEN markdown with standard elements
- WHEN rendered
- THEN it MUST correctly display:
  - Headings (h1-h6)
  - Bold and italic text
  - Lists (ordered and unordered)
  - Code blocks with syntax highlighting
  - Links
  - Images (if any)

#### Scenario: Code syntax highlighting
- GIVEN a code block with language tag
- WHEN rendered
- THEN syntax highlighting MUST be applied
- AND the language MUST match VSCode's theme
- AND common languages MUST be supported (ts, js, py, go, etc.)

#### Scenario: Tables
- GIVEN markdown tables
- WHEN rendered
- THEN tables MUST be formatted with borders
- AND cells MUST align correctly
- AND tables MUST be responsive (wrap if needed)

### Requirement: Spec Delta Viewing (Phase 2)
The system SHOULD display delta specs with diff highlighting.

#### Scenario: Delta spec vs main spec
- GIVEN a change with delta spec at `specs/<domain>/spec.md`
- AND a main spec at `openspec/specs/<domain>/spec.md`
- WHEN the user views the delta spec
- THEN differences SHOULD be highlighted:
  - Added requirements (green)
  - Modified requirements (yellow)
  - Removed requirements (red)
- AND a "View Main Spec" link SHOULD be provided

#### Scenario: New spec (no main)
- GIVEN a change creating a new spec
- AND no corresponding main spec exists
- WHEN viewing the delta spec
- THEN all content SHOULD be marked as "new"
- AND a note SHOULD explain this is a new spec

### Requirement: Artifact Actions
The system SHALL provide actions for artifact management.

#### Scenario: Open in editor
- GIVEN any artifact
- WHEN the user clicks "Open in Editor"
- THEN the artifact file MUST open in VSCode editor
- AND the cursor SHOULD be at the top of the file

#### Scenario: Copy file path
- GIVEN any artifact
- WHEN the user clicks "Copy Path"
- THEN the absolute file path MUST be copied to clipboard
- AND a notification SHOULD confirm the copy

#### Scenario: Refresh artifact
- GIVEN an artifact is being viewed
- WHEN the user clicks "Refresh"
- THEN the content MUST be reloaded from disk
- AND the view MUST update to show latest content

### Requirement: Content Search (Phase 2)
The system MAY support searching within artifacts.

#### Scenario: Search across artifacts
- GIVEN a change with multiple artifacts
- WHEN the user enters a search query
- THEN all artifacts MUST be searched
- AND matching results MUST be highlighted
- AND navigation to matches SHOULD be provided

### Requirement: Error Handling
The system SHALL handle artifact viewing errors gracefully.

#### Scenario: Artifact file missing
- GIVEN an expected artifact doesn't exist
- WHEN the user tries to view it
- THEN a message MUST show "Artifact not created"
- AND a "Create Artifact" button SHOULD be offered (if applicable)

#### Scenario: Artifact read error
- GIVEN an artifact file is corrupted or unreadable
- WHEN viewed
- THEN an error message MUST be shown
- AND the raw file content SHOULD be offered as fallback

#### Scenario: Large artifact files
- GIVEN an artifact > 5MB
- WHEN loaded
- THEN a warning SHOULD be shown
- AND loading SHOULD be progressive (paginated or lazy)
- AND the system MUST NOT freeze

### Requirement: Performance
The system SHALL render artifacts efficiently.

#### Scenario: Fast initial render
- GIVEN an artifact < 1MB
- WHEN opened
- THEN rendering MUST complete < 1 second
- AND a loading indicator MUST show if > 300ms

#### Scenario: Smooth scrolling
- GIVEN a rendered artifact
- WHEN scrolling
- THEN scrolling MUST be smooth (60fps)
- AND large documents SHOULD use virtual scrolling

## Design Constraints

- Markdown rendering MUST match VSCode's markdown preview style
- Code syntax highlighting MUST use VSCode's current theme
- All artifacts MUST be viewable without opening external applications
- The UI MUST provide clear indication of which artifact is currently viewed
- Artifact tabs MUST be keyboard-navigable

## Dependencies

- Markdown rendering library (e.g., marked, markdown-it)
- Syntax highlighting library (e.g., Prism, highlight.js, or VSCode's built-in)
- Access to artifact files in `openspec/changes/<name>/`
- VSCode theme colors for consistent styling
