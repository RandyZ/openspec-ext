## MODIFIED Requirements

### Requirement: Artifact List Display
The system SHALL display all artifacts for a given change.

#### Scenario: Show available artifacts
- GIVEN a change with multiple artifacts
- WHEN the user opens change details
- THEN all existing artifacts MUST be shown as tabs or list items
- AND the set and order of artifacts MUST come from the change's current Schema instead of a hardcoded list
- AND Schema-defined artifacts that have not been created yet MUST be indicated as "Not created"

#### Scenario: Artifact status indication
- GIVEN artifacts in various states
- WHEN displayed
- THEN each artifact MUST show:
  - Name (e.g., "Proposal", "Design")
  - Status (exists, missing, or empty)
  - Last modified time (if exists)
  - File size (optional)

### Requirement: Artifact Actions
The system SHALL provide actions for artifact management.

#### Scenario: Open in editor
- GIVEN a Schema-defined artifact backed by a single file
- WHEN the user clicks "Open in Editor"
- THEN the artifact file MUST open in VSCode editor
- AND the cursor SHOULD be at the top of the file
- AND the file MUST also be revealed in the VS Code Explorer, subject to the existing scoped reveal rules for artifacts opened from a store root outside the workspace

#### Scenario: Copy file path
- GIVEN any artifact
- WHEN the user clicks "Copy Path"
- THEN the absolute file path MUST be copied to clipboard
- AND a notification SHOULD confirm the copy

#### Scenario: Refresh artifact
- GIVEN an artifact is being viewed
- WHEN the user clicks "Refresh"
- THEN the content MUST be reloaded from disk
- AND the view MUST update to show latest content

#### Scenario: Reveal multi-file artifact
- GIVEN a Schema-defined artifact backed by multiple files or a directory (for example a `specs/` delta directory)
- WHEN the user opens that artifact
- THEN the extension MUST reveal and expand the corresponding directory in the VS Code Explorer
- AND it MUST select the most recently updated file within that directory by default

#### Scenario: Missing artifact does not attempt reveal
- GIVEN a Schema-defined artifact whose file has not been created yet
- WHEN the user views that artifact
- THEN the extension MUST offer a create or continue-planning action
- AND it MUST NOT attempt to reveal or open a file path that does not exist

## ADDED Requirements

### Requirement: Other Artifacts Display
The system SHALL display files and directories that exist in a change's directory but are not declared by the change's current Schema, without hiding, dropping, or silently reclassifying them.

#### Scenario: Undeclared file or directory is shown
- GIVEN a change directory contains a file or subdirectory that the current Schema does not declare
- WHEN the user opens change details
- THEN that file or subdirectory MUST appear in a separate "Other Artifacts" grouping
- AND it MUST NOT be hidden, dropped, or merged into an existing Schema-defined artifact

#### Scenario: Other artifact directory shows file count
- GIVEN an "Other Artifacts" entry that maps to a subdirectory
- WHEN it is displayed
- THEN the entry MUST show the number of files contained in that subdirectory

#### Scenario: Opening an other artifact
- GIVEN an entry in "Other Artifacts"
- WHEN the user clicks that entry
- THEN the extension MUST reveal the real file or directory in the VS Code Explorer
- AND it MUST open the file, or the most recently updated file within the directory, in the editor
- AND it MUST NOT attempt to map the entry to a known Schema artifact type

#### Scenario: No other artifacts present
- GIVEN a change directory whose contents are fully declared by the current Schema
- WHEN the user opens change details
- THEN the "Other Artifacts" grouping MUST NOT be shown
