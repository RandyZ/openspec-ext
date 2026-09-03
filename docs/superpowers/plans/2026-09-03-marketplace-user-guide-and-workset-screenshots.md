# Marketplace User Guide and Workset Screenshots Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three privacy-safe Store/Workset screenshots and a progressive bilingual guide that teaches new users the complete extension workflow while letting experienced OpenSpec users jump directly to plugin behavior.

**Architecture:** Keep the Marketplace README as the short entry point and host the detailed English and Chinese guides in `docs/`. Reuse the existing two screenshots plus three new real Extension Development Host captures across both layers. Keep the implementation documentation-only: no extension source changes, new dependencies, screenshot automation, or packaging-rule changes.

**Tech Stack:** Markdown, OpenSpec CLI 1.8.x, VS Code Extension Development Host, PNG screenshots, existing README extraction script, pnpm, vsce, zip inspection

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

- [ ] **Step 1: Prove the public fixture identifiers are unused**

Run:

```bash
rtk zsh -c 'source ~/.zshrc && \
  ! openspec store list --json | rg -q '"'"'"id"[[:space:]]*:[[:space:]]*"team-plans"'"'"' && \
  ! openspec workset list --json | rg -q '"'"'"name"[[:space:]]*:[[:space:]]*"checkout-suite"'"'"''
```

Expected: exit 0. If either identifier already exists, stop and choose new public names in both the fixture and documentation before mutating OpenSpec's machine-local registry.

- [ ] **Step 2: Create the disposable Store and two Project folders**

Run this only after confirming the two exact temporary paths do not exist:

```bash
rtk zsh -c 'source ~/.zshrc && \
  demo_root=/tmp/openspec-ext-marketplace-demo-20260903 && \
  profile_root=/tmp/openspec-ext-marketplace-vscode-20260903 && \
  test ! -e "$demo_root" && test ! -e "$profile_root" && \
  mkdir -p "$demo_root/checkout-api" "$demo_root/checkout-web" && \
  openspec init "$demo_root/checkout-api" --tools none && \
  openspec init "$demo_root/checkout-web" --tools none && \
  openspec store setup team-plans \
    --path "$demo_root/team-plans" \
    --no-init-git \
    --json'
```

Expected: both Project folders contain `openspec/config.yaml`; the final JSON reports Store id `team-plans` rooted below `/tmp/openspec-ext-marketplace-demo-20260903`.

- [ ] **Step 3: Build and launch the real Extension Development Host**

Run:

```bash
rtk pnpm run build
rtk zsh -c 'source ~/.zshrc && code \
  --locale=en \
  --user-data-dir=/tmp/openspec-ext-marketplace-vscode-20260903 \
  --extensionDevelopmentPath=/Users/randy/workspace/projects/github/openspec-ext \
  /tmp/openspec-ext-marketplace-demo-20260903/checkout-api'
```

Expected: build exits 0; a new Extension Development Host opens the `checkout-api` Project and the OpenSpec sidebar activates.

- [ ] **Step 4: Capture the Create Workset state before submitting it**

In the Extension Development Host:

1. Select the default dark theme and wait at least 600 ms after the theme settles.
2. Resize the OpenSpec sidebar content to exactly 430 px wide.
3. Open **Worksets**, then select **Create Workset**.
4. Enter `checkout-suite` as the Workset name.
5. Use **Add folders** to add:
   - `/tmp/openspec-ext-marketplace-demo-20260903/team-plans`
   - `/tmp/openspec-ext-marketplace-demo-20260903/checkout-web`
6. Keep `checkout-api` as the Primary member.
7. Enter `vscode` as the preferred opener id.
8. Verify the keyboard focus order reaches Workset name, Add folders, opener, Create, and Cancel.
9. Capture only the settled 430 px OpenSpec sidebar content and save it as `docs/images/openspec-workset-create.png`.

Expected: the image contains `checkout-suite`, `checkout-api`, `team-plans`, `checkout-web`, `vscode`, Create, and Cancel; it contains no username, `/Users/` path, private repository name, credential, remote URL, notification, or unrelated editor content.

