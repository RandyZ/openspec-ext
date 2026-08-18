## MODIFIED Requirements

### Requirement: Change List Display

系统 SHALL 基于统一的 Change 生命周期状态展示当前 OpenSpec Root 下的所有 Active 与 Archived Change，并提供可扫描的摘要、时间、Artifact 与进度信息。

生命周期状态 MUST 为：

- `Planning`
- `Ready to Apply`
- `Applying`
- `Ready to Verify`
- `Archived`

系统 MUST NOT 把 `Draft`、`In Progress`、`Completed` 或 `Merged` 作为 Changes Workspace 的一级筛选值。

#### Scenario: Changes expose lifecycle status

- **GIVEN** 当前 Root 中存在处于不同工作阶段的多个 Change
- **WHEN** Dashboard 加载完成
- **THEN** 每个 Change MUST 具有且仅具有一个生命周期状态
- **AND** Active Change 的状态 MUST 由 Schema Artifact 状态与任务进度统一推导
- **AND** Archived Change MUST 显示为 `Archived`
- **AND** 生命周期状态 MUST 与 ChangeCard 推荐操作使用同一份状态数据

#### Scenario: Empty state

- **GIVEN** 当前筛选结果没有任何 Change
- **WHEN** Changes Workspace 渲染
- **THEN** 系统 MUST 展示与当前 Root 和当前筛选条件相关的空状态
- **AND** 非 Archived 状态的空状态 SHOULD 展示创建新 Change 的入口
- **AND** Archived 空状态 MUST NOT 展示会创建或修改 Change 的操作

#### Scenario: Change card shows created and updated metadata

- **GIVEN** 某个 Change 具有可解析的创建时间、更新时间和任务数据
- **WHEN** 该 Change 显示在 Dashboard 中
- **THEN** 卡片 MUST 按以下层级展示信息：Change 名称、生命周期状态、Proposal Why 摘要、Artifact 状态、时间信息、任务进度
- **AND** 时间信息 MUST 单独成行展示 `Created` 与 `Updated`
- **AND** 任务进度 MUST 以任务文本摘要和可视进度指示共同呈现

#### Scenario: Missing created time falls back gracefully

- **GIVEN** 某个 Change 没有可用的 `createdAt`
- **WHEN** 该 Change 显示在 Dashboard 中
- **THEN** 卡片 MUST 继续正常展示
- **AND** 系统 MUST 隐藏 `Created` 而不是显示错误占位
- **AND** 如果存在可解析的更新时间，系统 MUST 继续展示 `Updated`

#### Scenario: Proposal Why summary display

- **GIVEN** 某个 Change 的 `proposal.md` 中存在 `## Why` 内容
- **WHEN** 该 Change 显示在 Dashboard 中
- **THEN** 卡片 MUST 在标题下方展示 Proposal Why 摘要
- **AND** 可见摘要 MUST 限制为适合卡片阅读的简短文本
- **AND** 当摘要被截断时，系统 MUST 通过 tooltip 或等价的可访问提示暴露完整内容

#### Scenario: Missing Proposal Why summary

- **GIVEN** 某个 Change 没有 Proposal 或没有可解析的 `## Why` 内容
- **WHEN** 该 Change 显示在 Dashboard 中
- **THEN** 卡片 MUST 继续可见
- **AND** 系统 MUST NOT 向用户暴露摘要提取错误

#### Scenario: Search changes by loaded metadata

- **GIVEN** Dashboard 已加载当前 Root 的 Change 列表
- **WHEN** 用户在搜索框中输入查询
- **THEN** 系统 MUST 基于已加载元数据在本地过滤 Change
- **AND** 匹配范围 MUST 包含 Change 名称、生命周期状态、Artifact 标识、Artifact 状态、Proposal Why 摘要与完整文本
- **AND** Archived Change 的匹配范围 MUST 至少包含名称和归档日期
- **AND** 系统 MUST NOT 因每次键入而触发新的 OpenSpec CLI 刷新

#### Scenario: Search empty result

- **GIVEN** Dashboard 已加载 Change 列表
- **WHEN** 用户输入的查询没有匹配任何 Change
- **THEN** 系统 MUST 展示空搜索结果提示
- **AND** 系统 MUST 保留当前状态筛选和 Root 上下文

