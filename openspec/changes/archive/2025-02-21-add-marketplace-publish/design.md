# Design: Marketplace Publish Tooling

## Context

- The extension already has `vscode:prepublish` (runs `pnpm run build`) and a proper `.vscodeignore`; the build output is suitable for packaging.
- **VS Code Marketplace** uses Azure DevOps organizations and the official `vsce` CLI; **Open VSX** uses its own registry and supports `ovsx-cli` (e.g. `npx ovsx publish`) or the web UI.
- Publisher identity: `package.json` currently has `"publisher": "openspec"`. This must match the publisher/namespace created in each marketplace (Azure DevOps org for VS Marketplace, Open VSX namespace for Open VSX).
- Package manager: pnpm; all commands and scripts SHALL use pnpm.

```
┌──────────────────────────────────────────────────────────────────┐
│  Developer / CI                                                   │
├──────────────────────────────────────────────────────────────────┤
│  pnpm run build  (existing)                                       │
│         │                                                         │
│         ▼                                                         │
│  pnpm run package  ──►  .vsix  (single artifact)                  │
│         │                                                         │
│         ├─────────────────────┬─────────────────────────────────┤
│         ▼                     ▼                                   │
│  pnpm run publish:marketplace   pnpm run publish:openvsx           │
│  (vsce publish)                 (ovsx publish, token from env)      │
│         │                     │                                   │
│         ▼                     ▼                                   │
│  VS Code Marketplace          Open VSX Registry                    │
└──────────────────────────────────────────────────────────────────┘
```

## Goals / Non-Goals

**Goals:**

- One-command packaging: `pnpm run package` produces a versioned `.vsix` from current `package.json` version.
- Publish to **VS Code Marketplace** via vsce (interactive login or token).
- Publish to **Open VSX** via ovsx-cli with token from environment (e.g. `OVSX_TOKEN`).
- Document publisher registration and publish steps so a maintainer can do first-time setup and releases without guessing.

**Non-Goals:**

- Automating the very first publisher/namespace creation (manual per marketplace).
- CI/CD pipeline implementation (document how to add it; optional follow-up).
- Changing extension runtime behavior or activation.

## Decisions

### 1. Use `@vscode/vsce` and `ovsx-cli` as devDependencies

- **Choice**: Add `@vscode/vsce` and `ovsx-cli` to `devDependencies` so `pnpm run package`, `publish:marketplace`, and `publish:openvsx` work without global installs.
- **Alternative**: Use `npx @vscode/vsce` and `npx ovsx` only. Rejected so versions are pinned and scripts stay simple (`pnpm exec vsce package` etc.).

### 2. Script naming: `package`, `publish:marketplace`, `publish:openvsx`

- **Choice**: `package` = build + vsce package; `publish:marketplace` = vsce publish; `publish:openvsx` = ovsx publish (reading token from env).
- **Rationale**: Clear separation; CI can run `package` once and then call the appropriate publish script (or both). No single “publish both” script by default to avoid accidental double-publish; can be added later if desired.

### 3. Open VSX token via environment variable

- **Choice**: Document and use a single env var (e.g. `OVSX_TOKEN`) for Open VSX Personal Access Token. Script runs `pnpm exec ovsx publish ... -p $OVSX_TOKEN` (or equivalent).
- **Rationale**: Keeps secrets out of repo; CI can inject the token. No .env committed; optional `.env.example` listing variable names only.

### 4. Publishing doc in `docs/PUBLISHING.md`

- **Choice**: Standalone `docs/PUBLISHING.md` for publisher setup (Azure DevOps, Open VSX namespace), first-time publish, and update flow. README can link to it for “How to release.”
- **Rationale**: Keeps README user-focused; release instructions are detailed and one-place.

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Publisher name `openspec` already taken in one marketplace | Document that publisher/namespace must be created first; if taken, use another name and update `package.json` publisher before first publish. |
| vsce/ovsx breaking or changing CLI | Pin devDependency versions; document minimum Node version if needed. |
| Accidentally publishing from wrong branch or version | Document: “Ensure version in package.json is bumped and committed before publishing.” Optional: add a small pre-publish check script that fails if git is dirty or version not bumped (future). |

## Migration Plan

- Add devDependencies and scripts; no runtime migration.
- After merge: maintainer creates publisher/namespace once per marketplace, then uses `pnpm run package` and the two publish scripts for releases. Rollback = do not run publish scripts; no code rollback needed for this change.

## Open Questions

- None for MVP. Optional later: add a `release` or `publish:all` script that runs package then both publish commands with confirmation.