- [ ] **Step 5: Create the Workset and capture detail and list states**

Continue in the same Development Host:

1. Select **Create** and wait for the fresh Workset detail state.
2. Confirm the detail contains one Store member (`team-plans`) and two Project members (`checkout-api`, `checkout-web`).
3. Select `team-plans` with **Use as planning root**, wait for the validated **Current root** state, then wait another 600 ms for transitions.
4. Capture the settled 430 px content as `docs/images/openspec-workset-detail.png`.
5. Select **Back to Worksets**, wait 600 ms, and capture the list as `docs/images/openspec-worksets-list.png`.

Expected: detail shows Store/Project role text, **Current root**, **Open all**, and the one-time opener control. List shows `checkout-suite`, three members, and `vscode`. Clicking a list row is used only to open detail; do not invoke **Open all** during screenshot capture.

- [ ] **Step 6: Verify dimensions, readability, and privacy**

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

Expected: all three files are PNG images and each reports `pixelWidth: 430`. Open each image at its native size and verify readable text, no horizontal clipping, no transition-state colors, and no private data.

- [ ] **Step 7: Remove only the disposable registry records and folders**

Close the Extension Development Host first. Then run:

```bash
rtk zsh -c 'source ~/.zshrc && \
  openspec workset remove checkout-suite --yes --json && \
  openspec store unregister team-plans --json && \
  demo_root=/tmp/openspec-ext-marketplace-demo-20260903 && \
  profile_root=/tmp/openspec-ext-marketplace-vscode-20260903 && \
  test "$demo_root" = /tmp/openspec-ext-marketplace-demo-20260903 && \
  test "$profile_root" = /tmp/openspec-ext-marketplace-vscode-20260903 && \
  test -d "$demo_root" && test ! -L "$demo_root" && \
  test -d "$profile_root" && test ! -L "$profile_root" && \
  rm -rf -- "$demo_root" "$profile_root" && \
  ! openspec store list --json | rg -q '"'"'"id"[[:space:]]*:[[:space:]]*"team-plans"'"'"' && \
  ! openspec workset list --json | rg -q '"'"'"name"[[:space:]]*:[[:space:]]*"checkout-suite"'"'"''
```

Expected: the Workset and Store fixture records are absent; only the two explicitly validated `/tmp` trees are removed. Existing Store and Workset records remain untouched.

- [ ] **Step 8: Commit the screenshots**

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

- [ ] **Step 1: Run the English-guide acceptance check and see it fail**

Run:

```bash
rtk zsh -c 'test -f docs/USER_GUIDE.md && \
  rg -q '"'"'<a id="plugin-interface"></a>'"'"' docs/USER_GUIDE.md && \
  rg -q '"'"'openspec-workset-detail.png'"'"' docs/USER_GUIDE.md && \
  rg -q '"'"'/opsx:verify'"'"' docs/USER_GUIDE.md'
```

Expected: FAIL because `docs/USER_GUIDE.md` does not exist yet.

- [ ] **Step 2: Create the English guide with this complete structure and wording**

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

The extension activates for workspace folders containing `openspec/config.yaml`. If the editor cannot find a CLI that works in your shell, set `openspec.cliPath` to the executable's absolute path.

![OpenSpec project Dashboard](images/openspec-dashboard.png)

## Complete your first Change

1. Check the Root control before creating anything. It decides where the Change and Specs are read and written.
2. Select **New Change**, enter a kebab-case name, and create the Change skeleton.
3. Use **Continue** to create the next artifact or **Fast-forward** to create all remaining planning artifacts through the selected Agent adapter.
4. Open the Change and review Proposal, Specs, Design, and Tasks.
5. Select **Apply** when the Change is ready for implementation.
6. Open **Verify & Archive** and run **Verify** in the interactive terminal.
7. Use **Review & Archive** for the normal Agent-assisted archive path. Use **Archive Now** only when you intentionally want the confirmation-protected direct CLI path.

