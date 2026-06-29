## ADDED Requirements

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
