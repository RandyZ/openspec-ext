## MODIFIED Requirements

### Requirement: Change List Display
系统 SHALL 将 dashboard 收缩为当前工程的 compact sidebar home，并仅直接展示当前工程的 active / unarchived changes。

Sidebar MUST 显示当前工程身份、active changes，以及 All Changes 和 Specs 入口。Draft / Active / Completed 的全量分组展示不再属于 sidebar 主界面。

#### Scenario: Sidebar shows only current-project active work
- **GIVEN** 当前工程同时存在 active changes 和 archived changes
- **WHEN** 用户打开 OpenSpec sidebar
- **THEN** sidebar MUST 显示当前工程身份
- **AND** sidebar MUST 仅展示该工程的 active changes
- **AND** archived changes MUST NOT 出现在 compact sidebar 主列表中
- **AND** All Changes 与 Specs 入口 MUST 保持可见

#### Scenario: No active changes still keeps entry points
- **GIVEN** 当前工程没有 active changes
- **WHEN** 用户打开 OpenSpec sidebar
- **THEN** 系统 MUST 展示空状态提示
- **AND** 系统 MUST 继续提供 All Changes 与 Specs 入口

#### Scenario: Changes grouped by status
- **GIVEN** 当前工程存在处于不同生命周期的 Changes
- **WHEN** 用户打开 All Changes Explorer
- **THEN** Explorer MUST 按 lifecycle 状态展示 Changes
- **AND** Sidebar MUST 继续只展示 active / unarchived Changes

#### Scenario: Empty state
- **GIVEN** 当前工程没有 active Change
- **WHEN** 用户打开 Sidebar
- **THEN** Sidebar MUST 展示 active work 空状态
- **AND** New Change、All Changes 与 Specs 入口 MUST 保持可用

#### Scenario: Change card shows created and updated metadata
- **GIVEN** 某个可见 Change 同时具有可解析的创建时间、更新时间和任务数据
- **WHEN** 该 Change 显示在 Sidebar 或 Changes Explorer 中
- **THEN** 卡片 MUST 保留名称、Proposal Why、artifact 状态、时间和任务进度的可扫描信息

#### Scenario: Missing created time falls back gracefully
- **GIVEN** 某个 Change 没有可用的 `createdAt`
- **WHEN** 该 Change 显示在 Sidebar 或 Changes Explorer 中
- **THEN** 卡片 MUST 正常展示并隐藏 `Created`
- **AND** 可用的 `Updated` 信息 MUST 继续显示

#### Scenario: Proposal Why summary display
- **GIVEN** 某个 Change 的 proposal 包含 `## Why`
- **WHEN** 该 Change 卡片显示
- **THEN** 卡片 MUST 展示简短 Why 摘要
- **AND** 截断时 MUST 提供可访问的完整文本提示

#### Scenario: Missing Proposal Why summary
- **GIVEN** 某个 Change 没有可读取的 Proposal Why
- **WHEN** 该 Change 卡片显示
- **THEN** 卡片 MUST 继续可见
- **AND** 系统 MUST NOT 向用户暴露摘要提取错误

#### Scenario: Search changes by loaded metadata
- **GIVEN** Changes Explorer 已加载当前 Project/root 的 Change 数据
- **WHEN** 用户输入搜索条件
- **THEN** Explorer MUST 在已加载数据中本地过滤名称、状态、artifact 与 Proposal Why 元数据
- **AND** 每次键入 MUST NOT 触发新的 CLI 刷新

#### Scenario: Search empty result
- **GIVEN** Changes Explorer 已加载 Change 数据
- **WHEN** 查询没有匹配项
- **THEN** Explorer MUST 展示空搜索结果
- **AND** 当前 Project/root 绑定 MUST 保持不变

### Requirement: Change Navigation
系统 SHALL 允许用户从 sidebar 中进入 change 详情，并在卡片的 hover 与 focus 状态下提供不会干扰主导航的 workflow 快捷操作。

