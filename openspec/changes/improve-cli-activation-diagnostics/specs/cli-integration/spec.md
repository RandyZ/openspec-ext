> 参考 Superpowers 前置设计文档：[OpenSpec CLI 路径解析设计](../../../../../docs/superpowers/specs/2026-04-30-resolve-cli-path-from-shell-design.md)

## MODIFIED Requirements

### Requirement: CLI Availability Check
The system SHALL verify OpenSpec CLI is available before operation, including GUI-launched Cursor/VS Code sessions whose Extension Host PATH differs from the user's terminal shell PATH, and SHALL produce structured activation diagnostics when availability cannot be established.

#### Scenario: CLI installed and available
- GIVEN the extension activates
- WHEN checking for CLI availability
- THEN the command `openspec --version` MUST execute successfully
- AND the version MUST be parsed and stored
- AND the extension MUST continue normal operation
- AND any previous CLI activation diagnostic MUST be cleared

#### Scenario: CLI path configured explicitly
- GIVEN `openspec.cliPath` is configured with an executable path
- WHEN checking for CLI availability
- THEN the configured path MUST be validated with `--version`
- AND the validated configured path MUST be used for subsequent OpenSpec CLI commands
- AND automatic PATH or shell discovery MUST NOT override the configured path

#### Scenario: CLI available through Extension Host PATH
- GIVEN `openspec.cliPath` is empty
- AND `openspec` is resolvable from the Extension Host process PATH
- WHEN checking for CLI availability
- THEN the extension MUST validate `openspec --version`
- AND the extension MUST continue normal operation without invoking shell PATH discovery

#### Scenario: CLI available only through terminal shell PATH
- GIVEN `openspec.cliPath` is empty
- AND `openspec` is not resolvable from the Extension Host process PATH
- AND the user's login shell can resolve `openspec` with `command -v openspec`
- WHEN checking for CLI availability
- THEN the extension MUST validate the resolved absolute path with `--version`
- AND the extension MUST cache the validated path for subsequent OpenSpec CLI commands during the extension session
- AND the extension MUST continue normal operation

#### Scenario: CLI available in common install path
- GIVEN `openspec.cliPath` is empty
- AND direct PATH lookup and shell PATH discovery do not resolve `openspec`
- AND `openspec` exists at a known installation path such as `/opt/homebrew/bin/openspec`, `/usr/local/bin/openspec`, or `/usr/bin/openspec`
- WHEN checking for CLI availability
- THEN the extension MUST validate the candidate path with `--version`
- AND the extension MUST use the first validated candidate path for subsequent OpenSpec CLI commands

#### Scenario: CLI not found
- GIVEN the extension activates
- AND `openspec` cannot be resolved through configured path, Extension Host PATH, shell PATH discovery, or known installation paths
- WHEN checking for CLI availability
- THEN a CLI activation diagnostic MUST be created with category `cli-not-found`
- AND the diagnostic MUST include safe user-facing details about the failed resolution attempts
- AND the diagnostic MUST provide `open-docs`, `open-settings`, `retry`, and `copy-diagnostics` recovery actions
- AND the diagnostic log MUST include the attempted resolution methods and relevant PATH information
- AND core extension features MUST be disabled gracefully or remain limited to existing cached data

#### Scenario: Configured path invalid
- GIVEN `openspec.cliPath` is configured
- AND the configured path is missing, not executable, or fails `--version`
- WHEN checking for CLI availability
- THEN a CLI activation diagnostic MUST be created with category `configured-path-invalid`
- AND the diagnostic MUST identify that the configured path is invalid without exposing sensitive path segments in user-copyable diagnostics
- AND automatic discovery MUST NOT silently ignore the configured path unless the user clears or corrects it
- AND the diagnostic MUST provide `open-settings`, `copy-diagnostics`, and `open-docs` recovery actions

#### Scenario: CLI spawn fails after resolution
- GIVEN the resolver returns a candidate CLI command
- AND spawning the command fails, including Windows shim or `.cmd` launch failures
- WHEN checking for CLI availability
- THEN a CLI activation diagnostic MUST be created with category `spawn-failed`
- AND the diagnostic MUST preserve the low-level error code such as `ENOENT` when available
- AND the diagnostic MUST provide `open-settings`, `copy-diagnostics`, `retry`, and `open-docs` recovery actions

#### Scenario: Shell resolution fails
- GIVEN direct Extension Host PATH lookup fails
- AND login shell PATH resolution times out, returns no path, errors, or is skipped as unsafe
- AND no known installation path restores CLI availability
- WHEN checking for CLI availability
- THEN a CLI activation diagnostic MUST be created with category `shell-resolution-failed`
- AND the diagnostic MUST include safe details that shell resolution failed without exposing raw shell output
- AND the diagnostic MUST provide `open-settings`, `open-docs`, `copy-diagnostics`, and `retry` recovery actions

#### Scenario: Version check fails for resolved CLI
- GIVEN the resolver identifies a CLI command candidate
- AND executing `openspec --version` fails, times out, or returns unusable output
- WHEN checking for CLI availability
- THEN a CLI activation diagnostic MUST be created with category `version-check-failed`
- AND the diagnostic MUST include safe details that the command could start but version validation failed
- AND the diagnostic MUST provide `open-docs`, `copy-diagnostics`, and `retry` recovery actions

