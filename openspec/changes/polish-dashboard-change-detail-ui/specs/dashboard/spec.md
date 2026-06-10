## MODIFIED Requirements

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
- **AND** 系统 MUST NOT 同时触发“打开 change 详情”的卡片点击行为

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
