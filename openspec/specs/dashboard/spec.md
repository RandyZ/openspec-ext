# Dashboard Specification

## Purpose

The Dashboard is the main entry point for the OpenSpec VSCode extension, providing a visual overview of all changes and their status.
## Requirements
### Requirement: Change List Display
系统 SHALL 按状态分组展示所有 change，并在每张卡片上提供可扫描的摘要、时间与进度信息。

#### Scenario: Changes grouped by status
- **GIVEN** 工作区中存在处于不同阶段的多个 change
- **WHEN** 用户打开 dashboard
- **THEN** change MUST 被分为 Draft、Active、Completed 三个分组展示
- **AND** 每个分组头部 MUST 显示该分组内的数量

#### Scenario: Empty state
- **GIVEN** 工作区中没有任何 change
- **WHEN** 用户打开 dashboard
- **THEN** 系统 MUST 展示空状态提示
- **AND** 系统 SHOULD 展示创建新 change 的入口

#### Scenario: Change card shows created and updated metadata
- **GIVEN** 某个 change 同时具有可解析的创建时间、更新时间和任务数据
- **WHEN** 该 change 显示在 dashboard 中
- **THEN** 卡片 MUST 按以下层级展示信息：change 名称、Proposal Why 摘要、artifact 状态、时间信息、任务进度
- **AND** 时间信息 MUST 单独成行展示 `Created` 与 `Updated`
- **AND** 任务进度 MUST 以任务文本摘要和可视进度指示共同呈现

#### Scenario: Missing created time falls back gracefully
- **GIVEN** 某个 change 没有可用的 `createdAt`
- **WHEN** 该 change 显示在 dashboard 中
- **THEN** 卡片 MUST 继续正常展示
- **AND** 系统 MUST 隐藏 `Created` 展示而不是显示错误占位
- **AND** 如果存在可解析的更新时间，系统 MUST 继续展示 `Updated`

#### Scenario: Proposal Why summary display
- **GIVEN** 某个 change 的 `proposal.md` 中存在 `## Why` 内容
- **WHEN** 该 change 显示在 dashboard 中
- **THEN** 卡片 MUST 在标题下方展示 Proposal Why 摘要
- **AND** 可见摘要 MUST 限制为适合卡片阅读的简短文本
- **AND** 当摘要被截断时，系统 MUST 通过 tooltip 或等价的可访问提示暴露完整内容

#### Scenario: Missing Proposal Why summary
- **GIVEN** 某个 change 没有 proposal 或没有可解析的 `## Why` 内容
- **WHEN** 该 change 显示在 dashboard 中
- **THEN** 卡片 MUST 继续可见
- **AND** 系统 MUST 不向用户暴露摘要提取错误

#### Scenario: Search changes by loaded metadata
- **GIVEN** dashboard 已加载 change 列表
- **WHEN** 用户在搜索框中输入查询
- **THEN** 系统 MUST 基于已加载元数据在本地过滤 change
- **AND** 匹配范围 MUST 包含 change 名称、状态、artifact 标识、artifact 状态、Proposal Why 摘要与完整文本
- **AND** 过滤结果 MUST 保持原有状态分组

#### Scenario: Search empty result
- **GIVEN** dashboard 已加载 change 列表
- **WHEN** 用户输入的查询没有匹配任何已加载 change
- **THEN** 系统 MUST 展示空搜索结果提示
- **AND** 系统 MUST NOT 因每次键入而触发新的 OpenSpec CLI 刷新

### Requirement: Change Navigation
系统 SHALL 允许用户从 dashboard 进入 change 详情，并在卡片的 hover 与 focus 状态下提供不会干扰主导航的 workflow 快捷操作。

#### Scenario: Click to open change
- **GIVEN** dashboard 中展示了某个 change
- **WHEN** 用户点击卡片的非操作区域
- **THEN** 系统 MUST 打开该 change 的 detail 视图
- **AND** detail 视图 MUST 展示该 change 的所有 artifact

