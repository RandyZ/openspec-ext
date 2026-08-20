## ADDED Requirements

### Requirement: Official referenced Store Specs
The Project-first Specs tab SHALL derive referenced Stores from the official Project context and load each referenced Store's canonical Specs with a Host-verified Store binding.

#### Scenario: Project declares a referenced Store
- **WHEN** official `openspec context --json` or its `members[].role=referenced_store` reports `aihelp-workspace`
- **THEN** the Specs tab MUST show a separate `Referenced Store Specs` group for that Store
- **AND** Store Specs MUST be loaded through `openspec list --specs --json --store aihelp-workspace`

#### Scenario: Project and Store contain Specs with the same id
- **WHEN** a Project and a referenced Store both expose the same Spec id
- **THEN** the Specs tab MUST keep them in separate Project and Store groups
- **AND** selecting the Store entry MUST use its Store binding for content loading

#### Scenario: Store reference is unavailable
- **WHEN** context, doctor, Store binding, or Store Specs loading fails for one referenced Store
- **THEN** the Project Specs group MUST remain usable
- **AND** the failed Store group MUST show a safe error state without guessing a root or showing unreferenced Stores

#### Scenario: Project has no references
- **WHEN** the official Project context reports no referenced Stores
- **THEN** the Specs tab MUST show Project Specs normally
- **AND** it MUST NOT show registered but unreferenced Stores as referenced groups
