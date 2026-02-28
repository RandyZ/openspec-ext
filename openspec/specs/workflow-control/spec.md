# Workflow Control Specification

## Purpose

为 ChangeDetail 面板和 Dashboard ChangeCard 提供基于 OpenSpec Workflow 的智能交互控制，使插件从"查看工具"进化为"工作流推进引擎"。

## ADDED Requirements

### Requirement: Workflow Step Indicator

系统应在 ChangeDetail 面板中展示当前 change 的工作流进度。

#### Scenario: 步骤条展示当前进度

- **GIVEN** 用户打开一个 change 的 detail 面板
- **WHEN** 面板加载完成
- **THEN** 面板顶部应显示一个水平步骤条，包含以下步骤：Proposal → Specs → Design → Tasks → Apply → Verify → Archive
- **AND** 已完成的步骤（对应 artifact 已存在）应显示完成标记（✓）
- **AND** 当前推荐步骤应以主色（primary color）高亮
- **AND** 未来步骤应以灰色显示

#### Scenario: 步骤条可交互

- **GIVEN** 步骤条中有已完成和待完成的步骤
- **WHEN** 用户点击一个已完成步骤（如 Proposal）
- **THEN** 应切换到对应的 tab 查看内容
- **WHEN** 用户点击当前推荐步骤（高亮步骤）
- **THEN** 应触发该步骤的创建动作（通过 adapter fillChat 发送对应 `/opsx:continue` 命令）

#### Scenario: 归档 change 的步骤条只读

- **GIVEN** 一个已归档的 change
- **WHEN** 步骤条显示
- **THEN** 所有步骤应显示为已完成状态
- **AND** 步骤不可点击触发创建动作（仅允许切换 tab 查看）

### Requirement: 动态 ActionBar

ActionBar 应根据 change 的工作流状态动态调整显示的按钮。

#### Scenario: 刚创建的 change（无 artifact）

- **GIVEN** 一个无任何 artifact 的 draft change
- **WHEN** ActionBar 渲染
- **THEN** 应显示主要按钮 **Continue**（高亮样式）
- **AND** 应显示次要按钮 **FF**（一键创建全部 artifact）
- **AND** Continue 按钮点击后应通过 adapter fillChat 发送 `/opsx:continue <changeName>`
- **AND** FF 按钮点击后应通过 adapter fillChat 发送 `/opsx:ff <changeName>`

#### Scenario: 部分 artifact 已创建

- **GIVEN** 一个 change 有 proposal 但缺少 specs/design/tasks
- **WHEN** ActionBar 渲染
- **THEN** 主要按钮应为 **Continue**
- **AND** 次要按钮应包含 FF 和 Open in Editor
- **AND** Continue 文案应标注下一个待创建的 artifact（如 "Continue → Specs"）

#### Scenario: 全部 planning artifact 就绪但 tasks 未完成

- **GIVEN** proposal、specs、design、tasks 均已创建，但 tasks 未全部完成
- **WHEN** ActionBar 渲染
- **THEN** 主要按钮应为 **Apply**（通过 adapter fillChat 发送 `/opsx:apply <changeName>`）
- **AND** 次要按钮应包含 Verify 和 Open in Editor

#### Scenario: 全部 tasks 完成

- **GIVEN** 全部 tasks 已勾选完成
- **WHEN** ActionBar 渲染
- **THEN** 主要按钮应为 **Verify**（通过 adapter fillChat 发送 `/opsx:verify <changeName>`）
- **AND** 次要按钮应包含 **Archive**、Sync Specs

#### Scenario: ActionBar 保留只读操作

- **GIVEN** 任何状态的 change
- **WHEN** ActionBar 渲染
- **THEN** Open in Editor、Refresh 按钮应始终可用
- **AND** 归档 change 的 ActionBar 不显示任何写操作按钮（现有行为保持不变）

### Requirement: `/opsx:continue` 交互入口

系统应在多个位置提供 `/opsx:continue` 的触发入口。

#### Scenario: ActionBar 的 Continue 按钮

- **GIVEN** change 不是归档状态且有待创建的 artifact
- **WHEN** 用户点击 Continue 按钮
- **THEN** 系统应通过当前 adapter 的 fillChat 方法发送 `/opsx:continue <changeName>`
- **AND** 应复用现有 adapter 机制（Cursor Chat / Clipboard 回退）

#### Scenario: ArtifactViewer 的"用 AI 创建"改为 Continue

- **GIVEN** 一个空 artifact tab 显示 "用 AI 创建" 按钮
- **WHEN** 按钮文案和行为
- **THEN** 按钮应通过 adapter fillChat 发送 `/opsx:continue <changeName>`（而非当前的 `requestCreateArtifact`）
- **AND** 依赖链检查保持不变（如 Design 需要先有 Proposal）

### Requirement: `/opsx:explore` 入口

系统应在 draft change 的空状态中提供探索入口。

#### Scenario: 无 artifact 的 change 提供 Explore 入口

- **GIVEN** 一个无任何 artifact 的 draft change
- **WHEN** 用户查看 Proposal tab（空状态）
- **THEN** 除了 "用 AI 创建" 外，应额外显示 **Explore** 按钮
- **AND** Explore 按钮点击后应通过 adapter fillChat 发送 `/opsx:explore`

### Requirement: `/opsx:verify` 常驻入口

系统应在非 debug 模式下也提供 verify 的入口。

#### Scenario: Verify Tab 显示条件

- **GIVEN** 一个 change 有 tasks.md 且至少有一个 task 已完成
- **WHEN** tab 列表渲染
- **THEN** 应显示 Verify tab（不再仅限 debug 模式）

#### Scenario: 归档前 Verify 引导

- **GIVEN** 用户点击 Archive Change 按钮
- **AND** change 尚未执行过 verify
- **WHEN** 弹出确认对话框
- **THEN** 对话框应提示建议先 verify
- **AND** 提供 "先 Verify" 和 "直接 Archive" 两个选项

### Requirement: `/opsx:sync` 入口

系统应提供 delta spec 同步操作入口。

#### Scenario: Sync Specs 按钮

- **GIVEN** 一个 change 有 delta specs（specs/ 目录非空）
- **AND** change 不是归档状态
- **WHEN** ActionBar 渲染
- **THEN** 应显示 **Sync Specs** 按钮
- **AND** 点击后通过 adapter fillChat 发送 `/opsx:sync <changeName>`

### Requirement: Dashboard ChangeCard 智能操作

ChangeCard 的 hover 快捷操作应根据 change 状态智能推荐。

#### Scenario: Draft change 的 hover 操作

- **GIVEN** 一个无 artifact 或部分 artifact 的 draft change
- **WHEN** 用户 hover 卡片
- **THEN** 主要操作应为 **Continue** 或 **FF**（而非 Copy /opsx:apply）

#### Scenario: Completed change 的 hover 操作

- **GIVEN** 一个全部 tasks 完成的 change
- **WHEN** 用户 hover 卡片
- **THEN** 主要操作应为 **Verify** 和 **Archive**

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
