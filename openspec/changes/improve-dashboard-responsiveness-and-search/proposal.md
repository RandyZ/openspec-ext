## Why

当前 OpenSpec Dashboard 已经是用户管理 change 的主要入口，但 sidebar 打开和点击时会出现不必要的等待，change 状态变化后不能自动同步，任务确认弹窗反馈慢且存在重复取消按钮，change 卡片也缺少搜索与上下文摘要。这些问题会打断用户在 Cursor/VS Code 中连续推进 OpenSpec 工作流的节奏，因此需要优先改善 Dashboard 的响应性、自动刷新和信息发现能力。

参考 Superpowers 设计文档：[Dashboard 响应性与搜索体验改进设计](../../../docs/superpowers/specs/2026-04-30-improve-dashboard-responsiveness-and-search-design.md)。

## What Changes

- 复用 Dashboard 数据缓存，避免用户点击 sidebar 或 change 卡片时触发不必要的全量重新扫描。
- 在文件监听、任务状态变化、命令刷新等场景下，将最新 Dashboard 数据主动推送到 sidebar，使左侧列表自动更新。
- 将任务勾选确认从 VS Code modal 调整为 webview 内轻量确认框：点击后立即展示确认反馈，用户确认后才持久化写入 `tasks.md`，并移除重复取消按钮。
- 为 sidebar change 列表增加搜索输入，支持基于 change 名称、状态、artifact、Proposal Why 摘要等本地可用文本过滤。
- 在每个 change 卡片标题下展示 Proposal `## Why` 的 150 字摘要，超出部分以 `...` 省略，并在鼠标悬浮时展示完整 Why 文本。
- 保留现有手动刷新入口，作为用户需要强制重新读取 OpenSpec 状态时的兜底操作。

## Capabilities

### New Capabilities

无。本次变更扩展现有 Dashboard、CLI 集成和任务管理能力，不新增独立 capability。

### Modified Capabilities

- `dashboard`: Dashboard 必须自动反映 OpenSpec 文件与任务状态变化；change 列表必须支持搜索过滤；change 卡片必须展示 Proposal Why 摘要和完整悬浮提示。
- `cli-integration`: Dashboard 数据获取必须复用缓存并共享刷新结果，避免 sidebar 点击和快速交互导致重复 CLI 调用。
- `task-management`: 任务勾选交互必须从“点击即写入”调整为“点击即确认、确认后写入”，提供即时、无重复按钮的确认体验，并保持取消时不修改 `tasks.md`。

## Impact

- Extension Host: `DataManager` 刷新事件、Dashboard 数据缓存、proposal 摘要提取、`DashboardViewProvider` 主动推送逻辑。
- Webview: `Dashboard`、`ChangesSection`、`ChangeCard`、`ChangeDetail`、`TaskList`、`ConfirmDialog` 及相关 message/type 定义。
- Specs: 修改 `dashboard`、`cli-integration`、`task-management` 的行为要求。
- Tests: 增加或更新数据刷新、摘要提取、搜索过滤、任务确认交互相关单元测试，并通过 Extension Development Host 做手工验证。