#### Scenario: Click to open current-project change
- **GIVEN** sidebar 中展示了某个 current-project change
- **WHEN** 用户点击卡片的非操作区域
- **THEN** 系统 MUST 打开该 change 的 detail 视图
- **AND** detail 视图 MUST 仍然绑定到当前 ProjectContext / OpenSpecRootBinding

#### Scenario: Quick actions do not steal card navigation
- **GIVEN** 卡片上展示了 workflow 快捷操作
- **WHEN** 用户点击某个快捷操作按钮
- **THEN** 系统 MUST 执行对应操作
- **AND** 系统 MUST NOT 同时触发打开 change 详情的卡片点击行为

#### Scenario: Click to open change
- **GIVEN** Sidebar 或 Changes Explorer 中展示了某个 Change
- **WHEN** 用户点击卡片的非操作区域
- **THEN** 系统 MUST 打开该 Change 的 detail 视图
- **AND** detail MUST 使用来源页面的 ProjectContext / OpenSpecRootBinding

#### Scenario: Hover and focus reveal workflow actions
- **GIVEN** 某张 active Change 卡片具有可用 workflow 操作
- **WHEN** 用户 hover 卡片或通过键盘将焦点移入卡片
- **THEN** 系统 MUST 展示可键盘触发的快捷操作
- **AND** 操作区 MUST NOT 干扰卡片主体阅读

### Requirement: Real-time Updates
The system SHALL reflect current-project file system changes and extension-triggered state changes without requiring manual refresh.

#### Scenario: New change created
- **GIVEN** sidebar is open for the current project
- **WHEN** a new change is created (via CLI or other means)
- **THEN** the new change MUST appear in the current-project sidebar

#### Scenario: Task completion updates current-project sidebar state
- **GIVEN** a change in the current-project sidebar
- **WHEN** the last task is marked complete in file or via UI
- **THEN** the sidebar MUST refresh the displayed change state for that project

#### Scenario: Change deleted
- **GIVEN** a change displayed in the sidebar
- **WHEN** the change is deleted from the file system
- **THEN** it MUST be removed from the sidebar
- **AND** no error SHOULD be shown

#### Scenario: Sidebar receives refreshed project data
- **GIVEN** the OpenSpec sidebar is open
- **WHEN** the extension host refreshes current-project data because of file watcher events, task writes, new change, archive, or manual refresh
- **THEN** the sidebar MUST receive the latest project-bound data without requiring the user to click a reload button
- **AND** the active change list and navigation entry points MUST reflect the refreshed data

#### Scenario: Task completion updates status
- **GIVEN** 当前工程的 Change 显示在 Sidebar 或 Changes Explorer
- **WHEN** 最后一个 task 被标记完成
- **THEN** 当前 Project/root 的生命周期与进度 MUST 刷新
- **AND** 其他 Project 的页面数据 MUST NOT 被替换

#### Scenario: Sidebar receives refreshed dashboard data
- **GIVEN** Project-first Sidebar 已打开
- **WHEN** watcher、任务写入、新建、归档或手动刷新触发数据更新
- **THEN** Sidebar MUST 接收最新的 project-bound payload
- **AND** active Changes 与入口数量 MUST 同步更新

#### Scenario: Existing cache avoids click-time reload
- **GIVEN** 当前 Project/root 的有效数据已经加载
- **WHEN** 用户 reveal Sidebar 或打开详情
- **THEN** 系统 MUST 复用有效缓存
- **AND** 单次点击 MUST NOT 触发额外的全量 OpenSpec 扫描

### Requirement: Cache-aware dashboard rendering
Dashboard SHALL render valid cached current-project sidebar data while fresh data is being loaded.

Cached sidebar data MUST be visibly treated as potentially stale until fresh data is returned by the extension host.

#### Scenario: Open sidebar with cached current-project data
- **GIVEN** valid cached sidebar data exists for the current project
- **WHEN** the sidebar opens
- **THEN** the sidebar MUST render cached active changes without waiting for a full CLI refresh
- **AND** the sidebar MUST show a refreshing or stale indicator until fresh data arrives

