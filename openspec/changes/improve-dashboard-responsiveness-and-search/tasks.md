# Implementation Tasks

> 参考 Superpowers 实现计划：[Dashboard Responsiveness And Search Implementation Plan](../../../docs/superpowers/plans/2026-04-30-improve-dashboard-responsiveness-and-search.md)。
> 执行 `/opsx:apply` 时按 RED → GREEN → REFACTOR 推进，每个任务完成后运行对应测试再勾选。

## 1. Dashboard 数据与刷新通道

- [x] 1.1 为 `ChangeInfo` 增加 Proposal Why 摘要、完整文本和搜索文本字段，并补充类型同步。
- [x] 1.2 新增 Proposal Why 提取工具及单元测试，覆盖标准 `## Why`、缺失 Why、Markdown 标记和 150 字截断。
- [x] 1.3 调整 Dashboard refresh callback，使 `DataManager.refresh()` 的结果可共享给订阅者并保持现有缓存语义。
- [x] 1.4 让 `DashboardViewProvider` 订阅 refresh 事件，在 sidebar 存在时主动推送最新 `dashboardData`。

## 2. Sidebar 搜索与摘要展示

- [x] 2.1 为 `ChangesSection` 增加本地搜索输入和过滤逻辑，覆盖名称、状态、artifact 和 Proposal Why 文本。
- [x] 2.2 更新 `ChangeCard` 展示 150 字 Proposal Why 摘要，并用 hover/title 提供完整 Why 信息。
- [x] 2.3 确保搜索后的状态分组标题与 change 计数基于过滤结果更新。
- [x] 2.4 补充 Dashboard/ChangeCard 相关单元测试，验证搜索过滤、空结果、过滤计数和摘要展示。
- [x] 2.5 更新 `src/i18n/locales/en.json` 和 `src/i18n/locales/zh-cn.json` 中新增搜索、空结果、确认弹窗文案。

## 3. Webview 内任务确认

- [x] 3.1 在 `ChangeDetail`/`TaskList` 接入 `ConfirmDialog`，点击 checkbox 后立即展示确认 UI。
- [x] 3.2 将 `toggleTask` 消息改为确认后发送，并确保取消不修改本地状态或 `tasks.md`。
- [x] 3.3 移除 Extension Host 中任务 toggle 的 VS Code modal，保留归档只读和写入后的数据刷新。
- [x] 3.4 补充任务确认相关单元测试，覆盖确认写入、取消不写入和弹窗按钮唯一性。

## 4. 集成验证与收口

- [x] 4.1 运行 `pnpm test`，确保新增和既有单元测试通过。
- [x] 4.2 运行 `pnpm run build`，确保 extension host 与 webview 构建通过。
- [x] 4.3 使用 VS Code Extension Development Host 手工验证：sidebar 自动刷新、搜索过滤、Proposal Why 摘要、任务确认弹窗。
- [x] 4.4 录制一段简短 walkthrough，展示 sidebar 自动刷新、搜索摘要和任务确认体验。
- [x] 4.5 根据手工验证结果修复问题，并更新本任务清单状态。
