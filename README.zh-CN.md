# OpenSpec 扩展

> 面向 VS Code / Cursor 的项目优先 OpenSpec 工作台：集中查看 changes、specs，并安全推进工作流。

[English](README.md) | 简体中文

## 概览

OpenSpec 将 change 规划与执行带回编辑器：集中查看需要关注的事项、检查 specs 和 artifacts，并在不丢失上下文的情况下推进下一步工作流。

### 核心能力

- **项目优先侧栏**：固定提供 Changes、Specs、Worksets、Dashboard 四个入口，清晰表达 active、focus 和不可用状态。
- **Stores 与工作集**：将已注册 Store 用作规划根，并直接在侧栏中浏览、查看、创建和打开可信的多文件夹工作集。
- **推荐动作**：紧凑的、由 resolver 驱动的动作栏按 Needs Attention、Ready to Verify、Recommended 优先级展示最多三条下一步动作。
- **Change 详情**：提供 Proposal、Specs、Design、Tasks、Verify & Archive 标签页、Markdown 渲染、任务进度和工作流控制。
- **安全路由**：Review 和 Verify 会进入对应详情页或交互式终端；高影响归档动作始终保留确认保护。
- **CLI 集成**：支持 OpenSpec CLI 的 list、status、new、archive、Store 和 Workset 流程，并提供重试、超时和 `openspec.cliPath` 兜底。
- **编辑器原生体验**：复用 VS Code 主题 token 和 Codicon，支持键盘操作，并适配窄侧栏布局。

## 截图

### 项目 Dashboard 侧栏

<img src="docs/images/openspec-dashboard.png" alt="OpenSpec 项目 Dashboard 侧栏，包含导航卡片和推荐动作" width="430" />

侧栏将项目导航和下一步推荐动作集中在一个紧凑界面中。截图使用公开示例工作区，不包含私人路径、凭据或运行时日志。

### Change 详情与任务操作

<img src="docs/images/openspec-change-detail.png" alt="OpenSpec Change 详情，展示任务和工作流动作" width="759" />

详情页将 artifacts、任务进度和工作流动作放在一起。Verify 和 Archive 与普通任务执行分开，安全路径更加明确。

## 安装

