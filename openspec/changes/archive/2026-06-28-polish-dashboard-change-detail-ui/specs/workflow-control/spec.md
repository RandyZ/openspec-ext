## MODIFIED Requirements

### Requirement: 动态 ActionBar
ActionBar SHALL 仅承载 workflow 推进动作；对象级辅助操作 SHALL 由 change detail header 承载，并保持高影响 workflow 动作与普通工具动作隔离。

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

#### Scenario: Archived change remains read-only
- **GIVEN** 某个 change 已归档
- **WHEN** ActionBar 渲染
- **THEN** 系统 MUST 不展示会触发写入的 workflow 动作
- **AND** 复制、打开与刷新等只读辅助操作 MUST 只保留在 header 工具区

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

## ADDED Requirements

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
