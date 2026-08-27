<!-- Distilled from explore.md saved at openspec/changes/polish-sidebar-navigation-and-action-recommendations/explore.md -->

## Why

Project-first Sidebar 的四宫格和推荐动作已经具备正确的数据与路由，但当前呈现仍像无样式文本，用户难以识别导航状态、动作含义和点击结果。发布候选需要在不重做动作模型的前提下补齐清晰、紧凑且符合 VS Code 主题的交互层级。

## What Changes

- 将固定 2×2 Project action grid 改为带主题边框、背景、Codicon、辅助文字、active/disabled/focus 状态的紧凑导航卡片。
- 为 Dashboard 添加明确的 Editor 打开提示，为不可用 Worksets 保留固定位置和可访问原因。
- 将裸露的 Recommended Actions 名称改为最多 3 条带边框动作行，按 Needs Attention → Ready to Verify → Recommended 排序。
- 每条推荐展示 Change 名称、推荐原因/状态和真实 CTA；CTA 继续复用 shared resolver 与现有 workflow/detail 路由。
- 成对更新中英文文案，并以语义/ARIA、动作路由和真实窄 Sidebar 验收覆盖视觉改造。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `project-sidebar-tabs`: 明确四个 Project 入口的卡片层级、active/disabled 状态、Dashboard Editor 提示和窄 Sidebar 可访问性。
- `dashboard`: 明确推荐动作的优先级、最多展示数量、动作信息结构和 CTA 路由语义。

## Impact

- Webview：`Header`、`Dashboard` 及其现有测试。
- Shared：继续读取 `resolveWorkflowActions()` 的结果，不改变动作模型或 Host 消息协议。
- i18n：`en.json`、`zh-cn.json` 新增成对文案。
- 依赖与数据：不新增依赖、缓存、DTO、持久化或 CLI 行为。

MVP 仅覆盖 Sidebar 四宫格和推荐动作行；不在本 Change 中重做 Change Card、宽 Dashboard 图表或全局设计系统。
