## 1. Dependencies and scripts

- [ ] 1.1 Add `@vscode/vsce` and `ovsx-cli` to devDependencies in package.json
- [ ] 1.2 Add script `package`: run build then vsce package (output .vsix in project root)
- [ ] 1.3 Add script `publish:marketplace`: run vsce publish (for VS Code Marketplace)
- [ ] 1.4 Add script `publish:openvsx`: run ovsx publish using token from env (e.g. OVSX_TOKEN), with clear error if token missing

## 2. Publishing documentation

- [ ] 2.1 Create docs/PUBLISHING.md with: how to create publisher in Azure DevOps for VS Code Marketplace
- [ ] 2.2 In docs/PUBLISHING.md add: how to create namespace and obtain token for Open VSX
- [ ] 2.3 In docs/PUBLISHING.md add: step-by-step first publish and update flow for both marketplaces (package → publish)
- [ ] 2.4 Document OVSX_TOKEN (and that it must not be committed) in docs/PUBLISHING.md; optionally add .env.example listing OVSX_TOKEN only (no values)
- [ ] 2.5 Add a short "Publishing" or "How to release" section in README that links to docs/PUBLISHING.md

## 3. Verification

- [ ] 3.1 Run `pnpm run package` and confirm a .vsix is produced with correct version in filename
- [ ] 3.2 Confirm publish:openvsx fails with a clear message when OVSX_TOKEN is unset (or document expected behavior)
