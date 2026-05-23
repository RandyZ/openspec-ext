## Why

OpenSpec 扩展已经能展示 change 状态并提供 Apply、Verify、Continue 等快捷操作，但 Cursor 中这些操作仍主要依赖复制 `/opsx:*` 文本，且命令格式与 Cursor command 文件使用的 `/opsx-*` 不一致。最近项目已加入 OpenSpec agent skills 和 workflows，扩展需要把这些能力作为稳定的 IDE workflow launcher 暴露给用户，减少从 UI 操作到 Agent 执行之间的摩擦。

参考 Superpowers 设计文档：[Cursor 原生交互与 AI 归档流程设计](../../../docs/superpowers/specs/2026-05-23-cursor-native-interaction-and-ai-archive-design.md)。

## What Changes

- 在 Cursor 环境中自动注册扩展内置的 OpenSpec Cursor commands/skills 插件路径。
- 新增统一的 workflow command builder，将 UI action 转换为目标 adapter 对应的命令格式。
- Cursor/OpenCode 目标使用 `/opsx-apply <change>` 这类 hyphen command；通用/Clipboard 目标保留 `/opsx:apply <change>` 这类 colon command。
- Cursor adapter 的 Chat 路由优先尝试预填 Chat 输入，失败时回退到复制命令。
- 调整相关 UI 文案，区分 `Open in Chat`、`Copy Command`、`Run Agent CLI` 等真实动作。
- 不引入 MCP，不改变 OpenSpec skills/commands 的业务流程，不默认自动发送 Chat。

## Capabilities

### New Capabilities

- `agent-command-routing`: 扩展将 OpenSpec workflow action 路由为目标 IDE/Agent 可识别命令的能力，包括 Cursor 插件注册、命令格式选择和 Chat 预填 fallback。

### Modified Capabilities

- `task-management`: 任务执行入口需要通过统一命令路由能力触发 Agent 或 Chat，而不是散落硬编码命令。
- `dashboard`: Dashboard quick actions 需要通过统一命令路由能力打开 Chat 或复制正确命令。

## Impact

- Extension host: adapter registry、Cursor adapter、Cursor plugin registration、配置和发布包包含规则。
- Webview: Dashboard card、Change Detail action bar、workflow state、任务执行入口和相关文案。
- Specs: 新增 `agent-command-routing`，并更新 `task-management`、`dashboard` 的相关行为要求。
- Compatibility: 非 Cursor 环境必须继续 fallback 到剪贴板，不影响 VS Code 用户。
