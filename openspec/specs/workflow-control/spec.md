# Workflow Control Specification

## Purpose

为 ChangeDetail 面板和 Dashboard ChangeCard 提供基于 OpenSpec Workflow 的智能交互控制，使插件从"查看工具"进化为"工作流推进引擎"。

## Requirements


### Requirement: `/opsx:verify` 常驻入口

系统 SHALL 在非 debug 模式下也提供 Verify 入口，并 MUST 将 Verify 与 Archive 聚合到专用交互式 tab 中。

#### Scenario: Verify & Archive Tab 显示条件
- **GIVEN** 一个 change 有 tasks.md 且至少有一个 task 已完成
- **WHEN** tab 列表渲染
- **THEN** 应显示 `Verify & Archive` tab（不再仅限 debug 模式）
- **AND** tab 列表 MUST NOT 显示旧的独立 `Verify` tab 名称

#### Scenario: Verify & Archive tab 提供交互式 Verify 入口
- **GIVEN** 用户打开 `Verify & Archive` tab
- **WHEN** tab 内容渲染
- **THEN** 应显示 **Run Verify** 操作
- **AND** 点击后必须通过交互式 terminal runner 发起 `/opsx-verify <changeName>`

#### Scenario: 归档前 Archive 引导
- **GIVEN** 用户准备归档一个未归档 change
- **WHEN** 用户打开 `Verify & Archive` tab
- **THEN** 应显示 **Run Archive** 或 **Review & Archive** 操作
- **AND** 点击后必须通过交互式 terminal runner 发起 `/opsx-archive <changeName>`
- **AND** 不应直接调用 `archiveChange` 移动 change 文件

#### Scenario: Direct archive keeps Verify guidance
- **GIVEN** 用户通过仍存在的 direct archive 入口归档 change
- **AND** change 尚未执行过 verify
- **WHEN** 弹出确认对话框
- **THEN** 对话框应提示建议先 verify
- **AND** 应提供进入 `Verify & Archive` 的选择
- **AND** 应保留用户明确选择继续 direct archive 的逃生路径

#### Scenario: 交互式 session 控制
- **GIVEN** Verify 或 Archive terminal session 已存在
- **WHEN** `Verify & Archive` tab 渲染
- **THEN** 应展示 session 状态
- **AND** 应提供 Reveal Terminal、Stop、Clear Session 控制

### Requirement: `/opsx:sync` 入口

系统 MUST 提供 delta spec 同步操作入口。

#### Scenario: Sync Specs 按钮

- **GIVEN** 一个 change 有 delta specs（specs/ 目录非空）
- **AND** change 不是归档状态
- **WHEN** ActionBar 渲染
- **THEN** 应显示 **Sync Specs** 按钮
- **AND** 点击后通过 adapter fillChat 发送 `/opsx:sync <changeName>`

### Requirement: Change Detail Header Utilities

系统 SHALL 在 change detail header 中提供围绕 change 身份的辅助操作，并保证 icon button 的可访问性。

#### Scenario: Copy change name from header
- **GIVEN** 用户打开某个 change 的 detail 面板
- **WHEN** 用户点击 change 名称旁的复制按钮
- **THEN** 系统 MUST 仅复制纯 change 名称文本
- **AND** 系统 MUST 提供复制成功反馈
- **AND** 复制内容 MUST NOT 包含 workflow 命令前缀或附加描述

#### Scenario: Icon buttons expose accessible names
- **GIVEN** header 或 ActionBar 中存在仅图标形式的按钮
- **WHEN** 用户使用鼠标、键盘或辅助技术访问这些按钮
- **THEN** 每个按钮 MUST 具有可感知的可访问名称
- **AND** 系统 MUST 提供 tooltip 或等价提示来解释按钮用途
- **AND** 按钮的可点击区域 MUST 满足稳定且可操作的尺寸要求

#### Scenario: Header actions wrap without obscuring title
- **GIVEN** 用户在窄宽度侧栏中查看 change detail
- **WHEN** header 可用宽度不足以并排容纳标题、状态摘要与辅助操作
- **THEN** 系统 MUST 允许辅助操作换行或重排
- **AND** 系统 MUST 保证 change 名称与状态摘要保持可读
- **AND** 系统 MUST 不让按钮与标题文本发生重叠

### Requirement: Workflow actions use selected scope
Workflow actions SHALL target the selected writable OpenSpec scope.

#### Scenario: Local scope workflow command
- **GIVEN** the selected scope is the workspace local root
- **WHEN** the user launches Continue, FF, Apply, Sync, Verify, or Archive from the dashboard or change detail
- **THEN** the generated workflow command MUST preserve current local-root behavior
- **AND** it MUST NOT include a store selector unless the target adapter explicitly requires one in future

