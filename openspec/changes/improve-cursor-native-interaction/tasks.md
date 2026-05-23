> 参考 Superpowers 设计文档：[Cursor 原生交互与 AI 归档流程设计](../../../docs/superpowers/specs/2026-05-23-cursor-native-interaction-and-ai-archive-design.md)
>
> 参考 Superpowers 实现计划：[Cursor Native Interaction And AI Archive Implementation Plan](../../../docs/superpowers/plans/2026-05-23-cursor-native-interaction-and-ai-archive-plan.md)
>
> 本 tasks.md 以设计文档、实现计划和本 change 的 specs/design 为任务来源。实现阶段必须按 TDD 执行：先写失败测试并确认 RED，再实现最小 GREEN，最后重构。具体执行步骤以实现计划中的 Task 1-4、Task 8 相关部分为准。

## 1. Command Routing Core

- [ ] 1.1 编写失败测试覆盖 workflow command builder 的 action 与 adapter target 矩阵，包括 Cursor/OpenCode hyphen、Clipboard/Generic/Unknown colon。
- [ ] 1.2 实现 workflow command builder 纯函数模块，支持 `explore`、`continue`、`ff`、`apply`、`verify`、`archive`、`sync`。
- [ ] 1.3 将 task execution prompt 生成切换到 workflow command builder，并保持 `taskExecutionMode=auto` 与 `fillChat` 行为边界不变。
- [ ] 1.4 运行 command builder 与 task execution prompt 相关测试，确认新增测试完成 RED→GREEN。

## 2. Cursor Plugin Registration

- [ ] 2.1 编写失败测试覆盖无 `vscode.cursor` 时注册逻辑静默跳过、有 API 时调用 `registerPath` 和 dispose 时调用 `unregisterPath`。
- [ ] 2.2 新增 Cursor plugin registration 服务，在 extension activation 中注册扩展内置 OpenSpec plugin 目录。
- [ ] 2.3 准备扩展内置 Cursor plugin 目录，包含 OpenSpec commands/skills，并调整发布包包含规则，避免 markdown 命令和技能文件被 `.vscodeignore` 排除。
- [ ] 2.4 运行 Cursor plugin registration 和发布包包含规则相关测试/检查，确认新增测试完成 RED→GREEN。

## 3. Cursor Adapter Chat Routing

- [ ] 3.1 编写失败测试覆盖 Cursor adapter fillChat 优先尝试 Chat query 预填、失败时复制到剪贴板。
- [ ] 3.2 更新 Cursor adapter 的 fillChat 路径，使用 command builder 生成的命令，不默认启动 Agent CLI。
- [ ] 3.3 保留 explicit auto execution 路径：仅 `executeTask` 或 `openspec.taskExecutionMode=auto` 调用 Agent CLI。
- [ ] 3.4 运行 Cursor adapter 相关测试，确认新增测试完成 RED→GREEN。

## 4. Webview Action Migration

- [ ] 4.1 编写失败测试或组件验证覆盖 Dashboard quick actions 通过统一命令路由触发 Chat/clipboard，而不是硬编码 `/opsx:*`。
- [ ] 4.2 迁移 Dashboard card、Change Detail action bar、Workflow step click、Artifact create/continue/explore 等入口到统一命令路由。
- [ ] 4.3 更新 UI 文案和通知，区分 `Open in Chat`、`Copy Command`、`Run Agent CLI` 等真实动作。
- [ ] 4.4 运行 webview action 相关测试或组件验证，确认新增测试完成 RED→GREEN。

## 5. Verification

- [ ] 5.1 运行相关单元测试，确认 command builder、Cursor plugin registration、Cursor adapter fallback、task execution prompt 测试通过。
- [ ] 5.2 运行 `pnpm run build`，确认 extension host 和 webview 构建通过。
- [ ] 5.3 在 Cursor Extension Development Host 中手工验证：点击 Apply 预填 `/opsx-apply <change>`，无 Cursor API 时 fallback 到复制命令。
- [ ] 5.4 检查 VSIX 或打包输出，确认内置 Cursor plugin commands/skills 被包含。
