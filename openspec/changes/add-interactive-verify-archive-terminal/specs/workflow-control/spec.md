> 参考 Superpowers 设计文档：[Interactive Verify & Archive Terminal 设计](../../../../../docs/superpowers/specs/2026-05-25-interactive-verify-archive-terminal-design.md)
>
> 参考 Superpowers 实现计划：[Interactive Verify & Archive Terminal Implementation Plan](../../../../../docs/superpowers/plans/2026-05-25-interactive-verify-archive-terminal-plan.md)

## MODIFIED Requirements

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
ActionBar SHALL 根据 change 的工作流状态动态调整显示的按钮，并 MUST 将 Verify/Archive 这类高影响 workflow 移入 `Verify & Archive` tab。

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
- **AND** 次要按钮应包含 FF 和 Open in Editor
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

#### Scenario: ActionBar 保留只读操作
- **GIVEN** 任何状态的 change
- **WHEN** ActionBar 渲染
- **THEN** Open in Editor、Refresh 按钮应始终可用
- **AND** 归档 change 的 ActionBar 不显示任何写操作按钮（现有行为保持不变）

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
