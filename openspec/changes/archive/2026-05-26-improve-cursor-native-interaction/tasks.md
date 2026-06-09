> 参考 Superpowers 设计文档：[Cursor 原生交互与 AI 归档流程设计](superpowers/design/2026-05-23-cursor-native-interaction-and-ai-archive-design.md)
>
> 参考 Superpowers 实现计划：[Cursor Native Interaction And AI Archive Implementation Plan](superpowers/plan/2026-05-23-cursor-native-interaction-and-ai-archive-plan.md)
>
> 本 tasks.md 以设计文档、实现计划和本 change 的 specs/design 为任务来源。实现阶段必须按 TDD 执行：先写失败测试并确认 RED，再实现最小 GREEN，最后重构。具体执行步骤以实现计划中的 Task 1-4、Task 8 相关部分为准。

## 1. Configuration and Command Routing Core

- [x] 1.1 编写失败测试覆盖配置解析：`preferredAgentAdapter` 默认 `clipboard`，`workflowLaunchMode` 默认 `clipboard`，`cursorLaunchMode` 默认 `clipboard`，`cursorAgentModel` 默认 `auto`。
- [x] 1.2 编写失败测试覆盖 workflow command/payload builder 的 action、adapter target 与 launch mode 矩阵，包括 Cursor/OpenCode hyphen、Clipboard/Generic/Unknown colon。
- [x] 1.3 实现 workflow command/payload builder 纯函数模块，支持 `explore`、`continue`、`ff`、`apply`、`verify`、`archive`、`sync`。
- [x] 1.4 将 task execution prompt 生成切换到 workflow command/payload builder，并保持 `taskExecutionMode=auto` 与 `fillChat` 行为边界不变。
- [x] 1.5 运行配置解析、command builder 与 task execution prompt 相关测试，确认新增测试完成 RED→GREEN。

## 2. Cursor Launch Modes

- [x] 2.1 编写失败测试覆盖 Cursor deeplink builder，确认 `/opsx-apply <change>` 被编码为 `cursor://anysphere.cursor-deeplink/prompt?text=...`。
- [x] 2.2 编写失败测试覆盖 Cursor adapter fillChat：所有 Cursor launch mode 都先复制命令并显示 toast。
- [x] 2.3 实现 `cursorLaunchMode=deeplink`：复制命令、打开 Cursor deeplink、显示“已打开且已复制”的 toast；失败时保留剪贴板 fallback toast。
- [x] 2.4 实现 `cursorLaunchMode=chatCommand`：复制命令、尝试 `workbench.action.chat.open({ query })`、失败时 fallback。
- [x] 2.5 实现 `cursorLaunchMode=clipboard`：只复制命令并显示 toast，不打开 Cursor。
- [x] 2.6 保留 `cursorLaunchMode=agentCli` 或 `taskExecutionMode=auto` 的显式自动执行路径，不作为默认行为。
- [x] 2.7 运行 Cursor launch mode 相关测试，确认新增测试完成 RED→GREEN。

## 3. Settings and UI Experience

- [x] 3.1 编写失败测试或配置快照检查，确认 `package.json` 中 `openspec.preferredAgentAdapter` 为 enum 下拉且默认 `clipboard`。
- [x] 3.2 新增 `openspec.workflowLaunchMode`、`openspec.cursorLaunchMode`、`openspec.cursorAgentModel` 配置项，并更新 `openspec.agentModel` 兼容说明。
- [x] 3.3 更新 Change Detail 的 adapter/执行设置展示文案，明确默认复制、adapter 路由、Cursor deeplink、Agent CLI 自动执行之间的差异。
- [x] 3.4 更新 i18n 文案和 toast 文案，确保复制、deeplink 成功、deeplink 失败、chatCommand 成功/失败、agentCli 运行都有清晰反馈。
- [x] 3.5 运行配置/i18n 相关测试，确认新增测试完成 RED→GREEN。
- [x] 3.6 更新设置项说明，解释 `clipboard`、`deeplink`、`chatCommand`、`agentCli` 四种 Cursor launch mode 的差异。

## 4. Webview Action Migration

- [x] 4.1 编写失败测试或组件验证覆盖 Dashboard quick actions 通过统一命令路由触发 Chat/clipboard，而不是硬编码 `/opsx:*`。
- [x] 4.2 迁移 Dashboard card、Change Detail action bar、Workflow step click、Artifact create/continue/explore 等入口到统一 workflow launch 路由。
- [x] 4.3 更新 UI 文案和通知，区分 `Open in Chat`、`Copy Command`、`Run Agent CLI` 等真实动作。
- [x] 4.4 运行 webview action 相关测试或组件验证，确认新增测试完成 RED→GREEN。
- [x] 4.5 将 Dashboard 和 Change Detail 的 Archive 按钮纳入统一 workflow launch 路由，保留 command palette direct archive 作为显式归档入口。

## 5. Verification

- [x] 5.1 运行相关单元测试，确认配置解析、command builder、Cursor deeplink、Cursor adapter fallback、task execution prompt 测试通过。
- [x] 5.2 运行 `pnpm run build`，确认 extension host 和 webview 构建通过。
- [x] 5.3 在 Cursor Extension Development Host 中手工验证：默认设置点击 Apply 只复制命令并显示 toast。
- [x] 5.4 在 Cursor Extension Development Host 中手工验证：`workflowLaunchMode=adapter` 且 `cursorLaunchMode=deeplink` 时点击 Apply 打开 Cursor deeplink 并预填 `/opsx-apply <change>`，同时剪贴板可用。
- [x] 5.5 在 Cursor Extension Development Host 中手工验证：`cursorLaunchMode=agentCli` 或 `taskExecutionMode=auto` 时只在用户显式配置后启动 Cursor Agent CLI。
- [x] 5.6 确认本 change 提供 archive workflow command 生成和 UI 路由能力（例如 Cursor `/opsx-archive <change>`），可供 `add-ai-guided-archive-flow` 消费；command palette direct archive 继续保留。
