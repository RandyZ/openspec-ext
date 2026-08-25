## ADDED Requirements

### Requirement: Status-owned artifact paths
The extension SHALL use concrete artifact paths returned by the current OpenSpec status response and SHALL fail closed when a path is missing, stale, or outside the bound Change root.

#### Scenario: Read status-owned artifact output
- **GIVEN** current status returns one or more existing output paths for an artifact
- **WHEN** the user opens that artifact
- **THEN** the extension MUST read only those returned paths
- **AND** every path MUST be contained by the bound Change root and allowed scope before reading

#### Scenario: Unknown artifact path is not guessed
- **GIVEN** a custom artifact has no existing output path in current status
- **WHEN** the user views its state
- **THEN** the extension MUST show the artifact as unavailable, ready, blocked, or skipped according to status
- **AND** it MUST NOT guess `<change>/<artifact-id>.md` or another conventional filename

#### Scenario: Out-of-root path fails closed
- **GIVEN** status or stale cached data contains an artifact path outside the bound Change root
- **WHEN** the extension validates the path
- **THEN** the file MUST NOT be read or opened
- **AND** the UI MUST show a safe unavailable message without exposing unrelated file content

### Requirement: Schema-agnostic artifact content rendering
Change Detail SHALL render artifacts declared by the active schema without requiring a dedicated component for every artifact id.

#### Scenario: Render one Markdown output
- **GIVEN** a custom artifact has one readable Markdown output
- **WHEN** the user selects it
- **THEN** the generic Markdown viewer MUST render that file
- **AND** existing Markdown accessibility and theme behavior MUST be preserved

#### Scenario: Render multiple artifact outputs
- **GIVEN** an artifact has multiple existing output paths
- **WHEN** the user selects it
- **THEN** Change Detail MUST show the available files before or alongside their content
- **AND** selecting a file MUST render that exact status-owned output

#### Scenario: Preserve specialized Specs and Tasks rendering
- **GIVEN** the selected artifact contains Specs or Tasks supported by an existing specialized renderer
- **WHEN** its content is displayed
- **THEN** the extension MUST continue to use the specialized renderer
- **AND** other artifact ids MUST fall back to generic Markdown rendering without failing the detail view

## MODIFIED Requirements

### Requirement: Artifact List Display
The system SHALL display the artifacts declared by the current root-bound OpenSpec status response for a Change.

#### Scenario: Show available artifacts
- **GIVEN** current status contains an ordered artifact graph
- **WHEN** the user opens Change Detail
- **THEN** every returned artifact MUST be represented in dynamic navigation or the artifact-state summary
- **AND** artifacts not returned by status MUST NOT be added as fixed empty tabs
- **AND** the displayed order MUST preserve CLI declaration order within the chosen grouping

#### Scenario: Artifact status indication
- **GIVEN** status returns artifacts in done, ready, blocked, or skipped states
- **WHEN** they are displayed
- **THEN** each artifact MUST show its id or display name and current state
- **AND** blocked artifacts MUST expose missing dependencies when available
- **AND** state meaning MUST remain understandable without color alone

### Requirement: Artifact Navigation
The system SHALL provide accessible navigation among schema-declared artifacts and their concrete outputs.

#### Scenario: Tab-based navigation
- **GIVEN** one or more artifacts exist in the current status graph
- **WHEN** the user opens Change Detail
- **THEN** only schema-declared artifacts MUST appear in artifact navigation
- **AND** keyboard and pointer selection MUST switch to the selected artifact's content or status explanation
- **AND** the current selection MUST be visually and programmatically identified

#### Scenario: Navigate among multiple outputs
- **GIVEN** the selected artifact has multiple existing output paths
- **WHEN** the user chooses one output
- **THEN** the view MUST switch to that exact output
- **AND** the selected output MUST remain identifiable without replacing the artifact's workflow state

#### Scenario: Artifact quick links
- **GIVEN** rendered artifact content references another status-declared artifact or output
- **WHEN** the reference is recognized as a safe in-scope target
- **THEN** it MAY be rendered as a clickable link
- **AND** clicking it MUST NOT bypass root containment checks

### Requirement: Error Handling
The system SHALL handle artifact viewing errors without guessing paths or promising unsupported targeted creation.

#### Scenario: Artifact file missing
- **GIVEN** current status reports no existing output for an artifact
- **WHEN** the user selects its state
- **THEN** the UI MUST explain whether it is ready, blocked, or skipped
- **AND** any offered workflow action MUST come from the shared action resolver
- **AND** the UI MUST NOT invent a file path or targeted create command

#### Scenario: Artifact read error
- **GIVEN** a validated artifact path cannot be read
- **WHEN** the user opens it
- **THEN** an error message MUST be shown
- **AND** unrelated files MUST NOT be used as fallback content

#### Scenario: Large artifact files
- **GIVEN** an artifact output exceeds 5MB
- **WHEN** it is selected
- **THEN** a warning MUST be shown
- **AND** the system MUST avoid blocking or freezing the webview
