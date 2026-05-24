## Why

OpenSpec 扩展已经能展示 change 状态并提供 Apply、Verify、Continue 等快捷操作，但当前执行配置把“默认复制、目标 adapter、Cursor 打开方式、CLI 自动执行”混在一起，导致用户难以预期按钮点击后的行为。Cursor 中还存在两个具体断点：默认 adapter 可能不是最安全的剪贴板路径，以及 Cursor adapter 只能打开 Agent/Chat 窗口却不能稳定填入内容。

参考 Superpowers 设计文档：[Cursor 原生交互与 AI 归档流程设计](../../../docs/superpowers/specs/2026-05-23-cursor-native-interaction-and-ai-archive-design.md)。

## What Changes

- 将 workflow 启动配置拆分为清晰的用户体验模型：安全默认复制、可选 adapter 路由、Cursor 专属打开模式、自动执行模式。
- 将 `openspec.preferredAgentAdapter` 改为下拉枚举配置，并默认使用 `clipboard`。
- 新增 Cursor 打开模式配置，优先支持官方 deeplink prompt，其次可尝试 Chat command query，失败时回退剪贴板。
- 新增统一的 workflow command/payload builder，将 UI action 转换为目标 adapter 和 launch surface 对应的命令或提示词。
- Cursor/OpenCode 目标使用 `/opsx-apply <change>` 这类 hyphen command；通用/Clipboard 目标保留 `/opsx:apply <change>` 这类 colon command。
- Cursor adapter 的 Chat 路由必须先复制命令并显示 toast，再按配置尝试 deeplink 或 Chat query 打开 Cursor。
- 调整相关 UI 文案，区分 `Open in Chat`、`Copy Command`、`Run Agent CLI` 等真实动作。
- Cursor plugin registration 降级为未来增强，不作为本 change 的主路径；扩展不打包 OpenSpec CLI，也不承诺通过注册插件让 OpenSpec 生效。
- 不引入 MCP，不改变 OpenSpec skills/commands 的业务流程，不默认自动发送 Chat。

## Capabilities

### New Capabilities

- `agent-command-routing`: 扩展将 OpenSpec workflow action 路由为用户选择的启动方式，包括配置分层、命令格式选择、Cursor deeplink/Chat 预填和剪贴板 fallback。

### Modified Capabilities

- `task-management`: 任务执行入口需要通过统一命令路由能力触发 Agent 或 Chat，而不是散落硬编码命令。
- `dashboard`: Dashboard quick actions 需要通过统一命令路由能力打开 Chat 或复制正确命令。

## Impact

- Extension host: adapter registry、Cursor adapter、配置项、toast 通知和 workflow command/payload 生成。
- Webview: Dashboard card、Change Detail action bar、workflow state、任务执行入口和相关文案。
- Specs: 新增 `agent-command-routing`，并更新 `task-management`、`dashboard` 的相关行为要求。
- Compatibility: 非 Cursor 环境必须继续 fallback 到剪贴板，不影响 VS Code 用户。
