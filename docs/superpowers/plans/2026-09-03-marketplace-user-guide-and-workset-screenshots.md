# Marketplace User Guide and Workset Screenshots Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three privacy-safe Store/Workset screenshots and a progressive bilingual guide that teaches new users the complete extension workflow while letting experienced OpenSpec users jump directly to plugin behavior.

**Architecture:** Keep the Marketplace README as the short entry point and host the detailed English and Chinese guides in `docs/`. Reuse the existing two screenshots plus three source-equivalent headless Webview captures across both layers. Keep the implementation documentation-only: no extension source changes, new dependencies, committed screenshot automation, or packaging-rule changes.

**Status:** Completed and verified on 2026-09-03.

**Tech Stack:** Markdown, OpenSpec CLI 1.5.0+, VS Code Extension Development Host, PNG screenshots, existing README extraction script, pnpm, vsce, zip inspection

---

**Design reference:** `docs/superpowers/specs/2026-09-03-marketplace-user-guide-and-workset-screenshots-design.md`

## File Map

| File | Responsibility |
|---|---|
| `docs/images/openspec-worksets-list.png` | Public Worksets list screenshot at 430 px |
| `docs/images/openspec-workset-detail.png` | Public Workset detail screenshot showing Store and Project roles |
| `docs/images/openspec-workset-create.png` | Public Create Workset screenshot |
| `docs/USER_GUIDE.md` | Complete English task-oriented guide |
| `docs/USER_GUIDE.zh-CN.md` | Complete Chinese task-oriented guide with matching anchors |
| `README.md` | English Marketplace quick start, screenshots, and guide links |
| `README.zh-CN.md` | Chinese quick start, screenshots, and guide links |

Do not modify `.vscodeignore`: the detailed guides stay on GitHub, while the existing rules package the README files and `docs/images/**`.

### Task 1: Capture the three public Store/Workset screenshots

**Files:**
- Create: `docs/images/openspec-worksets-list.png`
- Create: `docs/images/openspec-workset-detail.png`
- Create: `docs/images/openspec-workset-create.png`
- Reference: `openspec/changes/archive/2026-09-02-add-worksets-list-detail-create-flow/assets/worksets-list-detail-high-fidelity.png`
- Reference: `openspec/changes/archive/2026-09-02-add-worksets-list-detail-create-flow/assets/workset-create-high-fidelity.png`

The user approved a source-equivalent headless fallback after repeated macOS multi-display/Space failures prevented reliable Extension Development Host capture. Use the current Vite Webview entry point, production React components, the real Host message shape, and VS Code theme variables. Do not mutate the machine-local Store/Workset registry.

- [x] **Step 1: Run the screenshot acceptance check and see it fail**

Run:

```bash
rtk zsh -c 'test -f docs/images/openspec-worksets-list.png && \
  test -f docs/images/openspec-workset-detail.png && \
  test -f docs/images/openspec-workset-create.png'
```

Expected: FAIL because the three public assets do not exist yet.

- [x] **Step 2: Prepare the temporary source-equivalent harness**

Reuse the already validated temporary CDP harness under `/tmp/opsx-a1/` as a starting point. Copy it to a new exact temporary directory, then modify only the copy:

```bash
rtk zsh -c 'test -f /tmp/opsx-a1/cdp.mjs && \
  test -f /tmp/opsx-a1/run.mjs && \
  test ! -e /tmp/openspec-ext-marketplace-headless-20260903 && \
  cp -R /tmp/opsx-a1 /tmp/openspec-ext-marketplace-headless-20260903'
```

The copied harness must:

- load `http://localhost:5173/src/webview/index.html?lang=en`;
- install `acquireVsCodeApi` before the application mounts;
- use a 430 CSS px viewport at device scale factor 2;
- inject a trusted `setContext` message whose Project is `checkout-api`;
- inject one Workset named `checkout-suite`, with `vscode` opener and these members in order:
  - Project `checkout-api` at `/workspace/checkout-api`;
  - Project `checkout-web` at `/workspace/checkout-web`;
  - Store `team-plans` at `/workspace/team-plans`, `storeId: team-plans`;
- set the active validated binding to Store `team-plans`, so detail renders **Current root**;
- enter the real list/detail/create scenes by clicking the production controls;
- after entering create, post `worksetMembersPicked` for `/workspace/team-plans` and `/workspace/checkout-web`, then set the real name input to `checkout-suite` and opener input to `vscode` using native input setters plus bubbling `input` events;
- apply the documented dark VS Code variables and wait at least 600 ms after every theme or scene change;
- capture from x=0 through the bottom of the Workset surface plus 20 px, avoiding the unused 1200 px viewport tail;
- write list/detail/create PNGs under the temporary harness `shots/` directory;
- report `documentElement.scrollWidth === documentElement.clientWidth === 430` and zero non-ellipsis horizontal overflowers for every scene;
- always terminate its headless Chrome child.

Do not add the temporary harness to Git.

- [x] **Step 3: Run the current Webview and capture the three scenes**

Start the existing Vite Webview server:

```bash
rtk pnpm run dev:webview
```

Keep that process running only while the harness executes. In another terminal run:

```bash
rtk node /tmp/openspec-ext-marketplace-headless-20260903/run-marketplace.mjs
```

Expected: the report confirms the production app mounted, the Worksets list/detail/create scenes rendered, each scene settled for at least 600 ms, viewport width is 430 CSS px, and all overflow audits pass.

- [x] **Step 4: Export deterministic 430 px assets**

The CDP captures are 860 physical pixels wide because the device scale factor is 2. Copy them to their final filenames, then use deterministic resampling only:

