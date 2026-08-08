## ADDED Requirements

### Requirement: Selected Change Complete Artifact Inventory

When a change is selected in the Changes Workspace (Dashboard change list / selected-change panel), the system SHALL display Complete Artifact Inventory for that change using the **same shared Artifact Inventory payload** consumed by Change Detail.

The inventory MUST include:

1. Schema-defined artifact cards (Schema order; file/task counts and status when available)
2. An Other Artifacts section titled to indicate items are not defined in schema, listing undeclared files/directories with counts

Primary card click MUST Reveal + Open existing paths; Missing Schema cards MUST NOT reveal.

#### Scenario: Selected change shows schema inventory cards

- **WHEN** the user selects a change that has Schema artifacts
- **THEN** the Changes Workspace selected panel shows Schema inventory cards for those artifacts

#### Scenario: Selected change shows other artifacts

- **WHEN** the selected change directory contains undeclared entries such as `task-details/`
- **THEN** the selected panel lists them under Other Artifacts with file counts

#### Scenario: Workspace and detail stay consistent

- **WHEN** the user opens Change Detail for the currently selected change without changing scope
- **THEN** Detail inventory Schema keys and Other entries match what the Workspace selected panel showed

#### Scenario: No selection hides inventory panel

- **WHEN** no change is selected in Changes Workspace
- **THEN** the Complete Artifact Inventory selected panel is not shown as if it belonged to another change