![OpenSpec Change detail](images/openspec-change-detail.png)

### Lifecycle states

| State | Meaning | Typical next action |
|---|---|---|
| Planning | Required artifacts are still being produced | Continue or Fast-forward |
| Ready to Apply | Planning artifacts are complete | Apply |
| Applying | Implementation tasks are in progress | Continue implementation |
| Ready to Verify | Required tasks are complete | Verify |
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
| Continue | `/opsx:continue <change>` | Agent adapter or clipboard | Creates the next required artifact |
| Fast-forward | `/opsx:ff <change>` | Agent adapter or clipboard | Creates the remaining planning artifacts |
| Apply | `/opsx:apply <change>` | Agent adapter or clipboard | Implements the planned tasks |
| Verify | `/opsx:verify <change>` | Interactive VS Code terminal | Checks implementation against artifacts |
| Review & Archive | `/opsx:archive <change>` | Interactive VS Code terminal | Reviews and archives interactively |
| Archive Now | Direct archive CLI | Extension after confirmation | Archives only when required artifacts and tasks are complete |

Clipboard mode copies the command; it does not run an Agent. OpenCode adapters translate `/opsx:<action>` into their supported `/opsx-<action>` form. Verify and Review & Archive stay interactive so Agent questions are visible and answerable.

<a id="stores-and-worksets"></a>
## Stores and Worksets

