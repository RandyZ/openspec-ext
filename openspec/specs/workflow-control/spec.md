# Workflow Control Specification

## Purpose

为 ChangeDetail 面板和 Dashboard ChangeCard 提供基于 OpenSpec Workflow 的智能交互控制，使插件从"查看工具"进化为"工作流推进引擎"。

## Requirements

### Requirement: Workflow Step Indicator

系统 SHALL 在 ChangeDetail 面板中展示当前 change 的工作流进度，但 MUST NOT 把高影响 workflow 操作堆叠在 tab 上方。

#### Scenario: 步骤状态以紧凑摘要展示当前进度
- **GIVEN** 用户打开一个 change 的 detail 面板
- **WHEN** 面板加载完成
- **THEN** 面板顶部应显示紧凑的工作流状态摘要，包含 Proposal、Specs、Design、Tasks、Apply、Verify、Archive 的完成或推荐状态
- **AND** 已完成的步骤应显示完成标记或等价视觉状态
- **AND** 当前推荐步骤应以主色或等价强调状态显示
- **AND** 未来步骤应以弱化状态显示
- **AND** 面板顶部 MUST NOT 显示占据整行的 Verify/Archive 操作按钮堆叠

#### Scenario: 步骤状态可导航但高影响动作进入专用 tab
- **GIVEN** 步骤状态中有已完成和待完成的步骤
- **WHEN** 用户点击一个已完成 artifact 步骤（如 Proposal）
- **THEN** 应切换到对应的 tab 查看内容

#### Scenario: 当前推荐的非高影响步骤仍可推进
- **GIVEN** 步骤状态中存在当前推荐步骤
- **AND** 当前推荐步骤不是 Verify 或 Archive
- **WHEN** 用户点击当前推荐步骤
- **THEN** 系统应通过 workflow command routing 发起对应 OpenSpec workflow command
- **AND** 该行为应复用现有 clipboard、adapter、deeplink、chatCommand 或 headless agentCli 路由设置

#### Scenario: Verify 和 Archive 步骤进入专用交互 tab
- **GIVEN** 步骤状态中包含 Verify 或 Archive 步骤
- **WHEN** 用户点击 Verify 或 Archive 相关步骤
- **THEN** 应切换到 `Verify & Archive` tab
- **AND** 不应直接从步骤状态触发 headless Agent CLI 或 direct archive

#### Scenario: 归档 change 的步骤状态只读
- **GIVEN** 一个已归档的 change
- **WHEN** 步骤状态显示
- **THEN** 所有步骤应显示为已完成状态
- **AND** 步骤不可点击触发创建、Verify、Archive 或其他写操作
- **AND** 仅允许切换 tab 查看只读内容

### Requirement: 动态 ActionBar

ActionBar SHALL 仅承载 workflow 推进动作；对象级辅助操作 SHALL 由 change detail header 承载，并保持高影响 workflow 动作与普通工具动作隔离。Verify/Archive 这类高影响 workflow MUST 移入 `Verify & Archive` tab。

#### Scenario: Header separates identity tools from workflow controls
- **GIVEN** 用户打开某个 change 的 detail 面板
- **WHEN** 顶部区域渲染完成
- **THEN** 系统 MUST 在 header 中展示 change 名称与状态摘要
- **AND** 系统 MUST 将对象级辅助操作放在与 workflow 推进动作不同的分组中
- **AND** workflow 推进动作 MUST 在独立的 ActionBar 中展示

#### Scenario: Header keeps read-only utilities available
- **GIVEN** 任意状态的 change
- **WHEN** header 渲染
- **THEN** 复制 change 名称、Open in Editor、Refresh 等只读或视图辅助操作 MUST 在 header 中保持可用
- **AND** 这些操作 MUST 不改变 OpenSpec workflow 状态
- **AND** 这些操作 MUST NOT 出现在 workflow ActionBar 中

#### Scenario: High-impact workflow actions remain isolated
- **GIVEN** 某个 change 已满足 Verify 或 Archive 的展示条件
- **WHEN** ActionBar 渲染
- **THEN** 高影响 workflow 动作 MUST 与普通继续类动作分开表达
- **AND** 系统 MUST 避免将 Verify 或 Archive 与普通视图工具混排为同一组操作

