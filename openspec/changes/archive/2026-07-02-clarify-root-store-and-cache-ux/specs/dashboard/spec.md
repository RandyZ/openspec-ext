## ADDED Requirements

### Requirement: OpenSpec root selector clarity
Dashboard SHALL present local roots and registered stores as selectable OpenSpec roots, not as workspace filters.

The selector MUST be labeled around the `OpenSpec Root` concept. Local project roots MUST be distinguishable from store roots, and the selected root MUST be the root used for dashboard content requests.

#### Scenario: Selector distinguishes local and store roots
- **GIVEN** the extension knows about a local OpenSpec root and a registered store
- **WHEN** the dashboard renders the root selector
- **THEN** the selector label MUST communicate `OpenSpec Root`
- **AND** the local root option MUST be labeled as a local root
- **AND** the store option MUST be labeled with its store identity, such as `Store: aihelp-workspace`

#### Scenario: Root switch drives primary dashboard content
- **GIVEN** the user selects a different OpenSpec root
- **WHEN** the extension host returns data for that selected root
- **THEN** the dashboard MUST render changes from the selected root
- **AND** the dashboard MUST render specs from the selected root
- **AND** the dashboard MUST render archived changes from the selected root
- **AND** the dashboard MUST NOT show content from the previously selected root as if it belonged to the new root

#### Scenario: Store root does not inherit local root content
- **GIVEN** the local root has active changes
- **AND** the selected store root has no active changes
- **WHEN** the dashboard renders the store root
- **THEN** the Changes section MUST show the store root empty state
- **AND** the dashboard MUST NOT display the local root changes inside the store root view

### Requirement: Root-scoped empty states
Dashboard SHALL explain empty states using the currently selected OpenSpec root.

Empty states for changes, archived changes, and specs MUST name or otherwise clearly identify the selected root so users can understand whether they are looking at a local root or a store root.

#### Scenario: Empty active changes names selected root
- **GIVEN** the selected OpenSpec root has no active changes
- **WHEN** the dashboard renders the Changes section
- **THEN** the empty state MUST identify the selected root
- **AND** the create-change entry point MUST create the change in the selected root

#### Scenario: Empty specs names selected root
- **GIVEN** the selected OpenSpec root has no specs
- **WHEN** the dashboard renders the Specs section
- **THEN** the empty state MUST identify the selected root
- **AND** the empty state MUST NOT imply that another root's specs are missing

#### Scenario: Empty archived changes names selected root
- **GIVEN** the selected OpenSpec root has no archived changes
- **WHEN** the user opens or expands archived changes
- **THEN** the empty state MUST identify the selected root
- **AND** the dashboard MUST NOT show archived changes from another root as a fallback

### Requirement: Scoped archive overview
Dashboard SHALL request and display archived changes for the selected OpenSpec root.

Archived change requests MUST include the selected root identity. The extension host MUST resolve that identity before listing archives so archived content follows the same root selection as active changes and specs.

#### Scenario: Local root archives are scoped
- **GIVEN** the selected OpenSpec root is the local root
- **WHEN** the dashboard requests archived changes
- **THEN** the extension host MUST list archives from the local root
- **AND** the dashboard MUST display only archives belonging to the local root

#### Scenario: Store root archives are scoped
- **GIVEN** the selected OpenSpec root is a registered store root
- **WHEN** the dashboard requests archived changes
- **THEN** the extension host MUST list archives from that store root
- **AND** the dashboard MUST display only archives belonging to that store root

#### Scenario: Scoped archive request fails
- **GIVEN** the dashboard requests archived changes for the selected root
- **WHEN** the extension host cannot resolve or read archives for that root
- **THEN** the dashboard MUST show an archive-specific error or empty state for the selected root
- **AND** the dashboard MUST NOT silently display archives from another root

### Requirement: Stores and worksets maintenance panel
Dashboard SHALL provide a compact maintenance panel for registered stores, references, and personal worksets.

The panel MUST mirror OpenSpec concepts: stores are writable planning roots, references are read-only upstream context, and worksets are local personal views. Store and workset operations MUST go through extension-host messages rather than direct webview filesystem access.

#### Scenario: Registered stores are listed
- **GIVEN** OpenSpec reports one or more registered stores
- **WHEN** the dashboard renders the Stores and Worksets panel
- **THEN** the panel MUST list each store with its identity and root path or equivalent location summary
- **AND** each store row MUST provide access to view, open, or inspect that store
- **AND** each store row MUST expose maintenance actions such as doctor or unregister when those actions are available

#### Scenario: Store setup and registration are available
- **GIVEN** the dashboard renders the Stores and Worksets panel
- **WHEN** the user chooses to add store capacity
- **THEN** the panel MUST provide actions to register an existing store and set up a new store when supported by the extension host
- **AND** the action state MUST prevent duplicate clicks while the operation is pending
- **AND** the panel MUST refresh store metadata after the operation succeeds

#### Scenario: References are presented as read-only context
- **GIVEN** OpenSpec reports references for the selected root or store context
- **WHEN** the dashboard renders the Stores and Worksets panel
- **THEN** references MUST be presented separately from writable stores
- **AND** reference actions MUST NOT imply that the reference is the current writable planning root

#### Scenario: Personal worksets are listed
- **GIVEN** OpenSpec reports personal worksets
- **WHEN** the dashboard renders the Stores and Worksets panel
- **THEN** the panel MUST list worksets separately from stores
- **AND** workset actions MUST communicate that worksets are local views rather than shared planning state
