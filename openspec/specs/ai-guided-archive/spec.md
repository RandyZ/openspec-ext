# AI-guided Archive Specification

## Purpose

为高影响归档提供审查优先、绑定安全且可明确选择 direct CLI 逃生路径的统一用户交互，并确保 Dashboard、详情页与命令入口遵循同一套安全边界。

## Requirements

### Requirement: AI-guided archive is the primary Detail action

扩展 SHALL 将 Change Detail 中的 AI 审查归档作为主要归档动作，并复用现有交互式 workflow session。

#### Scenario: Review and Archive starts the interactive workflow

- **GIVEN** 用户打开未归档 Change 的 `Verify & Archive` tab
- **WHEN** 用户点击 `Review & Archive`
- **THEN** 扩展 MUST 通过交互式 terminal runner 发起 `/opsx-archive <change>`
- **AND** UI MUST 展示该 session 的 running、error、reveal、stop 与 clear 状态
- **AND** 此动作 MUST NOT 发送 direct `archiveChange` message

#### Scenario: Incomplete Change can request review

- **GIVEN** Change 的 tasks 或 required artifacts 尚未完成
- **WHEN** 用户进入 `Verify & Archive` tab
- **THEN** `Review & Archive` MAY 保持可用以获取 Agent review/advice
- **AND** UI MUST NOT 暗示该 Change 已满足 direct archive 条件

#### Scenario: Archived Change is read-only

- **GIVEN** Change 已归档
- **WHEN** Change Detail 渲染
- **THEN** `Review & Archive` 与 `Archive Now` MUST NOT 可执行
- **AND** Detail MUST 保持只读

### Requirement: Direct archive is an explicit secondary Detail action

扩展 SHALL 仅在 Change Detail 中以明确的次要动作 `Archive Now` 暴露 direct archive，并在执行前要求确认。

#### Scenario: Archive Now is enabled by shared resolution

- **GIVEN** 当前 binding 的 required artifacts 已完成
- **AND** 所有 tasks 已完成
- **AND** 共享 workflow resolver 返回可用的高影响 Archive action
- **WHEN** `Verify & Archive` tab 渲染
- **THEN** `Archive Now` MUST 可用
- **AND** UI MUST NOT 使用独立阶段推导覆盖 resolver 结果

#### Scenario: Archive Now is disabled when incomplete

- **GIVEN** 共享 workflow resolver 未返回可用的高影响 Archive action
- **WHEN** `Verify & Archive` tab 渲染
- **THEN** `Archive Now` MUST 被禁用或隐藏
- **AND** UI MUST 展示可访问的不可用原因
- **AND** `Review & Archive` MAY 保持可用

#### Scenario: Archive Now confirms before direct execution

- **GIVEN** `Archive Now` 可用
- **WHEN** 用户选择该动作
- **THEN** 扩展 MUST 显示现有 direct archive 确认对话框
- **AND** 取消 MUST 产生零文件变更
- **AND** 明确确认后才可通过当前 binding 的 direct archive CLI 路径执行

### Requirement: Archive entry points preserve the safety boundary

Dashboard、Change Detail 与 Command Palette SHALL 保持明确且一致的归档职责边界。

#### Scenario: Dashboard high-impact action opens Change Detail

- **GIVEN** Dashboard 展示 Ready to Verify 或可归档的 Change
- **WHEN** 用户选择 Verify/Archive 高影响入口
- **THEN** 扩展 MUST 打开或 reveal 绑定正确的 Change Detail
- **AND** Detail MUST 切换到 `Verify & Archive`
- **AND** Dashboard MUST NOT 直接发送 `archiveChange`

#### Scenario: Ready to Verify remains the recommended lifecycle action

- **GIVEN** Change 的全部 tasks 已完成且尚未归档
- **WHEN** 共享 workflow resolver 计算动作
- **THEN** Verify MUST 保持 recommended action
- **AND** Archive MUST 保持 high-impact secondary action
- **AND** UI MUST NOT 将 direct CLI archive 提升为默认动作
