# Dashboard Specification

## Purpose

The Dashboard is the main entry point for the OpenSpec VSCode extension, providing a visual overview of all changes and their status.
## Requirements




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
Dashboard SHALL render valid cached dashboard data while fresh data is being loaded, and a Project Dashboard SHALL reuse the current binding-matching Project workspace snapshot instead of starting a click-time scan.

Cached dashboard data MUST be visibly treated as potentially stale until fresh data is returned by the extension host.

#### Scenario: Open dashboard with cached data
- **GIVEN** valid cached dashboard data exists for the current workspace and scope
- **WHEN** the dashboard webview opens
- **THEN** dashboard MUST render cached changes and specs without waiting for a full CLI refresh
- **AND** dashboard MUST show a refreshing or stale indicator until fresh data arrives

#### Scenario: Fresh dashboard data replaces cache
- **GIVEN** dashboard is rendering cached data
- **WHEN** fresh dashboard data arrives from the extension host
- **THEN** dashboard MUST replace cached data with fresh data
- **AND** dashboard MUST clear the stale indicator
- **AND** search, status grouping, specs list, and scope metadata MUST reflect the fresh data

#### Scenario: Cached data is scoped
- **GIVEN** dashboard has cached data for multiple scopes or Project bindings
- **WHEN** the user switches from one scope or Project binding to another
- **THEN** dashboard MUST only render cached data belonging to the selected identity
- **AND** dashboard MUST NOT show changes or specs from the previous identity as if they belonged to the new selection

#### Scenario: Project Dashboard reuses the warm Sidebar snapshot
- **GIVEN** the Project-first Sidebar already holds a binding-matching Project workspace snapshot
- **WHEN** the user opens the Project Dashboard
- **THEN** the Host MUST send that snapshot to the Dashboard Editor immediately
- **AND** the click MUST NOT trigger another root resolution or a second full Project scan

#### Scenario: One refresh updates both Project surfaces
- **GIVEN** the Project Sidebar and Project Dashboard are both open for the same binding
- **WHEN** an explicit refresh or watcher event produces fresh Project data
- **THEN** the Host MUST assemble one fresh Project workspace snapshot
- **AND** the Host MUST publish the binding-matching result to both surfaces
- **AND** an older generation MUST NOT overwrite a newer Project selection

### Requirement: Operational status rail
Dashboard SHALL render OpenSpec runtime, scope, health, activity, and cache summary as a compact operational status rail instead of a large filled status card.

The status rail MUST fit narrow IDE sidebars, MUST use VS Code theme tokens, and MUST keep status meaning visible through text in addition to color. Icon-only controls in the rail MUST have accessible labels or tooltips.

#### Scenario: Rail shows normal runtime status
- **GIVEN** OpenSpec CLI is installed and the current scope is healthy
- **WHEN** dashboard renders the status rail
- **THEN** the rail MUST show the CLI source or mode, selected scope name, and health text in a compact two-line or equivalent layout
- **AND** the rail MUST NOT dominate the dashboard content like a large content card
- **AND** the health state MUST be understandable without relying only on green color

#### Scenario: Rail adapts to narrow sidebar width
- **GIVEN** the OpenSpec sidebar is rendered in a narrow IDE panel
- **WHEN** the selected scope name or cache summary is long
- **THEN** the rail MUST keep controls usable without horizontal overflow
- **AND** long labels MUST truncate or wrap in a controlled way
- **AND** primary dashboard actions MUST remain visible and clickable

#### Scenario: Rail exposes cache entry
- **GIVEN** cache statistics are available or being calculated
- **WHEN** dashboard renders the status rail
- **THEN** the rail MUST expose a cache entry showing a concise summary such as size and file count when available
- **AND** the cache entry MUST provide access to cache management actions
- **AND** unavailable cache stats MUST be represented as pending or unavailable without blocking the rest of the rail

#### Scenario: Rail uses accessible activity copy
- **GIVEN** dashboard is switching scope, refreshing cached data, or showing a warning
- **WHEN** the rail renders the current activity
- **THEN** the rail MUST show a concise text label for the activity
- **AND** spinner or progress indicators MUST be paired with accessible text
- **AND** warning or error states MUST remain visible after the transient spinner ends

### Requirement: Dashboard cache management entry
Dashboard SHALL provide a clear cache management entry connected to extension-host cache actions and settings/discovery surfaces.

