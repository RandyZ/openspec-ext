<!-- Distilled from explore.md for this change. -->

## Why

The current Project-first Worksets experience expands topology before users have selected a Workset and omits official CLI capabilities for creating Worksets and overriding the opener. A focused list → detail → create flow makes multi-folder work discoverable and safe without blurring Project, Planning Store, or Git responsibilities.

## What Changes

### MVP

- Replace the fully expanded Project-first Workset scene with a compact Workset list that drills into one Workset detail view.
- Add a single-screen Create Workset flow with Current Project membership, Primary-member ordering, native folder selection, optional opener id, validation, and explicit success/error states.
- Add saved-tool open and one-time `--tool` override actions while preserving ordinary non-JSON Workset open behavior.
- Let a trusted Store member become the explicit Planning root only after the Extension Host re-reads and validates official Workset and Store inventories.
- Keep Current Project and Planning root visibly and behaviorally independent.
- Match the approved implementation references:
  - [Worksets list and detail](assets/worksets-list-detail-high-fidelity.png)
  - [Create Workset](assets/workset-create-high-fidelity.png)
- Add Simplified Chinese and English strings, keyboard/focus behavior, capability gating, and narrow-sidebar visual acceptance.

### Deferred / Phase 2+

- Workset member editing remains deferred until OpenSpec exposes an official update command.
- Git clone, pull, push, and synchronization remain external to OpenSpec Worksets.
- A full editor-area Worksets workspace and automatic extension activation are not part of this change.

No breaking API or stored-data changes are intended.

## Capabilities

### New Capabilities

- `workset-creation`: Create a machine-local Workset from the Project-first Sidebar through the official selector-free CLI, including trusted folder selection, Primary ordering, optional opener id, refresh, and error recovery.

### Modified Capabilities

- `workset-project-navigation`: Present containing Worksets as list and detail states, and allow a fresh-validated Store member to become Planning root without making it a Project target.
- `workset-cli-open`: Add list/detail whole-Workset actions and a one-time opener override while keeping ordinary CLI output and saved Workset state unchanged.
- `openspec-scope-management`: Support explicit Planning Store selection from a validated Workset Store member while preserving the current Project identity and immutable Project binding.

## Impact

- **Webview**: `Dashboard`, `WorksetProjectPicker`, `WorksetsPage`, message types, i18n strings, keyboard/focus behavior, and tests.
- **Extension Host**: Workset create/open service methods, native folder picker handling, Store-member validation, Project Sidebar refresh, and message-handler tests.
- **CLI integration**: Uses OpenSpec 1.8.0 `workset create --json` and ordinary `workset open [--tool]`; every Workset command remains selector-free.
- **Security and data**: No direct access to private Workset registry files, no Git operations, and no new shared state.
- **Dependencies**: No new runtime or UI dependency is required.
