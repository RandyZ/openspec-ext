# Proposal: Add Marketplace Publish Tooling

## Why

The OpenSpec VS Code extension is ready for distribution; we need a repeatable way to package and publish it to both **Open VSX** (Cursor, VSCodium) and **VS Code Marketplace** so users can install from the marketplace instead of loading from source. Without publish tooling, releases are manual and error-prone.

## What Changes

- Add **vsce** (VS Code Extension Manager) as a dev dependency for packaging and VS Marketplace publish.
- Add **ovsx-cli** (or equivalent) for publishing to Open VSX.
- Add npm/pnpm scripts: `package` (produce .vsix), `publish:marketplace`, `publish:openvsx` (or a single script that can target both).
- Document publisher setup (Azure DevOps for VS Marketplace, Open VSX namespace/token) and publish steps in README or `docs/PUBLISHING.md`.
- Optionally: `.env.example` or doc for `OVSX_TOKEN` / Azure token so CI or maintainers can publish without hardcoding secrets.

No breaking changes to extension behavior; this is tooling and docs only.

## Capabilities

### New Capabilities

- **marketplace-publish**: Scripts, config, and documentation to package the extension as .vsix and publish to Open VSX and VS Code Marketplace.

### Modified Capabilities

- None.

## Impact

- **package.json**: New devDependencies (`@vscode/vsce`, `ovsx-cli` or similar), new scripts.
- **Docs**: New or updated README section or `docs/PUBLISHING.md`.
- **CI (optional)**: Could add a workflow that runs `pnpm run package` on tag and/or publishes when secrets are present; out of scope for MVP if not needed.
