## Why

Project-first Sidebar 当前只预加载 Changes，All Changes 与 Specs 通过重复的 CLI 解析和新的 Editor WebviewPanel 打开，导致明显等待和两套浏览体验。声明了 Store reference 的项目虽然能被官方 CLI 正确解析，但 Project-first UI 没有展示 referenced Store Specs；Workset 管理页又把无 JSON 模式的官方 `workset open` 当成 JSON 命令调用，造成点击无效。

## What Changes

- 在 Project-first Sidebar 内提供 Changes / Specs tabs，列表浏览不再创建 Editor Explorer。
- 统一 Project binding 下的 Changes、归档 Changes、Project Specs、referenced Store Specs 和 Workset navigation 数据加载，支持缓存优先与后台刷新，避免 tab 点击重复解析 CLI。
- 按官方 `context --json` / `doctor --json` 读取项目的 Store references，并按 Store binding 展示 Store Specs；未引用 Store 不进入项目 Specs 视图。
- 将 Workset 管理页的“打开工作集”改为直接调用官方 `openspec workset open <name>` 非 JSON 命令，让 CLI 负责工具选择、成员校验和 workspace 文件生成。
- 明确“切换到 Project”和“打开整个 Workset”的操作语义，保留 legacy scope/store 管理和 Change/Spec Detail Editor 详情页。

## Capabilities

### New Capabilities

- `project-sidebar-tabs`: Project-first Sidebar 中 Changes / Specs tab 的浏览与缓存数据契约。
- `referenced-store-specs`: 项目声明的 referenced Store Specs 分组、绑定与 fail-soft 展示。
- `workset-cli-open`: 使用官方非 JSON Workset open 命令打开完整工作集，并区分 Project 切换动作。

### Modified Capabilities

- `dashboard`: Project-first 列表浏览入口、缓存优先加载和 Sidebar tab 行为发生变化。
- `cli-integration`: 增加无 JSON 输出的官方 `workset open` 调用路径，并保留 CLI 错误语义。

## Impact

- Extension Host：`DashboardViewProvider`、`ProjectDataGateway`、`DataManager`、`OpenSpecCliService`、项目页缓存与 Webview message routing。
- Webview：`Dashboard`、Header、Changes/Specs/Worksets 组件、消息类型和本地 tab 状态。
- Tests：Gateway/CLI/provider 单元测试、Sidebar tab 交互测试、真实 XDG reference Store fixture、官方 Workset open smoke 与 VS Code/Cursor GUI 验收。
- 不修改 OpenSpec CLI、Store registry、Workset registry 或其他项目仓库。
