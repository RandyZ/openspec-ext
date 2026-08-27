## Why

Changes Workspace 即将加入分页，但当前 Change 只使用 `draft / in-progress / complete` 三种粗粒度状态，并且状态分组、智能操作和 Archived 浏览分别使用不同逻辑。

如果直接在现有实现上加入分页，用户可能只能筛选当前页，无法看到当前 Root 下某一状态的完整 Change 集合；同时状态标签与 ChangeCard 推荐操作可能不一致。

系统需要一个统一、可测试、Root 隔离的 Change 生命周期模型，使用户可以按真实工作阶段管理 Change。

## What Changes

- 新增统一的 `ChangeLifecycleStatus`：
  - `planning`
  - `ready-to-apply`
  - `applying`
  - `ready-to-verify`
  - `archived`
- 新增正交的 `Needs Attention` 诊断维度，不把正常的 Artifact `blocked` 状态误判为异常。
- 由 Extension Host 基于 Schema Artifact 状态和任务进度统一推导生命周期。
- Changes Workspace 顶部增加一级状态筛选和当前 Root 的全量状态计数。
- 固定数据处理顺序为：状态筛选 → 高级筛选 → 搜索 → 排序 → 分页。
- 将 Archived 提升为一级状态，并允许与 Active Change 一起进入 `All` 视图。
- 状态、搜索、排序或高级筛选发生变化时，页码自动重置到第一页。
- 每个 OpenSpec Root 独立保存筛选、排序、页码和每页数量。
- ChangeCard 直接消费统一生命周期状态，并使用同一映射生成 Continue、FF、Apply、Verify 等智能操作。
- Changes Workspace 筛选控件布局可参考 `docs/new-design*` 的 Changes Workspace，但一级筛选标签必须使用上述生命周期状态，不得使用稿中的 `Draft` / `In Progress` / `Completed` / `Merged`。
- Header 仅保留 New Change，不增加 Add Operation。
- 保留当前 `status` 字段作为短期兼容层，待所有消费者迁移后再删除。
- 在进入本 Change 的 UI 实施前，所有已有的 Change 写操作 MUST 显式绑定当前有效 Root；至少覆盖 New Change、Archive、Task Toggle、创建 Artifact 和 Workflow Launch，避免 Store 视图中的操作写入 Local Root。
- Archived 首版复用 `DataManager` 当前刷新流程已加载的同一 Root 数据，不新增服务端分页或重复 CLI 查询。

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `dashboard`: 增加 Change 生命周期状态、状态计数、一级状态筛选、Archived 一级视图、筛选后分页和 Root 级视图状态。
- `workflow-control`: ChangeCard 智能操作改为消费统一生命周期状态，避免重复推导和状态/操作不一致。

## Impact

- Extension Host:
  - 新增纯函数生命周期推导与状态计数。
  - `DataManager` 在发布 DashboardData 前为 Active Change 补充生命周期和 Attention 信息。
  - Archived 数据参与状态计数和列表视图适配。
- Shared types:
  - `ChangeLifecycleStatus`
  - `ChangeAttention`
  - `ChangeStatusCounts`
  - `ChangeListItemView`
- Webview:
  - `ChangesSection` 增加状态筛选、排序和分页管线。
  - `ChangeCard` 展示统一生命周期状态。
  - `Dashboard`/`AppContext` 保存当前 Root 的 Changes View State。
- i18n:
  - 生命周期状态、筛选计数、分页、空状态和 Attention 文案。
- Tests:
  - 生命周期边界测试。
  - 筛选顺序和分页重置测试。
  - Root 切换状态隔离测试。
  - Archived 与 All 视图测试。
  - ChangeCard 状态和智能操作一致性测试。
  - 写操作 scope 绑定和 Local/Store 同名 Change 隔离测试。

## Non-Goals

- 不实现项目 Store link/unlink。
- 不实现 Workset 侧边栏列表。
- 不实现 Store Quick View。
- 不实现 Add Operation、Store 关联 Modal，或设计稿中的 `Draft` / `In Progress` / `Completed` / `Merged` 一级筛选。
- 不以 `Ready to Sync` / `Ready to Archive` / `Blocked` 作为一级筛选值。
- 不实现服务端分页或新增 CLI 参数。
- 不重构 Change Detail 的动态 Artifact Tab。
- 不实现 Project Store 关联、Store Quick View 或 Workset 工作区；这些仍由独立 Change 负责。
- `docs/new-design*` 只提供布局参考，不覆盖本 Change 的生命周期状态模型。