## ADDED Requirements

### Requirement: Change lifecycle derivation

Extension Host SHALL 为每个 Active Change 推导统一的生命周期状态，并将其作为 Dashboard 和 workflow 推荐的唯一状态来源。

#### Scenario: Planning status

- **GIVEN** 某个 Change 的 Schema Artifact 尚未全部完成
- **OR** 该 Change 尚无 Tasks
- **WHEN** Extension Host 构建 DashboardData
- **THEN** 该 Change 的生命周期状态 MUST 为 `planning`

#### Scenario: Ready to Apply status

- **GIVEN** 某个 Change 的必要 Schema Artifact 全部为 `done`
- **AND** 该 Change 存在一个或多个 Task
- **AND** 已完成 Task 数为 0
- **WHEN** Extension Host 构建 DashboardData
- **THEN** 该 Change 的生命周期状态 MUST 为 `ready-to-apply`

#### Scenario: Applying status

- **GIVEN** 某个 Change 存在一个或多个 Task
- **AND** 已完成 Task 数大于 0 且小于 Task 总数
- **WHEN** Extension Host 构建 DashboardData
- **THEN** 该 Change 的生命周期状态 MUST 为 `applying`

#### Scenario: Ready to Verify status

- **GIVEN** 某个 Change 的 Task 总数大于 0
- **AND** 已完成 Task 数等于 Task 总数
- **WHEN** Extension Host 构建 DashboardData
- **THEN** 该 Change 的生命周期状态 MUST 为 `ready-to-verify`

#### Scenario: Schema artifacts are dynamic

- **GIVEN** 当前 Change 使用自定义 Schema
- **WHEN** 系统判断必要 Artifact 是否全部完成
- **THEN** 系统 MUST 使用 CLI 返回的 Schema Artifact 列表与状态
- **AND** 系统 MUST NOT 仅硬编码 Proposal、Specs、Design、Tasks
- **AND** Schema 未定义的其他工件 MUST NOT 阻塞生命周期推进

#### Scenario: Blocked artifact is not automatically an attention error

- **GIVEN** 某个 Artifact 因正常依赖关系处于 `blocked`
- **WHEN** 系统计算 Needs Attention
- **THEN** 系统 MUST NOT 仅因为该 Artifact 为 `blocked` 就标记 Needs Attention
- **AND** 该 Change MAY 继续处于 `planning`

### Requirement: Lifecycle status filter and counts

Changes Workspace SHALL 提供一级生命周期状态筛选，并展示当前 Root 的全量状态计数。

#### Scenario: Status controls show full root counts

- **GIVEN** 当前 Root 已加载 Active 与 Archived Change
- **WHEN** Changes Workspace 渲染状态筛选
- **THEN** 系统 MUST 展示 `All`、`Planning`、`Ready to Apply`、`Applying`、`Ready to Verify`、`Archived`
- **AND** 每个状态 MUST 显示当前 Root 下的全量数量
- **AND** 数量 MUST NOT 只统计当前页
- **AND** 数量 MUST NOT 因当前搜索词或排序方式改变

#### Scenario: Selecting a status filters the full dataset

- **GIVEN** 当前 Root 的 Change 分布在多个分页中
- **WHEN** 用户选择某个生命周期状态
- **THEN** 系统 MUST 先从当前 Root 的完整数据集中筛选该状态
- **AND** 系统 MUST 再对筛选结果执行搜索、排序和分页
- **AND** 系统 MUST NOT 只筛选当前页

#### Scenario: All includes archived changes

- **GIVEN** 当前 Root 同时存在 Active 与 Archived Change
- **WHEN** 用户选择 `All`
- **THEN** 系统 MUST 同时展示 Active 与 Archived Change
- **AND** Archived Change MUST 使用只读视觉与只读操作

#### Scenario: Narrow sidebar uses compact status selector

- **GIVEN** Dashboard 显示在窄侧边栏
- **WHEN** 横向空间不足以展示全部状态按钮
- **THEN** 系统 MUST 将状态筛选降级为紧凑的可访问选择控件
- **AND** 紧凑控件 MUST 使用与宽屏状态栏相同的状态值和数量