- **从扩展市场安装**：在 [VS Code Marketplace](https://marketplace.visualstudio.com/) 或 [Open VSX](https://open-vsx.org/)（例如 Cursor）安装 **OpenSpec**。
- **运行要求**：[OpenSpec CLI](https://github.com/Fission-AI/OpenSpec#quick-start)；工作区需要包含（或准备包含）`openspec/config.yaml`。扩展会在检测到 OpenSpec workspace 时激活。

如果 Cursor 或 VS Code 无法找到你终端里可用的 OpenSpec CLI，请将 `openspec.cliPath` 设置为 CLI 的绝对路径，例如 `/opt/homebrew/bin/openspec` 或 `/usr/local/bin/openspec`。

## 使用

### 快速开始

1. 打开包含 `openspec/config.yaml` 的工作区。
2. 执行 **OpenSpec: Open Dashboard**。
3. 检查当前 **Root**，然后选择 **New Change**。
4. 使用 **Continue** 或 **Fast-forward** 生成 planning artifacts。
5. 检查 **Proposal**、**Specs**、**Design** 和 **Tasks**，然后选择 **Apply**。
6. 在 **Verify & Archive** 中先运行 **Run Verify**，再按需要使用 **Review & Archive**。

**Review & Archive** 是推荐的 Agent-assisted 路径。**Archive Now** 是需显式确认后执行的直接 CLI 归档方式，仅在 workflow 完成时可用。

### Store 与 Workset

**Store** 是负责 Changes 和 Specs 的可写 planning **Root**。通过 Root 控件选择或创建 Store；扩展仅在 CLI 验证通过后切换 binding。Git 操作仍由用户负责。

**Workset** 是保存在本机的具名文件夹组。你可以查看其中的 Projects 和 Stores、切换侧栏 Project 或 planning Root、打开全部成员组成的完整 workspace，以及创建新组。

<img src="docs/images/openspec-worksets-list.png" alt="包含当前 OpenSpec Project 的 Worksets 列表" width="430" />

点击列表行只会打开详情，不会新开窗口。Project 成员用于切换侧栏，Store 成员会成为 planning Root，**Open all** 会打开完整 workspace。

<img src="docs/images/openspec-workset-detail.png" alt="Workset 详情中的 Store 与 Project 成员角色" width="430" />

**Create Workset** 以当前 Project 为基础，并通过原生文件夹选择器添加成员；一次性 opener override 不会修改已保存的 opener。

<img src="docs/images/openspec-workset-create.png" alt="包含成员和首选 opener 的 Create Workset 表单" width="430" />

### 完整使用指南

- [简体中文使用指南](https://github.com/RandyZ/openspec-ext/blob/main/docs/USER_GUIDE.zh-CN.md)
- [插件接口](https://github.com/RandyZ/openspec-ext/blob/main/docs/USER_GUIDE.zh-CN.md#plugin-interface)
- [English user guide](https://github.com/RandyZ/openspec-ext/blob/main/docs/USER_GUIDE.md)

### 命令

在命令面板中输入 OpenSpec：

| 命令 | 说明 |
|---|---|
| **OpenSpec: Open Dashboard** | 打开可视化 Dashboard（侧边栏或编辑区） |
| **OpenSpec: Refresh Data** | 从 CLI 手动刷新数据 |
| **OpenSpec: Create New Change** | 创建新的 change（带校验） |
| **OpenSpec: Archive Change** | 归档已完成的 change |

### 快捷键

- `Cmd+Shift+P`（macOS）/ `Ctrl+Shift+P`（Windows/Linux）：打开命令面板，然后输入 OpenSpec 执行命令。
- 默认不绑定快捷键；你可以在 Keyboard Shortcuts 中自行绑定，例如绑定 `OpenSpec: Open Dashboard`。

### 配置

| 设置项 | 默认值 | 说明 |
|---|---:|---|
| `openspec.focusSidebarViewWhenOpeningChangeDetail` | `false` | 打开 change 详情时聚焦 OpenSpec sidebar |
| `openspec.focusSidebarViewWhenOpeningDashboard` | `false` | 执行 Open Dashboard 命令时聚焦 OpenSpec sidebar |
| `openspec.cliPath` | `""` | 可选的 OpenSpec CLI 绝对路径；为空时自动从 PATH 和 login shell 检测 |
| `openspec.taskExecutionMode` | `fillChat` | 点击任务执行时的模式：`auto` 通过 adapter 执行；`fillChat` 填充 chat 或复制到剪贴板 |
| `openspec.workflowLaunchMode` | `clipboard` | workflow 按钮行为：`clipboard` 只复制命令；`adapter` 按首选 adapter 路由 |
| `openspec.preferredAgentAdapter` | `clipboard` | `workflowLaunchMode=adapter` 时使用的首选执行适配器：`clipboard`、`cursor`、`vscode-copilot`、`claude-code` 或 `opencode` |
| `openspec.cursorLaunchMode` | `clipboard` | 非交互 workflow 动作的 Cursor adapter 启动方式：`clipboard` 仅复制；`deeplink` 打开 Cursor prompt 并复制兜底；`chatCommand` 尝试 Cursor Chat query 并复制兜底；`agentCli` 以 headless 模式运行 Cursor Agent CLI |
| `openspec.taskDependencyPolicy` | `block` | 前置任务未完成时的策略：`block` 阻止执行；`warn` 提示后允许继续 |
| `openspec.cursorAgentModel` | `auto` | 显式 Cursor Agent CLI 执行时使用的模型；`auto` 表示由 Cursor 选择 |
| `openspec.agentModel` | `auto` | 旧版 Cursor Agent CLI 模型配置；建议改用 `openspec.cursorAgentModel` |
| `openspec.debug` | `false` | 启用 debug：显示 Verify tab，并在 Output 中打印完整 prompt |

### 任务执行与适配器

- **Clipboard** (`clipboard`)：始终可用，也是默认 workflow 启动方式，只复制生成的 `/opsx:*` 命令。
- **Cursor** (`cursor`)：在 Cursor 中可复制命令并打开官方 prompt deeplink、尝试 Chat query、仅复制，或在用户显式配置时启动 headless Agent CLI。
- **OpenCode** (`opencode`)：通过 adapter 路由时使用 `/opsx-<action>` 命令格式。
- workflow 动作默认使用 `workflowLaunchMode=clipboard`。当你希望按钮打开所选 adapter 时，设置 `openspec.workflowLaunchMode=adapter` 并选择 `openspec.preferredAgentAdapter`。在 Cursor 中，显式设置 `openspec.cursorLaunchMode` 为 `deeplink`、`chatCommand` 或 `agentCli` 也会让非交互 workflow 按钮走 Cursor 路由。
- Verify 和 Archive 是刻意分开的：它们会进入专用 `Verify & Archive` 标签页，并在 VS Code 官方终端编辑器中运行，而不是走 headless `agentCli`。
- 在该标签页中，`Review & Archive` 保留 Agent 交互式审查；`Archive Now` 是显式 direct archive 逃生路径，workflow 未完成时会保持禁用并说明原因。

### Dashboard

- 按 Host 推导的生命周期状态筛选：**全部**、**Planning**、**Ready to Apply**、**Applying**、**Ready to Verify**、**已归档（Archived）**。
- **Needs Attention** 是正交筛选条件（不是生命周期值），用于标出需要关注的 change。
- 列表处理顺序固定为：**筛选 → 搜索 → 排序 → 分页**；状态筛选在分页之前生效。
- **Archived** 是一等、只读的生命周期状态（不提供写操作工作流按钮）。
- 视图状态（筛选、搜索、排序、每页数量）按 OpenSpec Root（Local / Store）隔离保存。
- 按 change 名称、状态、artifact 或 Proposal Why 文本搜索。
- 在侧边栏查看进度、生命周期徽章、artifact badges 和 Proposal Why 摘要。
- 打开 change 详情页查看 Proposal / Specs / Design / Tasks / Verify & Archive。
- 通过选定 adapter 执行任务，或将工作流命令填充/复制到 chat。
- 修改任务完成状态前会先显示 webview 确认框。

### 查看日志

1. 打开 Output 面板：`View > Output` 或 `Cmd+Shift+U`。
2. 在下拉框中选择 **OpenSpec**。
3. 查看 INFO、WARN、ERROR、DEBUG 等时间戳日志。

### 故障排查

- **扩展未激活**：确认打开的文件夹包含（或准备包含）OpenSpec workspace：`openspec/config.yaml`。
- **提示 OpenSpec CLI not found**：安装 [OpenSpec CLI](https://github.com/Fission-AI/OpenSpec#quick-start)，并确保它在 PATH 中；如果终端可用但扩展不可用，请配置 `openspec.cliPath`。
- **Dashboard 为空**：执行 **OpenSpec: Refresh Data**，并检查 Output 面板中的 **OpenSpec** 日志。
- **Dashboard 显示 CLI 诊断卡片**：当 VS Code/Cursor Extension Host 无法启动 OpenSpec CLI 时，Dashboard 会显示诊断卡片和恢复动作。修复 PATH 或 `openspec.cliPath` 后点击 **重试**；需要手动指定路径时点击 **打开设置**；反馈问题时使用 **复制诊断**。复制内容会隐藏完整 PATH、用户目录和密钥信息。
- **Windows `.cmd` 或 shim 启动失败**：如果诊断中出现 `spawn-failed` 或 `ENOENT`，请把 `openspec.cliPath` 设置为 OpenSpec 可执行文件或 shim 的绝对路径，然后点击 **重试**。
- **重试不会修改你的配置**：**重试** 按钮仅重新运行 CLI 检测。它不会安装 CLI、修改你的 shell 配置或更改 `openspec.cliPath`。