```bash
rtk cp /tmp/openspec-ext-marketplace-headless-20260903/shots/marketplace-list.png docs/images/openspec-worksets-list.png
rtk cp /tmp/openspec-ext-marketplace-headless-20260903/shots/marketplace-detail.png docs/images/openspec-workset-detail.png
rtk cp /tmp/openspec-ext-marketplace-headless-20260903/shots/marketplace-create.png docs/images/openspec-workset-create.png

rtk sips --resampleWidth 430 docs/images/openspec-worksets-list.png
rtk sips --resampleWidth 430 docs/images/openspec-workset-detail.png
rtk sips --resampleWidth 430 docs/images/openspec-workset-create.png
```

Expected: only scale changes; text, layout, theme colors, and component pixels remain source-rendered.

- [x] **Step 5: Verify dimensions, content, readability, and privacy**

Run:

```bash
rtk file \
  docs/images/openspec-worksets-list.png \
  docs/images/openspec-workset-detail.png \
  docs/images/openspec-workset-create.png

rtk sips -g pixelWidth -g pixelHeight \
  docs/images/openspec-worksets-list.png \
  docs/images/openspec-workset-detail.png \
  docs/images/openspec-workset-create.png
```

Expected: all three files are PNG images with `pixelWidth: 430`. Visual inspection confirms:

- list contains `checkout-suite`, `3 members`, and `vscode`;
- detail contains `checkout-suite`, `checkout-api`, `checkout-web`, `team-plans`, **Current root**, **Open all**, and the one-time opener action;
- create contains `checkout-suite`, all three members, `vscode`, Create, and Cancel;
- all text is readable, controls are not clipped, and settled buttons use their final theme colors;
- no image contains a username, `/Users/`, private repository name, credential, remote URL, notification, or unrelated editor content.

- [x] **Step 6: Stop and remove only the temporary harness**

Stop the Vite process started in Step 3. Confirm no headless Chrome process still uses the temporary profile. Then validate the exact temporary path and remove it:

```bash
rtk zsh -c 'headless_root=/tmp/openspec-ext-marketplace-headless-20260903 && \
  test "$headless_root" = /tmp/openspec-ext-marketplace-headless-20260903 && \
  test -d "$headless_root" && test ! -L "$headless_root" && \
  rm -rf -- "$headless_root"'
```

Expected: the temporary harness and Chrome child are absent. OpenSpec Store/Workset registry state is unchanged because this fallback never invokes mutation commands.

- [x] **Step 7: Commit the screenshots**

```bash
rtk git add \
  docs/images/openspec-worksets-list.png \
  docs/images/openspec-workset-detail.png \
  docs/images/openspec-workset-create.png
rtk git commit -m "docs: add public workset screenshots"
```

Expected: one commit containing exactly the three new PNG files.

### Task 2: Write the complete English guide

**Files:**
- Create: `docs/USER_GUIDE.md`
- Reference: `README.md:42-138`
- Reference: `docs/images/openspec-dashboard.png`
- Reference: `docs/images/openspec-change-detail.png`
- Reference: `docs/images/openspec-worksets-list.png`
- Reference: `docs/images/openspec-workset-detail.png`
- Reference: `docs/images/openspec-workset-create.png`

- [x] **Step 1: Run the English-guide acceptance check and see it fail**

Run:

```bash
rtk zsh -c 'test -f docs/USER_GUIDE.md && \
  rg -q '"'"'<a id="plugin-interface"></a>'"'"' docs/USER_GUIDE.md && \
  rg -q '"'"'openspec-workset-detail.png'"'"' docs/USER_GUIDE.md && \
  rg -q '"'"'/opsx-verify'"'"' docs/USER_GUIDE.md'
```

Expected: FAIL because `docs/USER_GUIDE.md` does not exist yet.

- [x] **Step 2: Create the English guide with this complete structure and wording**

Create `docs/USER_GUIDE.md` with the following content. Keep command names and UI labels verbatim.

