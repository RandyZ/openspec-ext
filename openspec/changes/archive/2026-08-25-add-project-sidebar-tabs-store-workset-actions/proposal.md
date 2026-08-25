## Why

Project-first Sidebar 当前把核心入口堆成纵向按钮，Changes/Specs 浏览、Workset 模式与 Dashboard 的层级不一致；Dashboard Editor 又复用 Sidebar 页面，既浪费宽屏空间，也会重复触发数据加载。现在需要用一个共享的 Project workspace 快照同时支撑紧凑 Sidebar 和独立 Dashboard，并修正官方 Workset open 的非 JSON 语义。

## What Changes

- 将 Project-first Sidebar 顶部改成固定顺序的 2×2 action grid：Changes、Specs、动态 Worksets、Dashboard。
- Changes、Specs、Worksets 在 Sidebar 内本地切换；列表浏览不再创建 Editor Explorer，Change/Spec detail 继续按 binding 打开 Editor。
- Dashboard action 打开或 reveal 独立 Project Dashboard Editor，展示真实 KPI、lifecycle distribution、artifact readiness 和 recent updates。
- 统一当前 Project binding 下的 active/archived Changes、Project Specs、referenced Store Specs 与 Workset navigation 数据，供 Sidebar 和 Dashboard 复用缓存与 fresh refresh。
- 将 New Change 与 Refresh 暴露为原生 VS Code view-title actions，避免占用四宫格和重复 Webview 操作条。
- 按官方 context/Store selector 读取 referenced Store Specs；Store 失败只降级对应分组且不得污染 Project Dashboard 指标。
- 将 whole-Workset 操作路由到官方 `openspec workset open <name>` 普通输出命令，并明确区分 Project picker 与完整 Workset 打开。
- 保留 legacy Dashboard/Store/Workset 管理、watcher、workflow 和详情 Editor；Tasks 分组与 Specs 分栏详情作为 Phase 2，不在本 Change 实现。

## Capabilities

### New Capabilities

- `project-sidebar-tabs`: Project-first 四宫格入口、本地 Changes/Specs/Worksets 浏览、Dashboard 路由与共享 Project payload 契约。
- `referenced-store-specs`: 项目声明的 referenced Store Specs 分组、binding 隔离、fail-soft 展示与 Dashboard 指标隔离。
- `workset-cli-open`: 动态 Worksets 入口、Project 切换粒度和官方非 JSON whole-Workset open。

### Modified Capabilities

- `dashboard`: 缓存感知行为、原生操作入口和独立 Project Dashboard summary surface。
- `cli-integration`: 增加无 JSON 输出的官方 `workset open` 调用路径，并保留 CLI 退出与诊断语义。

## Impact

- Extension Host：`DashboardViewProvider`、`ProjectDataGateway`、`OpenSpecCliService`、`DataManager`、Project page cache 与 Webview message routing。
- VS Code contribution：现有 New Change/Refresh commands 的 `view/title` 菜单与图标。
- Webview：`Dashboard`、`Header`、`App` routing、`ProjectDashboard`、Changes/Specs/Worksets 组件、消息类型和 i18n。
- Tests：Gateway/CLI/provider/App/component 单元测试、真实 reference Store fixture、Extension Development Host GUI 验收与完整构建门禁。
- 不修改 OpenSpec CLI、Store registry、Workset registry、其他项目仓库或 Change Detail 的 Tasks/Specs 布局。