#### Scenario: Hover and focus reveal workflow actions
- **GIVEN** 某张 change 卡片具有可用的 workflow 操作
- **WHEN** 用户将鼠标悬停在卡片上或通过键盘将焦点移入卡片
- **THEN** 系统 MUST 展示该卡片的快捷操作区
- **AND** 这些操作 MUST 可通过键盘聚焦与触发
- **AND** 未进入 hover 或 focus 状态时，快捷操作区 MUST 不干扰卡片主体信息的阅读

#### Scenario: Quick actions do not steal card navigation
- **GIVEN** 卡片上展示了 workflow 快捷操作
- **WHEN** 用户点击某个快捷操作按钮
- **THEN** 系统 MUST 执行对应操作
- **AND** 系统 MUST NOT 同时触发"打开 change 详情"的卡片点击行为

### Requirement: Real-time Updates
The system SHALL reflect file system changes and extension-triggered state changes without requiring manual refresh.

#### Scenario: New change created
- GIVEN the dashboard is open
- WHEN a new change is created (via CLI or other means)
- THEN the new change MUST appear in the dashboard
- AND it MUST be added to the Draft section

#### Scenario: Task completion updates status
- GIVEN a change in the Active section
- WHEN the last task is marked complete (in file or via UI)
- THEN the change MUST move to the Completed section
- AND the progress indicator MUST update to show 100%

#### Scenario: Change deleted
- GIVEN a change displayed in the dashboard
- WHEN the change is deleted from the file system
- THEN it MUST be removed from the dashboard
- AND no error SHOULD be shown

#### Scenario: Sidebar receives refreshed dashboard data
- GIVEN the OpenSpec sidebar webview is open
- WHEN `DataManager.refresh()` completes because of file watcher events, task writes, new change, archive, or manual refresh
- THEN the sidebar MUST receive the latest dashboard data without requiring the user to click the reload button
- AND the change list, task counts, status grouping, specs list, and search metadata MUST reflect the refreshed data

#### Scenario: Existing cache avoids click-time reload
- GIVEN dashboard data has already been loaded
- WHEN the user reveals the OpenSpec sidebar or opens a change detail from a change card
- THEN the UI MUST reuse cached dashboard data where valid
- AND it MUST NOT perform an additional full OpenSpec scan solely because of the click

### Requirement: Scope transition feedback
Dashboard SHALL provide immediate visual feedback when the active OpenSpec scope is changing, and SHALL keep the visible activity label consistent with the data currently displayed.

The scope selector and store setup/register actions MUST enter a pending state as soon as the user triggers a scope-affecting action. The dashboard MUST prevent duplicate scope-affecting actions while the pending operation is active. `Switching` MUST only describe the period before dashboard data for the target scope is visible; once target-scope cached data is displayed, dashboard MUST show a cached-refresh activity instead of continuing to show switching.

#### Scenario: Select different scope
- **GIVEN** dashboard shows multiple OpenSpec scopes
- **WHEN** the user selects a different scope from the scope selector
- **THEN** dashboard MUST immediately show a loading indicator associated with scope switching
- **AND** dashboard MUST disable duplicate scope selection until the operation completes
- **AND** dashboard MUST request data for the selected scope from the extension host

#### Scenario: Target cached data arrives during scope switch
- **GIVEN** dashboard is showing a scope switching pending state for a selected target scope
- **WHEN** the extension host returns cached dashboard data marked stale for the selected target scope
- **THEN** dashboard MUST display changes and specs for the selected target scope
- **AND** the scope selector MUST show the selected target scope
- **AND** dashboard MUST clear the scope switching label
- **AND** dashboard MUST show a cached-refresh activity such as `Showing cached data while refreshing`

#### Scenario: Fresh data arrives after cached scope data
- **GIVEN** dashboard is displaying cached data for the selected target scope with a cached-refresh activity
- **WHEN** fresh dashboard data for that scope arrives from the extension host
- **THEN** dashboard MUST replace cached data with fresh data
- **AND** dashboard MUST clear the cached-refresh activity
- **AND** dashboard MUST keep the scope selector on the selected scope

#### Scenario: Scope switch succeeds without cached intermediate data
- **GIVEN** dashboard is showing a scope switching pending state
- **WHEN** the extension host returns fresh dashboard data for the selected scope
- **THEN** dashboard MUST display changes and specs for the selected scope
- **AND** dashboard MUST clear the scope switching pending state
- **AND** the scope selector MUST show the selected scope

