## MODIFIED Requirements

### Requirement: Artifact Actions
The system SHALL provide actions for artifact management, scoped to the change's archived status.

#### Scenario: Open in editor（unchanged）
- **WHEN** the user clicks「Open in Editor」on any change（active or archived）
- **THEN** the artifact file MUST open in VSCode editor

#### Scenario: Create artifact with AI（active change only）
- **WHEN** an artifact is missing in an **active** change
- **THEN** a「用 AI 创建」button MUST be shown

#### Scenario: No create button for archived change
- **WHEN** an artifact is missing in an **archived** change
- **THEN** NO「用 AI 创建」button SHALL be shown
- **AND** only a plain message SHOULD indicate the artifact is not available