#### Scenario: Store scope workflow command
- **GIVEN** the selected scope is a registered store
- **WHEN** the user launches a workflow action for a store-scoped change
- **THEN** the extension MUST ensure the launched agent path includes the selected store context
- **AND** any OpenSpec CLI command executed by the extension for that action MUST include `--store <id>` when applicable

#### Scenario: Scope identity shown before high-impact action
- **GIVEN** the user is about to run Apply, Sync, Verify, Archive, task toggle, or direct archive
- **WHEN** the selected scope is a store or declared store
- **THEN** the UI MUST show the active store id or declared store source near the action
- **AND** the user MUST be able to distinguish it from local root execution before triggering the action

### Requirement: Referenced stores are not workflow targets
Workflow controls SHALL not treat referenced stores as writable targets unless explicitly selected as the active scope.

#### Scenario: Reference row has no workflow buttons
- **GIVEN** a referenced store is shown in the relationship panel
- **WHEN** the user interacts with the referenced store row
- **THEN** the row MUST NOT show Continue, FF, Apply, Sync, Verify, Archive, or task-toggle buttons

#### Scenario: Selecting reference as store changes scope
- **GIVEN** a referenced store is registered locally
- **WHEN** the UI offers and the user chooses to work in that store
- **THEN** the extension MUST switch the selected scope to that store
- **AND** the dashboard MUST refresh before showing writable workflow actions for that store

#### Scenario: Unregistered reference cannot become writable
- **GIVEN** a referenced store is unresolved or unregistered
- **WHEN** the user views it in the relationship panel
- **THEN** the UI MUST show recovery guidance
- **AND** it MUST NOT offer writable workflow actions for that store

### Requirement: Change detail inherits selected scope
Change detail panels SHALL be aware of the scope used to open them.

#### Scenario: Open change detail from store dashboard
- **GIVEN** the dashboard is showing a store scope
- **WHEN** the user opens a change detail from a store change card
- **THEN** the change detail MUST load artifacts and task state from the same store scope
- **AND** its header MUST show the active store id or equivalent scope indicator

#### Scenario: Existing detail updates on scope refresh
- **GIVEN** a change detail panel is open
- **WHEN** the selected scope changes or dashboard refreshes a different scope
- **THEN** the panel MUST not silently reinterpret the same change name under a different root
- **AND** it MUST either remain bound to its original scope or clearly reload under the new selected scope

#### Scenario: Archived detail remains scoped
- **GIVEN** an archived change is opened from a store scope
- **WHEN** the detail view renders
- **THEN** all archived artifact reads MUST use that store root
- **AND** write actions MUST remain disabled

### Requirement: Interactive Verify and Archive are scope-aware
The interactive Verify and Archive workflows SHALL make the selected scope explicit and use the correct root.

#### Scenario: Store-scoped Verify terminal
- **GIVEN** a store scope is selected
- **WHEN** the user starts Verify from the Verify & Archive tab
- **THEN** the terminal workflow MUST be launched with enough context to operate on the selected store
- **AND** any direct OpenSpec CLI invocation owned by the extension MUST include `--store <id>`

#### Scenario: Store-scoped Archive terminal
- **GIVEN** a store scope is selected
- **WHEN** the user starts Archive from the Verify & Archive tab
- **THEN** the terminal workflow MUST show the selected store id in the UI before launch
- **AND** it MUST not archive a same-named local-root change by mistake

#### Scenario: Direct archive confirmation names scope
- **GIVEN** a direct archive escape path is still available
- **WHEN** the selected scope is not the local root
- **THEN** the confirmation dialog MUST include the active scope label
- **AND** the archive command MUST target the selected scope

### Requirement: Shared workflow action resolution
The extension SHALL derive workflow actions through one shared resolver that consumes the root-bound Change workflow snapshot and supplies consistent results to Sidebar, Change Detail, and Dashboard.

#### Scenario: First ready artifact is recommended
- **GIVEN** the ordered artifact graph contains one or more artifacts with status `ready`
- **WHEN** workflow actions are resolved
- **THEN** the first ready artifact in CLI declaration order MUST determine the recommended planning action
- **AND** every other ready artifact MUST remain visible as available now

#### Scenario: Blocked and skipped artifacts retain distinct meaning
- **GIVEN** the artifact graph contains blocked and skipped artifacts
- **WHEN** workflow state is displayed
- **THEN** blocked artifacts MUST be non-actionable and MUST expose their missing dependencies
- **AND** skipped artifacts MUST be identified as skipped rather than completed or blocked

