## Context

当前 Project-first UI 已有 `ProjectContext`、不可变 `OpenSpecRootBinding`、`ProjectDataGateway`、Project page cache、Sidebar Webview 和 Editor WebviewPanel，但实际 surface 仍有三处割裂：

1. Header 把 All Changes、Specs、Worksets 堆成纵向入口，Changes/Specs 仍可能走 Editor Explorer。
2. `DashboardViewProvider.openInEditor()` 虽然复用单例 Panel，却给它发送 Sidebar context，宽 Editor 最终仍渲染窄 Sidebar 页面。
3. Project 数据按 Changes、Specs、Archives、References、Navigation 分散加载，若为 Dashboard 再做一条路径会重复 root resolution 和缓存。

需求收敛和反编译源码取舍见 `explore.md`。正式行为以本 Change 的五份 delta specs 为准。

## Goals / Non-Goals

**Goals:**

- 用固定 2×2 action launcher 表达 Changes、Specs、动态 Worksets 和 Dashboard。
- Changes、Specs、Worksets 在 Sidebar 内本地切换，Dashboard 使用独立 Editor route。
- 让 Sidebar 与 Project Dashboard 复用一个 binding-scoped Project workspace payload、缓存和 fresh refresh。
- 使用官方 context/Store selector 显示 referenced Store Specs，并阻止同名 Spec 或 Store 数据污染当前 Project。
- 通过官方普通输出 `workset open` 打开整个 Workset，并区分本地 Workset mode、Project switch 和 whole-Workset open。
- 保留 Change/Spec detail、legacy scope/store 管理、watcher、workflow delivery 与错误诊断。

**Non-Goals:**

- 不重构 Change Detail 的 Tasks 分组、Specs 左右分栏、Git history/diff、添加任务或 artifact 写入；这些属于后续 Change。
- 不增加插件自己的 Project/Store/Workset registry、文件系统扫描器、`.code-workspace` 生成器或第二套事实源。
- 不新增 `DashboardDataV2`、Dashboard cache kind、统计服务或图表依赖。
- 不从 Store Specs、proposal/design/spec checkbox 或文件 mtime 猜测 Project task history。
- 不改变 OpenSpec CLI 的工具选择、Store registry、Workset persistence 或命令契约。

## Decisions

### 1. 四宫格是 action launcher，不是统一 tabs

Project-first Sidebar 保留一个本地状态：

```text
ProjectLocalView = changes | specs | worksets
default = changes
reset = accepted Project/root binding changes
```

Changes、Specs 和启用的 Worksets 更新该状态。Dashboard 发送 Host message 并保持当前 local view。四个入口均使用语义化 button；只有本地 view action 使用 `aria-pressed`，整个 grid 不使用 `role=tablist`，因为 Dashboard 不控制同一 Sidebar panel。

New Change 与 Refresh 复用现有 commands，通过 `package.json -> contributes.menus.view/title` 暴露。它们不占四宫格，也不需要新的 Webview message contract。

**选择理由：**混合 launcher 与用户确认的四宫格一致，并避免错误的 tab 可访问性语义。

**未选择：**继续使用四个纵向全宽按钮会浪费窄 Sidebar；把 Dashboard 做成第四个本地 tab 会继续把宽屏内容压缩成 Sidebar 布局。

### 2. 一个 Project workspace payload 服务两个 surface

保留并扩展现有 `ProjectSidebarData`，不并存第二个 Dashboard DTO。目标字段为：

```text
ProjectSidebarData
├─ project
├─ binding
├─ changes
├─ archivedChanges
├─ projectSpecs
├─ referencedStoreSpecs[]
├─ worksetNavigation?
├─ workflowLaunchConfig?
├─ cache?
└─ lastRefresh
```

`ProjectDataGateway` 增加一个统一组装入口：先解析一次 Project binding，再使用该 binding 对应的 CLI/content readers 并行加载 Project Changes、Archives、canonical Specs、references 和 Workset navigation。每个 referenced Store 仍必须独立解析 Store binding；失败只形成该 Store 的 error group。

```text
OpenSpec CLI
    │ context --json (Project，验证一次)
    ▼
Bound Project readers
    ├── list changes/status
    ├── archived content
    ├── list --specs --json
    ├── referenced Store ids
    │      └── context/list --specs --store <id>
    └── workset list + trusted member resolution
                 │
                 ▼
        ProjectSidebarData snapshot
          ┌──────┴──────┐
          ▼             ▼
       Sidebar       Dashboard
```

