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
| Ready to Verify | 必需任务已完成 | Verify |
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