#### Scenario: Show in sidebar is removed from the primary header actions
- **GIVEN** 用户查看 change detail 顶部操作区
- **WHEN** header 与 ActionBar 完成渲染
- **THEN** 系统 MUST NOT 将 `Show in sidebar` 作为顶部主要操作入口展示

#### Scenario: 刚创建的 change（无 artifact）
- **GIVEN** 一个无任何 artifact 的 draft change
- **WHEN** ActionBar 渲染
- **THEN** 应显示主要按钮 **Continue**（高亮样式）
- **AND** 应显示次要按钮 **FF**（一键创建全部 artifact）
- **AND** Continue 按钮点击后应通过 workflow command routing 发起 `/opsx:continue <changeName>` 或目标 adapter 对应命令
- **AND** FF 按钮点击后应通过 workflow command routing 发起 `/opsx:ff <changeName>` 或目标 adapter 对应命令

#### Scenario: 部分 artifact 已创建
- **GIVEN** 一个 change 有 proposal 但缺少 specs/design/tasks
- **WHEN** ActionBar 渲染
- **THEN** 主要按钮应为 **Continue**
- **AND** 次要按钮应包含 FF
- **AND** Continue 文案应标注下一个待创建的 artifact（如 "Continue → Specs"）

#### Scenario: 全部 planning artifact 就绪但 tasks 未完成
- **GIVEN** proposal、specs、design、tasks 均已创建，但 tasks 未全部完成
- **WHEN** ActionBar 渲染
- **THEN** Apply 仍可作为实现入口通过 workflow command routing 发起
- **AND** Verify 和 Archive 不应作为 tab 上方 ActionBar 的主按钮或次要按钮展示
- **AND** Verify 和 Archive 入口必须在 `Verify & Archive` tab 中展示

#### Scenario: 全部 tasks 完成
- **GIVEN** 全部 tasks 已勾选完成
- **WHEN** ActionBar 渲染
- **THEN** tab 上方 ActionBar 不应显示 **Verify** 或 **Archive** 运行按钮
- **AND** `Verify & Archive` tab 必须显示 **Run Verify** 和 **Run Archive**
- **AND** Run Verify 与 Run Archive 必须通过交互式 terminal runner 发起，而不是通过 headless `agentCli` 或 direct `archiveChange`

#### Scenario: Archived change remains read-only
- **GIVEN** 某个 change 已归档
- **WHEN** ActionBar 渲染
- **THEN** 系统 MUST 不展示会触发写入的 workflow 动作
- **AND** 复制、打开与刷新等只读辅助操作 MUST 只保留在 header 工具区

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

系统应提供 delta spec 同步操作入口。

#### Scenario: Sync Specs 按钮

- **GIVEN** 一个 change 有 delta specs（specs/ 目录非空）
- **AND** change 不是归档状态
- **WHEN** ActionBar 渲染
- **THEN** 应显示 **Sync Specs** 按钮
- **AND** 点击后通过 adapter fillChat 发送 `/opsx:sync <changeName>`

### Requirement: Dashboard ChangeCard 智能操作

ChangeCard 的 workflow 快捷操作 SHALL 继续根据 change 状态智能推荐，并与 detail 顶部的 workflow 分组语义保持一致。

#### Scenario: Draft change hover actions emphasize planning progression
- **GIVEN** 某个 change 仍处于 draft 或 planning 未完成状态
- **WHEN** 用户在 dashboard 中进入该卡片的 hover 或 focus 状态
- **THEN** 推荐的 workflow 操作 MUST 优先指向 Continue、FF 或其他当前阶段的推进动作
- **AND** 系统 MUST 不将不相关的高影响动作作为默认主推荐

#### Scenario: Completed change hover actions emphasize verification path
- **GIVEN** 某个 change 的 planning artifact 与 tasks 已达到可验证状态
- **WHEN** 用户在 dashboard 中进入该卡片的 hover 或 focus 状态
- **THEN** 推荐操作 MUST 突出 Verify、Archive 或与当前阶段匹配的后续动作
- **AND** 这些动作的语义 MUST 与 change detail 顶部 ActionBar 保持一致

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
