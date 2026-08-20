<!-- Distilled from explore.md for add-project-data-gateway. -->

## Why

当前插件用同一个可变 `selectedScope` 同时表达“用户正在查看哪个 Project”和“OpenSpec 数据位于哪个 Root”，导致 CLI 与文件读取存在绑定到不同根的正确性风险，也让后续 Project-first UX 必须继续依赖旧的 root selector 心智模型。现在需要先建立显式、可验证的 Project 数据边界，才能在不重写现有 Dashboard 的前提下渐进迁移。

## What Changes

### MVP

- 新增稳定的 Project 上下文标识，将代码工程身份与 OpenSpec 数据根分离。
- 新增由官方 CLI JSON 结果产生的 OpenSpec Root Binding；普通 Project 从自身工作目录进行 selector-free 解析，只有用户明确选择 Store 时才携带 Store selector。
- 新增只读 Project Data Gateway，使 CLI 状态读取和文件内容读取共享同一不可变 Root Binding。
- 为 Current Project 提供职责单一的 Changes 与 canonical Specs 数据结果，不再扩展大一统 `DashboardData`。
- 保持现有 `DataManager`、Dashboard、Panel、Cache、Watcher 和 workflow action 路径可用，通过窄桥接和对照测试支持后续逐步迁移。
- 明确 canonical Specs、Change delta Specs 与 referenced Store Specs 是不同数据来源；本阶段不把 active Change 下的 delta Specs 混入 canonical Specs。
- 增加本地 Root、CLI 解析到外部 Root、并发 Project 隔离、CLI/ContentAccess 同根和错误边界的测试。

### Phase 2/3（不在本 Change 实现）

- Project-first Sidebar、All Changes Explorer 和 Specs Explorer。
- Workset 内 Project 导航、Git repository/worktree identity、反向 Workset membership 和 Store consumer Project 索引。
- Project-scoped watcher registry、统一 Explorer panel manager 与 workflow delivery 重构。
- 删除 `selectedScope`、Dashboard root selector、旧 Stores & Worksets maintenance UI 及其聚合 DTO；这些工作须在消费者完成迁移后由独立 Change 执行。

本 Change 不归档或同步 `polish-workset-store-root-management-ui`，也不把其中的 root-centric UI requirements 纳入新产品契约。现有 non-destructive Workset removal、JSON CLI 调用、cache refresh 和 capability probe 行为继续保留。

## Capabilities

### New Capabilities

- `project-data-access`: 定义 Project 身份、CLI-owned OpenSpec Root Binding、同根 CLI/ContentAccess 读取、不可变请求上下文，以及 Current Project 的 Changes 与 canonical Specs 数据契约。

### Modified Capabilities

无。本阶段新增并行数据能力，不改变现有 `cli-integration`、`openspec-scope-management`、`extension-cache`、`dashboard` 或 workflow requirements；后续 UX Change 再显式修改或移除旧 scope/root UI 契约。

## Impact

- **Extension Host**：新增 Project 数据访问边界，并复用现有 `OpenSpecCliService`、`StateReader`、`ContentAccess` 与 CLI resolver。
- **共享数据模型**：新增 Project 与 Root Binding 类型，以及少量面向页面的数据 DTO；现有 Webview message contract 默认保持兼容。
- **现有门面**：`DataManager` 保持工作，仅增加最小桥接或对照入口，不在本阶段拆除 scope-aware 路径。
- **Cache 与文件读取**：继续使用现有服务，但新路径的 key 和 `ContentAccess` 必须来自同一显式 binding。
- **测试**：新增 gateway/root-binding 单元测试及与当前 Current Project 读取结果的兼容性检查。
- **依赖与持久化**：不新增依赖、不复制 Store/Workset registry、不新增插件全局事实库。
- **兼容性**：无外部 breaking change；现有 UI 和命令继续使用当前路径，直到后续 Change 完成消费者迁移。