#### Scenario: Scope switch fails before target data is visible
- **GIVEN** dashboard is showing a scope switching pending state
- **WHEN** the extension host reports a failure before any data for the selected scope is displayed
- **THEN** dashboard MUST clear the scope switching pending state
- **AND** dashboard MUST keep or restore the last successfully loaded dashboard data
- **AND** dashboard MUST show an error or warning explaining that scope data could not be loaded

#### Scenario: Fresh refresh fails after target cached data is visible
- **GIVEN** dashboard is displaying cached data for the selected target scope
- **WHEN** the extension host reports that fresh refresh failed
- **THEN** dashboard MUST keep displaying the target scope cached data
- **AND** dashboard MUST stop showing switching or refresh spinners
- **AND** dashboard MUST show a warning that visible data may be stale

#### Scenario: Store setup or register pending
- **GIVEN** dashboard displays store setup or register actions
- **WHEN** the user starts setup or register from the dashboard
- **THEN** dashboard MUST show a pending state for that action
- **AND** dashboard MUST refresh scope metadata after the action succeeds
- **AND** dashboard MUST prevent duplicate setup/register clicks while the action is pending

### Requirement: Cache-aware dashboard rendering
Dashboard SHALL render valid cached dashboard data while fresh data is being loaded.

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
- **GIVEN** dashboard has cached data for multiple scopes
- **WHEN** the user switches from one scope to another
- **THEN** dashboard MUST only render cached data belonging to the selected scope
- **AND** dashboard MUST NOT show changes or specs from the previously selected scope as if they belonged to the new scope

### Requirement: Scope Bar
The Dashboard SHALL show a compact Scope Bar that makes the active OpenSpec runtime and selected writable root visible.

#### Scenario: Scope Bar shows local root
- **GIVEN** the selected scope is the workspace local OpenSpec root
- **WHEN** the dashboard renders
- **THEN** the Scope Bar MUST show the local root label
- **AND** it MUST show the root path in a concise, inspectable form
- **AND** it MUST show the resolved runtime source

#### Scenario: Scope Bar shows selected store
- **GIVEN** the selected scope is a registered store
- **WHEN** the dashboard renders
- **THEN** the Scope Bar MUST show the store id
- **AND** it MUST show that commands act on the store root
- **AND** it MUST distinguish explicit store scope from local root scope

#### Scenario: Scope Bar shows declared store
- **GIVEN** OpenSpec reports that the current workspace resolves through a declared store
- **WHEN** the dashboard renders
- **THEN** the Scope Bar MUST show the declared store id
- **AND** it MUST indicate that the selected root comes from project configuration

#### Scenario: Scope Bar remains compact in sidebar
- **GIVEN** the OpenSpec dashboard is shown in the sidebar
- **WHEN** the available width is narrow
- **THEN** runtime, scope, health, and actions MUST wrap or collapse without overlapping text
- **AND** the change list MUST remain readable below the Scope Bar

### Requirement: Store selection
The Dashboard SHALL allow users to switch between local root and registered store scopes when store-aware features are available.

#### Scenario: Store selector lists local root and registered stores
- **GIVEN** store-aware features are available
- **AND** registered stores exist
- **WHEN** the user opens the scope selector
- **THEN** the selector MUST include the local root when available
- **AND** it MUST include each registered store by id
- **AND** each option SHOULD include a concise path or health hint

#### Scenario: Selecting a store refreshes scoped data
- **GIVEN** the dashboard is showing local root data
- **WHEN** the user selects a registered store
- **THEN** the dashboard MUST refresh changes and specs from the selected store scope
- **AND** stale local-root changes MUST not remain visible as store changes

#### Scenario: Returning to local root restores local dashboard
- **GIVEN** the dashboard is showing a store scope
- **WHEN** the user selects the local root option
- **THEN** the dashboard MUST refresh changes and specs from the workspace root
- **AND** store-specific relationship data MUST no longer be shown as the active root relationship data

#### Scenario: Store selector hidden when unsupported
- **GIVEN** the resolved OpenSpec runtime does not support stores
- **WHEN** the dashboard renders
- **THEN** the store selector MUST NOT be shown as an enabled control
- **AND** the dashboard MAY show a concise message explaining that local source mode is needed for unreleased store support

