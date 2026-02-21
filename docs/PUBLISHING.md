# Publishing the OpenSpec extension

This document describes how to package and publish the extension to **VS Code Marketplace** and **Open VSX** (used by Cursor, VSCodium, and others). Ensure `package.json` version is bumped and changes are committed before publishing.

## Prerequisites

- Node.js 18+
- pnpm installed
- Dependencies installed: `pnpm install`

---

## 1. VS Code Marketplace (marketplace.visualstudio.com)

### 1.1 Create a publisher (first time only)

VS Code uses Azure DevOps for the Marketplace. You need a **publisher** and a **Personal Access Token (PAT)**.

1. **Personal Access Token**
   - Go to [Azure DevOps](https://go.microsoft.com/fwlink/?LinkId=307137). Create an [organization](https://learn.microsoft.com/azure/devops/organizations/accounts/create-organization) if needed.
   - User settings (profile) → **Personal access tokens** → **New Token**.
   - Under **Scopes**, choose **Custom defined** → **Marketplace** → **Manage** (and show all scopes if needed). Create the token and copy it to a safe place.

2. **Create publisher**
   - Go to [Marketplace publisher management](https://marketplace.visualstudio.com/manage).
   - Sign in with the same Microsoft account used for the PAT.
   - Click **Create publisher**.
   - Set **ID** (e.g. `openspec`) and **Name**. The ID must match the `publisher` field in `package.json` and cannot be changed later. Click **Create**.

3. **Log in with vsce**
   - Run: `pnpm exec vsce login <publisher-id>`
   - When prompted, paste your Personal Access Token. You only need to do this once per machine.

### 1.2 Package and publish

```bash
# Build and create .vsix
pnpm run package

# Publish to VS Code Marketplace (uses vsce login)
pnpm run publish:marketplace
```

For CI or non-interactive use, you can use the `VSCE_PAT` environment variable instead of `vsce login`. Do not commit the PAT.

---

## 2. Open VSX (open-vsx.org)

### 2.1 Create namespace and token (first time only)

1. **Account and namespace**
   - Go to [open-vsx.org](https://open-vsx.org) and sign in (e.g. with GitHub).
   - Create a **namespace** that matches your extension’s `publisher` in `package.json` (e.g. `openspec`). If the name is taken, pick another and update `publisher` in `package.json` before first publish.

2. **Personal Access Token**
   - Open [Open VSX user settings → Tokens](https://open-vsx.org/user-settings/tokens).
   - Create a new token. Copy it to a safe place.

3. **Token must not be committed**
   - Use the token only via environment variable (e.g. `OVSX_TOKEN`). Do not put it in the repo or in committed `.env` files. CI should inject it as a secret.

### 2.2 Publish to Open VSX

Set your token and run the publish script:

```bash
# Build and create .vsix (if not already done)
pnpm run package

# Publish to Open VSX (requires OVSX_TOKEN)
OVSX_TOKEN=your-token-here pnpm run publish:openvsx
```

If `OVSX_TOKEN` is not set, the script exits with a clear error and does not publish.

On Windows (PowerShell):

```powershell
$env:OVSX_TOKEN = "your-token-here"
pnpm run publish:openvsx
```

---

## 3. Release flow (both marketplaces)

1. Bump `version` in `package.json` and commit.
2. Run once: `pnpm run package` (produces a `.vsix` in the project root).
3. Publish to one or both:
   - **VS Code Marketplace:** `pnpm run publish:marketplace` (after `vsce login <publisher>` or with `VSCE_PAT` set).
   - **Open VSX:** `OVSX_TOKEN=<token> pnpm run publish:openvsx`.

You can publish the same version to both; the same `.vsix` is used.

---

## 4. Optional: .env.example

If you use a local `.env` for tokens, add `.env` to `.gitignore` and optionally provide:

```bash
# .env.example (no real values – do not commit tokens)
# OVSX_TOKEN=    # Open VSX PAT from https://open-vsx.org/user-settings/tokens
# VSCE_PAT=      # Azure DevOps PAT with Marketplace scope (for vsce publish)
```

Load `.env` before running publish (e.g. with `dotenv` or your shell). Never commit `.env` or real tokens.
