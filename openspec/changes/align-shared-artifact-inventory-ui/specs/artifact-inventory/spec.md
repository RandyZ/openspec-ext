## Purpose

Defines the shared Artifact Inventory contract that both Changes Workspace and Change Detail MUST consume so Schema-defined and undeclared (Other) artifacts stay consistent across surfaces.

## ADDED Requirements

### Requirement: Shared Artifact Inventory Contract

The system SHALL expose a single Artifact Inventory per change that contains:

1. `defined`: Schema-declared artifacts in Schema order
2. `other`: Change-directory entries that exist on disk but are not declared by the current Schema

Both Changes Workspace and Change Detail MUST render from this same inventory payload for a given change identity (name + scope/root). The system MUST NOT build divergent Schema or Other lists per surface.

#### Scenario: Same inventory on workspace and detail

- **WHEN** the user selects a change in Changes Workspace and later opens the same change in Change Detail under the same scope
- **THEN** both surfaces show the same Schema artifact keys/order and the same Other artifact entries (paths and file counts)

#### Scenario: Schema and Other partitions are distinct

- **WHEN** an inventory is built for a change that has both Schema artifacts and undeclared files
- **THEN** Schema items appear only under `defined` and undeclared items appear only under `other` (no silent reclassification)

### Requirement: Schema Inventory Item Fields

Each Schema inventory item SHALL include enough information for Plan Readiness / inventory cards:

- stable key / id
- display name
- source marked as schema-defined
- status among Done / Ready / Blocked / Missing / Error (or an equivalent mapped set)
- file count (0 when missing)
- optional dependency ids
- optional updated time when known

Missing Schema-declared artifacts (declared but file not created) SHALL still appear as inventory items with Missing or Ready status, not be omitted.

#### Scenario: Missing schema artifact remains visible

- **WHEN** Schema declares an artifact whose output file does not yet exist
- **THEN** the inventory still includes that artifact marked Missing or Ready (not hidden)

#### Scenario: Schema order is preserved

- **WHEN** Schema returns artifacts in a specific order
- **THEN** `defined` preserves that order for consumers

### Requirement: Other Inventory Item Fields

Each Other inventory item SHALL include:

- stable key / id
- relative path
- whether it is a directory
- file count (single-level for directories; 1 for files)
- source marked as filesystem / not schema-defined

Undeclared entries MUST NOT be hidden, discarded, or auto-merged into a Schema artifact type.

#### Scenario: Undeclared directory is listed with count

- **WHEN** the change directory contains `task-details/` with six files and Schema does not declare it
- **THEN** `other` includes that directory with file count 6

#### Scenario: Empty other partition

- **WHEN** every top-level change entry is covered by Schema known paths
- **THEN** `other` is empty and consumers MAY hide the Other section