```markdown
# OpenSpec Extension User Guide

English | [简体中文](USER_GUIDE.zh-CN.md)

This guide explains how the OpenSpec extension UI works with OpenSpec. For the full OpenSpec model, start with the official [Getting Started guide](https://github.com/Fission-AI/OpenSpec/blob/main/docs/getting-started.md) and [command guide](https://github.com/Fission-AI/OpenSpec/blob/main/docs/how-commands-work.md).

## Choose your path

- **New to OpenSpec:** continue with [Install and initialize](#install-and-initialize).
- **Already use OpenSpec:** jump to [Plugin interface](#plugin-interface).
- **Here for multi-repository work:** jump to [Stores and Worksets](#stores-and-worksets).

## Install and initialize

1. Install the OpenSpec CLI and confirm `openspec --version` works in the terminal opened by your editor.
2. Run `openspec init` in the repository that will own local Changes and Specs.
3. Open that repository in VS Code or Cursor.
4. Install and enable the OpenSpec extension.
5. Run **OpenSpec: Open Dashboard** from the Command Palette.

The extension activates for workspace folders containing `openspec/config.yaml`. If the editor cannot find a CLI that works in your shell, set `openspec.cliPath` to the executable's absolute path. To use Verify and Review & Archive, also ensure the Cursor Agent CLI `agent` executable is available.

![OpenSpec project Dashboard](images/openspec-dashboard.png)

## Complete your first Change

1. Check the Root control before creating anything. It decides where the Change and Specs are read and written.
2. Select **New Change**, enter a kebab-case name, and create the Change skeleton.
3. In the default Clipboard mode, select **Copy Continue planning** for the next artifact or **Copy FF** for the remaining planning artifacts. Both actions only copy the command; paste it to your Agent. After you configure an adapter launch mode, the buttons use Open, Launch, or Run variants to pass the action directly to that adapter.
4. Open the Change and review Proposal, Specs, Design, and Tasks.
5. In the default Clipboard mode, select **Copy Apply**, then paste the command to your Agent. With an adapter launch mode configured, the corresponding action launches or runs through that adapter.
6. Open **Verify & Archive** and select **Run Verify** to start the interactive terminal.
7. Use **Review & Archive** for the normal Agent-assisted archive path. Use **Archive Now** only when you intentionally want the confirmation-protected direct CLI path.

![OpenSpec Change detail](images/openspec-change-detail.png)

### Lifecycle states

| State | Meaning | Typical next action |
|---|---|---|
| Planning | Required artifacts are still being produced | Continue or Fast-forward |
| Ready to Apply | Planning artifacts are complete | Apply |
| Applying | Implementation tasks are in progress | Continue implementation |
| Ready to Verify | Required tasks are complete | Run Verify |
| Archived | The Change is read-only history | Inspect artifacts or verification output |

<a id="plugin-interface"></a>
## Plugin interface

| Surface | What it is for |
|---|---|
| OpenSpec Root control | Chooses the local Project root or registered Store that owns Changes and Specs |
| Project navigation | Chooses which Project the sidebar is displaying |
| Dashboard | Filters Changes by lifecycle and presents recommended next actions |
| Change detail | Reviews Proposal, Specs, Design, Tasks, and Verify & Archive |
| Worksets | Lists machine-local groups containing the current Project and opens their detail/create flows |

### UI action and command mapping

| UI action | Underlying action | Where it runs | Result |
|---|---|---|---|
| New Change | `openspec new change <name>` | Extension CLI invocation | Creates a Change skeleton in the selected Root |
| Copy Continue planning (default) | `/opsx:continue <change>` (Clipboard, Copilot, Claude Code) or `/opsx-continue <change>` (Cursor, OpenCode) | Clipboard by default; configured Agent adapter after launch mode setup | Copies the next-artifact command by default; a configured adapter can launch or run it |
| Copy FF (default) | `/opsx:ff <change>` (Clipboard, Copilot, Claude Code) or `/opsx-ff <change>` (Cursor, OpenCode) | Clipboard by default; configured Agent adapter after launch mode setup | Copies the remaining-artifacts command by default; a configured adapter can launch or run it |
| Copy Apply (default) | `/opsx:apply <change>` (Clipboard, Copilot, Claude Code) or `/opsx-apply <change>` (Cursor, OpenCode) | Clipboard by default; configured Agent adapter after launch mode setup | Copies the implementation command by default; a configured adapter can launch or run it |
| Run Verify | `/opsx-verify <change>` | Interactive Cursor Agent CLI (`agent`) | Checks implementation against artifacts |
| Review & Archive | `/opsx-archive <change>` | Interactive Cursor Agent CLI (`agent`) | Reviews and archives interactively |
| Archive Now | Direct archive CLI | Extension after confirmation | Archives only when required artifacts and tasks are complete |

Clipboard, Copilot, and Claude Code use the `/opsx:<action>` form for Continue, Fast-forward, and Apply; Cursor and OpenCode use `/opsx-<action>`. Clipboard mode only copies the command and does not run an Agent. Verify and Review & Archive always run through the interactive Cursor Agent CLI (`agent`), not the selected adapter, so Agent questions are visible and answerable.

<a id="stores-and-worksets"></a>
## Stores and Worksets

Stores and Worksets require OpenSpec CLI 1.5.0 or newer. See the official [Stores and Worksets guide](https://github.com/Fission-AI/OpenSpec/blob/main/docs/stores-beta/user-guide.md) for CLI-level behavior.

### Use a Store as the planning Root

A Store is a standalone OpenSpec planning repository. It can own Changes and Specs while implementation remains in separate Project repositories.

1. Open the Root control.
2. Select a registered Store, or use **Create Store** or **Register Store** first.
3. Wait for the extension to validate and reload the binding.
4. Confirm the Root indicator names the intended Store before creating or running a Change action.

OpenSpec does not clone, pull, push, resolve credentials, or merge Store Git history for you. Manage the Store repository with Git just like any other repository.

### Browse a Workset

A Workset is a machine-local named group of folders. It helps you see and open related folders together; it does not choose the planning Root or implementation repository.

![Worksets list](images/openspec-worksets-list.png)

1. Select **Browse Workset Projects** from the OpenSpec sidebar.
2. Select a row to inspect its members. Selecting the row does not open another editor window.
3. In detail, select a Project member to change the Project shown in the sidebar.
4. Select a validated Store member to use it as the planning Root.
5. Select **Open all** to open the complete Workset in its saved opener.
6. Select **Open with another tool**, enter the **Custom opener id**, then select **Open with this tool**. This one-time override does not change the saved opener.

![Workset detail with Store and Project members](images/openspec-workset-detail.png)

### Create a Workset

1. Select **Browse Workset Projects** from the OpenSpec sidebar, then select **Create Workset**.
2. Enter a unique name.
3. Add folders with the native folder picker.
4. Select **Make primary** for the intended Primary member.
5. Optionally enter a preferred opener id.
6. Select **Create Workset** and wait for the new Workset detail view to load.

![Create Workset form](images/openspec-workset-create.png)

### Cross-repository example

`checkout-suite` contains:

- `team-plans` — Store and planning Root for the shared Change and Specs.
- `checkout-api` — Project containing API implementation.
- `checkout-web` — Project containing web implementation.

Use the Store Root to review or run the shared Change. Switch the sidebar Project when you need Project-specific navigation. Use **Open all** only when you want the editor to open every member folder.

### Boundaries to remember

- A Store is a planning Root; a Store member is not a Project target.
- A Workset is local and is not shared through the repository.
- A Workset does not grant Agent permissions or automatically add every member to Agent context.
- Switching Project changes sidebar data; **Open all** changes the editor workspace.
- Store and Project Git operations remain explicit user actions.

## Troubleshooting

| Symptom | Check |
|---|---|
| Dashboard does not activate | Open a workspace containing `openspec/config.yaml` |
| CLI works in a shell but not the extension | Set `openspec.cliPath` to the absolute executable path and reload |
| Store or Worksets are unavailable | Check `openspec --version`, then run `openspec store list --json` and `openspec workset list --json` |
| Change appeared in the wrong place | Recheck the Root control before creating or running actions |
| Workset row did not open a window | Rows open detail; use **Open all** to open the complete Workset |
| Store content is stale | Pull or otherwise update the Store with Git, then refresh the extension |
| Agent cannot edit another member | Open or explicitly authorize that repository; Workset membership is not Agent permission |
```

