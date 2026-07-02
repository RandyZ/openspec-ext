# OpenSpec Scope Management Specification

## Purpose

The extension SHALL manage OpenSpec runtime source selection, store-aware feature detection, and selected scope semantics for dashboard and workflow operations.

## Requirements

### Requirement: OpenSpec runtime source selection
The extension SHALL support an explicit OpenSpec runtime source model that distinguishes installed CLI, custom executable path, and local OpenSpec source checkout.

#### Scenario: Default auto mode preserves existing installed CLI behavior
- **GIVEN** `openspec.cliMode` is `auto`
- **AND** no local source path is configured
- **WHEN** the extension resolves the OpenSpec runtime
- **THEN** it MUST use the existing configured path, Extension Host PATH, login shell PATH, and known path resolution order
- **AND** existing users MUST see no change in dashboard behavior

#### Scenario: Custom path mode uses configured executable only
- **GIVEN** `openspec.cliMode` is `customPath`
- **AND** `openspec.cliPath` is configured
- **WHEN** the extension resolves the OpenSpec runtime
- **THEN** it MUST validate only the configured executable with `--version`
- **AND** it MUST NOT silently fall back to PATH, login shell, known paths, or local source

#### Scenario: Local source mode uses configured source checkout
- **GIVEN** `openspec.cliMode` is `localSource`
- **AND** `openspec.localOpenSpecSourcePath` points to an OpenSpec source checkout
- **WHEN** the extension resolves the OpenSpec runtime
- **THEN** it MUST run OpenSpec through the extension host Node executable and the checkout's `bin/openspec.js`
- **AND** all subsequent OpenSpec CLI calls MUST use that local source runtime until settings change or runtime detection is retried

#### Scenario: Runtime source is visible to the user
- **GIVEN** the OpenSpec runtime has been resolved
- **WHEN** the dashboard renders
- **THEN** the UI MUST show whether the runtime is Installed CLI, Custom Path, or Local Source
- **AND** local source mode MUST show a concise source label without exposing unsafe full paths in copyable diagnostics

### Requirement: Local source readiness diagnostics
The extension SHALL diagnose local OpenSpec source readiness before exposing unreleased store-aware UI.

#### Scenario: Local source checkout is ready
- **GIVEN** local source mode is enabled
- **AND** the configured source path contains a package manifest, `bin/openspec.js`, and built CLI output required by that entrypoint
- **WHEN** the extension runs `--version`
- **THEN** runtime resolution MUST succeed
- **AND** the dashboard MUST be allowed to probe store-aware features

#### Scenario: Local source checkout is missing build output
- **GIVEN** local source mode is enabled
- **AND** the source checkout exists but the CLI entrypoint cannot import built output
- **WHEN** runtime resolution fails
- **THEN** the extension MUST show a local source diagnostic
- **AND** the diagnostic MUST explain that the local OpenSpec checkout needs to be built
- **AND** the diagnostic MUST offer recovery actions to open settings, retry detection, copy diagnostics, and open relevant docs or instructions

#### Scenario: Local source path is invalid
- **GIVEN** local source mode is enabled
- **AND** the configured path is empty, missing, not a directory, or not an OpenSpec checkout
- **WHEN** runtime resolution runs
- **THEN** the extension MUST create a local source diagnostic
- **AND** automatic installed CLI fallback MUST NOT hide the invalid local source configuration

#### Scenario: Auto build is prompted before running build
- **GIVEN** local source mode is enabled
- **AND** `openspec.localOpenSpecAutoBuild` is `prompt`
- **AND** build output is missing
- **WHEN** the extension can offer to build the local checkout
- **THEN** it MUST ask for user confirmation before running any build command
- **AND** it MUST show the command that will run
- **AND** it MUST not run package installation automatically

### Requirement: Store-aware feature detection
The extension SHALL detect whether the resolved OpenSpec runtime supports store-aware commands before showing store-specific controls.

#### Scenario: Store commands are supported
- **GIVEN** the resolved runtime supports `store`, `context`, `doctor`, and `workset` command surfaces needed by the dashboard
- **WHEN** feature detection runs
- **THEN** the extension MUST mark store-aware dashboard features as available
- **AND** the Scope Bar MAY show store selection and relationship controls

#### Scenario: Store commands are unsupported
- **GIVEN** the resolved runtime is a stable CLI that does not support store-aware commands
- **WHEN** feature detection runs
- **THEN** the extension MUST keep the single-root dashboard usable
- **AND** store selector, references panel, and workset controls MUST be hidden or replaced by a concise unsupported-feature notice
- **AND** the notice MUST suggest local source mode when the user wants to dogfood unreleased store-aware features

#### Scenario: Feature probe failure is diagnostic, not data loss
- **GIVEN** dashboard data can be loaded for the current root
- **AND** store-aware feature probing fails
- **WHEN** the dashboard renders
- **THEN** existing change and spec content MUST remain visible
- **AND** the UI MUST show a non-blocking feature diagnostic instead of a blank dashboard

### Requirement: Selected OpenSpec scope
The extension SHALL maintain a selected OpenSpec scope that defines the writable root for dashboard data, artifact access, and workflow actions.

#### Scenario: Local root scope
- **GIVEN** a workspace folder contains a local `openspec/` planning root
- **WHEN** no explicit store scope is selected
- **THEN** the selected scope MUST be the local root
- **AND** dashboard data and actions MUST use that root

#### Scenario: Explicit store scope
- **GIVEN** store-aware features are available
- **AND** the user selects a registered store
- **WHEN** dashboard data is refreshed
- **THEN** the selected scope MUST include the store id, store root path, and source `store`
- **AND** root-resolving commands MUST run against that store

#### Scenario: Declared store scope is reported
- **GIVEN** OpenSpec resolves the current workspace to a declared store through `openspec/config.yaml`
- **WHEN** the extension loads the current scope
- **THEN** the selected scope MUST report source `declared`
- **AND** the UI MUST show the declared store id so the user understands where commands act

#### Scenario: Scope selection clears stale dashboard data
- **GIVEN** dashboard data has been loaded for one scope
- **WHEN** the selected scope changes
- **THEN** the extension MUST clear or replace scope-bound dashboard caches
- **AND** it MUST not show changes from the previous scope as if they belonged to the new scope

### Requirement: Reference and workset semantics
The extension SHALL preserve OpenSpec's distinction between writable scopes, read-only references, and personal worksets.

#### Scenario: Referenced store is read-only context
- **GIVEN** the selected scope declares a referenced store
- **WHEN** the dashboard displays that referenced store
- **THEN** it MUST present the referenced store as read-only context
- **AND** it MUST NOT expose create, apply, sync, verify, archive, or task-toggle actions for that referenced store unless the user explicitly selects it as the active store scope

#### Scenario: Reference fetch command is visible
- **GIVEN** a referenced store exposes specs in the context index
- **WHEN** the relationship panel renders
- **THEN** each referenced store MUST show a fetch command or equivalent action for reading a referenced spec
- **AND** the command MUST include `--store <id>` when OpenSpec provides that recipe

#### Scenario: Unresolved reference has concrete recovery
- **GIVEN** a referenced store is not registered locally
- **WHEN** OpenSpec reports an unresolved reference diagnostic
- **THEN** the dashboard MUST show the diagnostic message and fix text
- **AND** the dashboard MUST NOT silently omit the referenced store

#### Scenario: Workset is local convenience only
- **GIVEN** store-aware features are available
- **WHEN** the dashboard displays workset information
- **THEN** it MUST describe worksets as local personal views for opening folders together
- **AND** it MUST NOT imply that worksets are committed, shared, or authoritative project relationships
