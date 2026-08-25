## ADDED Requirements

### Requirement: Primary Action Rail Owns Root Context
Dashboard SHALL place OpenSpec root selection and store registration near the primary dashboard actions so users can choose the planning root before refreshing, creating changes, or launching workflows.

#### Scenario: Root selector appears with primary actions
- **GIVEN** dashboard data includes at least one selectable project or store root
- **WHEN** the dashboard renders
- **THEN** the root selector MUST appear in the primary action area near `Refresh` and `New Change`
- **AND** it MUST remain visually associated with root-scoped workflow actions rather than CLI/cache status

#### Scenario: Register store is available from Local Root
- **GIVEN** the selected root is Local Root
- **AND** store features are available
- **WHEN** the dashboard renders the primary action area
- **THEN** the dashboard MUST provide a visible action to register an existing store or connect the project to store-based planning
- **AND** the action MUST NOT require the user to first discover a lower maintenance panel

#### Scenario: Local Root without store context remains lightweight
- **GIVEN** the selected root is Local Root
- **AND** the workspace has no read-only references
- **AND** no store/workset management action is in progress
- **WHEN** the dashboard renders
- **THEN** the Changes and Specs areas MUST remain similar to the original single-project dashboard
- **AND** store/workset maintenance UI MUST be presented as lightweight contextual actions rather than a dominant management section

### Requirement: Store Cards Distinguish Current State From Switching
Dashboard SHALL render registered stores with clear current-state and switch-state actions.

#### Scenario: Current store shows current state
- **GIVEN** a registered store is the selected OpenSpec root
- **WHEN** that store appears in dashboard maintenance UI
- **THEN** the store card MUST show a `Current` state indicator or equivalent selected-state treatment
- **AND** it MUST NOT show a disabled `Open` button that appears broken or unavailable

#### Scenario: Inactive store can be selected
- **GIVEN** a registered store is not the selected OpenSpec root
- **WHEN** that store appears in dashboard maintenance UI
- **THEN** the store card MUST provide a normal enabled `Switch` action or equivalent root-selection action
- **AND** triggering that action MUST select the store root and refresh root-scoped dashboard data

#### Scenario: Store path remains inspectable
- **GIVEN** a registered store has a root path
- **WHEN** the store card renders
- **THEN** the card MUST show the store id as the primary label
- **AND** the root path MUST remain inspectable through visible text, tooltip, or an equivalent copy/open affordance

### Requirement: Workset Cards Are Readable And Actionable
Dashboard SHALL render saved worksets as readable workspace cards that separate the workset identity, opener metadata, member folders, and actions.

#### Scenario: Workset title and metadata are separated
- **GIVEN** `openspec workset list --json` returns a workset with a name, tool, and members
- **WHEN** the Worksets page renders that workset
- **THEN** the workset name MUST be the primary card title
- **AND** the default tool or opener MUST be rendered as secondary metadata
- **AND** the member count MUST be rendered as secondary metadata rather than competing with the title

#### Scenario: Member folders are readable
- **GIVEN** a workset has member folders with names and paths
- **WHEN** the Worksets page renders the member list
- **THEN** each member row MUST show the member name and path in a layout that remains readable in narrow sidebars
- **AND** long paths MUST expose the full path through a tooltip, copy affordance, or equivalent inspectable behavior

#### Scenario: Primary and member type are identified
- **GIVEN** a workset has at least one member
- **WHEN** the Worksets page renders the member list
- **THEN** the first member MUST be marked as the primary member
- **AND** members that match a registered store root SHOULD be marked as store roots
- **AND** other members SHOULD be presented as project folders or repos

#### Scenario: Workset actions are grouped
- **GIVEN** a workset is listed
- **WHEN** the card renders
- **THEN** `Open` and `Remove` actions MUST be visually grouped as card actions
- **AND** `Open` MUST be the primary workspace-launch action
- **AND** `Remove` MUST use a secondary or destructive treatment that does not compete with `Open`

### Requirement: Workset Remove Flow Is Confirmed And Non-Destructive
Dashboard SHALL allow users to remove saved worksets with explicit confirmation and without deleting member folders.

#### Scenario: Remove workset asks for confirmation
- **GIVEN** a workset is listed on the Worksets page
- **WHEN** the user triggers `Remove`
- **THEN** the extension MUST show a confirmation dialog that names the workset
- **AND** the dialog MUST state that member folders, repos, and stores will not be deleted

#### Scenario: Confirmed remove deletes only saved workset
- **GIVEN** the user confirms removing a workset
- **WHEN** the extension executes the removal
- **THEN** it MUST call the OpenSpec workset removal command with non-interactive confirmation and JSON output when available
- **AND** it MUST refresh dashboard workset data after success
- **AND** it MUST NOT delete member folders from disk

#### Scenario: Cancelled remove keeps workset
- **GIVEN** the user cancels the remove confirmation
- **WHEN** the confirmation closes
- **THEN** the saved workset MUST remain listed
- **AND** dashboard data MUST NOT be modified

### Requirement: Multi-Project Controls Are Feature-Gated
Dashboard SHALL show store and workset management only when the resolved OpenSpec runtime supports those features.

#### Scenario: OpenSpec 1.5 features are unavailable
- **GIVEN** feature probes show that store or workset commands are unavailable
- **WHEN** the dashboard renders
- **THEN** store/workset controls MUST NOT appear as enabled actionable controls
- **AND** the dashboard MUST show a concise message that stores and worksets require OpenSpec 1.5.0 or newer
- **AND** Local Root change and spec workflows MUST remain usable

#### Scenario: Store supported but worksets unavailable
- **GIVEN** store commands are available
- **AND** workset commands are unavailable
- **WHEN** the dashboard renders
- **THEN** store root selection and store registration MAY remain available
- **AND** Worksets page entry and workset actions MUST be hidden or disabled with an upgrade explanation

#### Scenario: Worksets supported but no worksets exist
- **GIVEN** workset commands are available
- **AND** `openspec workset list --json` returns no worksets
- **WHEN** the user opens the Worksets page
- **THEN** the page MUST show an empty state explaining that worksets are saved multi-folder editor views
- **AND** the empty state MUST NOT imply that the current OpenSpec root has no changes, specs, stores, or references
