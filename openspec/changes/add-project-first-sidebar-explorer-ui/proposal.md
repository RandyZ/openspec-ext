## Why

当前 Sidebar 将 Change、Spec、Root 切换、Store 和 Workset 管理集中在同一个 Dashboard 中，使普通工程的高频工作被低频管理能力淹没，也让同名内容可能继续依赖可变的 `selectedScope`。现在 Project 数据网关已经具备显式 Project/root 绑定能力，应以此为基础交付 Project-first 的 Sidebar 与 Editor Explorer，再继续扩展 Workset 跨工程导航。

## What Changes

- 将默认 Sidebar 改为当前工程首页：展示工程身份、active/unarchived Changes 及其 OpenSpec 下一步操作，并提供 “All Changes” 与 “Specs” 入口。
- 新增 Changes Explorer Editor 页面，在同一个 Project/root 绑定下浏览 active 与 archived Changes，并复用已有搜索、生命周期过滤、排序和分页行为。
- 新增 Specs Explorer Editor 页面，分组展示当前工程 canonical Specs 与该工程经 OpenSpec CLI 确认引用的 Store Specs；已注册但未被工程引用的 Store 不得出现。
- 为 Sidebar、Changes Explorer 和 Specs Explorer 提供各自的数据与消息契约，并使页面、详情打开请求和错误状态携带显式 `ProjectContext` / `OpenSpecRootBinding` 身份。
- 复用现有 Change Detail、Spec Detail、workflow actions、delivery adapters、缓存和文件监听能力；本 Change 不重做这些功能。
- **BREAKING（界面）**：默认 Sidebar 不再将 Root selector 与 `StoresAndWorksetsPanel` 作为主界面内容。底层 Store/Workset 与 legacy scope 服务暂不删除，以支持渐进迁移。
- Phase 2/3 明确后置：Workset 工程切换、Git worktree 识别与反向成员关系、Store Change 浏览、全局 Project Registry、workflow delivery 重构和 Change Detail 重设计。

## Capabilities

### New Capabilities

- `project-first-explorers`: 定义显式绑定当前工程的 compact Sidebar、All Changes Editor Explorer、Specs Editor Explorer，以及跨页面的 Project/root 数据隔离和导航行为。

### Modified Capabilities

- `dashboard`: 将主入口从可切换 Root、混合 Store/Workset 管理与全量内容的 Dashboard，调整为只突出当前工程 active work 和 Explorer 入口的 Project-first Sidebar。
- `openspec-scope-management`: 明确默认 Project-first 页面以当前工程的 CLI-resolved root 作为不可变读取绑定，而不是由可变 selected scope 驱动；Store references 仍是只读上下文，legacy 显式 Store scope 服务仅为兼容保留且不得替换当前工程身份。

## Impact

- Extension Host：Sidebar 数据装载、Editor Explorer panel 生命周期、webview message routing，以及 `ProjectDataGateway` 对 archived Changes 和 CLI-confirmed Store references 的只读覆盖。
- Webview：Dashboard/Sidebar 结构、App view context、Changes/Specs Explorer 页面、page-specific DTO 与对应 i18n/可访问状态。
- OpenSpec 数据读取：继续以 CLI root/context/list/list-specs 输出为事实源；不新增 Store/Workset 镜像数据库或插件全局关系缓存。
- 兼容性：现有详情面板、workflow 命令、缓存与 watcher 保持可用；旧 scope/Store/Workset UI 从默认入口退出，但底层服务在后续迁移前保留。
- 依赖与构建：不引入新的运行时依赖或路由库；需要补充 Extension Host 与 React webview 的单元/交互测试。