### Requirement: Root health display
The Dashboard SHALL surface selected root health without blocking normal data display for non-fatal health findings.

#### Scenario: Healthy root
- **GIVEN** OpenSpec doctor reports the selected root is healthy
- **WHEN** the dashboard renders
- **THEN** the Scope Bar MUST show a healthy state
- **AND** no relationship warning card MUST be shown for root health

#### Scenario: Health findings are visible
- **GIVEN** OpenSpec doctor reports warnings or informational findings for the selected root
- **WHEN** the dashboard renders
- **THEN** the Scope Bar MUST show a warning or info state
- **AND** the relationship area MUST show diagnostic messages and fixes supplied by OpenSpec

#### Scenario: Doctor unavailable
- **GIVEN** base dashboard data can load
- **AND** doctor support is unavailable or probe-disabled
- **WHEN** the dashboard renders
- **THEN** the dashboard MUST continue to show changes and specs
- **AND** health status MUST be shown as unavailable rather than failed activation

### Requirement: Read-only references panel
The Dashboard SHALL show referenced stores as read-only upstream context for the selected scope.

#### Scenario: Resolved reference displays specs
- **GIVEN** the selected root has a resolved referenced store with specs
- **WHEN** the references panel renders
- **THEN** it MUST show the referenced store id
- **AND** it MUST show referenced spec ids and one-line summaries when provided by OpenSpec
- **AND** it MUST show a fetch command or action for reading a referenced spec

#### Scenario: Empty resolved reference remains visible
- **GIVEN** a referenced store resolves but has no specs
- **WHEN** the references panel renders
- **THEN** it MUST show the referenced store id
- **AND** it MUST indicate that no specs are currently available

#### Scenario: Unresolved reference displays fix
- **GIVEN** OpenSpec context or doctor reports an unresolved referenced store
- **WHEN** the references panel renders
- **THEN** it MUST show the store id and warning state
- **AND** it MUST show the fix text supplied by OpenSpec
- **AND** it MUST NOT hide the reference silently

#### Scenario: References do not expose write actions
- **GIVEN** a referenced store is displayed
- **WHEN** the user views the reference row or card
- **THEN** the UI MUST NOT show New Change, Apply, Sync, Verify, Archive, or task-toggle controls for that referenced store
- **AND** it MAY offer to select the referenced store as the active scope when the store is registered

### Requirement: Workset entry points
The Dashboard SHALL expose personal worksets as local open-together conveniences without making them project truth.

#### Scenario: Worksets are listed when supported
- **GIVEN** the runtime supports worksets
- **WHEN** the dashboard requests workset data
- **THEN** the UI MAY show saved workset names, preferred tool, and members
- **AND** the section MUST label worksets as local personal views

#### Scenario: Open workset action delegates to OpenSpec
- **GIVEN** a saved workset is visible
- **WHEN** the user chooses to open it
- **THEN** the extension MUST delegate to `openspec workset open <name>` or an equivalent OpenSpec command
- **AND** it MUST not write membership files into any member folder

#### Scenario: Workset management is not required for MVP
- **GIVEN** store-aware dashboard MVP is implemented
- **WHEN** worksets are displayed
- **THEN** create, edit, and remove workset UI MAY be absent
- **AND** the UI MUST still explain how the user can manage worksets through OpenSpec CLI when needed

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
- GIVEN the dashboard is open
- WHEN the user clicks "New Change" button
- THEN a dialog MUST prompt for the change name
- AND on submission, `openspec new change <name>` MUST be executed
- AND the new change MUST appear in the dashboard

#### Scenario: Refresh data
- GIVEN the dashboard is open
- WHEN the user clicks the refresh button
- THEN all data MUST be reloaded from the file system
- AND the UI MUST update to reflect current state
- AND the refresh result MUST be shared with the open sidebar webview

#### Scenario: Copy opsx command
- GIVEN a change in the dashboard
- WHEN the user clicks a copy-command quick action
- THEN the command builder MUST generate the command using the Clipboard target
- AND the generated command MUST use colon format such as `/opsx:apply <change>`
- AND the generated command MUST be copied to clipboard
- AND a notification SHOULD confirm the copy action

