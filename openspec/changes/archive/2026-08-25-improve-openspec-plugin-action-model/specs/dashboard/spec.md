## ADDED Requirements

### Requirement: Dashboard prioritizes actionable Change state
The wide Dashboard SHALL present actionable Change priorities before aggregate statistics while preserving existing KPI and chart content below them.

#### Scenario: Needs attention is shown first
- **GIVEN** one or more Changes have blocked artifacts, failed action receipts, or another resolver-produced attention state
- **WHEN** the wide Dashboard renders
- **THEN** those Changes MUST appear in a Needs attention area before aggregate charts
- **AND** each entry MUST explain the actionable reason without relying on color alone

#### Scenario: Ready to verify is visible
- **GIVEN** one or more Changes have completed tasks and a resolved Verify action
- **WHEN** the wide Dashboard renders
- **THEN** those Changes MUST appear in a Ready to verify area
- **AND** Archive MUST NOT be represented as already completed or automatically selected

#### Scenario: Recommended actions use shared resolution
- **GIVEN** active Changes have resolved recommended actions
- **WHEN** the wide Dashboard renders its Recommended actions area
- **THEN** each entry MUST use the shared resolver result
- **AND** selecting a complex or high-impact action MUST open or reveal the bound Change Detail rather than bypass its safety flow

#### Scenario: Existing analytics remain available
- **GIVEN** KPI, artifact readiness, or progress chart data is available
- **WHEN** action-first areas render
- **THEN** the existing analytics MUST remain available below the action priorities
- **AND** this Change MUST NOT require a new Kanban, timeline, or animation system

### Requirement: Sidebar Change summaries are compact and action-oriented
The Sidebar SHALL summarize each Change with lifecycle, recommended next action, and task progress without repeating a fixed badge for every conventional artifact.

#### Scenario: Compact Change card uses resolved next action
- **GIVEN** a Change has a resolved recommended action
- **WHEN** its Sidebar card renders
- **THEN** the card MUST show the Change name, concise lifecycle, recommended next action, and available task progress
- **AND** it MUST NOT require Proposal, Specs, Design, and Tasks badges to communicate the same state

#### Scenario: Multiple ready actions remain discoverable
- **GIVEN** a Change has more than one available planning action
- **WHEN** its Sidebar card renders
- **THEN** the card MUST indicate that additional actions are available
- **AND** opening Change Detail MUST expose the complete available action set

#### Scenario: Sidebar excludes high-impact direct execution
- **GIVEN** Verify or Archive is available
- **WHEN** the Change is shown in the Sidebar
- **THEN** the Sidebar MAY identify the recommended lifecycle state
- **AND** triggering the high-impact action MUST require the dedicated Change Detail flow

### Requirement: Workflow surfaces expose explicit planning context
Sidebar and Dashboard SHALL distinguish the browsed Project from the Planning root and SHALL not present Workset membership as workflow authority.

#### Scenario: Project and Planning root are visible
- **GIVEN** the browsed Project and Planning root differ or the root is Store-backed
- **WHEN** workflow summaries are displayed
- **THEN** the UI MUST expose both Project identity and Planning root source in a concise form
- **AND** the user MUST be able to distinguish Local and Store planning targets before a write-producing action

#### Scenario: Workset remains an opener
- **GIVEN** the Project belongs to a Workset
- **WHEN** Change actions are resolved or displayed
- **THEN** Workset membership MUST NOT change the Change root binding or artifact state
- **AND** Workset controls MUST remain local project-opening actions

#### Scenario: Existing bound panel is not silently rebound
- **GIVEN** Change Detail or wide Dashboard is already bound to a Project/root
- **WHEN** the Sidebar Project picker changes browsing context
- **THEN** the existing panel MUST retain its original binding until the user explicitly opens the new context
- **AND** a same-named Change from the new context MUST NOT replace the bound panel's data
