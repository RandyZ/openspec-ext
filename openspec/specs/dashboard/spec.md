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