**选择理由：**现有 payload 已携带 Project/binding/cache identity，扩字段是最小变更。

**未选择：**重命名全部协议类型或新增 `ProjectWorkspaceData` alias 只会产生机械 diff；新增 Dashboard DTO 会形成双缓存和字段漂移。

### 3. Provider 负责 surface-aware 发布和 generation safety

Provider 保留一个 accepted memory snapshot。发布 API 增加 surface 参数，而不是复制两套加载函数：

```text
postProjectData(data, view, targetWebview)
view = sidebar | dashboard
```

消息协议：

| 方向 | Message | 语义 |
| --- | --- | --- |
| Extension → Sidebar | `{ type: 'setContext', view: 'sidebar', data }` | 渲染 launcher 与 local view |
| Extension → Dashboard | `{ type: 'setContext', view: 'dashboard', data }` | 渲染 Project Dashboard |
| Sidebar → Extension | `{ type: 'openProjectDashboard' }` | 调用现有 `openInEditor()` |
| Sidebar → Extension | `selectWorksetProject(...)` | 重新验证并切换 Project |
| Worksets page → Extension | `openWorkset(name)` | 打开整个 Workset |

Dashboard action 的快速路径：

1. 若 memory snapshot 与当前 Project/binding 匹配，创建或 reveal Panel 后立即发送 `view: 'dashboard'`，不启动 CLI。
2. 若没有可用 snapshot，Panel 进入 loading，并使用与 Sidebar 相同的统一加载入口。
3. watcher 或显式 Refresh 接受一个 fresh generation 后，同时向当前 binding 的 Sidebar 和 Dashboard 发布。
4. Project switch 增加 generation；旧请求结果、旧 cache 或旧 Panel target 都不能覆盖新 binding。

**选择理由：**复用现有 `dashboardPanel` 单例、generation guard 和 cache identity。

**未选择：**为 Dashboard 建立独立 provider/cache 会重新引入 click-time scan；使用 module-global panel key 会丢失 Project identity。

### 4. App 使用明确 Dashboard route 和独立组件

`ProjectPageContextMessage` 增加 `view: 'dashboard'`。App route 将 Project Dashboard 与 legacy `Dashboard` 分开：

```text
sidebar          -> Dashboard (现有 Project-first Sidebar 容器)
dashboard        -> ProjectDashboard
changesExplorer  -> legacy/remaining ChangesExplorer caller
specsExplorer    -> legacy/remaining SpecsExplorer caller
changeDetail     -> ChangeDetail
specContent      -> SpecViewer
```

新增一个最小 `ProjectDashboard.tsx`。统计派生函数直接导出自该文件供单元测试使用；不增加 service、context 或依赖。

**选择理由：**独立组件允许宽 Editor 信息密度，同时保留同一个 React bundle 和 App state。

**未选择：**在现有 `Dashboard.tsx` 内继续堆 surface 分支会使 Sidebar/legacy Dashboard/Project Dashboard 三种布局互相影响。

### 5. Dashboard 只展示可由 snapshot 证明的指标

指标定义：

| 指标 | 数据与算法 |
| --- | --- |
| Total Changes | active Changes + archived Changes |
| Active Changes | 当前 Project active Changes 数量 |
| Ready to Verify | `lifecycleStatus === 'ready-to-verify'` |
| Archived | archived Changes 数量 |
| Active Tasks | active Changes 的 `totalTasks` 之和 |
| Completion Rate | active `completedTasks` 总和 / active `totalTasks` 总和 |
| Lifecycle distribution | planning / ready-to-apply / applying / ready-to-verify / archived |
| Artifact Readiness | 每个实际声明 artifact id 的 done / declared 计数 |
| Recent Updates | 按 `lastModified` 降序的有限 Change 列表 |

零任务时 Completion Rate 显示空态或 0%，不能出现 `NaN`。Referenced Store Specs 完全不参与这些值。Artifact rows 按 schema 中实际出现的 id 生成，可对常见 id 使用稳定显示顺序，但不得假设每个 schema 固定存在 Proposal/Design/Tasks/Specs。

状态图使用 CSS 与文本计数；视觉图形为装饰，必须有等价的可访问文本。Recent Updates 替代无可靠数据源的进度时间线。

**选择理由：**全部值都可由现有 snapshot 纯函数派生，测试稳定且不增加 Host 命令。