- [x] **Step 3: Run the English-guide acceptance check**

Run:

```bash
rtk zsh -c 'test -f docs/USER_GUIDE.md && \
  rg -q '"'"'<a id="plugin-interface"></a>'"'"' docs/USER_GUIDE.md && \
  rg -q '"'"'<a id="stores-and-worksets"></a>'"'"' docs/USER_GUIDE.md && \
  rg -q '"'"'openspec-worksets-list.png'"'"' docs/USER_GUIDE.md && \
  rg -q '"'"'openspec-workset-detail.png'"'"' docs/USER_GUIDE.md && \
  rg -q '"'"'openspec-workset-create.png'"'"' docs/USER_GUIDE.md && \
  rg -q '"'"'openspec new change <name>'"'"' docs/USER_GUIDE.md && \
  rg -q '"'"'Copy Continue planning'"'"' docs/USER_GUIDE.md && \
  rg -q '"'"'/opsx:continue <change>'"'"' docs/USER_GUIDE.md && \
  rg -q '"'"'/opsx-continue <change>'"'"' docs/USER_GUIDE.md && \
  rg -q '"'"'/opsx-verify <change>'"'"' docs/USER_GUIDE.md && \
  rg -Fq '"'"'Interactive Cursor Agent CLI (`agent`)'"'"' docs/USER_GUIDE.md && \
  rg -q '"'"'OpenSpec CLI 1.5.0 or newer'"'"' docs/USER_GUIDE.md && \
  rg -q '"'"'Browse Workset Projects'"'"' docs/USER_GUIDE.md && \
  rg -q '"'"'does not grant Agent permissions'"'"' docs/USER_GUIDE.md'
```

Expected: exit 0.

- [x] **Step 4: Commit the English guide**

```bash
rtk git add docs/USER_GUIDE.md
rtk git commit -m "docs: add OpenSpec extension user guide"
```

Expected: one commit containing the English guide only.

### Task 3: Write the matching Chinese guide

**Files:**
- Create: `docs/USER_GUIDE.zh-CN.md`
- Reference: `docs/USER_GUIDE.md`

- [x] **Step 1: Run the Chinese-guide acceptance check and see it fail**

Run:

```bash
rtk zsh -c 'test -f docs/USER_GUIDE.zh-CN.md && \
  rg -q '"'"'<a id="plugin-interface"></a>'"'"' docs/USER_GUIDE.zh-CN.md && \
  rg -q '"'"'Copy Continue planning'"'"' docs/USER_GUIDE.zh-CN.md && \
  rg -q '"'"'/opsx-verify <change>'"'"' docs/USER_GUIDE.zh-CN.md && \
  rg -q '"'"'OpenSpec CLI 1.5.0'"'"' docs/USER_GUIDE.zh-CN.md && \
  rg -q '"'"'Workset 不会授予 Agent 权限'"'"' docs/USER_GUIDE.zh-CN.md'
```

Expected: FAIL because `docs/USER_GUIDE.zh-CN.md` does not exist yet.

- [x] **Step 2: Create the complete Chinese guide**

Create `docs/USER_GUIDE.zh-CN.md` with this content. Keep paths, commands, anchors, and image filenames identical to the English guide.

