# Spec: Marketplace Publish

## ADDED Requirements

### Requirement: Package produces a .vsix artifact

The project SHALL provide a single command that builds the extension (if needed) and produces a .vsix file. The .vsix filename SHALL include the extension version from package.json (e.g. `openspec-vscode-0.1.0.vsix`). The command SHALL use the existing build output and .vscodeignore so that the .vsix contains only runtime-necessary files.

#### Scenario: Run package script

- **WHEN** the maintainer runs the configured package command (e.g. `pnpm run package`)
- **THEN** the project runs the existing prepublish/build step and then runs the VS Code packaging tool to produce a .vsix in the project root (or a documented output directory)

#### Scenario: Version in filename

- **WHEN** package.json has version "0.2.0" and the package command is run
- **THEN** the generated .vsix file name SHALL reflect that version (e.g. contains "0.2.0")

### Requirement: Publish to VS Code Marketplace

The project SHALL provide a script or documented command to publish the packaged .vsix to the VS Code Marketplace. Authentication SHALL use the official VS Code publishing mechanism (e.g. vsce login or token) and SHALL NOT require hardcoded secrets in the repository.

#### Scenario: Publish to VS Marketplace

- **WHEN** the maintainer runs the configured publish-to-marketplace command after having authenticated (e.g. vsce login) and after having run the package command
- **THEN** the current .vsix is published to the VS Code Marketplace under the publisher specified in package.json

### Requirement: Publish to Open VSX

The project SHALL provide a script or documented command to publish the packaged .vsix to the Open VSX registry. Authentication SHALL use a token supplied via environment variable (e.g. OVSX_TOKEN); the token SHALL NOT be committed to the repository.

#### Scenario: Publish to Open VSX with token

- **WHEN** the maintainer sets the required token in the environment and runs the configured publish-to-openvsx command after having run the package command
- **THEN** the current .vsix is published to Open VSX under the namespace that matches the publisher or is configured for the tool

#### Scenario: Publish fails without token

- **WHEN** the publish-to-openvsx command is run and the required token environment variable is not set (or is empty)
- **THEN** the publish tool SHALL fail with a clear message that the token is missing (or the script SHALL document that the token must be set)

### Requirement: Publishing documentation

The project SHALL document how to register a publisher (or namespace) for VS Code Marketplace and for Open VSX, and how to perform the first publish and subsequent version updates. Documentation SHALL include which environment variables or credentials are required for each marketplace.

#### Scenario: First-time publisher can follow docs

- **WHEN** a maintainer follows the publishing documentation from zero (no existing publisher/namespace)
- **THEN** they can create the required publisher/namespace for both marketplaces and run the package and publish commands to publish a version

#### Scenario: Docs mention token handling

- **WHEN** a maintainer reads the Open VSX publish section
- **THEN** the docs SHALL state which environment variable to set for the Open VSX token and that it must not be committed
