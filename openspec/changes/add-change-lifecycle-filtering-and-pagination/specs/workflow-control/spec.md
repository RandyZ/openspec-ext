## MODIFIED Requirements

### Requirement: Dashboard ChangeCard 智能操作

ChangeCard 的 workflow 快捷操作 SHALL 直接消费 Extension Host 提供的统一 `ChangeLifecycleStatus`，并与 Changes Workspace 的状态标签保持一致。

ChangeCard MUST NOT 再独立根据 Artifact 和 Task 数据重新推导另一套生命周期。

#### Scenario: Planning change emphasizes planning progression

- **GIVEN** 某个 Change 的生命周期状态为 `planning`
- **WHEN** 用户在 Dashboard 中进入该卡片的 hover 或 focus 状态
- **THEN** 推荐操作 MUST 包含 Continue
- **AND** 系统 SHOULD 提供 FF 作为次要推进操作
- **AND** 系统 MUST NOT 推荐 Verify 或 Archive

#### Scenario: Ready to Apply change emphasizes Apply

- **GIVEN** 某个 Change 的生命周期状态为 `ready-to-apply`
- **WHEN** 用户进入卡片的 hover 或 focus 状态
- **THEN** 主要推荐操作 MUST 为 Apply
- **AND** 卡片显示的生命周期标签 MUST 为 `Ready to Apply`

#### Scenario: Applying change continues implementation

- **GIVEN** 某个 Change 的生命周期状态为 `applying`
- **WHEN** 用户进入卡片的 hover 或 focus 状态
- **THEN** 推荐操作 MUST 指向 Apply 或 Continue Apply
- **AND** 系统 MUST NOT 将该 Change 显示为 Ready to Verify

#### Scenario: Ready to Verify change emphasizes verification path

- **GIVEN** 某个 Change 的生命周期状态为 `ready-to-verify`
- **WHEN** 用户进入卡片的 hover 或 focus 状态
- **THEN** 推荐操作 MUST 突出 Verify
- **AND** Verify MUST 进入既有 `Verify & Archive` 交互式流程
- **AND** 系统 MAY 同时提供 Archive 的次要入口，但 MUST 保留 Verify guidance

#### Scenario: Archived change remains read-only

- **GIVEN** 某个 Change 的生命周期状态为 `archived`
- **WHEN** 卡片渲染或进入 hover/focus 状态
- **THEN** 系统 MUST NOT 展示 Continue、FF、Apply、Verify、Archive 等写入型操作
- **AND** 系统 MAY 提供打开详情、复制名称等只读操作

#### Scenario: Lifecycle status is the single source of truth

- **GIVEN** ChangeCard 收到生命周期状态和原始 Artifact/Task 数据
- **WHEN** 卡片生成状态标签和 workflow 快捷操作
- **THEN** 状态标签和操作映射 MUST 以生命周期状态为唯一阶段输入
- **AND** 原始 Artifact/Task 数据 MAY 用于展示详情
- **AND** 原始数据 MUST NOT 在卡片内重新生成另一套阶段状态