#### Scenario: Open workflow command from quick action through launch settings
- GIVEN a change in the dashboard
- WHEN the user clicks a workflow quick action such as Continue, FF, Apply, or Sync
- THEN the action MUST route through the shared workflow launch settings
- AND `openspec.workflowLaunchMode=clipboard` MUST copy the generated command and show a non-modal notification
- AND `openspec.workflowLaunchMode=adapter` MUST route through the selected adapter's configured launch behavior
- AND the dashboard quick action MUST NOT directly modify OpenSpec change files

#### Scenario: Cursor quick action uses hyphen command when adapter launch is selected
- GIVEN `openspec.workflowLaunchMode` is `adapter`
- AND the selected adapter target is Cursor
- WHEN the user clicks a workflow quick action in the dashboard
- THEN the command opened, copied, or executed through Cursor MUST use `/opsx-<action> <change>` format

#### Scenario: Default dashboard quick action is clipboard safe
- GIVEN the extension uses default settings
- WHEN the user clicks a workflow quick action other than interactive Verify or Archive in the dashboard
- THEN the generated command MUST be copied to the clipboard
- AND no Agent window, deeplink, or CLI process MUST start automatically

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

#### Scenario: Initial dashboard load fails without cached data
- **GIVEN** the dashboard has no cached dashboard data
- **AND** CLI availability or dashboard refresh fails with a CLI activation diagnostic
- **WHEN** the dashboard renders
- **THEN** it MUST display a blocking CLI failure state
- **AND** the state MUST show a diagnostic title, a concise message, safe diagnostic details, and recovery actions
- **AND** the state MUST NOT show an empty dashboard as if there were no changes
- **AND** the state MUST NOT start a new file-system scan to replace CLI-backed dashboard data

#### Scenario: Refresh fails after cached data exists
- **GIVEN** the dashboard already has cached dashboard data
- **AND** a later refresh fails with a CLI activation diagnostic
- **WHEN** the dashboard renders
- **THEN** it MUST keep displaying the existing cached dashboard data
- **AND** it MUST show the CLI activation diagnostic as a warning above the cached content
- **AND** it MUST clearly indicate that the visible data may be stale
- **AND** it MUST NOT create or use any new file-driven fallback path to update change, spec, or task data

#### Scenario: Diagnostic recovery actions are available in dashboard
- **GIVEN** a CLI activation diagnostic is displayed in the dashboard
- **WHEN** the diagnostic includes recovery actions
- **THEN** the dashboard MUST render buttons or equivalent controls for those actions
- **AND** `open-settings` MUST open VS Code settings for `openspec.cliPath`
- **AND** `retry` MUST ask the extension host to re-run CLI detection
- **AND** `copy-diagnostics` MUST copy sanitized diagnostics generated by the extension host
- **AND** `open-docs` MUST open OpenSpec CLI installation or troubleshooting documentation

#### Scenario: Retry succeeds after failure
- **GIVEN** the dashboard displays a CLI activation diagnostic
- **AND** the user fixes their environment or settings outside the dashboard
- **WHEN** the user clicks Retry
- **AND** CLI detection succeeds
- **THEN** the diagnostic MUST be cleared
- **AND** dashboard data MUST be refreshed through the normal CLI-backed data path
- **AND** the dashboard MUST render normal change and spec content

#### Scenario: Retry fails with same diagnostic
- **GIVEN** the dashboard displays a CLI activation diagnostic
- **WHEN** the user clicks Retry
- **AND** CLI detection fails with the same diagnostic category and normalized message
- **THEN** the dashboard diagnostic state MUST refresh
- **AND** VS Code MUST NOT show a duplicate notification for the same diagnostic key during the same extension session

#### Scenario: Retry fails with different diagnostic
- **GIVEN** the dashboard displays a CLI activation diagnostic
- **WHEN** the user clicks Retry
- **AND** CLI detection fails with a different diagnostic category or normalized message
- **THEN** the dashboard MUST replace the displayed diagnostic with the new one
- **AND** VS Code MAY show a new notification for the new diagnostic key

