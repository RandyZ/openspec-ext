## Context

参考 Superpowers 设计文档：[Interactive Verify & Archive Terminal 设计](superpowers/design/2026-05-25-interactive-verify-archive-terminal-design.md)。

`improve-cursor-native-interaction` 已经提供 workflow command builder 和 Cursor launch 配置。新的问题是 Verify/Archive 会进入多轮交互，而当前 `agentCli` headless 路径无法接收用户输入。因此本 change 新增一个专门的交互式 terminal runner，并重整 Change Detail 页面结构。

当前执行链路的断点：

```text
Change Detail / Dashboard
  -> launchWorkflowAction(archive)
  -> cursorAdapter.fillChat()
  -> cursorLaunchMode=agentCli
  -> agent -p --trust --force --model auto "/opsx-archive <change>"
  -> OutputChannel only
  -> Agent asks a follow-up question, but user has no stdin
```

目标链路：

```text
Change Detail / Verify & Archive
  -> runInteractiveWorkflow(archive)
  -> InteractiveAgentTerminalManager
  -> VS Code Integrated Terminal Editor
  -> agent --workspace <root> --model auto /opsx-archive <change>
  -> user answers directly in terminal
```

## Goals / Non-Goals

**Goals:**

- 使用 VS Code 官方 `vscode.window.createTerminal` 创建交互式 Terminal Editor。
- `Verify & Archive` tab 提供 Run Verify、Run Archive、Reveal Terminal、Stop、Clear Session。
- 交互式命令显式传入 workspace 和 model。
- 按 `change + action` 复用 terminal session。
- Dashboard quick action 能打开详情页并切到 `Verify & Archive`。
- 保留现有 headless `cursorLaunchMode=agentCli` 行为。

**Non-Goals:**

- 不实现 node-pty/xterm 内嵌终端。
- 不使用 Cursor Agent CLI `--resume` 或 `--continue` 拼接 transcript。
- 不修改 `/opsx-verify` 或 `/opsx-archive` skill 的业务流程。
- 不移除 direct archive command palette。
- 不改变 clipboard、deeplink、chatCommand 的既有路由语义。

## Decisions

### Decision: Verify/Archive 使用官方 Integrated Terminal

扩展创建 VS Code Terminal Editor，让用户在真实 shell 中与 Agent 交互。Webview 只展示 workflow 控制台和 terminal session 状态，不承担 stdin/stdout 渲染。

备选方案是 webview 内嵌 transcript 或 node-pty/xterm。transcript 依赖 Cursor Agent CLI 的 resume/continue 语义，无法保证中途问题和工具调用上下文稳定；node-pty/xterm 会引入 native dependency、ANSI 渲染、输入法、复制粘贴、滚动和跨平台打包成本。因此第一版采用官方 terminal。

### Decision: 命令形态使用 interactive agent

交互式命令为：

```bash
agent --workspace "<workspaceRoot>" --model <cursorAgentModel> /opsx-verify <change>
agent --workspace "<workspaceRoot>" --model <cursorAgentModel> /opsx-archive <change>
```

不使用 `-p`、`--print` 或 `--force`。`--workspace` 和 terminal `cwd` 都指向 workspace root。

`--workspace` 显式传入可以减少 Agent 推断错目录的风险；`--model` 复用 `openspec.cursorAgentModel`，保持和现有 Cursor Agent CLI 配置一致；不使用 `--force` 是因为 Verify/Archive 是高影响流程，应允许 Agent 正常询问。

### Decision: Session key 为 workspace + change + action

Verify 和 Archive 分别复用 terminal，避免互相污染上下文。重复点击 running session 不重复发送命令，只 reveal 终端或提示用户先 Stop/Clear。

```text
sessionKey = <workspaceRoot>::<changeName>::<action>
action = verify | archive
```

### Decision: Change Detail 动作下沉到上下文

顶部不再堆叠 workflow buttons。Change-level Verify/Archive 进入 `Verify & Archive` tab；artifact 阅读和 task 执行保留在各自 tab 内。

```text
Header
  change name
  compact status
  Open File / Refresh / More

Tabs
  Proposal | Specs | Design | Tasks | Verify & Archive

Verify & Archive
  Run Verify
  Run Archive
  Terminal session status
  Reveal / Stop / Clear Session
```

### Decision: `cursorLaunchMode=agentCli` 保留 headless 语义

现有 `agentCli` launch mode 不在本 change 中废弃，避免破坏用户已经配置的一次性 workflow 自动执行路径。但设置文案和 UI label 应明确这是 headless 模式，不作为 Verify/Archive 的推荐交互入口。

## Risks / Trade-offs

- [Risk] Terminal Editor 会离开 webview 内容区。→ Mitigation: `Verify & Archive` tab 保持 session 状态和 Reveal 控制。
- [Risk] Stop 直接 dispose terminal 不一定优雅终止子进程。→ Mitigation: 第一版明确 Stop=关闭该 terminal session；后续再评估 Ctrl-C 增强。
- [Risk] Dashboard quick action 自动启动 terminal 可能让用户意外进入交互流程。→ Mitigation: 按钮文案使用 `Run Agent Verify` / `Run Agent Archive`，并打开 Change Detail 展示状态。
- [Risk] 非 Cursor 环境中 `agent` 不存在。→ Mitigation: terminal manager 在启动前检测 `agent`，不可用时返回 error state，不创建 terminal。

## Migration Plan

1. 创建 OpenSpec change 工件。
2. 新增 interactive terminal manager 和单元测试。
3. 扩展 webview message protocol。
4. 重构 Change Detail header/tabs，并新增 VerifyArchivePanel。
5. 调整 Dashboard quick action。
6. 更新 i18n 和文档。
7. 运行单元测试、构建和 Cursor 手工验证。

Rollback 策略：如果 interactive terminal runner 出现兼容问题，可隐藏 `Verify & Archive` tab 的 Run buttons，保留现有 clipboard/deeplink/chatCommand/headless agentCli 路由和 command palette direct archive。

## Open Questions

无阻塞性 open question。第一版使用官方 Terminal Editor，不做内嵌终端。
