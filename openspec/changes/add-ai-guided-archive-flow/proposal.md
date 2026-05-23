## Why

Archive 当前默认由扩展直接调用 OpenSpec CLI 移动 change，这对确定性归档很快，但绕过了 OpenSpec/Superpowers 推荐的 Agent 审查、验证和 sync 判断流程。归档是高影响动作，默认入口应优先引导用户进入 AI 审查归档，同时保留明确的 `Archive Now` 快捷路径给用户主动选择。

参考 Superpowers 设计文档：[Cursor 原生交互与 AI 归档流程设计](../../../docs/superpowers/specs/2026-05-23-cursor-native-interaction-and-ai-archive-design.md)。

## What Changes

- 将 Dashboard 和 Change Detail 中的 Archive 主动作改为 `Review & Archive`。
- 主动作通过 Agent command `/opsx-archive <change>` 进入 AI 审查归档流程。
- 将 Archive 操作呈现为主按钮 + 下拉菜单组合，下拉中提供 `Archive Now`。
- `Archive Now` 继续调用现有 CLI archive 能力，并保留二次确认和风险提示。
- 当 tasks 或 artifacts 未完成时，仍可进入 `Review & Archive` 获取 Agent 建议，但 `Archive Now` 默认禁用并展示原因。
- Verify 完成后的推荐动作指向 `Review & Archive`，不再默认鼓励直接 CLI 归档。
- 不修改 `/opsx-archive` skill 的具体流程，不引入 MCP。

## Capabilities

### New Capabilities

- `ai-guided-archive`: 扩展提供默认 AI 审查归档入口和直接归档下拉入口的能力，包括状态规则、风险提示和 Dashboard/Detail 一致性。

### Modified Capabilities

- `dashboard`: Dashboard quick actions 需要将归档主动作改为 AI 审查路径，并提供 `Archive Now` 下拉入口。
- `cli-integration`: 直接 archive CLI 能力保留，但作为用户显式选择的 `Archive Now` 路径，而不是归档主动作。

## Impact

- Webview: ActionBar、ChangeCard、workflow state、归档按钮文案、下拉菜单组件和状态提示。
- Extension host: `archiveChange` message 继续保留为 direct archive；AI archive 主路径复用 Chat/command routing。
- Specs: 新增 `ai-guided-archive`，并更新 `dashboard`、`cli-integration` 的归档行为要求。
- Dependency: 最终验收依赖 `improve-cursor-native-interaction` 提供稳定 command builder 和 Chat 路由。