**未选择：**反编译实现会扫描多个 artifact 的 checkbox 并使用 mtime 拼时间线，无法代表真实 OpenSpec 任务历史。

### 6. Worksets 的三种动作保持粒度隔离

```text
四宫格 Worksets
    └── local Project picker
          └── selectWorksetProject(worksetName, memberPath)

Worksets management card
    └── openWorkset(name)
          └── openspec workset open <name> (ordinary output)
```

只有官方 Workset inventory 中包含当前 canonical Project path 的 Workset 才进入 navigation。Store member 依赖官方 Store inventory 分类且不可选择。navigation unavailable 时 fail closed，四宫格保留 disabled state。

`OpenSpecCliService` 的 ordinary-output 方法复用现有 runtime resolver、spawn、timeout、stderr 和 exit-code 处理；`runJson` 保持不变。

**选择理由：**本地浏览与外部 opener 是不同用户意图，必须用消息类型、标签和测试隔离。

### 7. Cache 与兼容性边界

- 继续使用现有 Project page cache key 和 schema/version 校验；不新增 Dashboard page kind。
- 新字段缺失的旧 payload 视为 stale/invalid，再走 fresh load，不能伪装为空列表。
- Project/root/source/store identity 必须全部匹配才可发布 cache。
- Changes/Specs local click、Worksets local click、Dashboard warm click都不得增加 root-resolution 计数。
- legacy scope-only Dashboard、Store/Workset management、Explorer remaining callers、detail panel 和 watcher routing 保留测试。
- 不删除 Explorer 组件；只移除 Project-first launcher 对它们的调用。

## Risks / Trade-offs

- [统一 payload 首次 fresh load 变重] → cache-first；Project 数据并行加载；Store group 独立失败；Dashboard warm click不触发 fresh。
- [Sidebar 与 Dashboard 同时打开导致重复请求] → Provider 持有一个 in-flight generation 和 accepted snapshot，刷新只组装一次。
- [Dashboard Panel 在 Project switch 后显示旧数据] → 每次发布比较 Project/binding，switch 后立即使旧 generation 失效。
- [Workset inventory 或 Store inventory 不可用] → fail closed，禁用 Worksets local action，不把 Store 当 Project。
- [旧 cache 缺少 archives/specs/groups] → schema validator 判定 stale；不做字段猜测。
- [Artifact schema 可配置] → readiness 从实际 artifact ids 派生，不硬编码固定四项。
- [宽 Dashboard 在窄 Editor 中拥挤] → KPI/summary 使用响应式 CSS grid，文本保持可读，图形不是唯一信息来源。
- [范围继续膨胀到图 3] → Tasks/Specs Detail 明确为 Phase 2，当前任务和验收不触碰相关 parser/viewer 行为。

## Migration Plan

1. 先用 RED Gateway/provider tests 固定统一 payload、binding identity 和多 surface cache 行为。
2. 扩展 payload 与统一 Gateway 组装，保留旧 Project-first字段和 legacy Dashboard 路径。
3. 用 RED Webview tests 固定四宫格顺序、动态 Worksets、本地 view 与 accessibility，再替换 Header 入口。
4. 增加 `view: 'dashboard'`、Dashboard action message 和 Panel warm-open/refresh broadcast。
5. 实现纯派生 Project Dashboard summary，不增加依赖或 cache kind。
6. 修复并验证 ordinary-output Workset open 和三种 Workset action 粒度。
7. 运行真实 reference Store fixture、Extension Development Host GUI 和完整自动化门禁。
8. 回滚时恢复旧 Project-first Header/route；保留向后兼容的 payload字段、legacy paths 和 ordinary CLI helper，不删除用户数据。

## Open Questions

无。用户已选择方案 A：当前 Change 覆盖四宫格、独立 Dashboard 和 Workset 交互；图 3 的 Tasks/Specs Detail 另建后续 Change。

## Spec Amendments

- [x] `project-sidebar-tabs`：补充 2×2 launcher、动态 Worksets、Dashboard route 和 mixed-action accessibility。
- [x] `dashboard`：用 canonical requirement 名称更新 cache/action 行为，并新增 Project Dashboard summary contract。
- [x] `referenced-store-specs`：补充 Store 数据不参与 Project Dashboard 指标。
- [x] `workset-cli-open`：补充 launcher、Project picker 与 whole-Workset open 三种粒度。
- [x] `cli-integration`：明确 ordinary stdout、无 `--json` 和 non-zero diagnostic preservation。