```markdown
# OpenSpec 插件使用指南

[English](USER_GUIDE.md) | 简体中文

本指南介绍 OpenSpec 插件界面如何与 OpenSpec 配合使用。如需全面了解 OpenSpec 模型，请先阅读官方的 [Getting Started 指南](https://github.com/Fission-AI/OpenSpec/blob/main/docs/getting-started.md)和[命令指南](https://github.com/Fission-AI/OpenSpec/blob/main/docs/how-commands-work.md)。

## 选择适合你的路径

- **初次使用 OpenSpec：** 从[安装并初始化](#安装并初始化)开始。
- **已经在使用 OpenSpec：** 直接查看[插件界面](#plugin-interface)。
- **需要处理多仓库工作：** 直接查看 [Store 和 Workset](#stores-and-worksets)。

## 安装并初始化

1. 安装 OpenSpec CLI，并确认在编辑器打开的终端中可以正常运行 `openspec --version`。
2. 在用于管理本地 Changes 和 Specs 的仓库中运行 `openspec init`。
3. 使用 VS Code 或 Cursor 打开该仓库。
4. 安装并启用 OpenSpec 插件。
5. 从命令面板运行 **OpenSpec: Open Dashboard**。

插件会在工作区文件夹包含 `openspec/config.yaml` 时激活。如果编辑器找不到你在 Shell 中可以正常使用的 CLI，请将 `openspec.cliPath` 设置为该可执行文件的绝对路径。若要使用 Verify 和 Review & Archive，还需确保 Cursor Agent CLI 的 `agent` 可执行文件可用。

![OpenSpec 项目 Dashboard](images/openspec-dashboard.png)

## 完成你的第一个 Change

1. 创建任何内容前，先检查 Root 控件。它决定从哪里读取 Change 和 Specs，以及将它们写入哪里。
2. 选择 **New Change**，输入一个 kebab-case 名称，然后创建 Change 骨架。
3. 在默认 Clipboard 模式下，选择 **Copy Continue planning** 创建下一个工件，或选择 **Copy FF** 创建其余规划工件。两者都只会复制命令；请将命令粘贴给 Agent。配置适配器启动模式后，按钮会使用 Open、Launch 或 Run 变体，将操作直接交给相应适配器。
4. 打开该 Change，检查 Proposal、Specs、Design 和 Tasks。
5. 在默认 Clipboard 模式下，选择 **Copy Apply**，然后将命令粘贴给 Agent。配置适配器启动模式后，对应操作会通过该适配器启动或运行。
6. 打开 **Verify & Archive**，选择 **Run Verify** 启动交互式终端。
7. 正常情况下使用 **Review & Archive**，通过 Agent 辅助完成归档。只有当你明确希望使用需确认后执行的直接 CLI 归档方式时，才使用 **Archive Now**。

![OpenSpec Change 详情](images/openspec-change-detail.png)

### 生命周期状态

| 状态 | 含义 | 通常的下一步 |
|---|---|---|
| Planning | 仍在生成必需工件 | Continue 或 Fast-forward |
| Ready to Apply | 规划工件已完成 | Apply |
| Applying | 实现任务正在进行 | 继续实现 |
| Ready to Verify | 必需任务已完成 | Run Verify |
| Archived | Change 已成为只读历史记录 | 检查工件或验证输出 |

<a id="plugin-interface"></a>
## 插件界面

| 界面区域 | 用途 |
|---|---|
| OpenSpec Root 控件 | 选择管理 Changes 和 Specs 的本地 Project Root 或已注册 Store |
| Project 导航 | 选择侧边栏当前显示的 Project |
| Dashboard | 按生命周期筛选 Change，并提供建议的下一步操作 |
| Change 详情 | 查看 Proposal、Specs、Design、Tasks 和 Verify & Archive |
| Worksets | 列出包含当前 Project 的本机 Workset，并打开其详情或创建流程 |

### UI 操作与命令映射

| UI 操作 | 底层操作 | 执行位置 | 结果 |
|---|---|---|---|
| **New Change** | `openspec new change <name>` | 插件调用 CLI | 在所选 Root 中创建 Change 骨架 |
| **Copy Continue planning**（默认） | `/opsx:continue <change>`（Clipboard、Copilot、Claude Code）或 `/opsx-continue <change>`（Cursor、OpenCode） | 默认使用 Clipboard；配置启动模式后使用 Agent 适配器 | 默认复制用于创建下一个工件的命令；配置的适配器可启动或运行该命令 |
| **Copy FF**（默认） | `/opsx:ff <change>`（Clipboard、Copilot、Claude Code）或 `/opsx-ff <change>`（Cursor、OpenCode） | 默认使用 Clipboard；配置启动模式后使用 Agent 适配器 | 默认复制用于创建其余规划工件的命令；配置的适配器可启动或运行该命令 |
| **Copy Apply**（默认） | `/opsx:apply <change>`（Clipboard、Copilot、Claude Code）或 `/opsx-apply <change>`（Cursor、OpenCode） | 默认使用 Clipboard；配置启动模式后使用 Agent 适配器 | 默认复制实现命令；配置的适配器可启动或运行该命令 |
| **Run Verify** | `/opsx-verify <change>` | 交互式 Cursor Agent CLI (`agent`) | 对照工件检查实现 |
| **Review & Archive** | `/opsx-archive <change>` | 交互式 Cursor Agent CLI (`agent`) | 以交互方式审查并归档 |
| **Archive Now** | 直接归档 CLI | 插件在确认后执行 | 仅当必需工件和任务完成时归档 |

Continue、Fast-forward 和 Apply 在 Clipboard、Copilot、Claude Code 中使用 `/opsx:<action>` 形式，在 Cursor 和 OpenCode 中使用 `/opsx-<action>`。剪贴板模式只复制命令，不会运行 Agent。Verify 和 Review & Archive 始终通过交互式 Cursor Agent CLI (`agent`) 运行，而不使用所选适配器，以便你可以看到并回答 Agent 的问题。

<a id="stores-and-worksets"></a>
## Store 和 Workset

Store 与 Workset 需要 OpenSpec CLI 1.5.0 或更高版本。CLI 层面的行为请参阅官方 [Stores and Worksets 指南](https://github.com/Fission-AI/OpenSpec/blob/main/docs/stores-beta/user-guide.md)。

### 将 Store 用作规划 Root

Store 是一个独立的 OpenSpec 规划仓库。它可以管理 Changes 和 Specs，而实现代码仍保留在各个 Project 仓库中。

1. 打开 Root 控件。
2. 选择一个已注册的 Store，或先使用 **Create Store** 或 **Register Store**。
3. 等待插件完成绑定验证和重新加载。
4. 创建 Change 或执行 Change 操作前，确认 Root 指示器显示的是目标 Store。

OpenSpec 不会替你对 Store 执行 clone、pull、push，不会处理凭据，也不会合并 Store 的 Git 历史。请像管理其他仓库一样，使用 Git 管理 Store 仓库。

### 浏览 Workset

Workset 是由若干文件夹组成、仅保存在本机的命名分组。它能帮助你同时查看和打开相关文件夹，但不会选择规划 Root 或实现仓库。

![Workset 列表](images/openspec-worksets-list.png)

1. 在 OpenSpec 侧边栏中选择 **Browse Workset Projects**。
2. 选择一行以查看其成员。选择该行不会打开另一个编辑器窗口。
3. 在详情中选择一个 Project 成员，切换侧边栏当前显示的 Project。
4. 选择一个已验证的 Store 成员，将其用作规划 Root。
5. 选择 **Open all**，使用已保存的 opener 打开完整 Workset。
6. 选择 **Open with another tool**，输入 **Custom opener id**，再选择 **Open with this tool**。这次临时覆盖不会修改已保存的 opener。

![包含 Store 和 Project 成员的 Workset 详情](images/openspec-workset-detail.png)

### 创建 Workset

1. 在 OpenSpec 侧边栏中选择 **Browse Workset Projects**，然后选择 **Create Workset**。
2. 输入一个唯一名称。
3. 使用系统文件夹选择器添加文件夹。
4. 在希望设为 Primary 的成员上选择 **Make primary**。
5. 根据需要输入首选 opener id。
6. 选择 **Create Workset**，等待新的 Workset 详情视图加载完成。

![创建 Workset 表单](images/openspec-workset-create.png)

### 跨仓库示例

`checkout-suite` 包含：

- `team-plans` — Store，也是共享 Changes 和 Specs 的规划 Root。
- `checkout-api` — 包含 API 实现的 Project。
- `checkout-web` — 包含 Web 实现的 Project。

使用 Store Root 查看或运行共享 Change。当需要特定 Project 的导航内容时，切换侧边栏中的 Project。只有当你希望编辑器打开全部成员文件夹时，才使用 **Open all**。

### 需要牢记的边界

- Store 是规划 Root；Store 成员不能作为 Project 切换目标。
- Workset 只保存在本机，不会通过仓库共享。
- Workset 不会授予 Agent 权限，也不会自动将所有成员加入 Agent 上下文。
- 切换 Project 只会改变侧边栏数据；**Open all** 会改变编辑器工作区。
- Store 和 Project 的 Git 操作始终由用户显式执行。

## 排查问题

| 现象 | 检查项 |
|---|---|
| Dashboard 未激活 | 打开包含 `openspec/config.yaml` 的工作区 |
| CLI 在 Shell 中可用，但插件中不可用 | 将 `openspec.cliPath` 设置为可执行文件的绝对路径，然后重新加载 |
| Store 或 Workset 不可用 | 检查 `openspec --version`，然后运行 `openspec store list --json` 和 `openspec workset list --json` |
| Change 出现在错误位置 | 创建或执行操作前，重新检查 Root 控件 |
| 选择 Workset 行后没有打开窗口 | 行用于打开详情；请使用 **Open all** 打开完整 Workset |
| Store 内容不是最新状态 | 使用 Git pull 或其他方式更新 Store，然后刷新插件 |
| Agent 无法编辑另一个成员 | 打开该仓库或显式授予其访问权限；Workset 成员关系不等于 Agent 权限 |
```