#### Scenario: Fresh sidebar data replaces cache
- **GIVEN** the sidebar is rendering cached data
- **WHEN** fresh current-project data arrives from the extension host
- **THEN** the sidebar MUST replace cached data with fresh data
- **AND** the stale indicator MUST be cleared

#### Scenario: Cached data is project-scoped
- **GIVEN** the extension has cached data for multiple projects
- **WHEN** the user switches to another project
- **THEN** the sidebar MUST only render cached data belonging to the selected project
- **AND** it MUST NOT show active changes from the previous project as if they belonged to the new one

#### Scenario: Open dashboard with cached data
- **GIVEN** 当前 Project/root 存在有效 Sidebar 缓存
- **WHEN** Sidebar 打开
- **THEN** Sidebar MUST 先展示缓存的 active Changes
- **AND** fresh 数据返回前 MUST 显示 stale 或 refreshing 状态

#### Scenario: Fresh dashboard data replaces cache
- **GIVEN** Sidebar 正在显示当前 Project/root 的缓存数据
- **WHEN** fresh project-bound payload 返回
- **THEN** fresh 数据 MUST 替换缓存数据
- **AND** stale 状态 MUST 被清除

#### Scenario: Cached data is scoped
- **GIVEN** 多个 Project/root binding 都存在缓存
- **WHEN** 页面请求其中一个 binding
- **THEN** 页面 MUST 只读取该 binding 的缓存
- **AND** 其他 binding 的 Changes 或 Specs MUST NOT 泄漏

### Requirement: Dashboard Actions
The system SHALL provide quick actions for common operations in the compact sidebar, and those actions SHALL route to the same shared workflow command routing as other OpenSpec surfaces.

#### Scenario: Create new change
- **GIVEN** the sidebar is open
- **WHEN** the user clicks "New Change"
- **THEN** a dialog MUST prompt for the change name
- **AND** on submission, `openspec new change <name>` MUST be executed
- **AND** the new change MUST appear in the current-project sidebar

#### Scenario: Refresh data
- **GIVEN** the sidebar is open
- **WHEN** the user clicks the refresh button
- **THEN** the current-project data MUST be reloaded
- **AND** the UI MUST update to reflect the current state

#### Scenario: Entry points open explorer pages
- **GIVEN** the compact sidebar is open
- **WHEN** the user clicks All Changes or Specs
- **THEN** the extension MUST open the corresponding project-bound Editor Explorer
- **AND** it MUST preserve the current ProjectContext / OpenSpecRootBinding

#### Scenario: Workflow quick actions route through shared launch settings
- **GIVEN** a change in the sidebar
- **WHEN** the user clicks a workflow quick action such as Continue, FF, Apply, or Sync
- **THEN** the action MUST route through the shared workflow launch settings
- **AND** the dashboard quick action MUST NOT directly modify OpenSpec change files

#### Scenario: Copy-command quick action generates a clipboard-safe command
- **GIVEN** a change in the sidebar
- **WHEN** the user clicks the copy-command quick action
- **THEN** the command builder MUST generate the command using the clipboard target
- **AND** the generated command MUST use colon format such as `/opsx:apply <change>`
- **AND** the generated command MUST be copied to the clipboard

#### Scenario: Verify and Archive open the interactive workflow
- **GIVEN** a change card displays Verify or Archive quick actions
- **WHEN** the user clicks either action
- **THEN** the extension MUST open the change detail view
- **AND** the change detail view MUST switch to `Verify & Archive`
- **AND** the quick action MUST NOT use headless `agentCli`

#### Scenario: Copy opsx command
- GIVEN an active Change is visible in the Sidebar
- WHEN the user clicks a copy-command quick action
- THEN the shared command builder MUST generate a clipboard-target command
- AND the command MUST use colon format and be copied with confirmation

#### Scenario: Open workflow command from quick action through launch settings
- GIVEN an active Change is visible in the Sidebar
- WHEN the user triggers Continue, FF, Apply, or Sync
- THEN the action MUST route through shared workflow launch settings
- AND the Sidebar MUST NOT directly modify OpenSpec files

