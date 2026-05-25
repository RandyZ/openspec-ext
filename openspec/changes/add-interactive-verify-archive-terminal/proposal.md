## Why

`cursorLaunchMode=agentCli` 当前通过 headless `agent -p ...` 执行 workflow。该模式适合一次性 Apply，但 Verify 和 Archive 经常需要用户继续回答 Agent 的中途问题，例如是否先 sync delta specs、是否继续归档、是否补充验证证据。当前输出只进入 OutputChannel，用户无法继续交互。

同时 Change Detail 页面在 tab 上方堆叠 workflow stepper、Apply、Verify、Archive、Open in Editor、Refresh 等按钮，视觉层级混乱。需要把高影响 workflow 收敛到明确的 `Verify & Archive` 入口，并使用 VS Code 官方 Integrated Terminal 承载真实交互。

参考 Superpowers 设计文档：[Interactive Verify & Archive Terminal 设计](../../../docs/superpowers/specs/2026-05-25-interactive-verify-archive-terminal-design.md)。

## What Changes

- 将 Change Detail 详情页重构为 editor-native 信息架构：顶部只保留 change 标题、状态摘要和全局动作。
- 将旧 `Verify` tab 升级为 `Verify & Archive` tab。
- 新增交互式 terminal runner，使用 VS Code Integrated Terminal Editor 执行 `/opsx-verify` 和 `/opsx-archive`。
- Verify/Archive 命令使用 `agent --workspace <workspaceRoot> --model <cursorAgentModel> /opsx-<action> <change>`。
- 按 `change + action` 复用 terminal session，提供 Reveal、Stop、Clear Session 控制。
- Dashboard quick action 打开 Change Detail 的 `Verify & Archive` tab，并可直接启动对应 terminal workflow。
- 保留现有 `cursorLaunchMode=agentCli` headless 语义，但文案明确为 headless，不作为 Verify/Archive 推荐入口。

## Capabilities

### New Capabilities

- `interactive-agent-terminal`: 扩展提供面向 Verify/Archive 的交互式 Agent Terminal session 管理能力。

### Modified Capabilities

- `workflow-control`: Change Detail 的 tab、动作区和 Verify/Archive 入口需要重构。
- `dashboard`: Dashboard quick actions 需要能打开 Change Detail 并定位到 `Verify & Archive` workflow。

## Impact

- Extension host: 新增 terminal manager、webview message handler、Change Detail 打开参数。
- Webview: Change Detail header/tabs、VerifyArchivePanel、Dashboard quick action 消息。
- Specs: 新增 `interactive-agent-terminal`，修改 `workflow-control` 和 `dashboard`。
- Compatibility: 不改变 clipboard/deeplink/chatCommand/headless agentCli 既有路由，不移除 direct archive command palette。