The dashboard entry MUST allow users to open the cache folder, copy the cache path, clear the cache, and view cache details without knowing the editor-specific storage path.

#### Scenario: User opens cache action menu
- **GIVEN** dashboard status rail includes a cache entry
- **WHEN** the user activates the cache entry
- **THEN** dashboard MUST show available cache actions
- **AND** each action MUST send a typed message or command to the extension host
- **AND** dashboard MUST NOT attempt to read the filesystem directly from the webview

#### Scenario: Cache action completes
- **GIVEN** the user selects a cache action from dashboard
- **WHEN** extension host reports the action result
- **THEN** dashboard MUST show non-blocking success or failure feedback
- **AND** cache statistics MUST refresh after actions that mutate cache contents
- **AND** current dashboard data MUST remain visible unless the user explicitly clears and refreshes data

#### Scenario: Settings surface links to cache management
- **GIVEN** the user opens OpenSpec extension settings or command palette
- **WHEN** they look for cache management
- **THEN** the extension MUST expose discoverable commands or settings descriptions for opening, copying, clearing, and inspecting cache
- **AND** the description MUST make clear that cache lives in editor extension storage, not in the project

### Requirement: Dashboard Actions
The system SHALL provide quick actions for common operations, workflow-oriented quick actions SHALL route through shared OpenSpec workflow command routing, and Verify/Archive quick actions SHALL be able to open the interactive `Verify & Archive` workflow.

#### Scenario: Create new change
- **GIVEN** the Project-first Sidebar is open
- **WHEN** the user invokes the native New Change view-title action
- **THEN** a dialog MUST prompt for the change name
- **AND** on submission, `openspec new change <name>` MUST be executed
- **AND** the new change MUST appear in the current Project surfaces

#### Scenario: Refresh data
- **GIVEN** at least one Project surface is open
- **WHEN** the user invokes the native Refresh action
- **THEN** current data MUST be reloaded from the official Project sources
- **AND** one binding-validated refresh result MUST be shared with the open Sidebar and Project Dashboard

#### Scenario: Open Project Dashboard
- **GIVEN** the Project-first action grid is visible
- **WHEN** the user activates Dashboard
- **THEN** the extension MUST open or reveal the singleton Project Dashboard Editor
- **AND** the action MUST NOT replace the active local Sidebar view

#### Scenario: Copy opsx command
- **GIVEN** a change in the dashboard
- **WHEN** the user clicks a copy-command quick action
- **THEN** the command builder MUST generate the command using the Clipboard target
- **AND** the generated command MUST use colon format such as `/opsx:apply <change>`
- **AND** the generated command MUST be copied to clipboard
- **AND** a notification SHOULD confirm the copy action

#### Scenario: Open workflow command from quick action through launch settings
- **GIVEN** a change in the dashboard
- **WHEN** the user clicks a workflow quick action such as Continue, FF, Apply, or Sync
- **THEN** the action MUST route through the shared workflow launch settings
- **AND** `openspec.workflowLaunchMode=clipboard` MUST copy the generated command and show a non-modal notification
- **AND** `openspec.workflowLaunchMode=adapter` MUST route through the selected adapter's configured launch behavior
- **AND** the dashboard quick action MUST NOT directly modify OpenSpec change files

#### Scenario: Cursor quick action uses hyphen command when adapter launch is selected
- **GIVEN** `openspec.workflowLaunchMode` is `adapter`
- **AND** the selected adapter target is Cursor
- **WHEN** the user clicks a workflow quick action in the dashboard
- **THEN** the command opened, copied, or executed through Cursor MUST use `/opsx-<action> <change>` format

#### Scenario: Default dashboard quick action is clipboard safe
- **GIVEN** the extension uses default settings
- **WHEN** the user clicks a workflow quick action other than interactive Verify or Archive in the dashboard
- **THEN** the generated command MUST be copied to the clipboard
- **AND** no Agent window, deeplink, or CLI process MUST start automatically

#### Scenario: Dashboard Verify quick action opens interactive workflow
- **GIVEN** a change card displays a Verify quick action
- **WHEN** the user clicks that action
- **THEN** the extension MUST open the change detail view
- **AND** the change detail view MUST switch to `Verify & Archive`
- **AND** the Verify terminal workflow MAY start immediately
- **AND** the quick action MUST NOT use headless `agentCli`