#### Scenario: Cursor quick action uses hyphen command when adapter launch is selected
- GIVEN adapter launch targets Cursor
- WHEN the user triggers a workflow quick action
- THEN the delivered Cursor command MUST use `/opsx-<action> <change>` format

#### Scenario: Default dashboard quick action is clipboard safe
- GIVEN the extension uses default launch settings
- WHEN the user triggers a non-interactive workflow action
- THEN the command MUST be copied to the clipboard
- AND no Agent window, deeplink, or CLI process MUST start automatically

#### Scenario: Dashboard Verify quick action opens interactive workflow
- **GIVEN** an active Change card displays Verify
- **WHEN** the user triggers Verify
- **THEN** Change Detail MUST open at `Verify & Archive`
- **AND** the action MUST NOT use headless `agentCli`

#### Scenario: Dashboard Archive quick action opens interactive workflow
- **GIVEN** an active Change card displays Archive
- **WHEN** the user triggers Archive
- **THEN** Change Detail MUST open at `Verify & Archive`
- **AND** the action MUST NOT call direct `archiveChange`

### Requirement: CLI Activation Failure State
The Dashboard SHALL display actionable CLI activation diagnostics when OpenSpec CLI is unavailable, without introducing a new file-system fallback data source.

#### Scenario: Initial sidebar load fails without cached data
- **GIVEN** the sidebar has no cached current-project data
- **AND** CLI availability or project refresh fails with a CLI activation diagnostic
- **WHEN** the sidebar renders
- **THEN** it MUST display a blocking CLI failure state
- **AND** the state MUST show a diagnostic title, a concise message, safe diagnostic details, and recovery actions
- **AND** the state MUST NOT show an empty sidebar as if there were no changes

#### Scenario: Refresh fails after cached data exists
- **GIVEN** the sidebar already has cached current-project data
- **AND** a later refresh fails with a CLI activation diagnostic
- **WHEN** the sidebar renders
- **THEN** it MUST keep displaying the existing cached sidebar data
- **AND** it MUST show the CLI activation diagnostic as a warning above the cached content
- **AND** it MUST clearly indicate that the visible data may be stale

#### Scenario: Retry succeeds after failure
- **GIVEN** the sidebar displays a CLI activation diagnostic
- **AND** the user fixes their environment or settings outside the sidebar
- **WHEN** the user clicks Retry
- **AND** CLI detection succeeds
- **THEN** the diagnostic MUST be cleared
- **AND** current-project data MUST be refreshed through the normal CLI-backed data path

#### Scenario: Diagnostic recovery actions remain available
- **GIVEN** a CLI activation diagnostic is displayed
- **WHEN** the user looks at the recovery controls
- **THEN** the sidebar MUST render actions equivalent to open-settings, retry, copy-diagnostics, and open-docs
- **AND** those actions MUST be provided by the extension host with sanitized diagnostics

#### Scenario: Initial dashboard load fails without cached data
- **GIVEN** 当前 Project/root 没有缓存数据
- **AND** CLI availability 或 project refresh 返回 activation diagnostic
- **WHEN** Sidebar 渲染
- **THEN** Sidebar MUST 显示 blocking diagnostic 而不是空 Change 状态
- **AND** 系统 MUST NOT 创建文件系统 fallback 数据源

#### Scenario: Diagnostic recovery actions are available in dashboard
- **GIVEN** Sidebar 显示 CLI activation diagnostic
- **WHEN** diagnostic 提供恢复动作
- **THEN** Sidebar MUST 提供 open-settings、retry、copy-diagnostics 和 open-docs 等价动作
- **AND** copy-diagnostics MUST 使用 host 生成的脱敏内容

#### Scenario: Retry fails with same diagnostic
- **GIVEN** Sidebar 已显示某个 CLI diagnostic
- **WHEN** Retry 返回相同 category 与 normalized message
- **THEN** diagnostic 状态 MUST 刷新
- **AND** 同一 extension session MUST NOT 重复弹出相同通知