#### Scenario: Minimum version check
- GIVEN the extension requires OpenSpec >= 1.0.0
- AND the installed version is 0.9.0
- WHEN checking CLI version
- THEN a warning MUST be shown
- AND the user MUST be prompted to upgrade
- AND the extension SHOULD still attempt to function

### Requirement: Error Handling
The system SHALL handle CLI integration errors robustly and provide structured, actionable, and privacy-preserving diagnostics when the executable cannot be resolved or launched.

#### Scenario: Command not found
- GIVEN `openspec` cannot be resolved by the CLI path resolver
- WHEN any CLI command is attempted
- THEN a clear error MUST be shown once per session for the same diagnostic key
- AND the error MUST not spam the user
- AND the error MUST offer installation instructions or settings recovery based on the diagnostic category
- AND the output log MUST mention `openspec.cliPath`, `process.env.PATH`, `process.env.SHELL`, and attempted fallback paths

#### Scenario: Configured CLI path invalid
- GIVEN `openspec.cliPath` is configured
- AND the configured path is missing, not executable, or fails `--version`
- WHEN checking for CLI availability
- THEN the error MUST identify the configured path as invalid
- AND the error MUST suggest clearing or correcting `openspec.cliPath`
- AND automatic discovery MUST NOT silently ignore the configured path unless the user clears it

#### Scenario: Shell path discovery fails
- GIVEN direct PATH lookup fails
- AND shell PATH discovery times out, errors, or returns no path
- WHEN checking for CLI availability
- THEN the extension MUST continue to known installation path checks
- AND the output log MUST include the shell command failure or timeout
- AND no untrusted shell output MUST be executed

#### Scenario: Permission denied
- GIVEN the user lacks execute permission on `openspec`
- WHEN a command is executed
- THEN the permission error MUST be detected
- AND a CLI activation diagnostic MUST be created with category `permission-denied`
- AND a helpful message MUST guide the user to fix it

#### Scenario: Workspace not initialized
- GIVEN `openspec/` directory doesn't exist
- WHEN CLI commands are executed
- THEN the error from CLI MUST be captured
- AND the UI MUST suggest running `openspec init`
- AND an "Initialize Now" button SHOULD be provided
- AND the error MUST NOT be classified as a CLI activation diagnostic
- AND it MUST NOT use CLI activation diagnostic recovery actions such as `open-settings` or `copy-diagnostics`

#### Scenario: Diagnostic category maps to deterministic recovery actions
- GIVEN a CLI activation diagnostic is created
- WHEN the diagnostic is converted to UI actions
- THEN `configured-path-invalid` MUST map to `open-settings`, `copy-diagnostics`, and `open-docs`
- AND `cli-not-found` MUST map to `open-docs`, `open-settings`, `retry`, and `copy-diagnostics`
- AND `permission-denied` MUST map to `open-docs`, `copy-diagnostics`, and `retry`
- AND `spawn-failed` MUST map to `open-settings`, `copy-diagnostics`, `retry`, and `open-docs`
- AND `shell-resolution-failed` MUST map to `open-settings`, `open-docs`, `copy-diagnostics`, and `retry`
- AND `version-check-failed` MUST map to `open-docs`, `copy-diagnostics`, and `retry`
- AND `unknown` MUST map to `copy-diagnostics`, `retry`, and `open-docs`

#### Scenario: User-copyable diagnostics are sanitized
- GIVEN a CLI activation diagnostic includes raw resolver details
- WHEN the user copies diagnostics
- THEN the copied text MUST NOT include the full `process.env.PATH`
- AND it MUST NOT include full home-directory paths or username path segments
- AND it MUST NOT include environment variables containing `TOKEN`, `KEY`, `SECRET`, or `PASSWORD`
- AND it MUST preserve platform, architecture, diagnostic category, recovery action ids, resolver attempt labels, and stable error codes

#### Scenario: Duplicate notifications are suppressed per session
- GIVEN the same diagnostic category and normalized message occur multiple times in the same extension session
- WHEN CLI availability checks fail repeatedly
- THEN VS Code error notification MUST be shown at most once for that diagnostic key
- AND Output logging MAY record every failure
- AND Dashboard diagnostic state MUST still refresh for every failed check

#### Scenario: Normalized notification key is stable and privacy-preserving
- GIVEN two CLI activation diagnostics have the same category
- AND their messages differ only by absolute user paths, repeated whitespace, timestamps, durations, or attempt numbers
- WHEN the notification dedupe key is computed
- THEN the normalized messages MUST be equal
- AND the normalized message MUST be generated by the extension host as part of the CLI activation diagnostic
- AND the normalized message MUST preserve stable error codes such as `ENOENT`, `EACCES`, `EPERM`, and exit codes
- AND the normalized message MUST NOT include full home-directory paths or username path segments
- AND the normalized message MUST be truncated to a bounded length before being used in the dedupe key

#### Scenario: Retry does not mutate user configuration
- GIVEN a CLI activation diagnostic is visible
- WHEN the user chooses Retry
- THEN the extension MUST re-run CLI availability detection
- AND it MUST NOT modify `openspec.cliPath`
- AND it MUST NOT install OpenSpec CLI
- AND if CLI becomes available, the previous diagnostic MUST be cleared
- AND if CLI remains unavailable, the diagnostic MUST be updated without creating duplicate notifications for the same diagnostic key