#### Scenario: Dashboard Archive quick action opens interactive workflow
- **GIVEN** a change card displays an Archive quick action
- **WHEN** the user clicks that action
- **THEN** the extension MUST open the change detail view
- **AND** the change detail view MUST switch to `Verify & Archive`
- **AND** the Archive terminal workflow MAY start immediately
- **AND** the quick action MUST NOT call direct `archiveChange`

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

### Requirement: Performance
系统 SHALL 在保持 dashboard 响应性的同时，通过克制的过渡反馈帮助用户感知状态变化。

#### Scenario: Initial load time
- **GIVEN** 工作区内最多存在 50 个 change
- **WHEN** 用户打开 dashboard
- **THEN** dashboard MUST 在合理时间内完成首屏加载
- **AND** 当加载时间超过短暂阈值时，系统 MUST 展示加载反馈

#### Scenario: Update responsiveness
- **GIVEN** dashboard 当前处于打开状态
- **WHEN** 任务进度、workflow 状态或卡片可见元数据发生刷新
- **THEN** UI MUST 及时更新
- **AND** 系统 MAY 使用轻量级过渡反馈帮助用户感知变化
- **AND** 这些过渡 MUST 不造成布局跳动或影响连续操作

#### Scenario: Reduced motion preference disables non-essential motion
- **GIVEN** 用户环境声明了减少动态效果偏好
- **WHEN** dashboard 展示卡片 hover、快捷操作显隐或进度刷新反馈
- **THEN** 系统 MUST 禁用非必要的位移或动画效果
- **AND** 系统 MUST 保留即时且可感知的状态变化

### Requirement: Project-first Workset navigation scene

Project-first Dashboard SHALL provide a separate Workset Project selection scene without creating a second Changes/Specs dashboard.

#### Scenario: Workset navigation is eligible

- **WHEN** the host supplies at least one confirmed Workset membership for the current Project
- **THEN** the Sidebar MUST show a Workset navigation entry using the existing VS Code/Cursor visual language
- **AND** the entry MUST make the current Project, Workset level, and selectable Project level distinguishable

#### Scenario: Project content scene remains focused

- **WHEN** the user is viewing a selected Project
- **THEN** the Sidebar MUST keep the existing Current Project identity, active Changes, All Changes, and Specs entry points
- **AND** it MUST NOT render the Workset picker and Project content as one ambiguous list

#### Scenario: Switching Project reuses content navigation

- **WHEN** the user selects a valid Project member
- **THEN** the Dashboard MUST replace the Project identity and active Changes with the selected Project data
- **AND** existing All Changes, Specs, Change Detail, and Spec Detail actions MUST remain available

#### Scenario: Workset navigation is hidden

- **WHEN** the current Project has no confirmed Workset membership or the workset capability is unavailable
- **THEN** the Dashboard MUST render the existing Project-first view without an empty or enabled Workset control

### Requirement: Project Dashboard summary surface
The Project Dashboard SHALL present a wide Editor-oriented summary derived only from the current binding-matching Project workspace snapshot.

#### Scenario: Dashboard reports truthful Project metrics
- **GIVEN** the snapshot contains active and archived Changes with lifecycle and task totals
- **WHEN** the Project Dashboard renders its KPI summary
- **THEN** it MUST show Total Changes, Active Changes, Ready to Verify, Archived, Active Tasks, and Active Task Completion Rate
- **AND** completion rate MUST be calculated from the sum of completed active tasks divided by the sum of total active tasks
- **AND** a zero-task Project MUST display a defined empty value rather than `NaN` or an invented percentage

#### Scenario: Dashboard uses official lifecycle distribution
- **GIVEN** active Changes have Host-derived lifecycle status
- **WHEN** the status distribution renders
- **THEN** it MUST use planning, ready-to-apply, applying, ready-to-verify, and archived counts
- **AND** it MUST NOT relabel task completion as an archived or fully finished workflow

#### Scenario: Dashboard derives Artifact Readiness from declared artifacts
- **GIVEN** Changes declare schema artifact ids and statuses
- **WHEN** Artifact Readiness renders
- **THEN** each displayed artifact id MUST use done-versus-declared counts from the current Project Changes
- **AND** the UI MUST NOT assume every schema has exactly Proposal, Design, Tasks, and Specs

#### Scenario: Referenced Store data does not alter Project metrics
- **GIVEN** the current Project references one or more Stores
- **WHEN** the Dashboard derives Change, task, lifecycle, or readiness metrics
- **THEN** referenced Store Specs MUST NOT be counted as current Project Changes, tasks, or artifacts

