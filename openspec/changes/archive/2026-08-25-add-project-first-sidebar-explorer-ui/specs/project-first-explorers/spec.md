## ADDED Requirements

### Requirement: Project-first Sidebar Home
The system SHALL present the current IDE project as the default OpenSpec sidebar context.

The sidebar MUST show the current project identity and only the current project's active, unarchived Changes. It MUST also expose entry points to browse All Changes and Specs for that same project.

#### Scenario: Active work is visible in the sidebar
- **GIVEN** the current project has both active and archived Changes
- **WHEN** the user opens the OpenSpec sidebar
- **THEN** the sidebar MUST show the current project identity
- **AND** it MUST show the active Changes for that project
- **AND** it MUST provide visible entry points for All Changes and Specs
- **AND** archived Changes MUST NOT appear in the compact sidebar list

#### Scenario: No active changes still shows navigation
- **GIVEN** the current project has no active Changes
- **WHEN** the user opens the OpenSpec sidebar
- **THEN** the sidebar MUST show an empty-state message for active work
- **AND** it MUST still expose All Changes and Specs entry points

### Requirement: Changes Explorer for the Current Project
The system SHALL provide an Editor Explorer that browses all Changes for the current project.

The Changes Explorer MUST include both active and archived Changes, and MUST keep search, lifecycle filtering, sorting, and pagination scoped to the same ProjectContext and OpenSpecRootBinding that produced the page.

#### Scenario: All Changes opens a project-bound explorer
- **GIVEN** the user clicks All Changes from the sidebar
- **WHEN** the extension opens the Changes Explorer
- **THEN** the page MUST show active and archived Changes for the current project
- **AND** it MUST keep the project/root binding visible in its data context
- **AND** it MUST NOT merge Changes from another project or root

#### Scenario: Explorer state remains scoped during navigation
- **GIVEN** the Changes Explorer is showing search, filters, sorting, or pagination state
- **WHEN** the user navigates to a Change detail view and then returns
- **THEN** the explorer MUST restore the same project-bound view state
- **AND** it MUST continue to show the same project's Changes

### Requirement: Specs Explorer Separates Project and Referenced Store Specs
The system SHALL provide an Editor Explorer that separates canonical project Specs from referenced Store Specs.

Project Specs MUST come from the current project's CLI-resolved spec surface. Referenced Store Specs MUST be shown only for Stores that the current project references through official OpenSpec CLI data. Installed but unreferenced Stores MUST NOT appear.

#### Scenario: Project specs and referenced store specs are separated
- **GIVEN** the current project has canonical Specs and one CLI-confirmed referenced Store
- **WHEN** the user opens the Specs Explorer
- **THEN** the page MUST show a project Specs group
- **AND** it MUST show a separate referenced Store Specs group
- **AND** the page MUST NOT mix the two sources into one undifferentiated list

#### Scenario: Installed but unreferenced stores stay hidden
- **GIVEN** the machine has an installed Store that the current project does not reference
- **WHEN** the user opens the Specs Explorer
- **THEN** that Store MUST NOT appear in the explorer
- **AND** the user MUST only see Stores that official CLI data confirms as referenced by the current project

### Requirement: Explicit Project Binding and Isolation
The system SHALL bind every Sidebar and Explorer payload to an explicit ProjectContext and OpenSpecRootBinding.

The UI MUST fail closed when the requested project/root identity changes. Data from a previous project MUST NOT continue to render under a new project heading or be reused as if it were current.

#### Scenario: Switching projects does not leak stale data
- **GIVEN** the user switches from one project to another
- **WHEN** the new Sidebar or Explorer payload arrives
- **THEN** the page MUST render only data for the new ProjectContext
- **AND** it MUST NOT show cached Changes or Specs from the previous project as if they belonged to the new one

#### Scenario: Same-named changes remain isolated by binding
- **GIVEN** two different projects contain a Change with the same name
- **WHEN** the user opens the Change detail from an Explorer page
- **THEN** the extension MUST open the Change from the currently bound ProjectContext
- **AND** it MUST NOT resolve the other project's Change by name alone
