## Why

当前 Project-first Sidebar 只能展示激活项目，用户必须离开现有 OpenSpec 界面才能在官方 Workset 中定位另一个项目。现在 CLI 已能提供 Workset 成员、Store 注册信息和同仓 worktree 路径，应该把这一事实源接入项目导航，让多项目切换仍然保持同一套 Project-bound Changes/Specs/Detail 体验。

## What Changes

- 在 Project-first Sidebar 中，仅当当前 canonical Project 属于官方 CLI Workset 时显示 Workset 导航入口。
- 增加独立的 Workset Project 选择场景：展示当前 Project 所属 Workset、可切换的 Project members、Planning Store members、Git repo/branch 等只读身份信息，并提供返回 Current Project 的路径。
- 选择 Project member 后，由 Extension Host 重新校验官方 Workset membership、canonicalize 路径、创建新的 ProjectContext/OpenSpecRootBinding，并复用现有 Sidebar、All Changes、Specs Explorer、Change Detail 和 Spec Detail。
- 将单一 file watcher 跟随当前选中的 Project；不为整个 Workset 建立 watcher 集合。
- 用官方 `workset list --json`、必要时 `store list --json` 作为 Workset/Store machine-global 真相；Store member 只显示 Planning Store，不可切换为 Project。
- 保持 Store reference、Workflow Delivery/Adapter、root selector、Stores & Worksets 管理面板和 Store 反向消费者索引的现有边界不变。
- 增加隔离 CLI fixture、Webview/Host focused tests 与真实 Extension Development Host 验收，覆盖同仓 Git worktree、多个 Workset、Store member、空态、键盘与窄侧边栏。

## Capabilities

### New Capabilities

- `workset-project-navigation`: 基于官方 Workset membership 的 Project 选择、canonical identity、Project-bound reload 与 watcher retargeting。

### Modified Capabilities

- `dashboard`: Project-first Dashboard 增加 Workset selection scene，并保证选择后复用同一 Project 内容导航与窄栏可访问性。
- `openspec-scope-management`: Workset member 与 Store member 的只读分类、当前 Project membership 约束和 selected Project binding/watcher 语义。

## Impact

- Extension Host：`DashboardViewProvider`、`ProjectDataGateway`、`DataManager`/`FileWatcherService`、CLI service/type contracts、ProjectContext/OpenSpecRootBinding validation。
- Webview：Project-first Dashboard/Header、Workset picker、消息类型与 reducer/state tests；不新增路由、Store mirror 或第二套内容 UI。
- Tests/fixtures：Project gateway/provider/webview tests，以及可隔离 XDG 数据目录的 CLI/Extension Host smoke fixture。
- Runtime：依赖 OpenSpec CLI 的 `workset list --json` 与 `store list --json`；命令不可用时保持当前 Project-first Sidebar 并隐藏 Workset navigation，不阻断 Changes/Specs。
