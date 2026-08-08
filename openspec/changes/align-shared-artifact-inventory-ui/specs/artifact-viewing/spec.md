## MODIFIED Requirements

### Requirement: Artifact List Display

The Change Detail view SHALL present planning readiness and complete artifact inventory from the shared Artifact Inventory (see `artifact-inventory`), not from a hardcoded four-tab-only model or a permanent fixed lifecycle stepper.

Change Detail MUST:

1. Show **Plan Readiness** as Schema artifact cards driven by inventory `defined` (status, file count, optional deps, Open/Reveal)
2. Show **Complete Artifact Inventory** partitions for Schema and Other using the same inventory payload
3. Keep content tabs dynamically generated from Schema artifact ids
4. NOT use an irreversible fixed stepper of `Proposal → Specs → Design → Tasks → Apply → Verify → Archive` as the primary readiness UI

Apply / Verify / Archive remain actions (or dedicated workflow panels), not Schema artifacts.

#### Scenario: Show available artifacts

- **GIVEN** a change with multiple Schema artifacts
- **WHEN** the user opens change details
- **THEN** all Schema artifacts MUST be shown as Plan Readiness cards and/or inventory items and content tabs
- **AND** the set and order of artifacts MUST come from the change's current Schema instead of a hardcoded list
- **AND** Schema-defined artifacts that have not been created yet MUST remain visible as Missing/Not created

#### Scenario: Show available artifacts as readiness cards

- **WHEN** a user opens Change Detail for a change with Schema artifacts
- **THEN** Plan Readiness shows one card per Schema artifact with status and Open/Reveal affordance

#### Scenario: Fixed lifecycle stepper is not primary readiness UI

- **WHEN** a user opens Change Detail
- **THEN** the primary readiness presentation is Plan Readiness cards / inventory, not a fixed Proposal→…→Archive phase stepper

#### Scenario: Artifact status indication

- **WHEN** Schema artifacts have Done / Ready / Blocked / Missing / Error statuses
- **THEN** Plan Readiness cards reflect those statuses visually

#### Scenario: Other artifacts section on detail

- **WHEN** inventory `other` is non-empty
- **THEN** Change Detail shows an Other Artifacts section labeled to indicate items are not defined in schema

#### Scenario: Other artifacts section hidden when empty

- **WHEN** inventory `other` is empty
- **THEN** Change Detail does not render an empty Other Artifacts section

### Requirement: Artifact Actions

The system SHALL provide artifact actions consistent with Reveal-first inventory behavior:

- Open in editor
- Reveal in Explorer
- Copy path (for existing paths)
- Refresh artifact content

Primary click on an existing Schema or Other inventory card MUST Reveal + Open (single file) or Reveal directory and focus the most recently updated file (multi-file). Missing Schema artifacts MUST NOT attempt reveal; they offer continue/create planning actions instead.

#### Scenario: Open in editor

- **WHEN** user chooses Open on an existing single-file artifact
- **THEN** the file opens in the VS Code editor and is revealed in Explorer

#### Scenario: Copy file path

- **WHEN** user chooses Copy path for an existing artifact path
- **THEN** the absolute path is copied to the clipboard

#### Scenario: Refresh artifact

- **WHEN** user refreshes while viewing an artifact
- **THEN** content reloads from disk without leaving Change Detail

#### Scenario: Reveal multi-file artifact

- **WHEN** user activates a directory artifact (Schema or Other)
- **THEN** Explorer reveals/expands the directory and focuses the most recently updated file when one exists

#### Scenario: Missing artifact does not attempt reveal

- **WHEN** user activates a Missing Schema artifact
- **THEN** the system does not call reveal for a non-existent path and instead offers continue/create planning

## ADDED Requirements

### Requirement: Change Detail Context Header

Change Detail Header SHALL surface enough context to answer “where is this change?” including at least: change name, writable root label/path when known, schema id when known, and task progress when tasks exist. Linked store summary MAY appear when a store is in scope.

#### Scenario: Header shows root and schema

- **WHEN** a scoped change is opened in Change Detail
- **THEN** the header shows the change name plus writable root and schema information when available

### Requirement: Execution Progress Panel

Change Detail SHALL show Execution Progress separately from Plan Readiness, including tasks completed/total when task data exists. Implementation/archive workflow controls MAY live adjacent but MUST NOT replace Plan Readiness cards.

#### Scenario: Execution progress shows task counts

- **WHEN** a change has tasks with a known completed/total count
- **THEN** Execution Progress displays that progress separately from Plan Readiness