#### Scenario: Planning completion recommends Apply
- **GIVEN** OpenSpec reports planning complete
- **AND** tasks remain incomplete
- **WHEN** workflow actions are resolved
- **THEN** Apply MUST be the recommended implementation action
- **AND** planning creation actions MUST NOT remain the primary action

#### Scenario: Completed tasks recommend Verify without auto-archive
- **GIVEN** planning is complete and all tasks are complete
- **WHEN** workflow actions are resolved
- **THEN** Verify MUST be recommended
- **AND** Archive MUST remain a separate high-impact action
- **AND** the Change MUST NOT be represented as archived until OpenSpec reports it as archived

#### Scenario: Sync Specs is conditional
- **GIVEN** a Change has no delta specs eligible for synchronization
- **WHEN** workflow actions are resolved
- **THEN** Sync Specs MUST NOT be shown as a fixed workflow stage
- **AND** it MUST appear only when current Change data indicates applicable spec deltas

#### Scenario: All surfaces consume the same resolved action semantics
- **GIVEN** Sidebar, Change Detail, and Dashboard display the same bound Change snapshot
- **WHEN** each surface renders its workflow summary
- **THEN** they MUST agree on the recommended action, other available actions, and blocked reasons
- **AND** a surface MAY reduce detail but MUST NOT independently recalculate a contradictory lifecycle

#### Scenario: Archived Change remains read-only history
- **GIVEN** a Change is archived
- **WHEN** workflow actions are resolved
- **THEN** no write-producing workflow action MUST be returned
- **AND** the UI MUST NOT fabricate completed states for artifacts absent from the archived data

### Requirement: Continue planning describes its real capability
The extension SHALL present `/opsx:continue <changeName>` as a generic planning continuation action unless the execution contract explicitly supports selecting a target artifact.

#### Scenario: Generic Continue shows next artifact context
- **GIVEN** planning is incomplete and the first ready artifact is `specs`
- **WHEN** the Continue action is displayed
- **THEN** the executable label MUST describe a generic planning continuation
- **AND** supporting text MUST identify `specs` as the next artifact
- **AND** the generated command MUST remain `/opsx:continue <changeName>`

#### Scenario: Parallel ready artifacts remain visible
- **GIVEN** both `specs` and `design` are ready
- **WHEN** Continue planning is displayed
- **THEN** one artifact MUST be identified as next according to CLI order
- **AND** the other artifact MUST be identified as also available
- **AND** the UI MUST NOT imply that only the recommended artifact is permitted

#### Scenario: No misleading targeted create action
- **GIVEN** the current adapter only supports generic `/opsx:continue`
- **WHEN** an artifact has not been created
- **THEN** the UI MUST NOT offer an executable action labeled as creating that specific artifact
- **AND** the user MAY navigate to the artifact's blocked or ready explanation without triggering a guessed command

### Requirement: Workflow action hierarchy remains safe
Change Detail SHALL emphasize at most one recommended workflow action, keep alternative actions accessible, and isolate high-impact actions from ordinary navigation utilities.

#### Scenario: One primary action with accessible alternatives
- **GIVEN** a Change has a recommended action and one or more other available actions
- **WHEN** Change Detail renders its action area
- **THEN** exactly one action MUST receive primary visual emphasis
- **AND** the other available actions MUST remain keyboard-accessible through a secondary group or disclosure
- **AND** action meaning MUST be conveyed by text and not color alone

#### Scenario: Header utilities do not become workflow actions
- **GIVEN** Change Detail exposes copy, open, or refresh utilities
- **WHEN** the header and action area render
- **THEN** those utilities MUST remain visually separate from workflow progression actions
- **AND** they MUST NOT affect resolver state

#### Scenario: Verify and Archive retain dedicated handling
- **GIVEN** Verify or Archive is available
- **WHEN** the user chooses the action
- **THEN** the extension MUST use the existing dedicated interactive or confirmation path
- **AND** it MUST NOT silently route the high-impact action as a normal artifact navigation click

## Design Constraints

- 所有工作流命令通过现有 adapter 机制（fillChat / clipboard 回退）发送，不直接执行 CLI
- 步骤条设计须适配 VS Code 暗色/亮色主题，使用 `var(--vscode-*)` CSS 变量
- 步骤条在窄面板（sidebar 300px）下应可横向滚动或自适应换行
- 不新增消息协议类型，复用现有 `runCommand` / adapter fillChat 机制
- 归档 change 的所有写操作限制保持不变

## Dependencies

- 现有 adapter 机制（`fillChat` 方法）
- `existingArtifactIds` 数据（已由 ChangeDetail 获取）
- Task 完成度数据（已由 Dashboard 数据提供）
- `deltaSpecIds` 数据（已由 ChangeDetail 获取）
- Interactive Agent Terminal（`interactive-agent-terminal` spec）
