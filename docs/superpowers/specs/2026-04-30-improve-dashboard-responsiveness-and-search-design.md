# Dashboard 响应性与搜索体验改进设计

## 背景

OpenSpec 扩展的 Dashboard 是用户进入 change 工作流的主要入口。当前用户反馈集中在四类体验问题：左侧 sidebar 点击后需要等待加载、change 状态变化后不自动刷新、任务确认弹窗打开和关闭慢且取消按钮重复、change 卡片缺少搜索和 proposal 摘要信息。

## 目标

- sidebar 在已有缓存可用时立即展示，点击 change 不触发不必要的全量扫描。
- openspec 文件变化、任务状态变化、手动命令刷新后，sidebar 自动同步最新 dashboard 数据。
- 任务勾选确认使用 webview 内轻量确认框，避免 VS Code modal 延迟和重复取消按钮。
- change 列表支持本地搜索，并在卡片中展示 Proposal 的 Why 摘要；鼠标悬浮可查看完整 Why。

## 推荐方案

采用分层小步改造：

1. **刷新通道**：复用 `DataManager` 的缓存和 refresh 事件，让 `DashboardViewProvider` 订阅刷新结果并主动推送 `dashboardData` 给 sidebar webview。
2. **摘要数据**：扩展 `ChangeInfo`，在 refresh 时读取 `proposal.md` 的 `## Why` 段，生成 `proposalWhySummary` 和 `proposalWhyFullText`。
3. **搜索过滤**：在 `ChangesSection` 增加搜索输入框，前端基于 change name、status、artifact id、proposal Why 文本做本地过滤，避免每次输入都调用 CLI。
4. **确认交互**：将 task toggle 的确认前移到 `ChangeDetail`/`TaskList` webview 内，复用现有 `ConfirmDialog`，确认后才发送 `toggleTask` 消息；extension host 不再展示任务 toggle modal。

## 需要修改的能力

- `dashboard`：实时更新、性能、change 卡片信息密度、搜索过滤。
- `cli-integration`：缓存复用、刷新结果共享、避免重复 CLI 调用。
- `task-management`：任务 toggle 反馈延迟与确认交互。

## 风险与边界

- Proposal Why 提取只作为摘要展示，不参与 OpenSpec artifact 语义解析；解析失败时应为空字符串，不阻塞 dashboard。
- 本阶段搜索先覆盖 active changes 的本地可用文本，不做跨所有 artifact 的后台索引。
- 自动刷新应保留 debounce，避免文件保存风暴导致多次 CLI 刷新。

## 待后续计划细化

- 为 `DataManager.refresh()`、proposal Why 提取、`ChangesSection` 搜索过滤、webview 内确认框分别补单元测试。
- 使用 VS Code Extension Development Host 手工验证 sidebar 自动刷新和任务确认交互。
