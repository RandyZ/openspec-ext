## Why

扩展已经具备共享 Action Model、交互式 `Verify & Archive` tab 和 direct archive 确认链路，但归档入口仍缺少清晰分工：高影响的默认入口应先进入绑定正确的 Change Detail 完成审查，直接 CLI 归档只能由用户显式选择。现有 Change 的旧规划早于这些基础能力，会重复新增 split button 和 workflow state，需要先按当前架构收敛。

## What Changes

- Dashboard 的 Verify/Archive 高影响入口只打开或 reveal 绑定正确的 Change Detail，并切换到 `Verify & Archive`，不在卡片上直接归档或新增 split button。
- Change Detail 将 `Review & Archive` 作为主要归档动作，复用现有交互式 terminal runner 发起 `/opsx-archive <change>`。
- Change Detail 提供明确的次要动作 `Archive Now`，仅在共享 resolver 判定可直接归档时启用，并复用现有确认对话框、scope 绑定和 CLI archive 链路。
- 不完整 Change 仍可进入审查流程，但 `Archive Now` 必须禁用并解释原因；已归档 Change 保持只读。
- 保留 Command Palette 的 direct archive 能力，不新增并行 Action Model、通用 split-button 组件、消息协议或依赖。

## Capabilities

### New Capabilities

- `ai-guided-archive`: 定义 Dashboard 到 Change Detail 的安全归档入口、Detail 中的审查优先动作与显式 direct archive 逃生路径。

### Modified Capabilities

- `dashboard`: Verify/Archive 高影响入口必须进入绑定正确的 Change Detail 安全流程，Dashboard 不提供 direct archive 菜单。
- `cli-integration`: direct archive 仅由显式 `Archive Now` 或 Command Palette 路径触发，并继续按官方普通 CLI 输出处理。

## Impact

- Webview：`VerifyArchivePanel`、`ChangeDetail`、Dashboard 高影响动作导航和相关 i18n 文案。
- Extension Host：复用现有 `archiveChange` message、`confirmDirectArchive()`、scope-aware `DataManager.archiveChange()` 和刷新链路。
- Tests：共享 resolver gating、Detail 双动作、Dashboard 导航、direct archive 取消/确认/错误回归。
- Dependencies：无新增依赖；复用已落地的 Action Model 与交互式 workflow runner。
