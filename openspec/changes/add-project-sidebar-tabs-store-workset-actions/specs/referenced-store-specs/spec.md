## ADDED Requirements

### Requirement: Official referenced Store Specs
The Project-first Specs view SHALL derive referenced Stores from the official Project context and load each referenced Store's canonical Specs with a Host-verified Store binding.

#### Scenario: Project declares a referenced Store
- **WHEN** official `openspec context --json` or its `members[].role=referenced_store` compatibility shape reports `aihelp-workspace`
- **THEN** the Specs view MUST show a separate Referenced Store Specs group for that Store
- **AND** Store Specs MUST be loaded through `openspec list --specs --json --store aihelp-workspace`

#### Scenario: Project and Store contain Specs with the same id
- **WHEN** a Project and a referenced Store both expose the same Spec id
- **THEN** the Specs view MUST keep them in separate Project and Store groups
- **AND** selecting the Store entry MUST use its Store binding for content loading

#### Scenario: Store reference is unavailable
- **WHEN** context, Store binding, doctor, or Store Specs loading fails for one referenced Store
- **THEN** the Project Specs group MUST remain usable
- **AND** the failed Store group MUST show a safe error state without guessing a root or showing unreferenced Stores

#### Scenario: Project has no references
- **WHEN** the official Project context reports no referenced Stores
- **THEN** the Specs view MUST show Project Specs normally
- **AND** it MUST NOT show registered but unreferenced Stores as referenced groups

#### Scenario: Store Specs are excluded from Project Dashboard metrics
- **GIVEN** referenced Store Specs are present in the shared Project workspace payload
- **WHEN** the Project Dashboard derives Change, task, lifecycle, or artifact-readiness values
- **THEN** it MUST use only current Project Change data
- **AND** Store Spec ids or content MUST NOT affect those values
