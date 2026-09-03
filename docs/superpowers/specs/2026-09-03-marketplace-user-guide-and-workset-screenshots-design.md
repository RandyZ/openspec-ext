# Marketplace User Guide and Workset Screenshots Design

**Date:** 2026-09-03  
**Status:** Approved for implementation planning

## Goal

Make the extension understandable from its Marketplace page and provide a task-oriented, bilingual guide for both first-time OpenSpec users and experienced users who only need the plugin-specific behavior.

The documentation must explain how the extension UI works with OpenSpec rather than duplicate the complete OpenSpec manual. OpenSpec concepts and CLI details should link to the official [Getting Started](https://github.com/Fission-AI/OpenSpec/blob/main/docs/getting-started.md), [command model](https://github.com/Fission-AI/OpenSpec/blob/main/docs/how-commands-work.md), and [Stores/Worksets guide](https://github.com/Fission-AI/OpenSpec/blob/main/docs/stores-beta/user-guide.md).

## Current State

- The English and Chinese READMEs contain feature descriptions and a short quick start.
- The Marketplace content is extracted from `README.md` above the first standalone `---` line.
- Two public screenshots exist: Dashboard overview and Change detail.
- Worksets and Stores are described in text but have no public screenshots.
- Archived real-Host evidence contains local project names and filesystem paths, so it must not be reused for Marketplace publication.
- Repeated attempts to automate a fresh Extension Development Host were blocked by macOS multi-display/Space window rehydration. The user approved a source-equivalent headless Webview fallback on 2026-09-03.
- No task-oriented guide currently connects setup, UI actions, Agent commands, Store selection, and Workset navigation.

## Chosen Approach

Use a progressive, two-layer documentation structure:

1. Keep the Marketplace README short enough to scan in about two minutes.
2. Link to a complete bilingual guide for task-level instructions.
3. Let new users read the guide from the beginning.
4. Give experienced OpenSpec users a stable `#plugin-interface` anchor that skips setup and goes directly to plugin behavior.
5. Reuse one set of five screenshots across both layers instead of maintaining separate Marketplace and guide assets.

This approach is preferred over a README-only manual because a long Marketplace page becomes difficult to scan. It is preferred over a guide-only approach because users need enough information on the Marketplace page to understand the extension before leaving it.

## Information Architecture

### Marketplace README

The English and Chinese READMEs keep the same section order:

1. Product summary and highlights.
2. Dashboard overview screenshot.
3. Change detail screenshot.
4. Two-minute quick start.
5. Core Change workflow.
6. Store and Workset overview with three new screenshots.
7. Link to the complete user guide.
8. Commands, settings, adapters, and existing reference material.

All Marketplace-facing content remains above the existing `---` delimiter. The complete guide link uses an absolute GitHub URL so it works from the VS Code Marketplace, where repository-relative Markdown links are unreliable.

### Complete User Guides

Create:

- `docs/USER_GUIDE.md`
- `docs/USER_GUIDE.zh-CN.md`

Both guides use the same headings and examples:

1. **Choose a path**
   - New to OpenSpec: continue with installation and initialization.
   - Familiar with OpenSpec: jump to `#plugin-interface`.
2. **Install and initialize**
   - Install OpenSpec CLI and the extension.
   - Initialize a project.
   - Open the Dashboard.
3. **Complete the first Change**
   - Select the intended OpenSpec Root.
   - Create a Change.
   - Generate planning artifacts.
   - Apply, verify, and archive.
4. **Lifecycle states**
   - Planning, Ready to Apply, Applying, Ready to Verify, and Archived.
5. **Plugin interface** (`#plugin-interface`)
   - Sidebar areas, Dashboard, Change detail tabs, action rail, and root controls.
   - A UI-to-command mapping table.
6. **Use a Store as the planning root**
   - Register or create a Store.
   - Select it from the root control.
   - Explain validation and Git ownership.
7. **Use Worksets**
   - List, inspect, create, switch Project, select Store, and open all members.
8. **Cross-repository example**
   - `team-plans` Store plus `checkout-api` and `checkout-web` Projects in `checkout-suite`.
9. **Troubleshooting and boundaries**
   - CLI discovery, unavailable capabilities, incorrect root, editor switching, Git management, and Agent context expectations.

## UI-to-Command Truth Table

The guide must distinguish terminal CLI commands from Agent slash commands.

| UI action | Underlying action | Execution surface | Documented result |
|---|---|---|---|
| New Change | `openspec new change <name>` | Extension invokes CLI | Creates the Change skeleton in the selected root |
| Continue | `/opsx:continue <change>` | Selected Agent adapter or clipboard | Creates the next required artifact |
| Fast-forward | `/opsx:ff <change>` | Selected Agent adapter or clipboard | Creates the remaining planning artifacts |
| Apply | `/opsx:apply <change>` | Selected Agent adapter or clipboard | Implements the planned tasks |
| Verify | `/opsx:verify <change>` | Interactive VS Code terminal | Checks implementation against artifacts |
| Review & Archive | `/opsx:archive <change>` | Interactive VS Code terminal | Lets the Agent review and archive interactively |
| Archive Now | Direct archive CLI | Extension after confirmation | Archives only when required artifacts and tasks are complete |

The guide must mention that OpenCode adapters translate colon-form slash commands to their supported hyphen form. It must not imply that every UI action executes directly or that clipboard mode automatically runs an Agent.

## Store and Workset Semantics

The documentation must preserve these boundaries:

- A **Store** is a planning root for Changes and Specs.
- Store Git clone, pull, push, credentials, and conflict handling remain the user's responsibility.
- A **Workset** is a machine-local named group of folders that can be opened together.
- Selecting a Workset Project changes the Project shown in the OpenSpec sidebar.
- Selecting a validated Store member changes the planning root.
- **Open all** changes the editor workspace; it is not the same as switching the sidebar Project.
- Store members are not Project targets.
- A Workset does not grant Agent permissions, choose an implementation repository, or automatically provide every member as Agent context.
- A one-time opener override does not modify the Workset's saved opener.

## Screenshot Plan

Reuse the two existing images:

1. `docs/images/openspec-dashboard.png`
2. `docs/images/openspec-change-detail.png`

Add three screenshots:

3. `docs/images/openspec-worksets-list.png`
   - Shows trusted Worksets containing the current Project.
   - Shows member count and preferred opener.
4. `docs/images/openspec-workset-detail.png`
   - Shows `team-plans` as a Store/planning-root member.
   - Shows `checkout-api` and `checkout-web` as Project members.
   - Shows **Open all**, a one-time opener control, and Project/Store navigation actions.
5. `docs/images/openspec-workset-create.png`
   - Shows Workset name, current Project, selected member folders, preferred opener, Create, and Cancel.

### Capture Fixture

Use public demonstration names only:

- Store: `team-plans`
- Workset: `checkout-suite`
- Projects: `checkout-api`, `checkout-web`
- Optional second Workset: `support-platform`

Do not expose `/Users/...`, usernames, private repository names, tokens, remote URLs, or unrelated editor content.

### Visual Constraints

- Render the current production Webview source through the existing Vite entry point in headless Chromium, using the same Host message contract and VS Code theme variables. This user-approved fallback replaces the real Extension Development Host requirement for these three Marketplace images only.
- Use a 430 px sidebar width.
- Use the settled dark theme state after transitions finish.
- Use the English locale for Marketplace screenshots.
- Keep text readable at the rendered README width.
- Wait at least 600 ms after applying the theme or changing scenes, then verify no horizontal overflow, transition-state colors, or clipped primary actions.
- Use Chinese and high-contrast captures only as QA evidence unless a later release has a specific localization marketing need.

The Workset detail screenshot carries the Store explanation, so a sixth Store-only screenshot is intentionally omitted.

## Files and Packaging

Expected implementation scope:

- Update `README.md`.
- Update `README.zh-CN.md`.
- Add `docs/USER_GUIDE.md`.
- Add `docs/USER_GUIDE.zh-CN.md`.
- Add the three PNG files under `docs/images/`.

No extension behavior, source code, dependency, documentation site, or `.vscodeignore` change is required. The current ignore rules intentionally keep the detailed guides repository-hosted; only the README files and `docs/images/**` need to be present in the VSIX. Marketplace README links use canonical absolute GitHub `blob/main` URLs, which become live when the change is merged.

## Validation

Implementation is complete only when all of the following are true:

1. English and Chinese READMEs have equivalent user-facing structure and links.
2. English and Chinese complete guides have matching section coverage and stable anchors.
3. Every documented action matches the current extension behavior and execution surface.
4. Every image path and guide link resolves from the repository README.
5. The Marketplace README extraction contains the intended quick start, Store/Workset section, screenshots, and absolute guide link.
6. A locally packaged VSIX contains the extracted English Marketplace README, the Chinese README, and all five images.
7. The packaged Marketplace README renders every image and its complete-guide URLs target the canonical repository paths. Live `blob/main` reachability is checked after merge rather than treated as a pre-merge gate.
8. The three new screenshots are generated from the current Webview source and satisfy the capture fixture, Host-message equivalence, privacy, width, settled-theme, readability, and overflow constraints.
9. `git diff --check` is clean.

## Non-Goals

- Rewriting OpenSpec's official conceptual documentation.
- Building a documentation website or adding a documentation framework.
- Adding screenshots for every theme, locale, tab, command, or settings field.
- Changing Store, Workset, workflow, adapter, or packaging behavior.
- Committing or maintaining screenshot-generation automation; a temporary headless harness may be used to produce the approved static assets.
