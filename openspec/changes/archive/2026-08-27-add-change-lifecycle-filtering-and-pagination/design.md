## Context

当前分支已经具备：

- CLI `list/status/show` 驱动的 Change 数据；
- `ChangeInfo.artifacts` 动态 Artifact 数组；
- ChangeCard 搜索元数据、Artifact badge 和任务进度；
- Webview 本地搜索；
- Root/Scope 隔离的数据刷新；
- Archived Change 单独加载与展示；
- ChangeCard 智能 workflow 操作。

本 Change 不改变 OpenSpec CLI 或 Root 解析语义，只在现有分层中建立统一生命周期模型，并把分页接到正确的数据处理顺序中。

当前代码核对补充：`DataManager.runRefresh()` 已在同一次选中 Scope 中并行加载 Active Change、Specs 和 Archived Change，且 `DashboardViewProvider` 会把这份快照发布给 Webview。因此首版直接复用该快照；不增加 Archived 专用查询，也不把分页下沉到 CLI。

实施前置约束：现有 New Change、Archive 和部分创建 Artifact 消息没有始终携带 `scopeId`，而 Workflow Launch 已经有 Scope-aware 路径。实现本 Change 前，必须先让所有 Change 写操作使用同一个显式 Scope 解析结果，并让缓存失效、刷新和成功反馈保持同一 Scope。该约束只保证写入安全，不改变 Project Store 关联或 Root 解析语义。

目标架构：

```text
OpenSpec CLI / Content Access
        |
        v
StateReader
        |
        v
DataManager
  |-- enrich active changes
  |     `-- deriveChangeLifecycleStatus()
  |-- derive ChangeAttention
  |-- build root-scoped status counts
  `-- publish DashboardData
        |
        v
Webview AppContext
  |-- root-scoped ChangesViewState
  `-- active + archived view adapters
        |
        v
ChangesSection
  filter status
  -> filter attention
  -> search
  -> sort
  -> paginate
        |
        +--> ChangeCard
        `--> Pagination
```

## Goals / Non-Goals

**Goals:**

- 使用一个生命周期状态驱动筛选、卡片状态和智能操作。
- 所有状态数量基于当前 Root 的完整数据集。
- 确保筛选发生在分页前。
- 将 Archived 提升为一级状态。
- 每个 Root 独立保存列表视图状态。
- 在 Sidebar 与可复用的宽屏 ChangesExplorer 布局中提供一致但响应式的筛选交互。
- 通过纯函数和单元测试保护状态边界。

**Non-Goals:**

- 不新增 OpenSpec CLI 参数。
- 不实现服务端分页。
- 不改变 Store/Project 的 Root 解析和关联模型。
- 不实现 Workset 侧边栏列表。
- 不重构 Change Detail 的动态 Artifact。
- 不将普通 Artifact `blocked` 自动解释为异常。
- 不实现 Project Store link/unlink、Store Quick View、Add Operation 或 Workset Workspace。
- 不实现动态 Schema Artifact Inventory、Other Artifacts 或基于真实 `outputPath` 的 Explorer 定位。
- 不以设计稿中的 `Draft` / `In Progress` / `Completed` / `Merged` 作为一级筛选值。
- 不以 `Ready to Sync` / `Ready to Archive` / `Blocked` 作为一级筛选值。

## Decisions

### 1. 生命周期由 Extension Host 推导

新增共享纯函数模块：

```text
src/shared/changeLifecycle.ts
```

建议类型：

```ts
export type ChangeLifecycleStatus =
  | 'planning'
  | 'ready-to-apply'
  | 'applying'
  | 'ready-to-verify'
  | 'archived';

export interface ChangeAttention {
  required: boolean;
  reasons: string[];
}

export interface ChangeStatusCounts {
  all: number;
  planning: number;
  readyToApply: number;
  applying: number;
  readyToVerify: number;
  archived: number;
  needsAttention: number;
}
```

Active Change 的领域数据扩展为：

```ts
export interface ChangeInfo {
  name: string;

  /** 临时兼容字段，后续 Change 删除 */
  status: 'draft' | 'in-progress' | 'complete';

  lifecycleStatus: Exclude<ChangeLifecycleStatus, 'archived'>;
  attention?: ChangeAttention;

  completedTasks: number;
  totalTasks: number;
  artifacts?: ArtifactStatus[];
  // existing fields...
}
```

选择 Extension Host 而不是 React 推导的原因：

- Dashboard、ChangeCard、未来命令面板可以共享结果；
- 避免多个 UI 组件复制规则；
- CLI/fallback 差异在 Host 层更容易处理；
- 单元测试不依赖 DOM。

