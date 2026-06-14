> 参考 Superpowers 设计文档：[Interactive Verify & Archive Terminal 设计](../../../docs/superpowers/specs/2026-05-25-interactive-verify-archive-terminal-design.md)
>
> 参考实现计划：[Interactive Verify & Archive Terminal Implementation Plan](../../../docs/superpowers/plans/2026-05-25-interactive-verify-archive-terminal-plan.md)
>
> 本 change 必须按 TDD 执行：先写失败测试并确认 RED，再实现最小 GREEN，最后重构。实现阶段不得引入内嵌 node-pty/xterm 终端；Verify/Archive 的交互必须基于 VS Code 官方 Integrated Terminal。
>
> 并行执行说明：2.1 的 terminal manager 测试与 4.1 的 VerifyArchivePanel 组件测试可以由不同子代理并行编写，因为写入范围不重叠。3.x 的 message protocol 是 4.x/5.x 的集成前置，必须先稳定类型和 handler 后再并行推进 ChangeDetail 与 Dashboard 接入。6.x 文档/i18n 可在 3.x 类型稳定后与 UI 接入并行。7.x 最终验证必须串行执行。

## 1. OpenSpec Contract

- [x] 1.1 创建 proposal、design、interactive-agent-terminal spec、workflow-control delta spec、dashboard delta spec。
- [x] 1.2 运行 `openspec validate add-interactive-verify-archive-terminal --strict` 并修复合同问题。
- [x] 1.3 使用 artifact review 子代理审查 proposal/design/specs，修复 P1 规格完整性问题。证据：proposal review 无 P0；design/spec review 发现并已修复 workflow-control MODIFIED delta 丢失非高影响步骤推进、direct archive verify 引导，以及 archived Verify 行为未明确的问题；final review 发现并已修复 specs 引用和 tasks 覆盖缺口。

## 2. Interactive Terminal Manager

- [x] 2.1 编写 terminal manager 失败测试，覆盖 Verify/Archive 命令、session 复用、Reveal、Stop、Clear、agent 不可用、terminal 创建失败、workspace path/change name shell quoting。
- [x] 2.2 实现 `InteractiveAgentTerminalManager`，使用 `vscode.window.createTerminal` 和 `TerminalLocation.Editor` 创建交互式终端。
- [x] 2.3 交互式命令必须使用 `agent --workspace <workspaceRoot> --model <cursorAgentModel> /opsx-verify|archive <change>`，不得使用 `-p`、`--print` 或 `--force`。
- [x] 2.4 按 `workspaceRoot + changeName + action` 复用 session，重复启动同一 running session 时只 reveal，不重复发送命令。
- [x] 2.5 支持 Stop 和 Clear Session，第一版语义为 dispose terminal 并更新 session state。
- [x] 2.6 检测 `agent` 不可用时返回 error state，不创建 terminal。
- [x] 2.7 terminal 创建失败时返回 error state，并在 webview 中展示可读错误信息。
- [x] 2.8 运行 manager 测试并确认 RED→GREEN。

## 3. Webview Message Protocol

- [x] 3.1 扩展 webview message 类型，新增 `InteractiveWorkflowAction`、`InteractiveWorkflowState`、run/reveal/stop/clear/get state 消息和 send helpers。
- [x] 3.2 编写 message handler 失败测试，覆盖 run、reveal、stop、clear、get state、archived change 上 Archive 拒绝、非法 action 拒绝并返回 error state。
- [x] 3.3 接入 `InteractiveAgentTerminalManager` 到 `webviewMessageHandler`。
- [x] 3.4 确认 archived change 的 Run Archive 被拒绝，Run Verify 按只读验证入口保留。
- [x] 3.5 运行 message handler 相关测试并确认 RED→GREEN。

## 4. Change Detail Redesign

- [x] 4.1 新增 `VerifyArchivePanel` 组件和组件测试，覆盖 Run Verify、Run Archive、Reveal Terminal、Stop、Clear Session、archived change 禁用 Archive。
- [x] 4.2 将 `Verify` tab 改为 `Verify & Archive`，并接入 `VerifyArchivePanel`。
- [x] 4.3 移除 Change Detail 顶部 Verify/Archive 按钮堆叠；非高影响步骤仍可通过 workflow command routing 推进。
- [x] 4.4 在 `Verify & Archive` tab 可见时请求 interactive workflow state，并在收到 state message 后刷新 UI。
- [x] 4.5 保留 Proposal、Specs、Design、Tasks 的 artifact 阅读和 task-level execute 行为。
- [x] 4.6 更新 Change Detail 相关测试并确认 RED→GREEN。

## 5. Dashboard Quick Actions

- [x] 5.1 扩展 `openChangeDetailInEditor` 消息，支持 `initialTab=verifyArchive` 和 `interactiveAction=verify|archive`。
- [x] 5.2 更新 `ChangeDetailPanelManager` 和 `DashboardViewProvider`，将 initial tab/action 传给 Change Detail webview。
- [x] 5.3 Dashboard Verify quick action 打开 Change Detail 的 `Verify & Archive` tab，并可直接启动 Verify terminal workflow。
- [x] 5.4 Dashboard Archive quick action 打开 Change Detail 的 `Verify & Archive` tab，并可直接启动 Archive terminal workflow。
- [x] 5.5 确认 Dashboard Archive quick action 不调用 direct `archiveChange`。
- [x] 5.6 运行 Dashboard/ChangeDetail 路由测试并确认 RED→GREEN。

## 6. I18n, Documentation, and Configuration Wording

- [x] 6.1 更新英文和中文 i18n 文案，包含 `Verify & Archive`、Run Verify、Run Archive、Reveal Terminal、Stop、Clear Session、Agent CLI not found。
- [x] 6.2 将 `cursorLaunchMode=agentCli` 的设置说明或 UI label 标记为 headless，避免用户误解它是交互式 Verify/Archive 入口。
- [x] 6.3 更新 README/README.zh-CN 中 workflow launch 与交互式 Verify/Archive 的说明。
- [x] 6.4 运行 i18n 测试并确认无缺失键。

## 7. Final Verification

- [x] 7.1 运行 `pnpm vitest run test/extension/services/interactiveAgentTerminalManager.test.ts test/extension/providers/webviewMessageHandler.test.ts test/extension/providers/dashboardViewProvider.test.ts test/webview/components/verifyArchivePanel.test.ts test/webview/components/changeDetailRouting.test.ts test/i18n/i18n.test.ts`。
- [ ] 7.2 运行 `pnpm test`。
- [x] 7.3 运行 `pnpm run build`。
- [x] 7.4 运行 `openspec validate add-interactive-verify-archive-terminal --strict`。
- [ ] 7.5 在 Cursor Extension Development Host 中手工验证：Run Verify 立即打开 Terminal Editor，Run Archive 立即打开 Terminal Editor，Agent 反问时可在终端输入，同一 change/action 可 reveal/reuse，Stop/Clear 行为符合预期。
- [ ] 7.6 派 code review 子代理审查实现，P0/P1 必须修复，P2 记录或按风险决定修复。
