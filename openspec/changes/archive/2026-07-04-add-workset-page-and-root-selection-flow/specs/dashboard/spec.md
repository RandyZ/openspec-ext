## ADDED Requirements

### Requirement: OpenSpec Root Selector Separates Projects And Stores
Dashboard SHALL present OpenSpec root selection as a Project/Store scope choice and SHALL NOT present worksets as selectable roots.

#### Scenario: Root selector groups project and store roots
- **GIVEN** dashboard data includes a local project scope and one or more store scopes
- **WHEN** the dashboard renders the OpenSpec root selector
- **THEN** the selector MUST distinguish project roots from store roots through grouping or equivalent labels
- **AND** each option MUST expose the root label and enough secondary metadata to disambiguate same-named roots

#### Scenario: Multi-folder workspace exposes all project roots
- **GIVEN** the current VS Code workspace contains multiple folders with `openspec/config.yaml`
- **WHEN** the dashboard loads OpenSpec root options
- **THEN** the Project group MUST include each discovered project root
- **AND** the Project group MUST NOT collapse the workspace to only the first OpenSpec folder

#### Scenario: Worksets are excluded from root selector
- **GIVEN** dashboard data includes saved worksets from `openspec workset list --json`
- **WHEN** the dashboard renders the OpenSpec root selector
- **THEN** no workset MUST appear as a selectable root option
- **AND** the selector MUST contain only root-scoped project or store options

#### Scenario: Selecting a project or store scopes dashboard data
- **GIVEN** the user selects a project or store from the OpenSpec root selector
- **WHEN** the extension host returns dashboard data for that scope
- **THEN** changes, archived changes, specs, New Change, and workflow actions MUST be scoped to the selected OpenSpec root
- **AND** the dashboard MUST keep the selected root visible while the scoped data is loading or displayed

#### Scenario: Selecting a project root runs local OpenSpec commands from that root
- **GIVEN** the user selects a non-store project root from the OpenSpec root selector
- **WHEN** the extension host loads changes, specs, archives, artifacts, or workflow instructions for that scope
- **THEN** local OpenSpec CLI commands MUST execute with that selected project root as their working directory
- **AND** the extension MUST NOT resolve project-scoped commands from a different workspace folder merely because it was the activation root

### Requirement: Worksets Workspace Page
Dashboard SHALL provide a dedicated Worksets workspace page backed by `openspec workset list --json`.

#### Scenario: Workset list shows CLI metadata
- **GIVEN** `openspec workset list --json` returns saved worksets
- **WHEN** the user opens the Worksets workspace page
- **THEN** each workset entry MUST show the workset name
- **AND** each entry MUST show the default tool or opener when provided by the CLI
- **AND** each entry MUST show the member count
- **AND** each entry MUST show member folders in CLI order

#### Scenario: First workset member is primary
- **GIVEN** a workset has at least one member folder
- **WHEN** the Worksets workspace page renders that workset
- **THEN** the first member MUST be identified as the primary member
- **AND** the UI MUST indicate that OpenSpec sessions start from that primary folder

#### Scenario: Workset open action launches workspace view
- **GIVEN** a workset is listed on the Worksets workspace page
- **WHEN** the user triggers the workset open action
- **THEN** the extension MUST request `openspec workset open <name>` or the equivalent supported opener flow
- **AND** the action MUST NOT directly change the selected OpenSpec root in the current dashboard data

#### Scenario: Empty workset list
- **GIVEN** `openspec workset list --json` returns no saved worksets
- **WHEN** the user opens the Worksets workspace page
- **THEN** the page MUST show an empty state explaining that worksets are saved multi-folder workspace views
- **AND** the empty state MUST NOT imply that no project or store OpenSpec roots exist

### Requirement: Workset And Root Semantics Are Clear
Dashboard SHALL explain and preserve the distinction between worksets, project roots, and store roots during cross-project development.

#### Scenario: Workset page explains root selection remains explicit
- **GIVEN** the user is viewing the Worksets workspace page
- **WHEN** at least one project or store root is available
- **THEN** the page MUST communicate that opening a workset changes the editor workspace view
- **AND** it MUST communicate that OpenSpec artifacts are still scoped by the selected project or store root

#### Scenario: Current root remains visible while managing worksets
- **GIVEN** the user has selected a project or store root
- **WHEN** the user navigates to the Worksets workspace page
- **THEN** the dashboard MUST keep the current OpenSpec root visible or easily recoverable
- **AND** workset management MUST NOT obscure which root owns visible changes and specs

#### Scenario: Store and project maintenance is separate from workset launching
- **GIVEN** dashboard provides store setup, store register, project root selection, and workset open actions
- **WHEN** those actions are rendered
- **THEN** store/project root management MUST be visually and behaviorally separate from workset launch actions
- **AND** root-affecting actions MUST use root-scoped pending states
- **AND** workset launch actions MUST use workspace-launch pending or feedback states
