## MODIFIED Requirements

### Requirement: Selected OpenSpec scope
The extension SHALL distinguish the immutable Project/root binding used by Project-first read surfaces from the legacy selected OpenSpec scope retained for compatible workflow operations.

Sidebar and Explorer data MUST use the current `ProjectContext` and its CLI-resolved `OpenSpecRootBinding`. Changing a legacy selected scope MUST NOT replace the Project identity or silently redirect Project-first data to another root. Referenced Stores remain explicit read-only bindings unless a separate workflow explicitly selects a Store scope.

#### Scenario: Local root scope
- **GIVEN** a workspace folder resolves an OpenSpec root through official CLI context
- **WHEN** the Project-first Sidebar or an Editor Explorer loads data
- **THEN** the payload MUST use the current ProjectContext and CLI-resolved OpenSpecRootBinding
- **AND** it MUST NOT infer the root from a registered Store, Workset membership, or a previous selected scope

#### Scenario: Explicit store scope
- **GIVEN** store-aware features are available
- **AND** the user explicitly selects a registered Store for a legacy scope-aware workflow
- **WHEN** that legacy operation runs
- **THEN** its selected scope MUST include the Store id, root path, and source
- **AND** the selection MUST NOT replace the current Project identity or redirect an already-open Project-first Sidebar or Explorer

#### Scenario: Declared store scope is reported
- **GIVEN** OpenSpec resolves the current project through a declared Store in project configuration
- **WHEN** the Project-first surface creates its binding
- **THEN** the binding MUST retain the CLI-reported root source and Store identity when available
- **AND** the UI MUST continue to present the code project as the primary context

#### Scenario: Scope selection clears stale dashboard data
- **GIVEN** Project-first data has been loaded for one Project/root binding
- **WHEN** the current Project or its CLI-resolved root binding changes
- **THEN** the extension MUST clear or replace data and caches associated with the previous binding
- **AND** it MUST NOT show Changes or Specs from the previous binding as if they belonged to the new Project