#### Scenario: Dashboard diagnostic hides sensitive details
- **GIVEN** a CLI activation diagnostic contains raw resolver details
- **WHEN** the dashboard displays the diagnostic
- **THEN** the dashboard MUST show only safe details supplied by the extension host
- **AND** it MUST NOT render the full `process.env.PATH`
- **AND** it MUST NOT render full home-directory paths or username path segments
- **AND** it MUST NOT render raw environment variables containing `TOKEN`, `KEY`, `SECRET`, or `PASSWORD`

#### Scenario: Workspace not initialized is not a CLI activation diagnostic
- **GIVEN** OpenSpec CLI is available
- **AND** the current workspace does not contain an initialized `openspec/` workspace
- **WHEN** the dashboard fails to load because OpenSpec reports the workspace is not initialized
- **THEN** the dashboard MUST show a workspace initialization error state or existing generic error state
- **AND** it MUST suggest running `openspec init` or equivalent workspace initialization guidance
- **AND** it MUST NOT render the CLI activation diagnostic failure card
- **AND** it MUST NOT show CLI activation recovery actions such as `open-settings`, `copy-diagnostics`, or CLI install docs

### Requirement: Specs Overview
The system SHALL display a summary of all specs.

#### Scenario: Specs list display
- GIVEN a workspace with specs defined
- WHEN the user views the dashboard
- THEN a "Specs" section MUST show all spec directories
- AND each spec MUST display:
  - Spec name/ID
  - Number of requirements
  - Link to view details

#### Scenario: No specs defined
- GIVEN a workspace with no specs
- WHEN the user views the dashboard
- THEN the Specs section SHOULD show "No specs defined"
- AND MAY suggest creating specs

### Requirement: Archive Overview
The system SHALL provide access to archived changes.

#### Scenario: Recent archives display
- GIVEN archived changes exist
- WHEN the user views the dashboard
- THEN a "Recent Archives" section SHOULD show the 5 most recent archives
- AND each archive MUST display:
  - Archive name
  - Archive date
  - Link to browse full archive

#### Scenario: Browse all archives
- GIVEN the dashboard is open
- WHEN the user clicks "Browse Archives"
- THEN an archive browser view MUST open
- AND it MUST list all archived changes with metadata

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

### Requirement: OpenSpec root selector clarity
Dashboard SHALL present local roots and registered stores as selectable OpenSpec roots, not as workspace filters.

The selector MUST be labeled around the `OpenSpec Root` concept. Local project roots MUST be distinguishable from store roots, and the selected root MUST be the root used for dashboard content requests.

#### Scenario: Selector distinguishes local and store roots
- **GIVEN** the extension knows about a local OpenSpec root and a registered store
- **WHEN** the dashboard renders the root selector
- **THEN** the selector label MUST communicate `OpenSpec Root`
- **AND** the local root option MUST be labeled as a local root
- **AND** the store option MUST be labeled with its store identity, such as `Store: aihelp-workspace`

#### Scenario: Root switch drives primary dashboard content
- **GIVEN** the user selects a different OpenSpec root
- **WHEN** the extension host returns data for that selected root
- **THEN** the dashboard MUST render changes from the selected root
- **AND** the dashboard MUST render specs from the selected root
- **AND** the dashboard MUST render archived changes from the selected root
- **AND** the dashboard MUST NOT show content from the previously selected root as if it belonged to the new root

#### Scenario: Store root does not inherit local root content
- **GIVEN** the local root has active changes
- **AND** the selected store root has no active changes
- **WHEN** the dashboard renders the store root
- **THEN** the Changes section MUST show the store root empty state
- **AND** the dashboard MUST NOT display the local root changes inside the store root view

### Requirement: Root-scoped empty states
Dashboard SHALL explain empty states using the currently selected OpenSpec root.

Empty states for changes, archived changes, and specs MUST name or otherwise clearly identify the selected root so users can understand whether they are looking at a local root or a store root.

#### Scenario: Empty active changes names selected root
- **GIVEN** the selected OpenSpec root has no active changes
- **WHEN** the dashboard renders the Changes section
- **THEN** the empty state MUST identify the selected root
- **AND** the create-change entry point MUST create the change in the selected root

