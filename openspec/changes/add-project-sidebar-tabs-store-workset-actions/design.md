## Context

当前 Project-first 实现把 Sidebar、Changes Explorer、Specs Explorer 分成三条数据路径。`DashboardViewProvider` 在每次打开 Explorer 时重新验证 binding，`ProjectDataGateway` 再分别调用 `context`、`list`、`status`、`list --specs` 和 Store 查询，导致重复 CLI 进程和 click-time 等待。详细问题背景与选择过程见 `explore.md`。

本设计只改变 Project-first 的列表浏览和 Workset 打开入口，不改变 OpenSpec CLI、Store registry、Workset registry、legacy scope 管理或详情 Editor。

## Goals / Non-Goals

**Goals:**

- 用一个 binding-scoped Project Sidebar payload 支撑 Changes / Specs tabs。
- 缓存优先、后台刷新，并在切换 Project 时丢弃不匹配 binding 的结果。
- 使用官方 context/doctor 和 Store selector 显示 referenced Store Specs。
- 通过官方非 JSON `workset open` 打开完整 Workset，并保留 CLI 诊断。
- 让 Project 切换和整个 Workset 打开有明确、可测试的消息与标签。

**Non-Goals:**

- 不在插件中解析或写入 `~/.local/share/openspec/worksets/`、Store registry 或生成 `.code-workspace`。
- 不把 Store member 变成可写 Project，也不增加插件自己的 Project registry。
- 不移除 Change Detail、Spec Detail、workflow、watcher 或 legacy Dashboard 的 Editor 能力。
- 不承诺 Cursor/VS Code 以外工具的额外 opener；工具选择继续由 OpenSpec CLI 决定。

## Decisions

### 1. Host 统一构造 Sidebar 数据，Webview 只切换 tab

扩展现有 `ProjectSidebarData`，加入归档 Changes、Project Specs 和 referenced Store Spec groups；必要时保留现有类型的字段兼容。Gateway 增加一个以当前 Project 为入口的加载路径：先解析一次 `OpenSpecRootBinding`，复用该 binding 的 CLI/content access 读取 Project 数据，并把 Store 查询结果带上独立 Store binding。

```text
DashboardViewProvider
        │ getProjectSidebarData / refresh
        ▼
ProjectDataGateway.loadProjectSidebarData
        │ resolveBindingContext (一次)
        ├── Project Changes + archived Changes
        ├── Project Specs
        ├── context/doctor references
        │     └── list --specs --store <id> + Store binding
        └── selector-free Workset navigation
        ▼
ProjectSidebarData (cache key = Project + root + store)
        ▼
Dashboard: Changes tab │ Specs tab
```

Workset navigation的 Git display metadata可以继续按需加载；它不能阻塞缓存首屏，也不能改变当前 binding。所有异步结果发布前必须比较 Project 与 binding identity。

### 2. 列表浏览留在 Sidebar，详情仍按需打开 Editor

Header 的 All Changes / Specs 动作改为本地 `projectFirstTab` 状态更新。Dashboard 使用现有 `ChangesSection` 和 `SpecsSection` 的列表能力，给 Specs 列表增加 Project/Referenced Store 分组。点击 Change、Spec 详情仍发送现有 binding-aware 消息，保持详情 Editor 的隔离与复用。

```text
click All Changes / Specs
        │
        └── setProjectFirstTab(...)
              └── no host message / no new WebviewPanel

click Change or Spec row
        └── existing detail message + verified binding → Editor detail
```

### 3. Reference 与 Store binding 只由官方 CLI 提供

Project context 优先使用官方 `references`，缺失时兼容 `members[].role=referenced_store`。每个 Store id 通过 `context --store <id> --json` 解析 binding，再调用 `list --specs --json --store <id>`。Store 解析或读取失败只影响对应 Store group，并显示安全错误；禁止从已注册但未引用的 Store 反向推断项目 reference。

### 4. Workset open 使用独立的非 JSON 执行入口

`OpenSpecCliService` 保留现有 JSON 路径，同时提供复用同一 runtime resolver、timeout、stderr 和 exit-code 处理的普通文本命令入口。`DataManager.openWorkset` 使用该入口执行 `['workset', 'open', name]`，不追加 `--json`、不调用 `JSON.parse`。Workset 管理页只发送 Workset name；Project-first picker 的成员按钮只发送现有 Project selection message。

### 5. 性能与缓存

- 首屏先读取现有 binding-scoped project page cache；无缓存时先发布最小 Project/Changes 数据。
- Fresh payload 在同一 binding 下补齐 Specs、归档和 Store groups；tab 切换不重新触发 CLI。
- 在 Gateway/provider 测试中锁定 binding resolve 次数、tab 不创建 panel、Store query 使用正确 selector。
- 不引入新缓存系统；复用 `OpenSpecCacheService`，只扩展已存在的 page payload。

## Risks / Trade-offs

- [Store reference 查询慢] → 先显示 Project Specs 和缓存，Store group 独立显示 loading/error；不阻塞整个 Sidebar。
- [旧缓存缺少新字段] → 由 cache schema/version 校验判定 stale，缺字段时丢弃该页缓存并走 fresh load。
- [CLI Workset open 是外部工具启动] → 保留 CLI 输出、错误和 exit code；UI 显示可恢复诊断，不猜测工具是否成功打开。
- [旧消息仍可能被其他入口调用] → 保留 detail 和 legacy message handler；Project-first 列表动作不再生成 Explorer panel，并补回归测试防止回退。

## Migration Plan

1. 先补 Gateway/CLI/provider/Webview 的 RED 测试，再实现统一 payload、Sidebar tabs 和非 JSON Workset open。
2. 迁移 Project-first Header 的列表入口；保留旧 Explorer 组件与消息类型，直到兼容测试确认无调用方。
3. 使用真实 `aihelp-knowledge-agent` reference Store、临时 XDG Workset 和两个同名 Spec fixture 做 CLI/Host 验收。
4. 若 fresh payload 失败，回退到同 binding 的旧 Sidebar cache；若 Workset open 失败，不修改 Workset 或成员目录。

## Open Questions

- 无阻塞问题。具体 tab 文案沿用现有 i18n key，Project/Store 分组标签由 Specs 设计与测试固定。

## Spec Amendments

- [x] 已确认 Specs 覆盖 Sidebar tabs、binding-scoped cache、referenced Store groups 和官方 Workset open；无需补充。