Store and Workset controls require an OpenSpec CLI version that reports those capabilities to the extension. See the official [Stores and Worksets guide](https://github.com/Fission-AI/OpenSpec/blob/main/docs/stores-beta/user-guide.md) for CLI-level behavior.

### Use a Store as the planning Root

A Store is a standalone OpenSpec planning repository. It can own Changes and Specs while implementation remains in separate Project repositories.

1. Open the Root control.
2. Select a registered Store, or use the Store setup/register actions first.
3. Wait for the extension to validate and reload the binding.
4. Confirm the Root indicator names the intended Store before creating or running a Change action.

OpenSpec does not clone, pull, push, resolve credentials, or merge Store Git history for you. Manage the Store repository with Git just like any other repository.

### Browse a Workset

A Workset is a machine-local named group of folders. It helps you see and open related folders together; it does not choose the planning Root or implementation repository.

![Worksets list](images/openspec-worksets-list.png)

1. Open **Worksets** from the OpenSpec sidebar.
2. Select a row to inspect its members. Selecting the row does not open another editor window.
3. In detail, select a Project member to change the Project shown in the sidebar.
4. Select a validated Store member to use it as the planning Root.
5. Select **Open all** to open the complete Workset in its saved opener.
6. Use the custom opener id only for a one-time override; it does not change the saved opener.

![Workset detail with Store and Project members](images/openspec-workset-detail.png)

### Create a Workset

1. Open **Worksets** and select **Create Workset**.
2. Enter a unique name.
3. Add folders with the native folder picker.
4. Move the intended Primary member to the first position.
5. Optionally enter a preferred opener id.
6. Select **Create** and wait for the fresh Workset detail state.

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

- [ ] **Step 3: Run the English-guide acceptance check**

Run:

```bash
rtk zsh -c 'test -f docs/USER_GUIDE.md && \
  rg -q '"'"'<a id="plugin-interface"></a>'"'"' docs/USER_GUIDE.md && \
  rg -q '"'"'<a id="stores-and-worksets"></a>'"'"' docs/USER_GUIDE.md && \
  rg -q '"'"'openspec-worksets-list.png'"'"' docs/USER_GUIDE.md && \
  rg -q '"'"'openspec-workset-detail.png'"'"' docs/USER_GUIDE.md && \
  rg -q '"'"'openspec-workset-create.png'"'"' docs/USER_GUIDE.md && \
  rg -q '"'"'openspec new change <name>'"'"' docs/USER_GUIDE.md && \
  rg -q '"'"'/opsx:verify <change>'"'"' docs/USER_GUIDE.md && \
  rg -q '"'"'does not grant Agent permissions'"'"' docs/USER_GUIDE.md'
```

Expected: exit 0.

- [ ] **Step 4: Commit the English guide**

```bash
rtk git add docs/USER_GUIDE.md
rtk git commit -m "docs: add OpenSpec extension user guide"
```

Expected: one commit containing the English guide only.

### Task 3: Write the matching Chinese guide

**Files:**
- Create: `docs/USER_GUIDE.zh-CN.md`
- Reference: `docs/USER_GUIDE.md`

- [ ] **Step 1: Run the Chinese-guide acceptance check and see it fail**

Run:

```bash
rtk zsh -c 'test -f docs/USER_GUIDE.zh-CN.md && \
  rg -q '"'"'<a id="plugin-interface"></a>'"'"' docs/USER_GUIDE.zh-CN.md && \
  rg -q '"'"'Workset 不会授予 Agent 权限'"'"' docs/USER_GUIDE.zh-CN.md'
```

Expected: FAIL because `docs/USER_GUIDE.zh-CN.md` does not exist yet.

- [ ] **Step 2: Create the complete Chinese guide**

Create `docs/USER_GUIDE.zh-CN.md` with this content. Keep paths, commands, anchors, and image filenames identical to the English guide.

```markdown
# OpenSpec 插件使用指南

[English](USER_GUIDE.md) | 简体中文

本文说明如何通过 OpenSpec 插件界面配合 OpenSpec 工作。完整的 OpenSpec 概念与命令请参考官方 [Getting Started](https://github.com/Fission-AI/OpenSpec/blob/main/docs/getting-started.md) 和[命令说明](https://github.com/Fission-AI/OpenSpec/blob/main/docs/how-commands-work.md)。

## 选择阅读路径

- **第一次使用 OpenSpec：**从[安装与初始化](#安装与初始化)开始。
- **已经熟悉 OpenSpec：**直接跳到[插件界面](#plugin-interface)。
- **主要关注多仓协作：**直接跳到[Store 与 Workset](#stores-and-worksets)。

## 安装与初始化

1. 安装 OpenSpec CLI，并确认编辑器终端可以执行 `openspec --version`。
2. 在负责保存本地 Changes 和 Specs 的仓库中执行 `openspec init`。
3. 用 VS Code 或 Cursor 打开该仓库。
4. 安装并启用 OpenSpec 插件。
5. 从命令面板运行 **OpenSpec: Open Dashboard**。

插件会在工作区包含 `openspec/config.yaml` 时激活。如果编辑器找不到终端中可用的 CLI，请把 `openspec.cliPath` 设置为可执行文件的绝对路径。

![OpenSpec Project Dashboard](images/openspec-dashboard.png)

## 完成第一个 Change

1. 创建内容前先检查 Root 控件；它决定 Change 和 Specs 从哪里读取、写到哪里。
2. 选择 **New Change**，输入 kebab-case 名称并创建 Change 骨架。
3. 使用 **Continue** 让所选 Agent 生成下一个 artifact，或使用 **Fast-forward** 生成剩余规划 artifacts。
4. 打开 Change，检查 Proposal、Specs、Design 和 Tasks。
5. 规划完成后选择 **Apply** 开始实施。
6. 打开 **Verify & Archive**，在交互式终端运行 **Verify**。
7. 通常使用 **Review & Archive** 让 Agent 先审查再归档；只有明确需要确认保护的直接 CLI 路径时才使用 **Archive Now**。

![OpenSpec Change 详情](images/openspec-change-detail.png)

### 生命周期状态

| 状态 | 含义 | 常见下一步 |
|---|---|---|
| Planning | 必需的规划 artifacts 尚未完成 | Continue 或 Fast-forward |
| Ready to Apply | 规划 artifacts 已完成 | Apply |
| Applying | 实施任务进行中 | 继续实施 |
| Ready to Verify | 必需任务已完成 | Verify |
| Archived | Change 已成为只读历史 | 查看 artifacts 或验证结果 |

<a id="plugin-interface"></a>
## 插件界面

| 界面 | 用途 |
|---|---|
| OpenSpec Root 控件 | 选择负责保存 Changes 和 Specs 的本地 Project root 或已注册 Store |
| Project 导航 | 选择侧栏当前展示的 Project |
| Dashboard | 按生命周期筛选 Changes，并提供推荐的下一步动作 |
| Change 详情 | 查看 Proposal、Specs、Design、Tasks 和 Verify & Archive |
| Worksets | 查看包含当前 Project 的本机目录组合，并进入详情或创建流程 |

### 界面动作与命令对应关系

| 界面动作 | 底层动作 | 执行位置 | 结果 |
|---|---|---|---|
| New Change | `openspec new change <name>` | 插件调用 CLI | 在当前 Root 中创建 Change 骨架 |
| Continue | `/opsx:continue <change>` | Agent 适配器或剪贴板 | 创建下一个必需 artifact |
| Fast-forward | `/opsx:ff <change>` | Agent 适配器或剪贴板 | 创建剩余规划 artifacts |
| Apply | `/opsx:apply <change>` | Agent 适配器或剪贴板 | 实施规划任务 |
| Verify | `/opsx:verify <change>` | VS Code 交互式终端 | 对照 artifacts 验证实现 |
| Review & Archive | `/opsx:archive <change>` | VS Code 交互式终端 | 交互式审查并归档 |
| Archive Now | 直接 archive CLI | 插件确认后执行 | 仅在必需 artifacts 和任务完成时归档 |

剪贴板模式只复制命令，不会自动运行 Agent。OpenCode 适配器会把 `/opsx:<action>` 转成其支持的 `/opsx-<action>` 形式。Verify 和 Review & Archive 保持交互式运行，确保用户能够看到并回答 Agent 的追问。

<a id="stores-and-worksets"></a>
## Store 与 Workset

Store 和 Workset 控件要求 OpenSpec CLI 向插件报告相应能力。CLI 层的完整行为请参考官方 [Stores and Worksets 指南](https://github.com/Fission-AI/OpenSpec/blob/main/docs/stores-beta/user-guide.md)。

### 使用 Store 作为规划 Root

Store 是独立的 OpenSpec 规划仓库。它可以保存 Changes 和 Specs，而实施代码仍留在不同的 Project 仓库中。

1. 打开 Root 控件。
2. 选择已注册的 Store；如尚未注册，先使用 Store setup/register 操作。
3. 等待插件完成校验并重新加载 binding。
4. 创建或运行 Change 动作前，确认 Root 指示器显示的是目标 Store。

OpenSpec 不会替你 clone、pull、push、处理凭据或解决 Store 的 Git 冲突。请像管理普通仓库一样管理 Store。

### 浏览 Workset

Workset 是保存在本机的命名目录组合。它方便同时查看和打开相关目录，但不会替你选择规划 Root 或实施仓库。

![Worksets 列表](images/openspec-worksets-list.png)

1. 从 OpenSpec 侧栏打开 **Worksets**。
2. 选择一行查看成员；选择列表行不会打开新的编辑器窗口。
3. 在详情中选择 Project 成员，切换侧栏当前展示的 Project。
4. 选择经过校验的 Store 成员，把它用作规划 Root。
5. 选择 **Open all**，用保存的 opener 打开完整 Workset。
6. 自定义 opener id 只对本次打开生效，不会修改保存的 opener。

![包含 Store 和 Project 成员的 Workset 详情](images/openspec-workset-detail.png)

### 创建 Workset

1. 打开 **Worksets** 并选择 **Create Workset**。
2. 输入唯一名称。
3. 使用系统目录选择器添加文件夹。
4. 把目标 Primary 成员移动到第一位。
5. 按需填写首选 opener id。
6. 选择 **Create**，等待插件加载新的 Workset 详情。

![Create Workset 表单](images/openspec-workset-create.png)

### 跨仓示例

`checkout-suite` 包含：

- `team-plans`——保存共享 Change 和 Specs 的 Store 与规划 Root。
- `checkout-api`——包含 API 实现的 Project。
- `checkout-web`——包含 Web 实现的 Project。

需要查看或执行共享 Change 时使用 Store Root；需要针对仓库导航时切换侧栏 Project；只有需要编辑器同时打开全部成员时才使用 **Open all**。

### 必须记住的边界

- Store 是规划 Root；Store 成员不是 Project 目标。
- Workset 只保存在本机，不会随仓库共享。
- Workset 不会授予 Agent 权限，也不会自动把全部成员加入 Agent 上下文。
- 切换 Project 只改变侧栏数据；**Open all** 会改变编辑器工作区。
- Store 和 Project 的 Git 操作仍由用户显式执行。

## 常见问题

| 现象 | 检查项 |
|---|---|
| Dashboard 没有激活 | 打开包含 `openspec/config.yaml` 的工作区 |
| CLI 在终端可用，但插件找不到 | 把 `openspec.cliPath` 设置为可执行文件绝对路径并重新加载 |
| Store 或 Worksets 不可用 | 检查 `openspec --version`，再执行 `openspec store list --json` 和 `openspec workset list --json` |
| Change 出现在错误位置 | 创建或运行操作前重新检查 Root 控件 |
| 选择 Workset 行后没有打开窗口 | 列表行只打开详情；使用 **Open all** 打开完整 Workset |
| Store 内容没有更新 | 用 Git 更新 Store，然后刷新插件 |
| Agent 无法修改其他成员 | 显式打开或授权对应仓库；Workset 成员关系不等于 Agent 权限 |
```

- [ ] **Step 3: Verify structural and semantic parity**

Run:

```bash
rtk zsh -c 'test -f docs/USER_GUIDE.zh-CN.md && \
  test "$(rg -c '"'"'^#{2,3} '"'"' docs/USER_GUIDE.md)" = "$(rg -c '"'"'^#{2,3} '"'"' docs/USER_GUIDE.zh-CN.md)" && \
  test "$(rg -c '"'"'^\|.*\|$'"'"' docs/USER_GUIDE.md)" = "$(rg -c '"'"'^\|.*\|$'"'"' docs/USER_GUIDE.zh-CN.md)" && \
  rg -q '"'"'<a id="plugin-interface"></a>'"'"' docs/USER_GUIDE.zh-CN.md && \
  rg -q '"'"'<a id="stores-and-worksets"></a>'"'"' docs/USER_GUIDE.zh-CN.md && \
  rg -q '"'"'openspec-workset-create.png'"'"' docs/USER_GUIDE.zh-CN.md && \
  rg -q '"'"'Workset 不会授予 Agent 权限'"'"' docs/USER_GUIDE.zh-CN.md'
```

Expected: exit 0; both guides contain the same number of level-2/3 headings and table rows.

- [ ] **Step 4: Commit the Chinese guide**

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

- [ ] **Step 1: Run the Marketplace-content check and see it fail**

Run:

```bash
rtk zsh -c 'rg -q '"'"'openspec-worksets-list.png'"'"' README.md && \
  rg -q '"'"'docs/USER_GUIDE.md#plugin-interface'"'"' README.md && \
  rg -q '"'"'openspec-worksets-list.png'"'"' README.zh-CN.md && \
  rg -q '"'"'docs/USER_GUIDE.zh-CN.md#plugin-interface'"'"' README.zh-CN.md'
```

Expected: FAIL because the new screenshots and guide links are absent.

- [ ] **Step 2: Replace the English Usage quick-start block**

In `README.md`, replace the content from `## Usage` through the paragraph immediately before `### Commands` with:

```markdown
## Usage

### Quick start

1. Open a workspace that contains `openspec/config.yaml`.
2. Run **OpenSpec: Open Dashboard** from the Command Palette.
3. Check the OpenSpec Root, then select **New Change** to create a Change skeleton.
4. Use **Continue** or **Fast-forward** to generate planning artifacts through your selected Agent adapter.
5. Review Proposal, Specs, Design, and Tasks, then select **Apply**.
6. Use the **Verify & Archive** tab to verify and archive in an interactive terminal.

`Review & Archive` is the recommended Agent-assisted path. `Archive Now` is the explicit confirmation-protected direct CLI path and is available only when the selected workflow is complete.

### Stores and Worksets

A **Store** is a writable planning Root for Changes and Specs. Select or create one from the Root controls; the extension changes binding only after CLI validation. Store Git operations remain your responsibility.

A **Workset** is a machine-local named group of folders. Use Worksets to inspect related Projects and Stores, switch the sidebar Project or planning Root, open every member, or create a new group.

<img src="docs/images/openspec-worksets-list.png" alt="Worksets containing the current OpenSpec Project" width="430" />

Selecting a Workset row opens detail without launching another window. In detail, Project members switch sidebar context, Store members can become the planning Root, and **Open all** opens the complete editor workspace.

<img src="docs/images/openspec-workset-detail.png" alt="Workset detail showing Store and Project member roles" width="430" />

Create a Workset from the current Project plus folders selected with the native folder picker. A one-time opener override never changes the saved opener.

<img src="docs/images/openspec-workset-create.png" alt="Create Workset form with members and preferred opener" width="430" />

### Complete user guide

- New to OpenSpec: [read the complete user guide](https://github.com/RandyZ/openspec-ext/blob/main/docs/USER_GUIDE.md).
- Already use OpenSpec: [jump directly to the plugin interface](https://github.com/RandyZ/openspec-ext/blob/main/docs/USER_GUIDE.md#plugin-interface).
- 简体中文：[完整使用指南](https://github.com/RandyZ/openspec-ext/blob/main/docs/USER_GUIDE.zh-CN.md)。
```

Keep `### Commands` and all later sections unchanged.

- [ ] **Step 3: Replace the Chinese Usage quick-start block**

In `README.zh-CN.md`, replace the content from `## 使用` through the paragraph immediately before `### 命令` with:

```markdown
## 使用

### 快速开始

1. 打开包含 `openspec/config.yaml` 的工作区。
2. 从命令面板运行 **OpenSpec: Open Dashboard**。
3. 检查 OpenSpec Root，然后选择 **New Change** 创建 Change 骨架。
4. 使用 **Continue** 或 **Fast-forward**，通过所选 Agent 适配器生成规划 artifacts。
5. 检查 Proposal、Specs、Design 和 Tasks，然后选择 **Apply**。
6. 在 **Verify & Archive** 标签页的交互式终端中完成验证与归档。

推荐使用 `Review & Archive` 进行 Agent 辅助审查与归档。`Archive Now` 是带确认保护的直接 CLI 路径，仅在当前 workflow 完成后可用。

### Store 与 Workset

**Store** 是保存 Changes 和 Specs 的可写规划 Root。可以从 Root 控件选择或创建 Store；插件只会在 CLI 校验通过后切换 binding。Store 的 Git 操作仍由用户负责。

**Workset** 是保存在本机的命名目录组合。通过 Worksets 可以查看关联的 Projects 和 Stores、切换侧栏 Project 或规划 Root、打开全部成员，或者创建新的目录组合。

<img src="docs/images/openspec-worksets-list.png" alt="包含当前 OpenSpec Project 的 Worksets 列表" width="430" />

选择 Workset 列表行只会打开详情，不会启动另一个窗口。在详情中，Project 成员用于切换侧栏上下文，Store 成员可以成为规划 Root，**Open all** 用于打开完整编辑器工作区。

<img src="docs/images/openspec-workset-detail.png" alt="展示 Store 与 Project 成员角色的 Workset 详情" width="430" />

创建 Workset 时，以当前 Project 为基础，通过系统目录选择器添加成员。一次性 opener 覆盖不会修改保存的 opener。

<img src="docs/images/openspec-workset-create.png" alt="包含成员和首选 opener 的 Create Workset 表单" width="430" />

### 完整使用指南

- 第一次使用 OpenSpec：[阅读完整使用指南](https://github.com/RandyZ/openspec-ext/blob/main/docs/USER_GUIDE.zh-CN.md)。
- 已经熟悉 OpenSpec：[直接跳到插件界面](https://github.com/RandyZ/openspec-ext/blob/main/docs/USER_GUIDE.zh-CN.md#plugin-interface)。
- English: [Complete user guide](https://github.com/RandyZ/openspec-ext/blob/main/docs/USER_GUIDE.md).
```

Keep `### 命令` and all later sections unchanged.

- [ ] **Step 4: Verify README parity and Marketplace extraction**

Run:

```bash
rtk zsh -c 'test "$(rg -c '"'"'docs/images/openspec-workset-(detail|create)\.png'"'"' README.md)" = 2 && \
  test "$(rg -c '"'"'docs/images/openspec-worksets-list'"'"' README.md)" = 1 && \
  test "$(rg -c '"'"'docs/images/openspec-workset-(detail|create)\.png'"'"' README.zh-CN.md)" = 2 && \
  test "$(rg -c '"'"'docs/images/openspec-worksets-list'"'"' README.zh-CN.md)" = 1 && \
  rg -q '"'"'USER_GUIDE.md#plugin-interface'"'"' README.md && \
  rg -q '"'"'USER_GUIDE.zh-CN.md#plugin-interface'"'"' README.zh-CN.md'

rtk node scripts/extract-readme-marketplace.js

rtk zsh -c 'rg -q '"'"'openspec-worksets-list.png'"'"' build/README.md && \
  rg -q '"'"'openspec-workset-detail.png'"'"' build/README.md && \
  rg -q '"'"'openspec-workset-create.png'"'"' build/README.md && \
  rg -q '"'"'https://github.com/RandyZ/openspec-ext/blob/main/docs/USER_GUIDE.md#plugin-interface'"'"' build/README.md && \
  ! rg -q '"'"'Below: development/contributing only'"'"' build/README.md'
```

Expected: all commands exit 0; `build/README.md` contains the three screenshots and absolute guide links but excludes development-only content below `---`.

- [ ] **Step 5: Commit both README updates**

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

- [ ] **Step 1: Build the final local VSIX**

Run:

```bash
rtk pnpm run package
```

Expected: exit 0 and `openspec-workflow-0.2.1.vsix` is freshly created. The packaging script restores the repository's full `README.md` after packaging.

- [ ] **Step 2: Inspect the packaged README and image inventory**

Run:

```bash
rtk unzip -l openspec-workflow-0.2.1.vsix | \
  rg 'extension/(README.md|README.zh-CN.md|docs/images/openspec-(dashboard|change-detail|worksets-list|workset-detail|workset-create)\.png)'

rtk zsh -c 'unzip -p openspec-workflow-0.2.1.vsix extension/README.md | \
  rg -q '"'"'USER_GUIDE.md#plugin-interface'"'"' && \
  unzip -p openspec-workflow-0.2.1.vsix extension/README.md | \
  rg -q '"'"'openspec-workset-create.png'"'"' && \
  unzip -p openspec-workflow-0.2.1.vsix extension/README.md | \
  rg -q '"'"'Store Git operations remain your responsibility'"'"''
```

Expected: the inventory lists both READMEs and exactly the five intended public screenshots; the packaged English README contains the absolute guide anchor, Create Workset image, and Git-ownership boundary.

- [ ] **Step 3: Verify that detailed guides remain repository-hosted**

Run:

```bash
rtk zsh -c '! unzip -l openspec-workflow-0.2.1.vsix | rg -q '"'"'extension/docs/USER_GUIDE'"'"''
```

Expected: exit 0. This is intentional because Marketplace links use canonical GitHub `blob/main` URLs.

- [ ] **Step 4: Perform final visual and repository checks**

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
