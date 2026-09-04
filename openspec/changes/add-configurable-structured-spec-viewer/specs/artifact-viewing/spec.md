## MODIFIED Requirements

### Requirement: Artifact Content Rendering
The system SHALL render artifact content in a readable format and SHALL use a shared structured reading mode for canonical main and delta Spec documents.

#### Scenario: Render proposal
- **GIVEN** a `proposal.md` file
- **WHEN** the user views it
- **THEN** the markdown MUST be rendered as formatted HTML
- **AND** headings, lists, and code blocks MUST be styled correctly
- **AND** links MUST be clickable

#### Scenario: Render specs
- **GIVEN** a main or change `specs/<domain>/spec.md` file
- **WHEN** the user views it
- **THEN** requirements and scenarios MUST be clearly distinguished
- **AND** normative keywords `SHALL`, `MUST`, and `SHOULD` MUST be highlighted
- **AND** scenario `GIVEN`/`WHEN`/`THEN` structure MUST remain readable

#### Scenario: Render structured main spec
- **GIVEN** a main `openspec/specs/<domain>/spec.md` file with canonical `### Requirement:` and `#### Scenario:` headings
- **WHEN** the user views it
- **THEN** content outside Requirement blocks MUST render as ordinary Markdown
- **AND** each Requirement MUST render as an expanded disclosure with its complete normative body visible
- **AND** each Scenario MUST render as a nested collapsed disclosure showing its title
- **AND** the user MUST be able to expand or collapse each disclosure with pointer or keyboard controls

#### Scenario: Render structured delta spec
- **GIVEN** a change `specs/<domain>/spec.md` file with canonical `### Requirement:` and `#### Scenario:` headings
- **WHEN** the user views it
- **THEN** it MUST use the same Requirement and Scenario structure as a main Spec
- **AND** delta operation headings and content outside Requirement blocks MUST remain visible as ordinary Markdown

#### Scenario: Restore disclosure defaults
- **GIVEN** the user changed Requirement or Scenario disclosure state
- **WHEN** the Spec is reopened or refreshed
- **THEN** every Requirement MUST return to expanded state
- **AND** every Scenario MUST return to collapsed state

#### Scenario: Fall back for a non-canonical spec
- **GIVEN** a Spec whose Requirement and Scenario structure cannot be parsed safely
- **WHEN** the user views it
- **THEN** the complete source MUST render through the existing Markdown presentation
- **AND** no source content MUST be omitted
- **AND** the rendering failure MUST NOT prevent other artifacts from being viewed

#### Scenario: Render design
- **GIVEN** a `design.md` with ASCII diagrams
- **WHEN** displayed
- **THEN** ASCII diagrams MUST preserve formatting with a monospace font
- **AND** code blocks MUST have syntax highlighting
- **AND** headings MUST create a navigable outline

#### Scenario: Render tasks
- **GIVEN** a `tasks.md` file
- **WHEN** displayed
- **THEN** tasks MUST show as interactive checkboxes as defined by the Task Management spec
- **AND** non-task content MUST render as Markdown
- **AND** task hierarchy MUST be visually clear

## ADDED Requirements

### Requirement: Configurable Spec keyword highlighting
The system SHALL highlight semantic keywords in structured main and delta Specs with theme-aware defaults and SHALL allow valid workspace configuration to add or override keyword colors.

#### Scenario: Apply default semantic colors
- **GIVEN** no `openspec.specKeywordColors` overrides are configured
- **WHEN** a structured Spec is rendered
- **THEN** complete uppercase words `GIVEN` and `WHEN` MUST use a blue theme color
- **AND** complete uppercase word `THEN` MUST use a green theme color
- **AND** complete uppercase word `AND` MUST use a gray theme color
- **AND** complete uppercase words `MUST`, `SHALL`, and `SHOULD` MUST use a red theme color
- **AND** the surrounding text and Markdown emphasis MUST remain unchanged

#### Scenario: Add and override configured keywords
- **GIVEN** `openspec.specKeywordColors` contains uppercase single-token keys matching `[A-Z][A-Z0-9_-]*`
- **AND** it contains no more than 64 entries and each key is no longer than 32 characters
- **AND** each configured value is either a `#RRGGBB` color or a `vscode:<theme-color-id>` reference
- **WHEN** a main or delta Spec is opened or refreshed
- **THEN** a custom key MUST be highlighted with its configured color
- **AND** a configured built-in key MUST override its default color
- **AND** complete-word matching MUST prevent partial-word highlights

#### Scenario: Ignore invalid keyword configuration safely
- **GIVEN** `openspec.specKeywordColors` contains invalid keys, invalid colors, values of the wrong type, or entries beyond supported bounds
- **WHEN** a Spec is opened or refreshed
- **THEN** invalid custom entries MUST be ignored
- **AND** an invalid built-in override MUST retain its default color
- **AND** valid entries MUST still take effect
- **AND** the Spec MUST remain readable

#### Scenario: Skip non-semantic text contexts
- **GIVEN** a highlighted keyword also appears inside a code block, inline code, link, or Mermaid diagram
- **WHEN** the structured Spec is rendered
- **THEN** those non-semantic occurrences MUST NOT receive keyword highlighting
- **AND** matching occurrences in ordinary prose and scenario steps MUST remain highlighted

#### Scenario: Apply configuration on the next content load
- **GIVEN** a user changes `openspec.specKeywordColors` while a Spec is already displayed
- **WHEN** no content reload has occurred
- **THEN** the displayed colors MUST remain unchanged
- **WHEN** the user reopens or refreshes that Spec
- **THEN** the newly effective valid configuration MUST be applied
