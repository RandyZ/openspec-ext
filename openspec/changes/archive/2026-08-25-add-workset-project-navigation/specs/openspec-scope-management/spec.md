## ADDED Requirements

### Requirement: Workset Project and Planning Store boundaries

OpenSpec scope management SHALL treat Workset Project members as navigable Project candidates and registered Store members as read-only Planning Store context, while preserving immutable binding and single-selected-Project semantics.

#### Scenario: Current Project membership is derived from CLI

- **WHEN** official `workset list --json` reports the current canonical Project path as a member
- **THEN** the extension MUST expose that Workset as navigation context
- **AND** the extension MUST NOT create a persisted membership record or Project registry entry

#### Scenario: Registered Store member is encountered

- **WHEN** a Workset member path canonicalizes to a root returned by official `store list --json`
- **THEN** the member MUST be classified as Planning Store
- **AND** it MUST NOT become a selectable Project or change the selected writable Project scope

#### Scenario: Project binding is refreshed after navigation

- **WHEN** a Project member is selected or the user returns to the original Project
- **THEN** the extension MUST resolve the CLI root from that Project's command cwd
- **AND** every Project-bound operation MUST use the resulting binding identity until another validated selection occurs

#### Scenario: Workset metadata is unavailable

- **WHEN** workset or Store list probing fails
- **THEN** the extension MUST preserve the current Project binding and local Project content
- **AND** it MUST not fall back to a guessed path, selected Store scope, or stale membership as a navigation target