#### Scenario: Retry fails with different diagnostic
- **GIVEN** Sidebar 已显示某个 CLI diagnostic
- **WHEN** Retry 返回不同 category 或 normalized message
- **THEN** Sidebar MUST 替换为新 diagnostic
- **AND** VS Code MAY 显示新通知

#### Scenario: Dashboard diagnostic hides sensitive details
- **GIVEN** CLI resolver 返回原始诊断详情
- **WHEN** Sidebar 显示 diagnostic
- **THEN** UI MUST 只显示 host 提供的安全详情
- **AND** PATH、用户目录以及敏感环境变量 MUST NOT 被渲染

#### Scenario: Workspace not initialized is not a CLI activation diagnostic
- **GIVEN** CLI 可用但当前 Project 未初始化 OpenSpec
- **WHEN** Project-first 数据加载失败
- **THEN** Sidebar MUST 显示 workspace initialization 指引
- **AND** CLI activation recovery card MUST NOT 被误用

## REMOVED Requirements

### Requirement: Scope transition feedback
**Reason**: The compact Sidebar no longer changes a mutable root scope.
**Migration**: Project/root transitions use the explicit binding and stale-data rules in `project-first-explorers`.

### Requirement: Scope Bar
**Reason**: The Project header replaces the writable-root Scope Bar in the default Sidebar.
**Migration**: Project identity and root-bound diagnostics are carried by the Project-first payload.

### Requirement: Store selection
**Reason**: Registered Stores are not peer roots in the Project-first Sidebar.
**Migration**: Legacy explicit Store scope remains compatibility-only; referenced Store Specs appear in Specs Explorer.

### Requirement: Root health display
**Reason**: Selected-root health is no longer a standalone Sidebar administration surface.
**Migration**: Project-bound loading and diagnostics fail closed; richer health UI can return with a concrete Store management surface.

### Requirement: Read-only references panel
**Reason**: Referenced Store browsing moves out of the mixed Dashboard panel.
**Migration**: Specs Explorer groups CLI-confirmed referenced Store Specs as read-only content.

### Requirement: Workset entry points
**Reason**: Workset navigation is a later milestone.
**Migration**: No Workset entry is shown in the current-project-only release.

### Requirement: Specs Overview
**Reason**: Full canonical and referenced Spec browsing moves to an Editor Explorer.
**Migration**: Use the Specs entry in Sidebar to open the project-bound Specs Explorer.

### Requirement: Archive Overview
**Reason**: Archived Changes no longer occupy the compact Sidebar.
**Migration**: Use All Changes to browse active and archived Changes together.

### Requirement: OpenSpec root selector clarity
**Reason**: The default Sidebar no longer exposes a root selector.
**Migration**: Current Project and its CLI-resolved root are bound automatically.

### Requirement: Root-scoped empty states
**Reason**: Empty states are now bound to the current Project/root rather than a mutable selected root.
**Migration**: Sidebar and Explorer requirements define their own project-bound empty states.

### Requirement: Scoped archive overview
**Reason**: Archive browsing is now part of the project-bound Changes Explorer.
**Migration**: The Explorer binding determines the only archive root that may be read.

### Requirement: Stores and worksets maintenance panel
**Reason**: Store and Workset administration is not part of the compact current-project Sidebar.
**Migration**: Compatibility services remain; dedicated management/navigation is deferred.

### Requirement: OpenSpec Root Selector Separates Projects And Stores
**Reason**: Project and Store roots are no longer selected as peers from the default Sidebar.
**Migration**: Project identity is primary; referenced Stores are progressively disclosed read-only context.

### Requirement: Worksets Workspace Page
**Reason**: Cross-project Workset navigation is outside this Change.
**Migration**: Implement it in the subsequent Workset milestone.

### Requirement: Workset And Root Semantics Are Clear
**Reason**: The current-project release does not expose Workset management UI.
**Migration**: The later Workset milestone must define Project selection and root ownership explicitly.
