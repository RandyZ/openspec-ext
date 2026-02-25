# AGENTS.md

## Cursor Cloud specific instructions

### Project overview

OpenSpec VSCode Extension — a VS Code extension providing a visual dashboard for OpenSpec workflows. Two main layers:

- **Extension Host** (Node.js): CLI integration, file watching, caching, commands. Built with esbuild → `dist/extension.js`.
- **Webview** (React 19 + Tailwind + Radix UI): Dashboard, change detail, task list. Built with Vite → `dist/webview/`.

### Key commands

| Task | Command |
|---|---|
| Install deps | `pnpm install` |
| Full build | `pnpm run build` (esbuild + vite) |
| Watch (extension only) | `pnpm run watch` |
| Dev webview (standalone) | `pnpm run dev:webview` |
| Unit tests | `pnpm test` |
| Tests (watch) | `pnpm run test:watch` |
| Lint | `npx eslint src/` |
| Format | `npx prettier --write .` |
| Debug in VS Code | Press F5 (uses `.vscode/launch.json` "Run Extension") |

### Non-obvious caveats

- **No lockfile committed**: `pnpm-lock.yaml` is not in the repo; `pnpm install` resolves fresh each time.
- **esbuild build script warning**: pnpm may warn about "Ignored build scripts: esbuild" — this is cosmetic and does not affect functionality; the esbuild binary resolves correctly via its platform-specific optional dependency.
- **`@eslint/js` is a missing devDependency**: The ESLint flat config (`eslint.config.js`) imports `@eslint/js` but it's not declared in `package.json`. Run `pnpm add -D @eslint/js` to fix. ESLint also lacks Node.js/browser global declarations, so `no-undef` errors on `process`, `console`, `setTimeout`, `window`, `document` etc. are pre-existing.
- **`"type": "module"` not set**: Node warns about `MODULE_TYPELESS_PACKAGE_JSON` for `eslint.config.js` and `postcss.config.js` since they use ESM syntax. This is cosmetic.
- **Extension activation**: Requires `openspec/config.yaml` in the workspace root. This file exists in the repo.
- **OpenSpec CLI**: The extension shells out to an `openspec` binary. It's optional for building/testing but required for full runtime. Without it the extension shows "OpenSpec CLI not found" at startup — this is expected behavior, not a bug.
- **VS Code is required to run the extension**: It runs inside the Extension Development Host. Use `code --extensionDevelopmentPath=/workspace /workspace --no-sandbox` to launch headlessly, or press F5 from within VS Code.