### 2. 生命周期推导使用 Schema Artifact 数组

纯函数签名：

```ts
export function deriveChangeLifecycleStatus(input: {
  artifacts: ArtifactStatus[];
  completedTasks: number;
  totalTasks: number;
}): ActiveChangeLifecycleStatus
```

规则：

```ts
const hasArtifacts = input.artifacts.length > 0;
const allSchemaArtifactsDone =
  hasArtifacts &&
  input.artifacts.every((artifact) => artifact.status === 'done');

if (!allSchemaArtifactsDone || input.totalTasks === 0) {
  return 'planning';
}

if (input.completedTasks <= 0) {
  return 'ready-to-apply';
}

if (input.completedTasks < input.totalTasks) {
  return 'applying';
}

return 'ready-to-verify';
```

边界防御：

```text
completedTasks < 0
completedTasks > totalTasks
空 Artifact id
非法 outputPath
未知 status
```

这些情况不应使 UI 崩溃。系统应：

- 归一化为可显示数据；
- 将生命周期回退到最保守状态；
- 增加 Attention reason；
- 记录日志。

不允许在该模块中硬编码 Artifact id。

### 3. Attention 与 Lifecycle 正交

生命周期回答：

```text
Change 正处于哪个工作阶段？
```

Attention 回答：

```text
该 Change 是否存在需要用户处理的异常？
```

第一版 Attention reason 使用稳定 code，而不是直接将展示文案写入领域模型：

```ts
export type ChangeAttentionReason =
  | 'invalid-task-progress'
  | 'invalid-artifact-status'
  | 'invalid-artifact-path'
  | 'metadata-read-failed'
  | 'validation-failed'
  | 'root-write-unavailable';
```

Webview 使用 i18n 将 code 映射为文案。

### 4. Archived 保持独立存储，进入统一 View Adapter

不强制修改当前 `ArchivedChangeInfo` 为完整 `ChangeInfo`。

新增 Webview 视图模型：

```ts
export type ChangeListItemView =
  | {
      kind: 'active';
      id: string;
      lifecycleStatus: ActiveChangeLifecycleStatus;
      change: ChangeInfo;
    }
  | {
      kind: 'archived';
      id: string;
      lifecycleStatus: 'archived';
      archive: ArchivedChangeInfo;
    };
```

适配函数：

```ts
toActiveListItem(change)
toArchivedListItem(archive)
```

`All` 合并两个数组；其他状态选择对应子集。

Archived 卡片必须只提供只读操作。

### 5. 状态计数由 Host 发布

DashboardData 新增：

```ts
export interface DashboardData {
  changes: ChangeInfo[];
  archivedChanges: ArchivedChangeInfo[];
  changeStatusCounts: ChangeStatusCounts;
  // existing fields...
}
```

计数基于当前 Root：

```text
active changes + archived changes
```

计数不受 Webview：

- search；
- sort；
- page；
- pageSize；

影响。

如果 Archived 仍需延迟加载，则 Host 至少需要发布 `archivedCount`。当前代码已经能够取得归档列表，第一版优先复用现有数据，避免新 CLI 调用。

### 5.1 Root 快照与写入一致性

`DashboardData` 的 `changes`、`archivedChanges`、`changeStatusCounts` 和 `specs` 必须由同一个解析后的 Root 生成。Scope 切换时，旧请求即使晚到也不能覆盖当前 Scope。

所有已有写操作必须沿用同一 Scope 绑定原则：

```text
Webview message(scopeId)
        ↓
DataManager.resolveScope(scopeId)
        ↓
CLI/content access + cache invalidation + refresh
```

如果状态读取失败，Host 不能只返回空 Artifact 数组而丢失原因；应保留稳定 Attention reason，并将生命周期保守回退为 `planning`。

### 6. 过滤与分页使用纯函数管线

新增：

```text
src/webview/utils/changeListPipeline.ts
```

输入：

```ts
export interface ChangesViewState {
  lifecycleStatus: ChangeLifecycleStatus | 'all';
  attentionOnly: boolean;
  query: string;
  sort: ChangeSort;
  page: number;
  pageSize: 10 | 20 | 50;
}
```

输出：

```ts
export interface PaginatedChangeResult {
  items: ChangeListItemView[];
  totalItems: number;
  totalPages: number;
  page: number;
  startIndex: number;
  endIndex: number;
}
```

固定步骤：

```ts
const statusFiltered = filterByLifecycle(allItems, state.lifecycleStatus);
const attentionFiltered = filterByAttention(statusFiltered, state.attentionOnly);
const searched = searchChangeItems(attentionFiltered, state.query);
const sorted = sortChangeItems(searched, state.sort);
const paged = paginateChangeItems(sorted, state.page, state.pageSize);
```

