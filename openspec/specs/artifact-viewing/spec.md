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
The system SHALL display delta specs with diff highlighting when Phase 2 delta viewing is enabled.

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

### Requirement: Stable webview action icons
Change detail and artifact action controls SHALL render stable, accessible icons in VS Code and Cursor webviews.

Critical action icons MUST NOT depend on a webfont that can fail to load inside the webview. Each icon-only action MUST retain an accessible label and tooltip.

#### Scenario: Copy change name icon renders
- **GIVEN** the user opens a change detail view
- **WHEN** the copy change name action is visible beside the change title
- **THEN** the action MUST render a visible copy icon
- **AND** the icon MUST NOT appear as an empty square or missing glyph
- **AND** the action MUST expose an accessible label for copying the change name

#### Scenario: Copy change name success state renders
- **GIVEN** the user clicks the copy change name action
- **WHEN** the copy operation succeeds
- **THEN** the action MUST render a visible success icon or equivalent visual confirmation
- **AND** the action MUST update its accessible label to indicate that the change name was copied

#### Scenario: Icons render without codicon font
- **GIVEN** the codicon webfont is unavailable or blocked by webview resource loading
- **WHEN** change detail action buttons render
- **THEN** critical action icons MUST remain visible
- **AND** action buttons MUST remain keyboard focusable and screen-reader addressable

### Requirement: Content Search (Phase 2)
The system SHALL support searching within artifacts when Phase 2 content search is enabled.

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

### Requirement: Artifact access uses selected scope root
The system SHALL read change artifacts and specs from the selected OpenSpec scope root.

#### Scenario: Read artifact from local root
- **GIVEN** the selected scope is the workspace local root
- **WHEN** the user opens a change artifact
- **THEN** the system MUST read from the workspace root's `openspec/changes/<change>/` directory
- **AND** existing single-root artifact behavior MUST be preserved

#### Scenario: Read artifact from store root
- **GIVEN** the selected scope is a registered store
- **WHEN** the user opens a change artifact from that store
- **THEN** the system MUST read from the selected store root's `openspec/changes/<change>/` directory
- **AND** it MUST NOT read from the workspace root's `openspec/changes/` directory

#### Scenario: Read main spec from selected root
- **GIVEN** the selected scope is a registered store
- **WHEN** the user opens a main spec from the specs section
- **THEN** the system MUST read from the selected store root's `openspec/specs/<spec>/spec.md`
- **AND** it MUST NOT use a same-named spec under the workspace root

### Requirement: Scoped editor opens
The system SHALL open artifact and spec files from the selected root while preventing accidental path escapes.

#### Scenario: Open store artifact in editor
- **GIVEN** a store scope is selected
- **AND** the selected store root is outside the VS Code workspace folder
- **WHEN** the user clicks Open in Editor for a store artifact
- **THEN** the extension MUST allow opening the file from the selected store root
- **AND** it MUST verify the resolved artifact path is inside that selected store root

#### Scenario: Reject path outside selected root
- **GIVEN** a selected scope root
- **WHEN** an artifact or spec open request resolves outside that root
- **THEN** the extension MUST reject the open request
- **AND** it MUST show a friendly error message
- **AND** it MUST not open the escaped path

#### Scenario: Explorer reveal is best effort for external store roots
- **GIVEN** an artifact file is opened from a store root outside the workspace
- **WHEN** the extension attempts to reveal it in the VS Code explorer
- **THEN** reveal behavior MAY be skipped if the file is outside workspace folders
- **AND** the document MUST still open in the editor when VS Code allows it

### Requirement: Scoped task state and toggles
The system SHALL apply task reads and task toggles to the selected scope root.

#### Scenario: Toggle task in store-scoped change
- **GIVEN** a registered store scope is selected
- **AND** a change detail view is showing a store-scoped `tasks.md`
- **WHEN** the user confirms a task toggle
- **THEN** the extension MUST update the `tasks.md` under the selected store root
- **AND** it MUST refresh dashboard data for the selected store scope

#### Scenario: Task execution state follows selected root
- **GIVEN** a store-scoped change has extension task execution state
- **WHEN** the extension reads or writes task execution state
- **THEN** it MUST use the change metadata file under the selected store root
- **AND** it MUST not mix state with a same-named local-root change

#### Scenario: Archived store change remains read-only
- **GIVEN** a store-scoped archived change is opened
- **WHEN** artifact content is displayed
- **THEN** the extension MUST keep task toggles and write actions disabled
- **AND** the read-only behavior MUST match local archived changes

### Requirement: Scope change invalidates artifact caches
The system SHALL prevent artifact content from one scope appearing in another scope after the selected scope changes.

#### Scenario: Change detail cache includes scope identity
- **GIVEN** a change detail panel has cached artifact content for one scope
- **WHEN** the selected scope changes to a different root
- **THEN** cached artifact content MUST be invalidated or keyed by scope identity
- **AND** the panel MUST request content from the new selected root before rendering

#### Scenario: Same change name in two roots is isolated
- **GIVEN** the local root and a store root both contain a change with the same name
- **WHEN** the user switches scopes and opens that change name
- **THEN** the extension MUST show artifacts from the selected scope only
- **AND** task progress, specs, and open-in-editor paths MUST not be borrowed from the other root

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
