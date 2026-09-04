> Visual reference (non-normative): [Worksets list and detail high-fidelity design](../../assets/worksets-list-detail-high-fidelity.png).

## ADDED Requirements

### Requirement: Workset list and detail navigation

The Project-first Worksets surface SHALL present containing Worksets as a compact list and SHALL reveal members and topology actions only after one Workset is selected.

#### Scenario: Render containing Worksets as a list

- **WHEN** trusted Workset navigation contains one or more Worksets for the current Project
- **THEN** the Worksets surface MUST show one row per containing Workset with name, member count, and saved or default tool label
- **AND** member rows MUST remain collapsed until the user selects a Workset

#### Scenario: Open Workset detail

- **WHEN** the user activates a Workset list row without activating its whole-Workset `Open` control
- **THEN** the Sidebar MUST enter detail for that Workset without launching an external opener
- **AND** the detail MUST show the Workset name, opener information, members, and role-appropriate actions

#### Scenario: Return from detail

- **WHEN** the user activates Back in Workset detail
- **THEN** the Sidebar MUST return to the containing Worksets list
- **AND** it MUST preserve the current Project and Planning root

#### Scenario: Selected Workset disappears after refresh

- **WHEN** the selected Workset is absent from a fresh official navigation snapshot
- **THEN** the Sidebar MUST return to the list and expose a recoverable stale-item explanation
- **AND** it MUST NOT retain actions from the removed Workset

#### Scenario: Narrow Sidebar keyboard navigation

- **WHEN** the list or detail is rendered in a narrow Sidebar
- **THEN** row navigation, whole-Workset open, Back, Project switch, and Planning Store selection MUST be independently keyboard operable with visible focus
- **AND** names and role labels MUST remain bounded without overlapping actions

## MODIFIED Requirements

### Requirement: Project-only Workset selection

The Workset detail SHALL distinguish selectable Project members from registered Store members, SHALL never make a Store member a Project selection target, and SHALL expose a Store member as a Planning-root action only after fresh Host-side validation.

#### Scenario: Workset contains Project and Store members

- **WHEN** a Workset includes canonical paths matching registered Store roots and other Project folders
- **THEN** Store members MUST be labeled `Planning Store` and MUST NOT have Project selection controls
- **AND** only non-Store Project members MUST have Project selection controls
- **AND** a non-current Store member MAY expose `Use as planning root` only through a Host-validated Workset Store action

#### Scenario: Current Planning Store is a Workset member

- **WHEN** a Store member identifies the current Planning root
- **THEN** the detail MUST label it `Current root`
- **AND** it MUST NOT expose a redundant or disabled Store-selection action
- **AND** the surrounding Planning-root context MUST provide an explicit `Use project default` recovery action

#### Scenario: Workset contains a same-repository Git worktree

- **WHEN** a selectable member is a Git worktree of the same repository as another member
- **THEN** the Workset detail MUST show best-effort repository identity and branch metadata
- **AND** the member MUST remain a distinct selectable canonical Project path

#### Scenario: Workset has no selectable Project members

- **WHEN** all other members are registered Stores or invalid/unresolvable paths
- **THEN** the Workset detail MUST show a clear no-other-Projects state
- **AND** it MUST not offer a Store or invalid path as a Project action

#### Scenario: Store action uses stale or forged membership

- **WHEN** the submitted Workset name/path is absent from a fresh official Workset and Store response, is not a Store, or cannot be canonicalized
- **THEN** the Host MUST reject the Planning-root request
- **AND** it MUST preserve the current Project, Planning root, binding, watcher, and visible data