必须使用一个纯函数公开该顺序，避免 React render 中散落多段 filter/slice。

### 7. 状态切换和查询变化重置页码

以下 action 自动设置 `page = 1`：

```text
SET_LIFECYCLE_FILTER
SET_ATTENTION_FILTER
SET_QUERY
SET_SORT
SET_PAGE_SIZE
```

只有：

```text
SET_PAGE
```

直接修改当前页。

数据刷新后，如果当前页超过总页数：

```ts
page = Math.max(1, Math.min(page, totalPages));
```

### 8. Root 级状态存储

推荐状态结构：

```ts
export interface RootChangesViewState {
  [rootKey: string]: ChangesViewState;
}
```

Root key：

```ts
function getChangesViewRootKey(scope: OpenSpecScopeView): string {
  return [
    scope.source,
    scope.id,
    scope.storeId ?? '',
    scope.rootPath,
  ].join('::');
}
```

Webview 初始化：

```text
vscode.getState()
→ 读取当前 Root 的 ChangesViewState
→ 不存在则使用默认值
```

状态变化后：

```text
vscode.setState()
```

切换 Root 时：

- 保存离开 Root 的状态；
- 恢复目标 Root 的状态；
- 不把旧 Root 的页码带入目标 Root。

### 9. UI 结构

ChangesExplorer 宽屏布局（保留给现有/可复用 surface 与组件测试；Project-first 导航不要求新增可达的 Editor Changes 路由）：

```text
Changes                                      [ + New Change ]
17 total · Local ./openspec · Healthy

[All 17] [Planning 5] [Ready 3] [Applying 4] [Verify 2] [Archived 3]

[Search changes...] [Sort: Updated desc] [More Filters]
                                                [Needs Attention]

Change cards...

Showing 1–10 of 17                         [<] [1] [2] [>]
```

Sidebar：

```text
Changes

[Status: Applying (4) v]
[Search...]
[Sort v] [Filter]

Cards...

1–4 of 4
```

状态筛选为单选。`Needs Attention` 放入高级筛选，可与生命周期组合。Header 仅保留 New Change。

当前 Project-first 导航中，Changes 列表保留在 Sidebar，Editor 只要求可达的 Project Dashboard；因此手工验收以 Sidebar Changes 和 Editor Project Dashboard 为准，不为本 Change 新增 ChangesExplorer 路由。

Store 正向 smoke 仅在存在可信 Workset membership / Store reference 时执行。没有可信关联时，手工验收安全禁用态，并由自动化 Root 隔离测试覆盖 Local/Store 不串数据。恢复页码越界的 clamp 由 reducer/组件测试证明；只有真实 fixture 可稳定构造该状态时才追加手工证据。

#### Visual source

`docs/new-design`、`docs/new-design-append`、`docs/new-design-append-2` 只约束布局，不覆盖本 Change 的状态模型。

借：

- v4 Changes Workspace 的结构：状态栏 + Search/Sort + 卡片列表 + 分页；
- v2 Overview 卡片上的细生命周期 badge（如 Ready to apply / Planning）。

不借：

- `Draft` / `In Progress` / `Completed` / `Merged` 作为一级筛选；
- Add Operation、Store Quick View、固定 Artifact stepper、Other Artifacts；
- `Ready to Sync` / `Ready to Archive` / `Blocked` 作为一级筛选。

### 10. ChangeCard 使用生命周期映射

删除或废弃卡片内部独立的阶段推导。

新增纯映射：

```ts
export function getWorkflowActionsForLifecycle(
  lifecycleStatus: ChangeLifecycleStatus
): WorkflowActionRecommendation[]
```

映射：

```text
planning         → Continue + FF
ready-to-apply   → Apply
applying         → Apply
ready-to-verify  → Verify（进入 Verify & Archive）
archived         → 无写操作
```

卡片仍可使用 Artifact 和 Task 数据展示进度，但不能重新推导阶段。

### 11. Archived 迁移

现有底部 Archived accordion 被一级状态替代。

迁移步骤：

1. 保留现有 `getArchivedChanges(scopeId)` 协议。
2. Dashboard 初始数据已有 archived 时直接适配。
3. 如果归档列表仍按需加载，点击 Archived 后请求数据。
4. 数据到达后进入统一管线。
5. 删除旧 accordion UI。
6. 保留 `openArchivedChange` 的只读详情行为。

由于当前刷新已返回 Archived 列表，首版直接执行第 2 步的适配；只有运行时确实改为延迟加载时，才启用第 3 步的按需请求。

### 12. 兼容策略