- [x] **Step 3: Verify structural and semantic parity**

Run:

```bash
rtk zsh -c 'test -f docs/USER_GUIDE.zh-CN.md && \
  test "$(rg -c '"'"'^#{2,3} '"'"' docs/USER_GUIDE.md)" = "$(rg -c '"'"'^#{2,3} '"'"' docs/USER_GUIDE.zh-CN.md)" && \
  test "$(rg -c '"'"'^\|.*\|$'"'"' docs/USER_GUIDE.md)" = "$(rg -c '"'"'^\|.*\|$'"'"' docs/USER_GUIDE.zh-CN.md)" && \
  rg -q '"'"'<a id="plugin-interface"></a>'"'"' docs/USER_GUIDE.zh-CN.md && \
  rg -q '"'"'<a id="stores-and-worksets"></a>'"'"' docs/USER_GUIDE.zh-CN.md && \
  rg -q '"'"'openspec-workset-create.png'"'"' docs/USER_GUIDE.zh-CN.md && \
  rg -q '"'"'Copy Continue planning'"'"' docs/USER_GUIDE.zh-CN.md && \
  rg -q '"'"'/opsx:continue <change>'"'"' docs/USER_GUIDE.zh-CN.md && \
  rg -q '"'"'/opsx-continue <change>'"'"' docs/USER_GUIDE.zh-CN.md && \
  rg -q '"'"'/opsx-verify <change>'"'"' docs/USER_GUIDE.zh-CN.md && \
  rg -Fq '"'"'交互式 Cursor Agent CLI (`agent`)'"'"' docs/USER_GUIDE.zh-CN.md && \
  rg -q '"'"'OpenSpec CLI 1.5.0 或更高版本'"'"' docs/USER_GUIDE.zh-CN.md && \
  rg -q '"'"'Browse Workset Projects'"'"' docs/USER_GUIDE.zh-CN.md && \
  rg -q '"'"'Workset 不会授予 Agent 权限'"'"' docs/USER_GUIDE.zh-CN.md'
```

Expected: exit 0; both guides contain the same number of level-2/3 headings and table rows.

- [x] **Step 4: Commit the Chinese guide**

```bash
rtk git add docs/USER_GUIDE.zh-CN.md
rtk git commit -m "docs: add Chinese extension user guide"
```

Expected: one commit containing the Chinese guide only.

### Task 4: Update both Marketplace READMEs

**Files:**
- Modify: `README.md:42-67`
- Modify: `README.zh-CN.md:42-67`
- Reference: `scripts/extract-readme-marketplace.js`
- Reference: `scripts/package-with-marketplace-readme.js`

- [x] **Step 1: Run the Marketplace-content check and see it fail**

Run:

