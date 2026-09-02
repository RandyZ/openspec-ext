## MODIFIED Requirements

### Requirement: Workset Project and Planning Store boundaries

OpenSpec scope management SHALL treat Workset Project members as navigable Project candidates and registered Store members as explicit Planning Store candidates, while preserving Project identity and accepting a replacement Project binding only after official CLI root resolution.

#### Scenario: Current Project membership is derived from CLI

- **WHEN** official `workset list --json` reports the current canonical Project path as a member
- **THEN** the extension MUST expose that Workset as navigation context
- **AND** the extension MUST NOT create a persisted membership record or Project registry entry

#### Scenario: Registered Store member is encountered

- **WHEN** a Workset member path canonicalizes to a root returned by official `store list --json`
- **THEN** the member MUST be classified as Planning Store
- **AND** it MUST NOT become a selectable Project or silently change the current Project binding

#### Scenario: User explicitly selects a Workset Planning Store

- **WHEN** the user activates `Use as planning root` for a Store member that remains present in freshly read official Workset and Store inventories
- **THEN** the Host MUST resolve a new binding for the current Project with the validated Store id as the explicit selector
- **AND** it MUST accept the binding only when its Project id, command cwd, canonical root, and Store id match the requested Project/Store context
- **AND** it MUST preserve the current Project identity while replacing and refreshing Project-bound data for the accepted binding

#### Scenario: Workset Planning Store request is stale or forged

- **WHEN** the submitted Workset name/path no longer identifies a registered Store member in fresh official inventories
- **THEN** the Host MUST reject the request without changing the selected scope
- **AND** it MUST preserve the current Project binding, watcher target, and visible Project data

#### Scenario: Current Planning Store is displayed

- **WHEN** the selected Planning root matches a Store member in Workset detail
- **THEN** the UI MUST present that member as `Current root`
- **AND** it MUST NOT expose a redundant selection action

#### Scenario: User returns to the Project-resolved Planning root

- **WHEN** the user activates `Use project default` while an explicit Workset Store selector is active
- **THEN** the Host MUST resolve a fresh selector-free binding from the current Project command cwd
- **AND** it MUST preserve the Project identity and replace visible data only after the returned binding is validated

#### Scenario: Project binding is refreshed after navigation

- **WHEN** a Project member is selected or the user returns to the original Project
- **THEN** the extension MUST resolve the CLI root from that Project's command cwd using the currently explicit Planning Store selector when one remains active
- **AND** every Project-bound operation MUST use the resulting binding identity until another validated Project or Planning-root selection occurs

#### Scenario: Workset metadata is unavailable

- **WHEN** Workset or Store list probing fails
- **THEN** the extension MUST preserve the current Project binding, selected Planning root, and local Project content
- **AND** it MUST not fall back to a guessed path, another selected Store scope, or stale membership as a navigation or Planning-root target