`ChangeInfo.status` 在本 Change 中不立即删除。

过渡期：

```text
Extension Host：
同时发布 status + lifecycleStatus

New UI：
只读取 lifecycleStatus

Legacy tests/fixtures：
缺少 lifecycleStatus 时使用一次性 adapter
并以专用兼容性测试锁定边界
```

所有生产路径迁移完成后，另开 Change 删除旧字段。

## Message / Data Flow

```text
Dashboard refresh
  -> DataManager.listChangesWithFallback(scope)
  -> normalize artifacts and task progress
  -> derive lifecycle + attention
  -> list archived changes
  -> count lifecycle statuses
  -> dashboardData

Webview receives dashboardData
  -> adapt active + archived items
  -> restore Root ChangesViewState
  -> run changeListPipeline
  -> render status controls, cards, pagination

User selects Applying
  -> SET_LIFECYCLE_FILTER(applying)
  -> page = 1
  -> run pipeline on full Root dataset
  -> paginate applying results
  -> persist Root view state
```

## Error Handling

- 缺失 `lifecycleStatus`：兼容 adapter 推导并记录 warning。
- 任务进度非法：回退到 `planning`，标记 Attention。
- Archived 加载失败：Archived 视图显示 Root 相关错误，不回退到其他 Root。
- 恢复的 page 超界：clamp 到有效页。
- 状态计数与列表数据不一致：以 Host 计数显示，同时记录 debug diagnostic；不得静默读取其他 Root 数据。
- New Change、Archive、Task Toggle、创建 Artifact 或 Workflow Launch 缺少有效 Scope 时，必须阻止隐式 Root 写入并报告可恢复错误；不得回退到另一个候选 Root。

## Testing Strategy

### Shared unit tests

- lifecycle status boundary table；
- invalid task progress；
- dynamic Artifact ids；
- Attention reason mapping；
- workflow action mapping。

### Webview unit tests

- filter → search → sort → paginate 顺序；
- 状态计数不受当前页影响；
- filter/search/sort 重置页码；
- All 合并 archived；
- Archived 只读；
- Root view state 隔离；
- 窄屏状态 selector。

### Extension tests

- DataManager 发布 lifecycleStatus；
- status counts 绑定当前 Root；
- Scope 切换不串数据；
- filesystem fallback 保守推导；
- archived count 和 items 一致。

### Build verification

```bash
pnpm test
pnpm run build
openspec validate add-change-lifecycle-filtering-and-pagination --strict
```

## Risks / Trade-offs

- [Risk] CLI Artifact 数组为空时无法证明规划工件全部完成。  
  → 回退到 `planning`，而不是错误进入 Apply。

- [Risk] 现有 fixtures 没有 `lifecycleStatus`。  
  → 提供短期 adapter，逐步更新 fixtures。

- [Risk] All 包含大量 Archived Change 后列表较长。  
  → 正确分页；未来可增加默认隐藏 Archived 的产品配置，但本 Change 保持 All 语义明确。

- [Risk] Root id 变化导致视图状态无法恢复。  
  → Root key 同时包含 source、id、storeId、rootPath。

- [Risk] Host 计数与 Webview 合并列表不一致。  
  → 增加 contract tests，并在 debug 模式输出差异。

## Migration Plan

1. 新增共享生命周期类型和纯函数，保持旧 status 字段。
2. DataManager 发布 lifecycleStatus、attention 和 counts。
3. 更新 Webview message types 与 fixtures。
4. 新增 ChangeListItem adapter 与纯筛选分页管线。
5. 实现宽屏状态栏、窄屏 selector 和分页。
6. 将 Archived 迁移为一级筛选并删除旧 accordion。
7. 将 ChangeCard 智能操作切换到 lifecycleStatus。
8. 实现 Root 级 view state 持久化。
9. 完成 i18n、可访问性、测试和构建。
10. 后续独立 Change 删除 legacy `status`。

实施顺序补充：在第 1 步和第 2 步之间先完成 Scope-aware 写操作前置修复，验证 Local/Store 同名 Change 隔离后，再接入列表筛选与分页 UI。

Rollback：

- UI 可以回退到旧 ChangesSection 分组；
- Host 新字段为增量字段，不破坏旧消费者；
- 无持久化数据迁移，仅存在 Webview state，可安全忽略或清除。

## Open Questions

无阻塞性 Open Question。

默认决策：

- `All` 包含 Archived；
- 状态计数不随搜索变化；
- 默认 pageSize 为 10；
- 默认状态为 `All`；
- `Needs Attention` 默认关闭；
- 状态控件宽屏使用 segmented controls，窄屏使用 select。