#### Scenario: Filter labels follow lifecycle status, not design-mockup tabs

- **GIVEN** `docs/new-design*` 高保真稿使用 `In Progress` / `Draft` / `Archived` / `Merged` 等标签
- **WHEN** Changes Workspace 渲染一级状态筛选
- **THEN** 系统 MUST 展示 `All`、`Planning`、`Ready to Apply`、`Applying`、`Ready to Verify`、`Archived`
- **AND** 系统 MUST NOT 将 `Draft`、`In Progress`、`Completed` 或 `Merged` 作为一级筛选值
- **AND** 筛选控件布局 MAY 参考这些设计稿的 Changes Workspace 结构（状态栏、搜索排序行、卡片列表、分页）
- **AND** Header 主 CTA MUST 为 New Change，MUST NOT 渲染 Add Operation

### Requirement: Deterministic filter, sort, and pagination pipeline

Changes Workspace SHALL 以确定且可测试的顺序处理状态筛选、搜索、排序和分页。

处理顺序 MUST 为：

```text
Current Root dataset
→ lifecycle status
→ advanced filters
→ search
→ sort
→ pagination
```

#### Scenario: Pagination runs after filtering

- **GIVEN** 当前 Root 有 37 个 Change
- **AND** 其中 11 个为 `Applying`
- **WHEN** 用户选择 `Applying`
- **THEN** 分页总数 MUST 基于 11 个筛选结果
- **AND** 第一页 MUST 显示筛选结果的第 1 页
- **AND** 页面 MUST NOT 显示“当前页中碰巧属于 Applying 的数量”

#### Scenario: Filter change resets page

- **GIVEN** 用户当前位于第 3 页
- **WHEN** 用户修改生命周期状态、Needs Attention、搜索词或排序方式
- **THEN** 当前页 MUST 重置为第 1 页

#### Scenario: Page size changes

- **GIVEN** 当前结果超过一页
- **WHEN** 用户修改每页数量
- **THEN** 系统 MUST 使用新的每页数量重新分页
- **AND** 当前页 MUST 重置为第 1 页
- **AND** 系统 SHOULD 提供 10、20、50 的预设值

#### Scenario: Page navigation is accessible

- **GIVEN** 当前结果存在多个分页
- **WHEN** 用户使用鼠标、键盘或辅助技术访问分页控件
- **THEN** 上一页、下一页和页码 MUST 具有可感知名称
- **AND** 不可用的分页操作 MUST 被正确禁用
- **AND** 页面 MUST 显示当前结果范围和结果总数

### Requirement: Archived as a first-class lifecycle view

Changes Workspace SHALL 将 Archived 作为一级生命周期状态，而不是仅作为列表底部的折叠区域。

#### Scenario: Select Archived

- **GIVEN** 当前 Root 存在 Archived Change
- **WHEN** 用户选择 `Archived`
- **THEN** 系统 MUST 展示该 Root 的 Archived Change
- **AND** 系统 MUST 支持对归档名称和归档日期搜索
- **AND** 系统 MUST 支持排序和分页
- **AND** 所有归档项 MUST 为只读

#### Scenario: Archived data remains root-scoped

- **GIVEN** 用户从 Local Root 切换到 Store Root
- **WHEN** 用户选择 `Archived`
- **THEN** 系统 MUST 仅展示 Store Root 的 Archived Change
- **AND** 系统 MUST NOT 显示 Local Root 的归档数据

#### Scenario: Old archive accordion is removed

- **GIVEN** Archived 已作为一级状态筛选提供
- **WHEN** Changes Workspace 渲染
- **THEN** 系统 MUST NOT 再在列表底部展示重复的 Archived 折叠区域

### Requirement: Needs Attention filter

Changes Workspace SHALL 提供与生命周期状态正交的 `Needs Attention` 高级筛选。

#### Scenario: Attention can combine with lifecycle status

