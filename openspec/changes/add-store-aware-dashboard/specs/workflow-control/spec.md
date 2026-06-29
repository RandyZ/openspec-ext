## ADDED Requirements

### Requirement: Workflow actions use selected scope
Workflow actions SHALL target the selected writable OpenSpec scope.

#### Scenario: Local scope workflow command
- **GIVEN** the selected scope is the workspace local root
- **WHEN** the user launches Continue, FF, Apply, Sync, Verify, or Archive from the dashboard or change detail
- **THEN** the generated workflow command MUST preserve current local-root behavior
- **AND** it MUST NOT include a store selector unless the target adapter explicitly requires one in future

#### Scenario: Store scope workflow command
- **GIVEN** the selected scope is a registered store
- **WHEN** the user launches a workflow action for a store-scoped change
- **THEN** the extension MUST ensure the launched agent path includes the selected store context
- **AND** any OpenSpec CLI command executed by the extension for that action MUST include `--store <id>` when applicable

#### Scenario: Scope identity shown before high-impact action
- **GIVEN** the user is about to run Apply, Sync, Verify, Archive, task toggle, or direct archive
- **WHEN** the selected scope is a store or declared store
- **THEN** the UI MUST show the active store id or declared store source near the action
- **AND** the user MUST be able to distinguish it from local root execution before triggering the action

### Requirement: Referenced stores are not workflow targets
Workflow controls SHALL not treat referenced stores as writable targets unless explicitly selected as the active scope.

#### Scenario: Reference row has no workflow buttons
- **GIVEN** a referenced store is shown in the relationship panel
- **WHEN** the user interacts with the referenced store row
- **THEN** the row MUST NOT show Continue, FF, Apply, Sync, Verify, Archive, or task-toggle buttons

#### Scenario: Selecting reference as store changes scope
- **GIVEN** a referenced store is registered locally
- **WHEN** the UI offers and the user chooses to work in that store
- **THEN** the extension MUST switch the selected scope to that store
- **AND** the dashboard MUST refresh before showing writable workflow actions for that store

#### Scenario: Unregistered reference cannot become writable
- **GIVEN** a referenced store is unresolved or unregistered
- **WHEN** the user views it in the relationship panel
- **THEN** the UI MUST show recovery guidance
- **AND** it MUST NOT offer writable workflow actions for that store

### Requirement: Change detail inherits selected scope
Change detail panels SHALL be aware of the scope used to open them.

#### Scenario: Open change detail from store dashboard
- **GIVEN** the dashboard is showing a store scope
- **WHEN** the user opens a change detail from a store change card
- **THEN** the change detail MUST load artifacts and task state from the same store scope
- **AND** its header MUST show the active store id or equivalent scope indicator

#### Scenario: Existing detail updates on scope refresh
- **GIVEN** a change detail panel is open
- **WHEN** the selected scope changes or dashboard refreshes a different scope
- **THEN** the panel MUST not silently reinterpret the same change name under a different root
- **AND** it MUST either remain bound to its original scope or clearly reload under the new selected scope

#### Scenario: Archived detail remains scoped
- **GIVEN** an archived change is opened from a store scope
- **WHEN** the detail view renders
- **THEN** all archived artifact reads MUST use that store root
- **AND** write actions MUST remain disabled

### Requirement: Interactive Verify and Archive are scope-aware
The interactive Verify and Archive workflows SHALL make the selected scope explicit and use the correct root.

#### Scenario: Store-scoped Verify terminal
- **GIVEN** a store scope is selected
- **WHEN** the user starts Verify from the Verify & Archive tab
- **THEN** the terminal workflow MUST be launched with enough context to operate on the selected store
- **AND** any direct OpenSpec CLI invocation owned by the extension MUST include `--store <id>`

#### Scenario: Store-scoped Archive terminal
- **GIVEN** a store scope is selected
- **WHEN** the user starts Archive from the Verify & Archive tab
- **THEN** the terminal workflow MUST show the selected store id in the UI before launch
- **AND** it MUST not archive a same-named local-root change by mistake

#### Scenario: Direct archive confirmation names scope
- **GIVEN** a direct archive escape path is still available
- **WHEN** the selected scope is not the local root
- **THEN** the confirmation dialog MUST include the active scope label
- **AND** the archive command MUST target the selected scope