```bash
rtk zsh -c 'rg -q '"'"'openspec-worksets-list.png'"'"' README.md && \
  rg -q '"'"'docs/USER_GUIDE.md#plugin-interface'"'"' README.md && \
  rg -q '"'"'openspec-worksets-list.png'"'"' README.zh-CN.md && \
  rg -q '"'"'docs/USER_GUIDE.zh-CN.md#plugin-interface'"'"' README.zh-CN.md'
```

Expected: FAIL because the new screenshots and guide links are absent.

- [x] **Step 2: Replace the English Usage quick-start block**

In `README.md`, replace the content from `## Usage` through the paragraph immediately before `### Commands` with:

```markdown
## Usage

### Quick start

1. Open a workspace that contains `openspec/config.yaml`.
2. Run **OpenSpec: Open Dashboard**.
3. Check the active **Root**, then select **New Change**.
4. By default, select **Copy Continue planning** or **Copy FF**, then paste the copied command into your Agent to generate the planning artifacts.
5. Review **Proposal**, **Specs**, **Design**, and **Tasks**, then select **Copy Apply** and paste the copied command into your Agent.
6. In **Verify & Archive**, run **Run Verify** first, then use **Review & Archive** as needed.

The default `clipboard` launch mode only copies workflow commands. Set `openspec.workflowLaunchMode` to `adapter` when you want actions to open, launch, or run through the configured adapter.

**Review & Archive** is the recommended Agent-assisted path. **Archive Now** is a direct CLI path that requires explicit confirmation and is available only when the workflow is complete.

### Stores and Worksets

Stores and Worksets require OpenSpec CLI 1.5.0 or newer.

A **Store** is a writable planning **Root** for Changes and Specs. Use the Root controls to select or create one; the extension switches the binding only after CLI validation. Store Git operations remain your responsibility.

A **Workset** is a machine-local named group of folders. From **Worksets**, you can view Projects and Stores, switch the sidebar Project or planning Root, open every member as a complete workspace, and create a group.

<img src="docs/images/openspec-worksets-list.png" alt="Worksets containing the current OpenSpec Project" width="430" />

A row opens only its detail view, not a new editor window. A Project member switches the sidebar, a Store member becomes the planning Root, and **Open all** opens the complete workspace.

<img src="docs/images/openspec-workset-detail.png" alt="Workset detail showing Store and Project member roles" width="430" />

**Create Workset** starts with the current Project and adds folders through the native folder picker. A one-time opener override does not change the saved opener.

<img src="docs/images/openspec-workset-create.png" alt="Create Workset form with members and preferred opener" width="430" />

### Complete user guide

- [English user guide](https://github.com/RandyZ/openspec-ext/blob/main/docs/USER_GUIDE.md)
- [Plugin interface](https://github.com/RandyZ/openspec-ext/blob/main/docs/USER_GUIDE.md#plugin-interface)
- [简体中文使用指南](https://github.com/RandyZ/openspec-ext/blob/main/docs/USER_GUIDE.zh-CN.md)
```

Keep `### Commands` and all later sections unchanged.

- [x] **Step 3: Replace the Chinese Usage quick-start block**

In `README.zh-CN.md`, replace the content from `## 使用` through the paragraph immediately before `### 命令` with:

```markdown
## 使用

### 快速开始

1. 打开包含 `openspec/config.yaml` 的工作区。
2. 执行 **OpenSpec: Open Dashboard**。
3. 检查当前 **Root**，然后选择 **New Change**。
4. 默认选择 **Copy Continue planning** 或 **Copy FF**，再将复制的命令粘贴给 Agent，以生成 planning artifacts。
5. 检查 **Proposal**、**Specs**、**Design** 和 **Tasks**，然后选择 **Copy Apply**，并将复制的命令粘贴给 Agent。
6. 在 **Verify & Archive** 中先运行 **Run Verify**，再按需要使用 **Review & Archive**。

默认的 `clipboard` 启动模式只复制 workflow 命令；将 `openspec.workflowLaunchMode` 配置为 `adapter` 后，相应动作才会通过 adapter 打开、启动或运行。

**Review & Archive** 是推荐的 Agent 辅助路径。**Archive Now** 是需显式确认后执行的直接 CLI 归档方式，仅在 workflow 完成时可用。

### Store 与 Workset

Store 与 Workset 需要 OpenSpec CLI 1.5.0 或更高版本。

**Store** 是负责 Changes 和 Specs 的可写 planning **Root**。通过 Root 控件选择或创建 Store；扩展仅在 CLI 验证通过后切换 binding。Git 操作仍由用户负责。

**Workset** 是保存在本机的具名文件夹组。你可以查看其中的 Projects 和 Stores、切换侧栏 Project 或 planning Root、打开全部成员组成的完整 workspace，以及创建新组。

<img src="docs/images/openspec-worksets-list.png" alt="包含当前 OpenSpec Project 的 Worksets 列表" width="430" />

点击列表行只会打开详情，不会新开窗口。Project 成员用于切换侧栏，Store 成员会成为 planning Root，**Open all** 会打开完整 workspace。

<img src="docs/images/openspec-workset-detail.png" alt="Workset 详情中的 Store 与 Project 成员角色" width="430" />

**Create Workset** 以当前 Project 为基础，并通过原生文件夹选择器添加成员；临时指定其他打开工具不会修改已保存的默认打开方式。

<img src="docs/images/openspec-workset-create.png" alt="包含成员和首选 opener 的 Create Workset 表单" width="430" />

### 完整使用指南

- [简体中文使用指南](https://github.com/RandyZ/openspec-ext/blob/main/docs/USER_GUIDE.zh-CN.md)
- [插件接口](https://github.com/RandyZ/openspec-ext/blob/main/docs/USER_GUIDE.zh-CN.md#plugin-interface)
- [English user guide](https://github.com/RandyZ/openspec-ext/blob/main/docs/USER_GUIDE.md)
```