- **GIVEN** 当前 Root 同时存在正常和需关注的 Applying Change
- **WHEN** 用户选择 `Applying` 并启用 `Needs Attention`
- **THEN** 系统 MUST 仅展示同时满足两个条件的 Change
- **AND** 状态筛选仍 MUST 保持单选

#### Scenario: Normal planning dependency is not attention

- **GIVEN** 某个 Planning Change 仅因为上游 Artifact 未完成而存在 `blocked` Artifact
- **WHEN** 用户启用 `Needs Attention`
- **THEN** 该 Change MUST NOT 仅因此被包含

### Requirement: Root-scoped Changes view state

Changes Workspace SHALL 为每个 OpenSpec Root 独立保存用户的列表视图状态。

视图状态至少包括：

- 生命周期筛选；
- Needs Attention；
- 搜索词；
- 排序方式；
- 页码；
- 每页数量。

#### Scenario: Switching roots restores independent filters

- **GIVEN** Local Root 的筛选为 `Applying`
- **AND** Store Root 的筛选为 `Ready to Verify`
- **WHEN** 用户在两个 Root 之间切换
- **THEN** 系统 MUST 分别恢复各 Root 上次使用的筛选状态
- **AND** 一个 Root 的分页状态 MUST NOT 覆盖另一个 Root

#### Scenario: Invalid restored page is clamped

- **GIVEN** 保存的当前页超出刷新后的总页数
- **WHEN** 系统恢复 Changes View State
- **THEN** 系统 MUST 将页码限制到有效范围
- **AND** 系统 MUST NOT 渲染空白的无效页

### Requirement: Root-consistent dashboard mutations

Dashboard SHALL bind every Change-mutating action to the same resolved OpenSpec Root that supplied the visible Change list.

#### Scenario: New Change targets the visible Root

- **GIVEN** 用户正在查看某个 Local 或 Store Root
- **WHEN** 用户从 Dashboard 创建 New Change
- **THEN** 消息 MUST 携带当前 Root 的稳定 scope 标识
- **AND** Extension Host MUST 使用该 scope 解析目标 Root
- **AND** 新 Change MUST 创建在该 Root，而不是 CLI 的隐式默认 Root

#### Scenario: Archive targets the visible Root

- **GIVEN** 当前列表中存在一个来自选中 Root 的 Change
- **WHEN** 用户从卡片或命令入口归档该 Change
- **THEN** Archive、缓存失效和刷新 MUST 使用同一个 Root
- **AND** 系统 MUST NOT 归档另一个 Root 中的同名 Change

#### Scenario: Scope-bound writes are isolated

- **GIVEN** Local Root 和 Store Root 中存在同名 Change
- **WHEN** 用户在其中一个 Root 执行 Task Toggle、创建 Artifact 或 Workflow Launch
- **THEN** 操作 MUST 只影响当前可见 Root
- **AND** 另一个 Root 的 Change、计数和缓存 MUST 保持不变

### Requirement: Same-root lifecycle data and diagnostics

Dashboard SHALL derive lifecycle counts, Active Change data, Archived Change data and Attention diagnostics from one resolved Root snapshot.

#### Scenario: Archived data reuses the refresh snapshot

- **GIVEN** `DataManager` 为当前 Root 刷新 Dashboard
- **WHEN** Active Change、Specs 和 Archived Change 数据返回
- **THEN** Archived 首版 MUST 直接适配该次刷新已返回的列表
- **AND** 系统 MUST 不因状态筛选或分页额外触发 CLI 刷新

#### Scenario: Status read failure is distinguishable from empty artifacts

- **GIVEN** 某个 Change 的状态读取或 Artifact 解析失败
- **WHEN** Extension Host 构建 DashboardData
- **THEN** Change MUST 回退到保守的 `planning` 生命周期
- **AND** MUST 标记 `Needs Attention` 及稳定诊断原因
- **AND** 系统 MUST NOT 把读取失败静默当作合法的空 Artifact 列表

#### Scenario: Stale Root response is ignored

- **GIVEN** 用户在刷新期间切换到另一个 Root
- **WHEN** 旧 Root 的异步响应晚于目标 Root 响应到达
- **THEN** 旧 Root 的 Change、Archived 数据和计数 MUST NOT 覆盖当前 Dashboard
