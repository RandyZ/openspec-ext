<!-- Exploration output for openspec/changes/<change>/explore.md — input for proposal, not the contract. -->

## Clarified requirements and constraints

- Project-first 的 Changes 与 Specs 必须在同一个 Sidebar 中查看，并通过 tab 切换；不能再通过 `createWebviewPanel` 打开列表 Explorer。
- Change Detail 与 Spec Detail 仍可作为独立 Editor 详情页；本 Change 只替换列表/浏览入口。
- 首次打开 Sidebar 应优先显示缓存或最小可用 Project 数据，Changes、Specs、referenced Store Specs 在同一 Project binding 下复用数据，不能为每个 tab 重复解析 `context --json`。
- Project 声明的 Store reference 必须来自官方 CLI 的 `context --json`/`doctor --json`，Store Specs 必须使用官方 `list --specs --json --store <id>`，并携带 Host 验证过的 Store binding。
- Workset 管理页的“打开工作集”必须直接调用官方 `openspec workset open <name>`。该命令没有 JSON 模式，插件不得用 `runJson` 或自行生成 `.code-workspace`。
- Project-first Workset picker 中的成员操作只表示“切换到 Project”；Workset 管理页中的操作才表示“打开整个 Workset”，两者不能都显示模糊的 Open。
- 保留 legacy scope/store 管理、现有 Change Detail/Spec Detail、文件 watcher 与 Store/Workset 官方机器级事实源，不新增插件自己的 Store 或 Workset registry。
- 真实验收使用声明了 `aihelp-workspace` reference 的 `aihelp-knowledge-agent`，并检查当前项目 Specs、referenced Store Specs 以及 Workset CLI 行为。

## Agreed design direction

采用“Host 统一加载、Sidebar 本地切 tab、CLI 负责 Workset 打开”的方向：

```text
Project binding
      │
      ▼
Project workspace payload
  ├─ Changes + archived Changes
  ├─ Project Specs
  ├─ Referenced Store Specs + Store bindings
  └─ Workset navigation
      │
      ▼
Project Sidebar
  ├─ Changes tab
  └─ Specs tab

Worksets 管理页 ──> openspec workset open <name>（非 JSON）
```

Sidebar 初始路径先尝试当前 binding 的缓存，随后由 Host 统一刷新需要的数据；tab 切换只更新 Webview 状态，不启动新的 Editor Explorer。Host 仍在切换 Project 或打开 Store Spec 前验证 binding，防止同名 Change/Spec 串 root。

## Key decisions

- 复用现有 `ProjectSidebarData`、`ProjectChangesExplorerData`、`ProjectSpecsExplorerData` 的字段语义，优先扩展当前 Project-first payload，而不是再建立一套 Store/Workset 数据库。
- 将 referenced Store Specs 作为 Specs tab 的分组数据；未引用 Store 不显示，Store 查询失败显示可理解的 fail-soft 状态，不把项目误判为 Store。
- 保留按需读取 Change/Spec 内容的详情面板，列表浏览不再打开 Editor panel。
- 为 `OpenSpecCliService`/`DataManager` 增加非 JSON 的 Workset open 调用路径，保留官方 CLI 输出与错误；不得给 `workset open` 追加 `--json`。
- 用最小的性能回归测试锁定：一次 Sidebar 刷新复用 binding、All Changes/Specs tab 不触发 panel 创建或重复 CLI；用真实 CLI fixture 验证 `aihelp-workspace` reference 和 Store binding。