#### Scenario: Empty specs names selected root
- **GIVEN** the selected OpenSpec root has no specs
- **WHEN** the dashboard renders the Specs section
- **THEN** the empty state MUST identify the selected root
- **AND** the empty state MUST NOT imply that another root's specs are missing

#### Scenario: Empty archived changes names selected root
- **GIVEN** the selected OpenSpec root has no archived changes
- **WHEN** the user opens or expands archived changes
- **THEN** the empty state MUST identify the selected root
- **AND** the dashboard MUST NOT show archived changes from another root as a fallback

### Requirement: Scoped archive overview
Dashboard SHALL request and display archived changes for the selected OpenSpec root.

Archived change requests MUST include the selected root identity. The extension host MUST resolve that identity before listing archives so archived content follows the same root selection as active changes and specs.

#### Scenario: Local root archives are scoped
- **GIVEN** the selected OpenSpec root is the local root
- **WHEN** the dashboard requests archived changes
- **THEN** the extension host MUST list archives from the local root
- **AND** the dashboard MUST display only archives belonging to the local root

#### Scenario: Store root archives are scoped
- **GIVEN** the selected OpenSpec root is a registered store root
- **WHEN** the dashboard requests archived changes
- **THEN** the extension host MUST list archives from that store root
- **AND** the dashboard MUST display only archives belonging to that store root

#### Scenario: Scoped archive request fails
- **GIVEN** the dashboard requests archived changes for the selected root
- **WHEN** the extension host cannot resolve or read archives for that root
- **THEN** the dashboard MUST show an archive-specific error or empty state for the selected root
- **AND** the dashboard MUST NOT silently display archives from another root

### Requirement: Stores and worksets maintenance panel
Dashboard SHALL provide a compact maintenance panel for registered stores, references, and personal worksets.

The panel MUST mirror OpenSpec concepts: stores are writable planning roots, references are read-only upstream context, and worksets are local personal views. Store and workset operations MUST go through extension-host messages rather than direct webview filesystem access.

#### Scenario: Registered stores are listed
- **GIVEN** OpenSpec reports one or more registered stores
- **WHEN** the dashboard renders the Stores and Worksets panel
- **THEN** the panel MUST list each store with its identity and root path or equivalent location summary
- **AND** each store row MUST provide access to view, open, or inspect that store
- **AND** each store row MUST expose maintenance actions such as doctor or unregister when those actions are available

#### Scenario: Store setup and registration are available
- **GIVEN** the dashboard renders the Stores and Worksets panel
- **WHEN** the user chooses to add store capacity
- **THEN** the panel MUST provide actions to register an existing store and set up a new store when supported by the extension host
- **AND** the action state MUST prevent duplicate clicks while the operation is pending
- **AND** the panel MUST refresh store metadata after the operation succeeds

#### Scenario: References are presented as read-only context
- **GIVEN** OpenSpec reports references for the selected root or store context
- **WHEN** the dashboard renders the Stores and Worksets panel
- **THEN** references MUST be presented separately from writable stores
- **AND** reference actions MUST NOT imply that the reference is the current writable planning root

#### Scenario: Personal worksets are listed
- **GIVEN** OpenSpec reports personal worksets
- **WHEN** the dashboard renders the Stores and Worksets panel
- **THEN** the panel MUST list worksets separately from stores
- **AND** workset actions MUST communicate that worksets are local views rather than shared planning state

### Requirement: OpenSpec Root Selector Separates Projects And Stores
Dashboard SHALL present OpenSpec root selection as a Project/Store scope choice and SHALL NOT present worksets as selectable roots.

#### Scenario: Root selector groups project and store roots
- **GIVEN** dashboard data includes a local project scope and one or more store scopes
- **WHEN** the dashboard renders the OpenSpec root selector
- **THEN** the selector MUST distinguish project roots from store roots through grouping or equivalent labels
- **AND** each option MUST expose the root label and enough secondary metadata to disambiguate same-named roots

#### Scenario: Multi-folder workspace exposes all project roots
- **GIVEN** the current VS Code workspace contains multiple folders with `openspec/config.yaml`
- **WHEN** the dashboard loads OpenSpec root options
- **THEN** the Project group MUST include each discovered project root
- **AND** the Project group MUST NOT collapse the workspace to only the first OpenSpec folder

