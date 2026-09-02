# Workset Project Navigation Specification

## Purpose

为 Project-first Sidebar 提供基于官方 OpenSpec Workset 的安全多项目导航，使用户能够选择另一个 Project 后继续使用同一套 Project-bound Changes、Specs 和 Detail 体验，同时隔离 Store 与过期 binding。

## Requirements

### Requirement: Official Workset membership discovery

Extension SHALL derive Project-first Workset navigation only from the official CLI JSON workset list and registered Store list, and SHALL show a Workset entry only when the canonical current Project path is a member of that Workset.

#### Scenario: Current Project belongs to one or more Worksets

- **WHEN** the official CLI returns Worksets whose canonical member paths include the current Project
- **THEN** the Project-first Sidebar MUST expose Workset navigation
- **AND** it MUST list only those Worksets and their CLI-reported members

#### Scenario: Current Project belongs to no Workset

- **WHEN** no official Workset member path canonicalizes to the current Project path
- **THEN** the Project-first Sidebar MUST keep the normal Current Project view
- **AND** it MUST NOT show an enabled Workset navigation control

#### Scenario: Workset capability is unavailable or malformed

- **WHEN** the CLI does not support worksets, the command fails, or the payload is malformed
- **THEN** the Project-first Sidebar MUST keep Changes/Specs usable
- **AND** it MUST hide Workset navigation rather than infer membership from local files or cached registry data

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

### Requirement: Host-validated Project switching

Selecting a Workset Project SHALL be validated by the Extension Host against a fresh official Workset payload and a fresh CLI root resolution before the new Project is displayed.

#### Scenario: Valid Project member is selected

- **WHEN** the user selects a Project member whose canonical path is still a member of the named Workset
- **THEN** the host MUST create a canonical ProjectContext and resolve an immutable OpenSpecRootBinding for that Project
- **AND** the host MUST replace the current Project Sidebar data only after the binding identity is verified

#### Scenario: Webview submits a forged or stale member path

- **WHEN** the submitted Workset name/path is absent from the fresh official membership response, points to a Store, or cannot be canonicalized
- **THEN** the host MUST reject the request without changing ProjectContext, binding, watcher target, or visible Project data

#### Scenario: Same-named Change or Spec exists in another Project

- **WHEN** the selected Project and the previous Project contain an identically named Change or Spec
- **THEN** all subsequent list, content, Change Detail, and Spec Detail operations MUST use the selected Project's binding
- **AND** content from the previous Project MUST NOT be displayed as the selected Project's content

### Requirement: Project view reuse and return navigation

After a successful Workset Project selection, the extension SHALL reuse the existing Project-first Sidebar, All Changes, Specs Explorer, Change Detail, and Spec Detail surfaces, and SHALL provide a host-validated path back to the original Current Project.

#### Scenario: Navigate from Current Project to another Project and open content

- **WHEN** the user selects another Project from a Workset
- **THEN** the Project view MUST show the selected Project identity and its active Changes
- **AND** All Changes, Specs, Change Detail, and Spec Detail MUST open for the selected Project binding

#### Scenario: Return to Current Project

- **WHEN** the user activates the return-to-current-Project action
- **THEN** the host MUST restore the original canonical ProjectContext and a freshly resolved binding
- **AND** the Sidebar MUST show the original Project's data without retaining the other Project's Changes or Specs

#### Scenario: Narrow sidebar keyboard path

- **WHEN** the Workset scene is rendered in a narrow sidebar and the user navigates with keyboard focus
- **THEN** Workset selection and return actions MUST be focusable, titled, and operable without a pointer
- **AND** long labels and root paths MUST remain bounded without overlapping controls

### Requirement: Single selected-Project watcher

The extension SHALL watch only the currently selected Project root and SHALL retarget that single watcher when Project navigation succeeds.

#### Scenario: Project selection retargets watcher

- **WHEN** a valid Workset Project switch completes
- **THEN** file events under the newly selected Project MUST refresh its Project-bound Sidebar and open panels
- **AND** file events under non-selected Workset members MUST NOT trigger a refresh for the selected Project

#### Scenario: Project switch fails

- **WHEN** binding resolution or membership validation fails
- **THEN** the previous watcher target and Project data MUST remain active
- **AND** no watcher for the rejected member MAY be retained