#### Scenario: Dashboard shows recent updates without invented history
- **GIVEN** Changes include last-modified timestamps
- **WHEN** the Dashboard renders recent activity
- **THEN** it MUST order a bounded Recent Updates list from those timestamps
- **AND** it MUST NOT present file modification times as a historical task-progress timeline

#### Scenario: Dashboard remains operable across states
- **WHEN** the Dashboard is loading, stale, empty, failed, narrow, or used with reduced motion and keyboard navigation
- **THEN** it MUST expose understandable text state and accessible controls
- **AND** decorative visualizations MUST have equivalent textual counts

### Requirement: Dashboard prioritizes actionable Change state
The wide Dashboard SHALL present actionable Change priorities before aggregate statistics while preserving existing KPI and chart content below them.

#### Scenario: Needs attention is shown first
- **GIVEN** one or more Changes have blocked artifacts, failed action receipts, or another resolver-produced attention state
- **WHEN** the wide Dashboard renders
- **THEN** those Changes MUST appear in a Needs attention area before aggregate charts
- **AND** each entry MUST explain the actionable reason without relying on color alone

#### Scenario: Ready to verify is visible
- **GIVEN** one or more Changes have completed tasks and a resolved Verify action
- **WHEN** the wide Dashboard renders
- **THEN** those Changes MUST appear in a Ready to verify area
- **AND** Archive MUST NOT be represented as already completed or automatically selected

#### Scenario: Recommended actions use shared resolution
- **GIVEN** active Changes have resolved recommended actions
- **WHEN** the wide Dashboard renders its Recommended actions area
- **THEN** each entry MUST use the shared resolver result
- **AND** selecting a complex or high-impact action MUST open or reveal the bound Change Detail rather than bypass its safety flow

#### Scenario: Existing analytics remain available
- **GIVEN** KPI, artifact readiness, or progress chart data is available
- **WHEN** action-first areas render
- **THEN** the existing analytics MUST remain available below the action priorities
- **AND** this Change MUST NOT require a new Kanban, timeline, or animation system

### Requirement: Sidebar Change summaries are compact and action-oriented
The Sidebar SHALL summarize each Change with lifecycle, recommended next action, and task progress without repeating a fixed badge for every conventional artifact.

#### Scenario: Compact Change card uses resolved next action
- **GIVEN** a Change has a resolved recommended action
- **WHEN** its Sidebar card renders
- **THEN** the card MUST show the Change name, concise lifecycle, recommended next action, and available task progress
- **AND** it MUST NOT require Proposal, Specs, Design, and Tasks badges to communicate the same state

#### Scenario: Multiple ready actions remain discoverable
- **GIVEN** a Change has more than one available planning action
- **WHEN** its Sidebar card renders
- **THEN** the card MUST indicate that additional actions are available
- **AND** opening Change Detail MUST expose the complete available action set

#### Scenario: Sidebar excludes high-impact direct execution
- **GIVEN** Verify or Archive is available
- **WHEN** the Change is shown in the Sidebar
- **THEN** the Sidebar MAY identify the recommended lifecycle state
- **AND** triggering the high-impact action MUST require the dedicated Change Detail flow

### Requirement: Workflow surfaces expose explicit planning context
Sidebar and Dashboard SHALL distinguish the browsed Project from the Planning root and SHALL not present Workset membership as workflow authority.

#### Scenario: Project and Planning root are visible
- **GIVEN** the browsed Project and Planning root differ or the root is Store-backed
- **WHEN** workflow summaries are displayed
- **THEN** the UI MUST expose both Project identity and Planning root source in a concise form
- **AND** the user MUST be able to distinguish Local and Store planning targets before a write-producing action

#### Scenario: Workset remains an opener
- **GIVEN** the Project belongs to a Workset
- **WHEN** Change actions are resolved or displayed
- **THEN** Workset membership MUST NOT change the Change root binding or artifact state
- **AND** Workset controls MUST remain local project-opening actions

#### Scenario: Existing bound panel is not silently rebound
- **GIVEN** Change Detail or wide Dashboard is already bound to a Project/root
- **WHEN** the Sidebar Project picker changes browsing context
- **THEN** the existing panel MUST retain its original binding until the user explicitly opens the new context
- **AND** a same-named Change from the new context MUST NOT replace the bound panel's data