#### Scenario: Worksets are excluded from root selector
- **GIVEN** dashboard data includes saved worksets from `openspec workset list --json`
- **WHEN** the dashboard renders the OpenSpec root selector
- **THEN** no workset MUST appear as a selectable root option
- **AND** the selector MUST contain only root-scoped project or store options

#### Scenario: Selecting a project or store scopes dashboard data
- **GIVEN** the user selects a project or store from the OpenSpec root selector
- **WHEN** the extension host returns dashboard data for that scope
- **THEN** changes, archived changes, specs, New Change, and workflow actions MUST be scoped to the selected OpenSpec root
- **AND** the dashboard MUST keep the selected root visible while the scoped data is loading or displayed

#### Scenario: Selecting a project root runs local OpenSpec commands from that root
- **GIVEN** the user selects a non-store project root from the OpenSpec root selector
- **WHEN** the extension host loads changes, specs, archives, artifacts, or workflow instructions for that scope
- **THEN** local OpenSpec CLI commands MUST execute with that selected project root as their working directory
- **AND** the extension MUST NOT resolve project-scoped commands from a different workspace folder merely because it was the activation root

### Requirement: Worksets Workspace Page
Dashboard SHALL provide a dedicated Worksets workspace page backed by `openspec workset list --json`.

#### Scenario: Workset list shows CLI metadata
- **GIVEN** `openspec workset list --json` returns saved worksets
- **WHEN** the user opens the Worksets workspace page
- **THEN** each workset entry MUST show the workset name
- **AND** each entry MUST show the default tool or opener when provided by the CLI
- **AND** each entry MUST show the member count
- **AND** each entry MUST show member folders in CLI order

#### Scenario: First workset member is primary
- **GIVEN** a workset has at least one member folder
- **WHEN** the Worksets workspace page renders that workset
- **THEN** the first member MUST be identified as the primary member
- **AND** the UI MUST indicate that OpenSpec sessions start from that primary folder

#### Scenario: Workset open action launches workspace view
- **GIVEN** a workset is listed on the Worksets workspace page
- **WHEN** the user triggers the workset open action
- **THEN** the extension MUST request `openspec workset open <name>` or the equivalent supported opener flow
- **AND** the action MUST NOT directly change the selected OpenSpec root in the current dashboard data

#### Scenario: Empty workset list
- **GIVEN** `openspec workset list --json` returns no saved worksets
- **WHEN** the user opens the Worksets workspace page
- **THEN** the page MUST show an empty state explaining that worksets are saved multi-folder workspace views
- **AND** the empty state MUST NOT imply that no project or store OpenSpec roots exist

### Requirement: Workset And Root Semantics Are Clear
Dashboard SHALL explain and preserve the distinction between worksets, project roots, and store roots during cross-project development.

#### Scenario: Workset page explains root selection remains explicit
- **GIVEN** the user is viewing the Worksets workspace page
- **WHEN** at least one project or store root is available
- **THEN** the page MUST communicate that opening a workset changes the editor workspace view
- **AND** it MUST communicate that OpenSpec artifacts are still scoped by the selected project or store root

#### Scenario: Current root remains visible while managing worksets
- **GIVEN** the user has selected a project or store root
- **WHEN** the user navigates to the Worksets workspace page
- **THEN** the dashboard MUST keep the current OpenSpec root visible or easily recoverable
- **AND** workset management MUST NOT obscure which root owns visible changes and specs

#### Scenario: Store and project maintenance is separate from workset launching
- **GIVEN** dashboard provides store setup, store register, project root selection, and workset open actions
- **WHEN** those actions are rendered
- **THEN** store/project root management MUST be visually and behaviorally separate from workset launch actions
- **AND** root-affecting actions MUST use root-scoped pending states
- **AND** workset launch actions MUST use workspace-launch pending or feedback states

## Design Constraints

- Dashboard MUST use VSCode webview API
- UI MUST follow VSCode theme colors
- Layout MUST be responsive (support narrow panels)
- All interactions MUST provide visual feedback
- Error states MUST show helpful messages

## Dependencies

- OpenSpec CLI installed and available
- `openspec/` directory exists in workspace
- File system watcher active