Keep `### 命令` and all later sections unchanged.

- [x] **Step 4: Verify README parity and Marketplace extraction**

Run:

```bash
rtk zsh -c 'test "$(rg -c '"'"'docs/images/openspec-workset-(detail|create)\.png'"'"' README.md)" = 2 && \
  test "$(rg -c '"'"'docs/images/openspec-worksets-list'"'"' README.md)" = 1 && \
  test "$(rg -c '"'"'docs/images/openspec-workset-(detail|create)\.png'"'"' README.zh-CN.md)" = 2 && \
  test "$(rg -c '"'"'docs/images/openspec-worksets-list'"'"' README.zh-CN.md)" = 1 && \
  rg -q '"'"'USER_GUIDE.md#plugin-interface'"'"' README.md && \
  rg -q '"'"'Copy Continue planning'"'"' README.md && \
  rg -q '"'"'Copy FF'"'"' README.md && \
  rg -q '"'"'Copy Apply'"'"' README.md && \
  rg -q '"'"'Run Verify'"'"' README.md && \
  rg -q '"'"'OpenSpec CLI 1.5.0 or newer'"'"' README.md && \
  rg -q '"'"'Store Git operations remain your responsibility.'"'"' README.md && \
  rg -q '"'"'USER_GUIDE.zh-CN.md#plugin-interface'"'"' README.zh-CN.md && \
  rg -q '"'"'Copy Continue planning'"'"' README.zh-CN.md && \
  rg -q '"'"'Copy FF'"'"' README.zh-CN.md && \
  rg -q '"'"'Copy Apply'"'"' README.zh-CN.md && \
  rg -q '"'"'Run Verify'"'"' README.zh-CN.md && \
  rg -q '"'"'OpenSpec CLI 1.5.0 或更高版本'"'"' README.zh-CN.md && \
  rg -q '"'"'Git 操作仍由用户负责。'"'"' README.zh-CN.md

rtk node scripts/extract-readme-marketplace.js

rtk zsh -c 'rg -q '"'"'openspec-worksets-list.png'"'"' build/README.md && \
  rg -q '"'"'openspec-workset-detail.png'"'"' build/README.md && \
  rg -q '"'"'openspec-workset-create.png'"'"' build/README.md && \
  rg -q '"'"'https://github.com/RandyZ/openspec-ext/blob/main/docs/USER_GUIDE.md#plugin-interface'"'"' build/README.md && \
  ! rg -q '"'"'Below: development/contributing only'"'"' build/README.md'
```

Expected: all commands exit 0; `build/README.md` contains the three screenshots and absolute guide links but excludes development-only content below `---`.

- [x] **Step 5: Commit both README updates**

```bash
rtk git add README.md README.zh-CN.md
rtk git commit -m "docs: add Store and Workset usage guide"
```

Expected: one commit containing only the two README updates.

### Task 5: Package and inspect the Marketplace artifact

**Files:**
- Verify: `openspec-workflow-0.2.1.vsix`
- Verify: `build/README.md`
- Verify: all files created or modified by Tasks 1–4

- [x] **Step 1: Build the final local VSIX**

Run:

```bash
rtk pnpm run package
```

Expected: exit 0 and `openspec-workflow-0.2.1.vsix` is freshly created. The packaging script restores the repository's full `README.md` after packaging.

- [x] **Step 2: Inspect the packaged README and image inventory**

Run:

```bash
rtk unzip -l openspec-workflow-0.2.1.vsix | \
  rg 'extension/(readme.md|README.zh-CN.md|docs/images/openspec-(dashboard|change-detail|worksets-list|workset-detail|workset-create)\.png)'

rtk zsh -c 'unzip -p openspec-workflow-0.2.1.vsix extension/readme.md | \
  rg -q '"'"'USER_GUIDE.md#plugin-interface'"'"' && \
  unzip -p openspec-workflow-0.2.1.vsix extension/readme.md | \
  rg -q '"'"'openspec-workset-create.png'"'"' && \
  unzip -p openspec-workflow-0.2.1.vsix extension/readme.md | \
  rg -q '"'"'Store Git operations remain your responsibility'"'"''
```

Expected: the inventory lists both READMEs and exactly the five intended public screenshots; the packaged English README contains the absolute guide anchor, Create Workset image, and Git-ownership boundary.

- [x] **Step 3: Verify that detailed guides remain repository-hosted**

Run:

```bash
rtk zsh -c '! unzip -l openspec-workflow-0.2.1.vsix | rg -q '"'"'extension/docs/USER_GUIDE'"'"''
```

Expected: exit 0. This is intentional because Marketplace links use canonical GitHub `blob/main` URLs.

- [x] **Step 4: Perform final visual and repository checks**

1. Preview the full English and Chinese READMEs and both guides in VS Code Markdown Preview.
2. Confirm all five screenshots render and the `#plugin-interface` links land at the explicit anchor.
3. Confirm the three new screenshots remain readable at 430 px and show no private data.
4. Confirm the `blob/main` targets match files in the branch. Do not require live `main` URLs to resolve before merge.

Run:

```bash
rtk git diff --check
rtk git status --short --branch
```

Expected: `git diff --check` is clean. Git status shows the implementation commits ahead of the remote and no unintended source, temporary fixture, backup README, Store/Workset registry export, or build-directory changes.

No additional test suite is required because this change modifies documentation and static images only; `pnpm run package` already performs the production build and exercises the existing Marketplace README extraction path.
