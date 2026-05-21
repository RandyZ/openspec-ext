## MODIFIED Requirements

### Requirement: CLI Availability Check
The system SHALL verify OpenSpec CLI is available before operation, including GUI-launched Cursor/VS Code sessions whose Extension Host PATH differs from the user's terminal shell PATH.

#### Scenario: CLI installed and available
- GIVEN the extension activates
- WHEN checking for CLI availability
- THEN the command `openspec --version` MUST execute successfully
- AND the version MUST be parsed and stored
- AND the extension MUST continue normal operation

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
- THEN an error notification MUST be shown
- AND the error MUST include installation instructions
- AND the error MUST provide a link to OpenSpec documentation
- AND the diagnostic log MUST include the attempted resolution methods and relevant PATH information
- AND core extension features MUST be disabled gracefully

#### Scenario: Minimum version check
- GIVEN the extension requires OpenSpec >= 1.0.0
- AND the installed version is 0.9.0
- WHEN checking CLI version
- THEN a warning MUST be shown
- AND the user MUST be prompted to upgrade
- AND the extension SHOULD still attempt to function

### Requirement: Error Handling
The system SHALL handle CLI integration errors robustly and provide actionable diagnostics when the executable cannot be resolved.

#### Scenario: Command not found
- GIVEN `openspec` cannot be resolved by the CLI path resolver
- WHEN any CLI command is attempted
- THEN a clear error MUST be shown once per session
- AND the error MUST not spam the user
- AND the error MUST offer installation instructions
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
- AND a helpful message MUST guide the user to fix it

#### Scenario: Workspace not initialized
- GIVEN `openspec/` directory doesn't exist
- WHEN CLI commands are executed
- THEN the error from CLI MUST be captured
- AND the UI MUST suggest running `openspec init`
- AND an "Initialize Now" button SHOULD be provided
