# Workset Creation Specification

## Purpose

为 Project-first Sidebar 提供从当前 Project 上下文创建本机 Workset 的单屏表单，通过官方 JSON CLI 完成 selector-free 创建，并在成功后刷新导航快照。

## Requirements

### Requirement: Project-first Workset creation form

The Project-first Sidebar SHALL provide a single-screen form for creating a machine-local Workset from the current Project context.

#### Scenario: Open the creation form

- **WHEN** Workset capability is available and the user activates `Create Workset` from the Worksets list
- **THEN** the Sidebar MUST show fields for name, Primary member, members, and optional preferred tool
- **AND** the current Project MUST be included as a member and MUST NOT be removable in this Project-first flow

#### Scenario: Choose a different Primary member

- **WHEN** the user selects another included member as Primary
- **THEN** that member MUST remain in the members list
- **AND** the submitted members sequence MUST place its canonical path first

#### Scenario: Cancel creation

- **WHEN** the user cancels the creation form
- **THEN** the Sidebar MUST return to the Worksets list
- **AND** it MUST NOT invoke any Workset mutation command

### Requirement: Trusted Workset member selection

The extension SHALL collect Workset members through the VS Code folder picker and SHALL validate and canonicalize selected paths before submitting them to OpenSpec.

#### Scenario: Add multiple folders

- **WHEN** the user requests to add members and selects one or more folders
- **THEN** the Extension Host MUST return absolute selected folder paths to the active creation form
- **AND** the form MUST preserve one entry per canonical path

#### Scenario: Folder selection is cancelled

- **WHEN** the native folder picker is dismissed without a selection
- **THEN** the existing creation draft MUST remain unchanged
- **AND** the UI MUST NOT report a creation error

#### Scenario: Duplicate or invalid member is returned

- **WHEN** a selected member duplicates an existing canonical path or cannot be resolved as an eligible absolute folder
- **THEN** the form MUST NOT add a duplicate or invalid member
- **AND** the user MUST receive a recoverable explanation for an invalid selection

### Requirement: Selector-free official Workset creation

The Extension Host SHALL create Worksets exclusively through the official JSON CLI command and SHALL keep Workset mutation independent from the current Planning root.

#### Scenario: Create a Workset without a preferred tool

- **WHEN** the user submits a valid name and ordered members without a preferred tool
- **THEN** the Host MUST invoke `openspec workset create <name> --member <primary> --member <other>... --json`
- **AND** the command MUST NOT include `--store` or another Planning-root selector

#### Scenario: Create a Workset with a preferred tool

- **WHEN** the user submits a valid optional opener id
- **THEN** the Host MUST append `--tool <id>` before `--json`
- **AND** the CLI MUST remain responsible for validating whether the opener is configured and usable

#### Scenario: Webview submits malformed creation input

- **WHEN** the submitted name, tool id, or members have invalid types, the trimmed name is empty, or the members list is empty
- **THEN** the Host MUST reject the request before invoking the CLI
- **AND** it MUST NOT read or write OpenSpec private Workset registry files

### Requirement: Workset creation result and refresh

The creation flow SHALL report an explicit result and SHALL refresh the Project-first Workset snapshot only after the official command succeeds.

#### Scenario: Workset creation succeeds

- **WHEN** the official create command succeeds for a Workset containing the current Project
- **THEN** the Host MUST reload the current Project Sidebar data from official sources
- **AND** the Sidebar MUST enter the new Workset detail view after the refreshed snapshot contains that Workset

#### Scenario: Workset creation fails

- **WHEN** the CLI rejects a duplicate name, invalid opener, missing member, or another creation error
- **THEN** the Sidebar MUST preserve the user's draft and show a recoverable error
- **AND** it MUST NOT display the Workset as created or clear the draft optimistically

#### Scenario: Workset capability is unavailable

- **WHEN** the resolved OpenSpec runtime explicitly reports Workset capability as unavailable
- **THEN** the Sidebar MUST hide or disable the creation action with the existing upgrade explanation
- **AND** it MUST keep Changes and Specs usable
