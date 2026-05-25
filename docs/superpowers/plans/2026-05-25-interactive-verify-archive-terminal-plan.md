# Interactive Verify & Archive Terminal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a new OpenSpec change that redesigns Change Detail and adds an official VS Code Integrated Terminal based `Verify & Archive` workflow runner.

**Architecture:** The webview expresses workflow intent and renders session state. The extension host owns terminal creation and lifecycle through an `InteractiveAgentTerminalManager`. Verify and Archive use `agent --workspace <root> --model <model> /opsx-verify|archive <change>` in a real Terminal Editor, while existing clipboard/deeplink/chat/headless adapter routing remains unchanged.

**Tech Stack:** TypeScript, VS Code Extension API, React webview, Vitest, OpenSpec artifacts.

---

## File Structure

- Create: `openspec/changes/add-interactive-verify-archive-terminal/proposal.md`
  - Describes why interactive Verify/Archive is needed and the visible product changes.
- Create: `openspec/changes/add-interactive-verify-archive-terminal/design.md`
  - Captures the terminal runner architecture and Change Detail redesign decisions.
- Create: `openspec/changes/add-interactive-verify-archive-terminal/specs/interactive-agent-terminal/spec.md`
  - New capability for interactive terminal sessions.
- Create: `openspec/changes/add-interactive-verify-archive-terminal/specs/workflow-control/spec.md`
  - Delta requirements for Change Detail tabs/action layout.
- Create: `openspec/changes/add-interactive-verify-archive-terminal/specs/dashboard/spec.md`
  - Delta requirements for dashboard quick actions opening the interactive workflow tab.
- Create: `openspec/changes/add-interactive-verify-archive-terminal/tasks.md`
  - Implementation checklist matching this plan.
- Create: `src/extension/services/interactiveAgentTerminalManager.ts`
  - Owns terminal lifecycle, command construction, state, and agent availability checks.
- Create: `test/extension/services/interactiveAgentTerminalManager.test.ts`
  - Unit tests for terminal creation, command format, session reuse, reveal, stop, clear, and error state.
- Modify: `src/webview/types/messages.ts`
  - Adds interactive workflow messages, state types, and send helpers.
- Modify: `test/extension/providers/webviewMessageHandler.test.ts`
  - Adds message handling coverage.
- Modify: `src/extension/providers/webviewMessageHandler.ts`
  - Handles interactive workflow messages.
- Modify: `src/extension/providers/changeDetailPanelManager.ts`
  - Supports opening Change Detail with an initial tab/action.
- Modify: `src/extension/providers/dashboardViewProvider.ts`
  - Passes initial tab/action from dashboard quick actions into Change Detail.
- Create: `src/webview/components/VerifyArchivePanel.tsx`
  - Renders Verify/Archive cards and session controls.
- Create: `test/webview/components/verifyArchivePanel.test.ts`
  - Component tests using direct React element traversal.
- Modify: `src/webview/components/ChangeDetail.tsx`
  - Renames `Verify` tab to `Verify & Archive`, removes the button pile, renders the new panel, and consumes session state messages.
- Modify: `test/webview/components/changeDetailRouting.test.ts`
  - Adds source-level or component-level assertions for tab naming and message routing.
- Modify: `src/webview/components/Dashboard.tsx`, `src/webview/components/ChangeCard.tsx`, `src/webview/components/ChangesSection.tsx`
  - Dashboard quick actions open Change Detail at `Verify & Archive` and can auto-start the corresponding workflow.
- Modify: `src/i18n/locales/en.json`, `src/i18n/locales/zh-cn.json`, `test/i18n/i18n.test.ts`
  - Adds user-facing labels and errors.
- Modify: `test/setup/vscode-stub.ts`
  - Adds minimal `createTerminal`, `TerminalLocation`, and `onDidCloseTerminal` stubs for build/test resolution.

---

### Task 1: Create OpenSpec Change Contract

**Files:**
- Create: `openspec/changes/add-interactive-verify-archive-terminal/proposal.md`
- Create: `openspec/changes/add-interactive-verify-archive-terminal/design.md`
- Create: `openspec/changes/add-interactive-verify-archive-terminal/specs/interactive-agent-terminal/spec.md`
- Create: `openspec/changes/add-interactive-verify-archive-terminal/specs/workflow-control/spec.md`
- Create: `openspec/changes/add-interactive-verify-archive-terminal/specs/dashboard/spec.md`
- Create: `openspec/changes/add-interactive-verify-archive-terminal/tasks.md`

- [ ] **Step 1: Create the OpenSpec change directory**

Run:

```bash
mkdir -p openspec/changes/add-interactive-verify-archive-terminal/specs/interactive-agent-terminal
mkdir -p openspec/changes/add-interactive-verify-archive-terminal/specs/workflow-control
mkdir -p openspec/changes/add-interactive-verify-archive-terminal/specs/dashboard
```

Expected: directories exist.

- [ ] **Step 2: Write `proposal.md`**

Create `openspec/changes/add-interactive-verify-archive-terminal/proposal.md`:

```markdown
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
```

- [ ] **Step 3: Write `design.md`**

Create `openspec/changes/add-interactive-verify-archive-terminal/design.md`:

```markdown
## Context

参考 Superpowers 设计文档：[Interactive Verify & Archive Terminal 设计](../../../docs/superpowers/specs/2026-05-25-interactive-verify-archive-terminal-design.md)。

`improve-cursor-native-interaction` 已经提供 workflow command builder 和 Cursor launch 配置。新的问题是 Verify/Archive 会进入多轮交互，而当前 `agentCli` headless 路径无法接收用户输入。因此本 change 新增一个专门的交互式 terminal runner，并重整 Change Detail 页面结构。

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

## Decisions

### Decision: Verify/Archive 使用官方 Integrated Terminal

扩展创建 VS Code Terminal Editor，让用户在真实 shell 中与 Agent 交互。Webview 只展示 workflow 控制台和 terminal session 状态，不承担 stdin/stdout 渲染。

### Decision: 命令形态使用 interactive agent

交互式命令为：

```bash
agent --workspace "<workspaceRoot>" --model <cursorAgentModel> /opsx-verify <change>
agent --workspace "<workspaceRoot>" --model <cursorAgentModel> /opsx-archive <change>
```

不使用 `-p`、`--print` 或 `--force`。`--workspace` 和 terminal `cwd` 都指向 workspace root。

### Decision: Session key 为 workspace + change + action

Verify 和 Archive 分别复用 terminal，避免互相污染上下文。重复点击 running session 不重复发送命令，只 reveal 终端或提示用户先 Stop/Clear。

### Decision: Change Detail 动作下沉到上下文

顶部不再堆叠 workflow buttons。Change-level Verify/Archive 进入 `Verify & Archive` tab；artifact 阅读和 task 执行保留在各自 tab 内。

## Risks / Trade-offs

- [Risk] Terminal Editor 会离开 webview 内容区。→ Mitigation: `Verify & Archive` tab 保持 session 状态和 Reveal 控制。
- [Risk] Stop 直接 dispose terminal 不一定优雅终止子进程。→ Mitigation: 第一版明确 Stop=关闭该 terminal session；后续再评估 Ctrl-C 增强。
- [Risk] Dashboard quick action 自动启动 terminal 可能让用户意外进入交互流程。→ Mitigation: 按钮文案使用 `Run Agent Verify` / `Run Agent Archive`，并打开 Change Detail 展示状态。

## Migration Plan

1. 创建 OpenSpec change 工件。
2. 新增 interactive terminal manager 和单元测试。
3. 扩展 webview message protocol。
4. 重构 Change Detail header/tabs，并新增 VerifyArchivePanel。
5. 调整 Dashboard quick action。
6. 更新 i18n 和文档。
7. 运行单元测试、构建和 Cursor 手工验证。

## Open Questions

无阻塞性 open question。第一版使用官方 Terminal Editor，不做内嵌终端。
```

- [ ] **Step 4: Write `interactive-agent-terminal/spec.md`**

Create `openspec/changes/add-interactive-verify-archive-terminal/specs/interactive-agent-terminal/spec.md`:

```markdown
## ADDED Requirements

### Requirement: Interactive Agent terminal sessions

The extension SHALL provide interactive terminal sessions for Verify and Archive workflows.

#### Scenario: Run Verify opens interactive Terminal Editor
- **GIVEN** a non-archived change
- **WHEN** the user clicks `Run Verify` in the `Verify & Archive` tab
- **THEN** the extension MUST create or reveal a VS Code Integrated Terminal in the editor area
- **AND** the terminal command MUST use `agent --workspace <workspaceRoot> --model <model> /opsx-verify <change>`
- **AND** the command MUST NOT use `-p`, `--print`, or `--force`

#### Scenario: Run Archive opens interactive Terminal Editor
- **GIVEN** a non-archived change
- **WHEN** the user clicks `Run Archive` in the `Verify & Archive` tab
- **THEN** the extension MUST create or reveal a VS Code Integrated Terminal in the editor area
- **AND** the terminal command MUST use `agent --workspace <workspaceRoot> --model <model> /opsx-archive <change>`
- **AND** the command MUST NOT use `-p`, `--print`, or `--force`

#### Scenario: Terminal sessions are scoped by change and action
- **GIVEN** a Verify terminal is running for a change
- **WHEN** the user starts Archive for the same change
- **THEN** the extension MUST create or reveal a separate Archive terminal session
- **AND** Verify and Archive MUST NOT share the same terminal session

#### Scenario: Running session is not started twice
- **GIVEN** a terminal session is already running for a change and action
- **WHEN** the user clicks the same run action again
- **THEN** the extension MUST reveal the existing terminal or show an existing-session state
- **AND** it MUST NOT send a duplicate Agent command into that terminal

#### Scenario: Stop and Clear close the terminal session
- **GIVEN** a terminal session exists for a change and action
- **WHEN** the user clicks Stop or Clear Session
- **THEN** the extension MUST dispose that terminal
- **AND** the session state MUST no longer be running

#### Scenario: Cursor Agent CLI is unavailable
- **GIVEN** the `agent` executable is not available
- **WHEN** the user starts Verify or Archive
- **THEN** the extension MUST NOT create a terminal session for that workflow
- **AND** the webview MUST receive an error state explaining that Cursor Agent CLI was not found
```

- [ ] **Step 5: Write `workflow-control/spec.md`**

Create `openspec/changes/add-interactive-verify-archive-terminal/specs/workflow-control/spec.md`:

```markdown
## MODIFIED Requirements

### Requirement: Workflow Step Indicator

The system SHALL show workflow progress in Change Detail without crowding action controls above the tab content.

#### Scenario: Change Detail uses compact workflow status
- **GIVEN** the user opens a change detail view
- **WHEN** the view loads
- **THEN** the top area MUST show compact change status such as completion and artifact progress
- **AND** it MUST NOT require a full-width button pile above the tabs

### Requirement: `/opsx:verify` 常驻入口

系统应在 Change Detail 中提供 Verify 与 Archive 的交互式入口。

#### Scenario: Verify & Archive tab replaces Verify tab
- **GIVEN** a change detail view is open
- **WHEN** the tab list renders
- **THEN** the tab list MUST include `Verify & Archive`
- **AND** it MUST NOT show the old standalone `Verify` tab label

#### Scenario: Verify & Archive tab provides workflow controls
- **GIVEN** the user opens the `Verify & Archive` tab
- **WHEN** the tab renders
- **THEN** it MUST show `Run Verify` and `Run Archive`
- **AND** it MUST show session controls for `Reveal Terminal`, `Stop`, and `Clear Session` when a session exists

### Requirement: 动态 ActionBar

ActionBar SHALL no longer be the primary surface for Verify and Archive in Change Detail.

#### Scenario: Verify and Archive are removed from the top action pile
- **GIVEN** a change detail view is open
- **WHEN** the action area above tabs renders
- **THEN** it MUST NOT show top-level `Run Verify` or `Run Archive` buttons
- **AND** Open File, Refresh, and More-style global actions MAY remain available
```

- [ ] **Step 6: Write `dashboard/spec.md`**

Create `openspec/changes/add-interactive-verify-archive-terminal/specs/dashboard/spec.md`:

```markdown
## MODIFIED Requirements

### Requirement: Dashboard Actions

Dashboard quick actions SHALL be able to start interactive Verify and Archive workflows through Change Detail.

#### Scenario: Dashboard Verify quick action opens interactive workflow
- **GIVEN** a change card displays a Verify quick action
- **WHEN** the user clicks that action
- **THEN** the extension MUST open the change detail view
- **AND** the change detail view MUST switch to `Verify & Archive`
- **AND** the Verify terminal workflow MAY start immediately

#### Scenario: Dashboard Archive quick action opens interactive workflow
- **GIVEN** a change card displays an Archive quick action
- **WHEN** the user clicks that action
- **THEN** the extension MUST open the change detail view
- **AND** the change detail view MUST switch to `Verify & Archive`
- **AND** the Archive terminal workflow MAY start immediately
- **AND** the quick action MUST NOT call direct `archiveChange`
```

- [ ] **Step 7: Write `tasks.md`**

Create `openspec/changes/add-interactive-verify-archive-terminal/tasks.md`:

```markdown
> 参考 Superpowers 设计文档：[Interactive Verify & Archive Terminal 设计](../../../docs/superpowers/specs/2026-05-25-interactive-verify-archive-terminal-design.md)
>
> 参考实现计划：[Interactive Verify & Archive Terminal Implementation Plan](../../../docs/superpowers/plans/2026-05-25-interactive-verify-archive-terminal-plan.md)

## 1. OpenSpec Contract

- [ ] 1.1 创建 proposal、design、interactive-agent-terminal spec、workflow-control delta spec、dashboard delta spec。
- [ ] 1.2 运行 `openspec validate add-interactive-verify-archive-terminal --strict` 并修复合同问题。

## 2. Interactive Terminal Manager

- [ ] 2.1 编写 terminal manager 失败测试，覆盖 Verify/Archive 命令、session 复用、Reveal、Stop、Clear、agent 不可用。
- [ ] 2.2 实现 `InteractiveAgentTerminalManager`。
- [ ] 2.3 运行 manager 测试并确认 RED→GREEN。

## 3. Webview Message Protocol

- [ ] 3.1 扩展 webview message 类型和 send helpers。
- [ ] 3.2 编写 message handler 失败测试。
- [ ] 3.3 接入 interactive terminal manager 到 message handler。

## 4. Change Detail Redesign

- [ ] 4.1 新增 `VerifyArchivePanel` 组件和组件测试。
- [ ] 4.2 将 `Verify` tab 改为 `Verify & Archive`。
- [ ] 4.3 移除 Change Detail 顶部 Verify/Archive 按钮堆叠。
- [ ] 4.4 接入 interactive workflow state。

## 5. Dashboard Quick Actions

- [ ] 5.1 让 Dashboard Verify/Archive quick action 打开 Change Detail 的 `Verify & Archive` tab。
- [ ] 5.2 支持必要时直接启动对应 interactive workflow。
- [ ] 5.3 确认 Dashboard Archive quick action 不调用 direct `archiveChange`。

## 6. Documentation, Build, and Manual Verification

- [ ] 6.1 更新 i18n 文案和设置说明，将 `agentCli` 标记为 headless。
- [ ] 6.2 运行 `pnpm test`。
- [ ] 6.3 运行 `pnpm run build`。
- [ ] 6.4 运行 `openspec validate add-interactive-verify-archive-terminal --strict`。
- [ ] 6.5 在 Cursor Extension Development Host 中验证 Run Verify、Run Archive、Reveal、Stop、Clear 和 terminal 交互。
```

- [ ] **Step 8: Validate the OpenSpec change**

Run:

```bash
openspec validate add-interactive-verify-archive-terminal --strict
```

Expected: `Change 'add-interactive-verify-archive-terminal' is valid`.

- [ ] **Step 9: Commit the OpenSpec contract**

Run:

```bash
git add openspec/changes/add-interactive-verify-archive-terminal
git commit -m "Add interactive verify archive terminal change"
```

Expected: commit succeeds.

---

### Task 2: Add Interactive Workflow Message Types

**Files:**
- Modify: `src/webview/types/messages.ts`
- Modify: `test/i18n/i18n.test.ts`
- Modify: `src/i18n/locales/en.json`
- Modify: `src/i18n/locales/zh-cn.json`

- [ ] **Step 1: Extend message and state types**

Modify `src/webview/types/messages.ts` near the top:

```ts
export type InteractiveWorkflowAction = 'verify' | 'archive';
export type InteractiveWorkflowSessionStatus = 'idle' | 'running' | 'closed' | 'error';

export interface InteractiveWorkflowSessionState {
  status: InteractiveWorkflowSessionStatus;
  terminalName?: string;
  lastCommand?: string;
  startedAt?: number;
  message?: string;
}

export interface InteractiveWorkflowState {
  changeName: string;
  sessions: Partial<Record<InteractiveWorkflowAction, InteractiveWorkflowSessionState>>;
}
```

Add to `WebviewMessage`:

```ts
  | { type: 'runInteractiveWorkflow'; changeName: string; action: InteractiveWorkflowAction }
  | { type: 'revealInteractiveWorkflow'; changeName: string; action: InteractiveWorkflowAction }
  | { type: 'stopInteractiveWorkflow'; changeName: string; action: InteractiveWorkflowAction }
  | { type: 'clearInteractiveWorkflow'; changeName: string; action: InteractiveWorkflowAction }
  | { type: 'getInteractiveWorkflowState'; changeName: string }
```

Add to `ExtensionMessage`:

```ts
  | { type: 'interactiveWorkflowState'; state: InteractiveWorkflowState }
```

Add to `sendMessage`:

```ts
  runInteractiveWorkflow: (changeName: string, action: InteractiveWorkflowAction): WebviewMessage => ({
    type: 'runInteractiveWorkflow',
    changeName,
    action,
  }),

  revealInteractiveWorkflow: (changeName: string, action: InteractiveWorkflowAction): WebviewMessage => ({
    type: 'revealInteractiveWorkflow',
    changeName,
    action,
  }),

  stopInteractiveWorkflow: (changeName: string, action: InteractiveWorkflowAction): WebviewMessage => ({
    type: 'stopInteractiveWorkflow',
    changeName,
    action,
  }),

  clearInteractiveWorkflow: (changeName: string, action: InteractiveWorkflowAction): WebviewMessage => ({
    type: 'clearInteractiveWorkflow',
    changeName,
    action,
  }),

  getInteractiveWorkflowState: (changeName: string): WebviewMessage => ({
    type: 'getInteractiveWorkflowState',
    changeName,
  }),
```

- [ ] **Step 2: Add i18n keys**

Add to `src/i18n/locales/en.json`:

```json
  "verifyArchive.tab": "Verify & Archive",
  "verifyArchive.runVerify": "Run Verify",
  "verifyArchive.runArchive": "Run Archive",
  "verifyArchive.revealTerminal": "Reveal Terminal",
  "verifyArchive.stop": "Stop",
  "verifyArchive.clearSession": "Clear Session",
  "verifyArchive.terminalTitle": "OpenSpec Agent Terminal",
  "verifyArchive.noSession": "No interactive session is running.",
  "verifyArchive.running": "{action} session is running.",
  "verifyArchive.closed": "{action} session is closed.",
  "verifyArchive.error": "{action} session failed: {message}",
  "verifyArchive.agentNotFound": "Cursor Agent CLI was not found. Run `agent login` or `agent status` in a terminal, then retry.",
  "cursor.agentCliHeadless": "Run Agent CLI (headless)"
```

Add to `src/i18n/locales/zh-cn.json`:

```json
  "verifyArchive.tab": "Verify & Archive",
  "verifyArchive.runVerify": "Run Verify",
  "verifyArchive.runArchive": "Run Archive",
  "verifyArchive.revealTerminal": "显示终端",
  "verifyArchive.stop": "停止",
  "verifyArchive.clearSession": "清空会话",
  "verifyArchive.terminalTitle": "OpenSpec Agent 终端",
  "verifyArchive.noSession": "当前没有运行中的交互会话。",
  "verifyArchive.running": "{action} 会话正在运行。",
  "verifyArchive.closed": "{action} 会话已关闭。",
  "verifyArchive.error": "{action} 会话失败：{message}",
  "verifyArchive.agentNotFound": "未找到 Cursor Agent CLI。请先在终端运行 `agent login` 或 `agent status`，然后重试。",
  "cursor.agentCliHeadless": "Run Agent CLI (headless)"
```

- [ ] **Step 3: Update i18n tests**

Modify `test/i18n/i18n.test.ts` to assert the new keys exist:

```ts
expect(t('verifyArchive.tab')).toBe('Verify & Archive');
expect(t('verifyArchive.runVerify')).toBe('Run Verify');
expect(t('verifyArchive.runArchive')).toBe('Run Archive');
expect(t('cursor.agentCliHeadless')).toBe('Run Agent CLI (headless)');
```

- [ ] **Step 4: Run i18n and type tests**

Run:

```bash
pnpm vitest run test/i18n/i18n.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit message and i18n protocol changes**

Run:

```bash
git add src/webview/types/messages.ts src/i18n/locales/en.json src/i18n/locales/zh-cn.json test/i18n/i18n.test.ts
git commit -m "Add interactive workflow message types"
```

Expected: commit succeeds.

---

### Task 3: Implement InteractiveAgentTerminalManager

**Files:**
- Create: `src/extension/services/interactiveAgentTerminalManager.ts`
- Create: `test/extension/services/interactiveAgentTerminalManager.test.ts`
- Modify: `test/setup/vscode-stub.ts`

- [ ] **Step 1: Extend the VS Code stub**

Modify `test/setup/vscode-stub.ts`:

```ts
export const TerminalLocation = {
  Panel: 1,
  Editor: 2,
};

export const window = {
  createOutputChannel: () => ({
    appendLine: noop,
    append: noop,
    clear: noop,
    show: noop,
    dispose: noop,
  }),
  createTerminal: () => ({
    sendText: noop,
    show: noop,
    dispose: noop,
  }),
  onDidCloseTerminal: () => ({ dispose: noop }),
  showErrorMessage: noopAsync,
  showInformationMessage: noopAsync,
};
```

Update the default export:

```ts
export default { window, env, TerminalLocation };
```

- [ ] **Step 2: Write failing manager tests**

Create `test/extension/services/interactiveAgentTerminalManager.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as vscode from 'vscode';
import { spawn } from 'child_process';
import { InteractiveAgentTerminalManager } from '../../../src/extension/services/interactiveAgentTerminalManager';

vi.mock('child_process', () => ({ spawn: vi.fn() }));

const terminal = {
  sendText: vi.fn(),
  show: vi.fn(),
  dispose: vi.fn(),
};

vi.mock('vscode', () => ({
  TerminalLocation: { Panel: 1, Editor: 2 },
  window: {
    createTerminal: vi.fn(() => terminal),
    onDidCloseTerminal: vi.fn(() => ({ dispose: vi.fn() })),
  },
  workspace: {
    getConfiguration: vi.fn(() => ({
      get: vi.fn((key: string) => (key === 'cursorAgentModel' ? 'auto' : undefined)),
    })),
  },
}));

function mockAgentAvailable() {
  vi.mocked(spawn).mockImplementation(() => {
    const handlers = new Map<string, Function>();
    const proc = {
      stdout: { on: vi.fn((event: string, fn: Function) => { if (event === 'data') setImmediate(() => fn('/usr/local/bin/agent\n')); }) },
      on: vi.fn((event: string, fn: Function) => {
        handlers.set(event, fn);
        if (event === 'close') setImmediate(() => fn(0));
      }),
    };
    return proc as any;
  });
}

describe('InteractiveAgentTerminalManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    terminal.sendText.mockClear();
    terminal.show.mockClear();
    terminal.dispose.mockClear();
    mockAgentAvailable();
  });

  it('starts verify in an editor terminal with interactive agent command', async () => {
    const manager = new InteractiveAgentTerminalManager();
    const state = await manager.start({
      workspaceRoot: '/Users/randy/workspace/project one',
      changeName: 'demo-change',
      action: 'verify',
    });

    expect(vscode.window.createTerminal).toHaveBeenCalledWith(expect.objectContaining({
      name: 'OpenSpec: demo-change / Verify',
      cwd: '/Users/randy/workspace/project one',
      location: vscode.TerminalLocation.Editor,
      isTransient: true,
    }));
    expect(terminal.sendText).toHaveBeenCalledWith(
      'agent --workspace \'/Users/randy/workspace/project one\' --model auto /opsx-verify demo-change',
      true
    );
    expect(terminal.show).toHaveBeenCalledWith(false);
    expect(state.sessions.verify?.status).toBe('running');
  });

  it('starts archive without print or force flags', async () => {
    const manager = new InteractiveAgentTerminalManager();
    await manager.start({ workspaceRoot: '/workspace', changeName: 'demo-change', action: 'archive' });
    const command = terminal.sendText.mock.calls[0][0] as string;
    expect(command).toBe('agent --workspace /workspace --model auto /opsx-archive demo-change');
    expect(command).not.toContain(' -p ');
    expect(command).not.toContain('--print');
    expect(command).not.toContain('--force');
  });

  it('reuses a running session without resending command', async () => {
    const manager = new InteractiveAgentTerminalManager();
    await manager.start({ workspaceRoot: '/workspace', changeName: 'demo-change', action: 'archive' });
    await manager.start({ workspaceRoot: '/workspace', changeName: 'demo-change', action: 'archive' });
    expect(vscode.window.createTerminal).toHaveBeenCalledTimes(1);
    expect(terminal.sendText).toHaveBeenCalledTimes(1);
    expect(terminal.show).toHaveBeenCalledTimes(2);
  });

  it('reveals a running session', async () => {
    const manager = new InteractiveAgentTerminalManager();
    await manager.start({ workspaceRoot: '/workspace', changeName: 'demo-change', action: 'verify' });
    const state = manager.reveal('/workspace', 'demo-change', 'verify');
    expect(terminal.show).toHaveBeenLastCalledWith(false);
    expect(state.sessions.verify?.status).toBe('running');
  });

  it('stops and clears sessions by disposing terminal', async () => {
    const manager = new InteractiveAgentTerminalManager();
    await manager.start({ workspaceRoot: '/workspace', changeName: 'demo-change', action: 'verify' });
    const stopped = manager.stop('/workspace', 'demo-change', 'verify');
    expect(terminal.dispose).toHaveBeenCalledTimes(1);
    expect(stopped.sessions.verify?.status).toBe('closed');

    await manager.start({ workspaceRoot: '/workspace', changeName: 'demo-change', action: 'verify' });
    const cleared = manager.clear('/workspace', 'demo-change', 'verify');
    expect(terminal.dispose).toHaveBeenCalledTimes(2);
    expect(cleared.sessions.verify).toBeUndefined();
  });

  it('returns an error state when agent CLI is unavailable', async () => {
    vi.mocked(spawn).mockImplementation(() => {
      const proc = {
        stdout: { on: vi.fn() },
        on: vi.fn((event: string, fn: Function) => {
          if (event === 'close') setImmediate(() => fn(1));
        }),
      };
      return proc as any;
    });

    const manager = new InteractiveAgentTerminalManager();
    const state = await manager.start({ workspaceRoot: '/workspace', changeName: 'demo-change', action: 'verify' });
    expect(vscode.window.createTerminal).not.toHaveBeenCalled();
    expect(state.sessions.verify?.status).toBe('error');
    expect(state.sessions.verify?.message).toContain('Cursor Agent CLI');
  });
});
```

- [ ] **Step 3: Run tests and verify RED**

Run:

```bash
pnpm vitest run test/extension/services/interactiveAgentTerminalManager.test.ts
```

Expected: FAIL because `InteractiveAgentTerminalManager` does not exist.

- [ ] **Step 4: Implement the manager**

Create `src/extension/services/interactiveAgentTerminalManager.ts`:

```ts
import { spawn } from 'child_process';
import * as vscode from 'vscode';
import { buildWorkflowCommand } from '../../shared/workflowCommand';
import { getCursorAgentModel } from './workflowLaunchConfig';
import type {
  InteractiveWorkflowAction,
  InteractiveWorkflowState,
  InteractiveWorkflowSessionState,
} from '../../webview/types/messages';

export interface StartInteractiveWorkflowRequest {
  workspaceRoot: string;
  changeName: string;
  action: InteractiveWorkflowAction;
}

interface SessionRecord {
  workspaceRoot: string;
  changeName: string;
  action: InteractiveWorkflowAction;
  terminal: vscode.Terminal;
  state: InteractiveWorkflowSessionState;
}

function sessionKey(workspaceRoot: string, changeName: string, action: InteractiveWorkflowAction): string {
  return `${workspaceRoot}::${changeName}::${action}`;
}

function displayAction(action: InteractiveWorkflowAction): string {
  return action === 'verify' ? 'Verify' : 'Archive';
}

export function quoteShellArg(value: string): string {
  if (/^[A-Za-z0-9_@%+=:,./-]+$/.test(value)) return value;
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function normalizeModel(): string {
  const model = getCursorAgentModel().trim();
  return model === '' ? 'auto' : model;
}

function checkAgentCli(): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn('which', ['agent'], { shell: true });
    let out = '';
    proc.stdout?.on('data', (chunk) => {
      out += chunk.toString();
    });
    proc.on('close', (code) => resolve(code === 0 && out.trim().length > 0));
    proc.on('error', () => resolve(false));
  });
}

export class InteractiveAgentTerminalManager {
  private sessions = new Map<string, SessionRecord>();

  constructor() {
    vscode.window.onDidCloseTerminal((terminal) => {
      for (const [key, session] of this.sessions.entries()) {
        if (session.terminal === terminal) {
          session.state = { ...session.state, status: 'closed', message: 'Terminal closed' };
          this.sessions.delete(key);
        }
      }
    });
  }

  async start(request: StartInteractiveWorkflowRequest): Promise<InteractiveWorkflowState> {
    const key = sessionKey(request.workspaceRoot, request.changeName, request.action);
    const existing = this.sessions.get(key);
    if (existing) {
      existing.terminal.show(false);
      return this.getSessionState(request.workspaceRoot, request.changeName);
    }

    const available = await checkAgentCli();
    if (!available) {
      return {
        changeName: request.changeName,
        sessions: {
          [request.action]: {
            status: 'error',
            message: 'Cursor Agent CLI was not found',
          },
        },
      };
    }

    const command = buildInteractiveAgentCommand(request.workspaceRoot, request.changeName, request.action);
    const terminalName = `OpenSpec: ${request.changeName} / ${displayAction(request.action)}`;
    const terminal = vscode.window.createTerminal({
      name: terminalName,
      cwd: request.workspaceRoot,
      location: vscode.TerminalLocation.Editor,
      isTransient: true,
    });

    const state: InteractiveWorkflowSessionState = {
      status: 'running',
      terminalName,
      lastCommand: command,
      startedAt: Date.now(),
    };
    this.sessions.set(key, { ...request, terminal, state });
    terminal.sendText(command, true);
    terminal.show(false);
    return this.getSessionState(request.workspaceRoot, request.changeName);
  }

  reveal(workspaceRoot: string, changeName: string, action: InteractiveWorkflowAction): InteractiveWorkflowState {
    const session = this.sessions.get(sessionKey(workspaceRoot, changeName, action));
    session?.terminal.show(false);
    return this.getSessionState(workspaceRoot, changeName);
  }

  stop(workspaceRoot: string, changeName: string, action: InteractiveWorkflowAction): InteractiveWorkflowState {
    const key = sessionKey(workspaceRoot, changeName, action);
    const session = this.sessions.get(key);
    if (session) {
      session.terminal.dispose();
      this.sessions.delete(key);
      return {
        changeName,
        sessions: {
          [action]: {
            ...session.state,
            status: 'closed',
            message: 'Terminal stopped',
          },
        },
      };
    }
    return this.getSessionState(workspaceRoot, changeName);
  }

  clear(workspaceRoot: string, changeName: string, action: InteractiveWorkflowAction): InteractiveWorkflowState {
    const key = sessionKey(workspaceRoot, changeName, action);
    const session = this.sessions.get(key);
    session?.terminal.dispose();
    this.sessions.delete(key);
    return this.getSessionState(workspaceRoot, changeName);
  }

  getSessionState(workspaceRoot: string, changeName: string): InteractiveWorkflowState {
    const sessions: InteractiveWorkflowState['sessions'] = {};
    for (const action of ['verify', 'archive'] as const) {
      const session = this.sessions.get(sessionKey(workspaceRoot, changeName, action));
      if (session) sessions[action] = session.state;
    }
    return { changeName, sessions };
  }
}

export function buildInteractiveAgentCommand(
  workspaceRoot: string,
  changeName: string,
  action: InteractiveWorkflowAction
): string {
  const workflowCommand = buildWorkflowCommand({ action, changeName, target: 'cursor' });
  return [
    'agent',
    '--workspace',
    quoteShellArg(workspaceRoot),
    '--model',
    quoteShellArg(normalizeModel()),
    workflowCommand,
  ].join(' ');
}

export const interactiveAgentTerminalManager = new InteractiveAgentTerminalManager();
```

- [ ] **Step 5: Run manager tests and verify GREEN**

Run:

```bash
pnpm vitest run test/extension/services/interactiveAgentTerminalManager.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit manager**

Run:

```bash
git add src/extension/services/interactiveAgentTerminalManager.ts test/extension/services/interactiveAgentTerminalManager.test.ts test/setup/vscode-stub.ts
git commit -m "Add interactive agent terminal manager"
```

Expected: commit succeeds.

---

### Task 4: Wire Interactive Workflow Messages in Extension Host

**Files:**
- Modify: `src/extension/providers/webviewMessageHandler.ts`
- Modify: `test/extension/providers/webviewMessageHandler.test.ts`

- [ ] **Step 1: Write failing handler tests**

Add to `test/extension/providers/webviewMessageHandler.test.ts`:

```ts
const interactiveStart = vi.hoisted(() => vi.fn());
const interactiveReveal = vi.hoisted(() => vi.fn());
const interactiveStop = vi.hoisted(() => vi.fn());
const interactiveClear = vi.hoisted(() => vi.fn());
const interactiveGetState = vi.hoisted(() => vi.fn());

vi.mock('@extension/services/interactiveAgentTerminalManager', () => ({
  interactiveAgentTerminalManager: {
    start: interactiveStart,
    reveal: interactiveReveal,
    stop: interactiveStop,
    clear: interactiveClear,
    getSessionState: interactiveGetState,
  },
}));
```

Add tests:

```ts
it('starts an interactive verify workflow and posts state', async () => {
  interactiveStart.mockResolvedValue({ changeName: 'demo-change', sessions: { verify: { status: 'running' } } });
  const dataManager = { getWorkspaceRoot: vi.fn().mockReturnValue('/workspace') };
  const webview = { postMessage: vi.fn() };

  await handleWebviewMessage(
    { type: 'runInteractiveWorkflow', action: 'verify', changeName: 'demo-change' },
    webview as any,
    dataManager as any
  );

  expect(interactiveStart).toHaveBeenCalledWith({
    workspaceRoot: '/workspace',
    changeName: 'demo-change',
    action: 'verify',
  });
  expect(webview.postMessage).toHaveBeenCalledWith({
    type: 'interactiveWorkflowState',
    state: { changeName: 'demo-change', sessions: { verify: { status: 'running' } } },
  });
});

it('rejects archive interactive workflow for archived change', async () => {
  const dataManager = { getWorkspaceRoot: vi.fn().mockReturnValue('/workspace') };
  const webview = { postMessage: vi.fn() };

  await handleWebviewMessage(
    { type: 'runInteractiveWorkflow', action: 'archive', changeName: 'archive:2026-05-25-demo-change' },
    webview as any,
    dataManager as any
  );

  expect(interactiveStart).not.toHaveBeenCalled();
  expect(webview.postMessage).toHaveBeenCalledWith({
    type: 'interactiveWorkflowState',
    state: {
      changeName: 'archive:2026-05-25-demo-change',
      sessions: { archive: { status: 'error', message: expect.stringContaining('Archived') } },
    },
  });
});

it('reveals stops clears and reads interactive workflow state', async () => {
  const state = { changeName: 'demo-change', sessions: { archive: { status: 'running' } } };
  interactiveReveal.mockReturnValue(state);
  interactiveStop.mockReturnValue({ changeName: 'demo-change', sessions: { archive: { status: 'closed' } } });
  interactiveClear.mockReturnValue({ changeName: 'demo-change', sessions: {} });
  interactiveGetState.mockReturnValue(state);
  const dataManager = { getWorkspaceRoot: vi.fn().mockReturnValue('/workspace') };
  const webview = { postMessage: vi.fn() };

  await handleWebviewMessage({ type: 'revealInteractiveWorkflow', action: 'archive', changeName: 'demo-change' }, webview as any, dataManager as any);
  await handleWebviewMessage({ type: 'stopInteractiveWorkflow', action: 'archive', changeName: 'demo-change' }, webview as any, dataManager as any);
  await handleWebviewMessage({ type: 'clearInteractiveWorkflow', action: 'archive', changeName: 'demo-change' }, webview as any, dataManager as any);
  await handleWebviewMessage({ type: 'getInteractiveWorkflowState', changeName: 'demo-change' }, webview as any, dataManager as any);

  expect(interactiveReveal).toHaveBeenCalledWith('/workspace', 'demo-change', 'archive');
  expect(interactiveStop).toHaveBeenCalledWith('/workspace', 'demo-change', 'archive');
  expect(interactiveClear).toHaveBeenCalledWith('/workspace', 'demo-change', 'archive');
  expect(interactiveGetState).toHaveBeenCalledWith('/workspace', 'demo-change');
  expect(webview.postMessage).toHaveBeenCalledWith({ type: 'interactiveWorkflowState', state });
});
```

- [ ] **Step 2: Run handler tests and verify RED**

Run:

```bash
pnpm vitest run test/extension/providers/webviewMessageHandler.test.ts
```

Expected: FAIL because handler does not support the new messages.

- [ ] **Step 3: Add handler cases**

Modify `src/extension/providers/webviewMessageHandler.ts` imports:

```ts
import {
  interactiveAgentTerminalManager,
} from '../services/interactiveAgentTerminalManager';
import type { InteractiveWorkflowAction, InteractiveWorkflowState } from '../../webview/types/messages';
```

Add helper above `handleWebviewMessage`:

```ts
function isInteractiveWorkflowAction(value: unknown): value is InteractiveWorkflowAction {
  return value === 'verify' || value === 'archive';
}

function archivedInteractiveError(changeName: string, action: InteractiveWorkflowAction): InteractiveWorkflowState {
  return {
    changeName,
    sessions: {
      [action]: {
        status: 'error',
        message: 'Archived changes are read-only',
      },
    },
  };
}
```

Add cases before `launchWorkflowAction`:

```ts
    case 'runInteractiveWorkflow': {
      const { changeName, action } = message;
      if (typeof changeName !== 'string' || !isInteractiveWorkflowAction(action)) break;
      if (changeName.startsWith('archive:') && action === 'archive') {
        webview.postMessage({ type: 'interactiveWorkflowState', state: archivedInteractiveError(changeName, action) });
        break;
      }
      const state = await interactiveAgentTerminalManager.start({
        workspaceRoot: dataManager.getWorkspaceRoot(),
        changeName,
        action,
      });
      webview.postMessage({ type: 'interactiveWorkflowState', state });
      break;
    }

    case 'revealInteractiveWorkflow': {
      const { changeName, action } = message;
      if (typeof changeName !== 'string' || !isInteractiveWorkflowAction(action)) break;
      const state = interactiveAgentTerminalManager.reveal(dataManager.getWorkspaceRoot(), changeName, action);
      webview.postMessage({ type: 'interactiveWorkflowState', state });
      break;
    }

    case 'stopInteractiveWorkflow': {
      const { changeName, action } = message;
      if (typeof changeName !== 'string' || !isInteractiveWorkflowAction(action)) break;
      const state = interactiveAgentTerminalManager.stop(dataManager.getWorkspaceRoot(), changeName, action);
      webview.postMessage({ type: 'interactiveWorkflowState', state });
      break;
    }

    case 'clearInteractiveWorkflow': {
      const { changeName, action } = message;
      if (typeof changeName !== 'string' || !isInteractiveWorkflowAction(action)) break;
      const state = interactiveAgentTerminalManager.clear(dataManager.getWorkspaceRoot(), changeName, action);
      webview.postMessage({ type: 'interactiveWorkflowState', state });
      break;
    }

    case 'getInteractiveWorkflowState': {
      const { changeName } = message;
      if (typeof changeName !== 'string') break;
      const state = interactiveAgentTerminalManager.getSessionState(dataManager.getWorkspaceRoot(), changeName);
      webview.postMessage({ type: 'interactiveWorkflowState', state });
      break;
    }
```

- [ ] **Step 4: Run handler tests and verify GREEN**

Run:

```bash
pnpm vitest run test/extension/providers/webviewMessageHandler.test.ts test/extension/services/interactiveAgentTerminalManager.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit message handler wiring**

Run:

```bash
git add src/extension/providers/webviewMessageHandler.ts test/extension/providers/webviewMessageHandler.test.ts
git commit -m "Wire interactive workflow webview messages"
```

Expected: commit succeeds.

---

### Task 5: Build VerifyArchivePanel

**Files:**
- Create: `src/webview/components/VerifyArchivePanel.tsx`
- Create: `test/webview/components/verifyArchivePanel.test.ts`

- [ ] **Step 1: Write failing component tests**

Create `test/webview/components/verifyArchivePanel.test.ts`:

```ts
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { VerifyArchivePanel } from '../../../src/webview/components/VerifyArchivePanel';
import type { InteractiveWorkflowState } from '../../../src/webview/types/messages';

function childrenOf(node: React.ReactNode): React.ReactNode[] {
  return React.Children.toArray(React.isValidElement(node) ? node.props.children : []);
}

function textOf(node: React.ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (!React.isValidElement(node)) return '';
  return childrenOf(node).map(textOf).join('');
}

function findButtonByText(node: React.ReactNode, text: string): React.ReactElement {
  if (React.isValidElement(node)) {
    if (node.type === 'button' && textOf(node) === text) return node;
    for (const child of childrenOf(node)) {
      try { return findButtonByText(child, text); } catch {}
    }
  }
  throw new Error(`Button not found: ${text}`);
}

describe('VerifyArchivePanel', () => {
  it('sends run actions for verify and archive', () => {
    const onRun = vi.fn();
    const tree = VerifyArchivePanel({
      changeName: 'demo-change',
      isArchived: false,
      state: { changeName: 'demo-change', sessions: {} },
      onRun,
      onReveal: vi.fn(),
      onStop: vi.fn(),
      onClear: vi.fn(),
    });

    findButtonByText(tree, 'Run Verify').props.onClick();
    findButtonByText(tree, 'Run Archive').props.onClick();

    expect(onRun).toHaveBeenCalledWith('verify');
    expect(onRun).toHaveBeenCalledWith('archive');
  });

  it('shows session controls for a running archive session', () => {
    const state: InteractiveWorkflowState = {
      changeName: 'demo-change',
      sessions: {
        archive: {
          status: 'running',
          terminalName: 'OpenSpec: demo-change / Archive',
          lastCommand: 'agent --workspace /workspace --model auto /opsx-archive demo-change',
          startedAt: 1,
        },
      },
    };
    const onReveal = vi.fn();
    const onStop = vi.fn();
    const onClear = vi.fn();
    const tree = VerifyArchivePanel({
      changeName: 'demo-change',
      isArchived: false,
      state,
      onRun: vi.fn(),
      onReveal,
      onStop,
      onClear,
    });

    findButtonByText(tree, 'Reveal Terminal').props.onClick();
    findButtonByText(tree, 'Stop').props.onClick();
    findButtonByText(tree, 'Clear Session').props.onClick();

    expect(textOf(tree)).toContain('OpenSpec: demo-change / Archive');
    expect(textOf(tree)).toContain('/opsx-archive demo-change');
    expect(onReveal).toHaveBeenCalledWith('archive');
    expect(onStop).toHaveBeenCalledWith('archive');
    expect(onClear).toHaveBeenCalledWith('archive');
  });

  it('disables archive run for archived changes', () => {
    const tree = VerifyArchivePanel({
      changeName: 'archive:2026-05-25-demo-change',
      isArchived: true,
      state: { changeName: 'archive:2026-05-25-demo-change', sessions: {} },
      onRun: vi.fn(),
      onReveal: vi.fn(),
      onStop: vi.fn(),
      onClear: vi.fn(),
    });

    expect(findButtonByText(tree, 'Run Archive').props.disabled).toBe(true);
    expect(findButtonByText(tree, 'Run Verify').props.disabled).toBeFalsy();
  });
});
```

- [ ] **Step 2: Run component tests and verify RED**

Run:

```bash
pnpm vitest run test/webview/components/verifyArchivePanel.test.ts
```

Expected: FAIL because `VerifyArchivePanel` does not exist.

- [ ] **Step 3: Implement `VerifyArchivePanel`**

Create `src/webview/components/VerifyArchivePanel.tsx`:

```tsx
import React from 'react';
import { t } from '../../i18n';
import type { InteractiveWorkflowAction, InteractiveWorkflowState } from '../types/messages';

interface VerifyArchivePanelProps {
  changeName: string;
  isArchived: boolean;
  state: InteractiveWorkflowState | null;
  onRun: (action: InteractiveWorkflowAction) => void;
  onReveal: (action: InteractiveWorkflowAction) => void;
  onStop: (action: InteractiveWorkflowAction) => void;
  onClear: (action: InteractiveWorkflowAction) => void;
}

const cardStyle: React.CSSProperties = {
  background: 'var(--vscode-editor-inactiveSelectionBackground)',
  border: '1px solid var(--vscode-panel-border)',
  borderRadius: 6,
  padding: 12,
};

const buttonStyle: React.CSSProperties = {
  padding: '6px 10px',
  fontSize: 12,
  fontWeight: 500,
  borderRadius: 4,
  border: 'none',
  cursor: 'pointer',
  background: 'var(--vscode-button-background)',
  color: 'var(--vscode-button-foreground)',
};

const secondaryButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  background: 'var(--vscode-button-secondaryBackground)',
  color: 'var(--vscode-button-secondaryForeground)',
};

function commandFor(action: InteractiveWorkflowAction, changeName: string): string {
  return action === 'verify' ? `/opsx-verify ${changeName}` : `/opsx-archive ${changeName}`;
}

export const VerifyArchivePanel: React.FC<VerifyArchivePanelProps> = ({
  changeName,
  isArchived,
  state,
  onRun,
  onReveal,
  onStop,
  onClear,
}) => {
  const sessions = state?.sessions ?? {};
  const activeAction: InteractiveWorkflowAction | null =
    sessions.archive ? 'archive' : sessions.verify ? 'verify' : null;
  const activeSession = activeAction ? sessions[activeAction] : undefined;

  return (
    <div className="flex flex-col gap-3 max-w-4xl">
      <div className="grid gap-3 md:grid-cols-2">
        <section style={cardStyle}>
          <div className="flex items-center justify-between mb-2">
            <strong>Verify</strong>
            <code className="text-xs">{commandFor('verify', changeName)}</code>
          </div>
          <p className="text-xs mb-3" style={{ color: 'var(--vscode-descriptionForeground)' }}>
            Run an interactive Agent verification session in the official terminal.
          </p>
          <button type="button" style={buttonStyle} onClick={() => onRun('verify')}>
            {t('verifyArchive.runVerify')}
          </button>
        </section>

        <section style={cardStyle}>
          <div className="flex items-center justify-between mb-2">
            <strong>Review & Archive</strong>
            <code className="text-xs">{commandFor('archive', changeName)}</code>
          </div>
          <p className="text-xs mb-3" style={{ color: 'var(--vscode-descriptionForeground)' }}>
            Let Agent review sync state, ask follow-up questions, and archive when ready.
          </p>
          <button
            type="button"
            style={buttonStyle}
            disabled={isArchived}
            onClick={() => onRun('archive')}
          >
            {t('verifyArchive.runArchive')}
          </button>
        </section>
      </div>

      <section style={cardStyle}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <strong>{t('verifyArchive.terminalTitle')}</strong>
            <div className="text-xs mt-1" style={{ color: 'var(--vscode-descriptionForeground)' }}>
              {activeSession?.terminalName ?? t('verifyArchive.noSession')}
            </div>
          </div>
          {activeAction && (
            <div className="flex gap-2">
              <button type="button" style={secondaryButtonStyle} onClick={() => onReveal(activeAction)}>
                {t('verifyArchive.revealTerminal')}
              </button>
              <button type="button" style={secondaryButtonStyle} onClick={() => onStop(activeAction)}>
                {t('verifyArchive.stop')}
              </button>
              <button type="button" style={secondaryButtonStyle} onClick={() => onClear(activeAction)}>
                {t('verifyArchive.clearSession')}
              </button>
            </div>
          )}
        </div>
        {activeSession?.lastCommand && (
          <pre className="text-xs mt-3 overflow-auto" style={{ color: 'var(--vscode-descriptionForeground)' }}>
            {activeSession.lastCommand}
          </pre>
        )}
        {activeSession?.status === 'error' && (
          <div className="text-xs mt-3" style={{ color: 'var(--vscode-errorForeground)' }}>
            {activeSession.message}
          </div>
        )}
      </section>
    </div>
  );
};
```

- [ ] **Step 4: Run component tests and verify GREEN**

Run:

```bash
pnpm vitest run test/webview/components/verifyArchivePanel.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit panel**

Run:

```bash
git add src/webview/components/VerifyArchivePanel.tsx test/webview/components/verifyArchivePanel.test.ts
git commit -m "Add verify archive terminal panel"
```

Expected: commit succeeds.

---

### Task 6: Redesign ChangeDetail Around Verify & Archive

**Files:**
- Modify: `src/webview/components/ChangeDetail.tsx`
- Modify: `test/webview/components/changeDetailRouting.test.ts`

- [ ] **Step 1: Write failing source-level routing test**

Modify `test/webview/components/changeDetailRouting.test.ts`:

```ts
it('uses Verify & Archive tab and interactive workflow messages', () => {
  expect(source).toContain("label: t('verifyArchive.tab')");
  expect(source).toContain('<VerifyArchivePanel');
  expect(source).toContain('sendMessage.runInteractiveWorkflow(changeName, action)');
  expect(source).toContain('sendMessage.getInteractiveWorkflowState(changeName)');
  expect(source).not.toContain("label: 'Verify'");
});
```

- [ ] **Step 2: Run routing test and verify RED**

Run:

```bash
pnpm vitest run test/webview/components/changeDetailRouting.test.ts
```

Expected: FAIL because ChangeDetail still uses old Verify tab and does not render `VerifyArchivePanel`.

- [ ] **Step 3: Modify imports and tab types**

Modify `src/webview/components/ChangeDetail.tsx` imports:

```ts
import { VerifyArchivePanel } from './VerifyArchivePanel';
import type { InteractiveWorkflowAction, InteractiveWorkflowState } from '../types/messages';
```

Change `ALL_TABS`:

```ts
const ALL_TABS = [
  { id: 'proposal' as const, label: 'Proposal' },
  { id: 'specs' as const, label: 'Specs' },
  { id: 'design' as const, label: 'Design' },
  { id: 'tasks' as const, label: 'Tasks' },
  { id: 'verifyArchive' as const, label: t('verifyArchive.tab') },
];
```

Change active tab state:

```ts
type ChangeDetailTab = 'proposal' | 'specs' | 'design' | 'tasks' | 'verifyArchive';
const [activeTab, setActiveTab] = useState<ChangeDetailTab>('proposal');
```

Replace old verify tab visibility variables:

```ts
const showVerifyArchiveTab = completedTasks > 0 || totalTasks > 0 || debug;
const tabs = showVerifyArchiveTab ? ALL_TABS : ALL_TABS.filter((tab) => tab.id !== 'verifyArchive');

useEffect(() => {
  if (!showVerifyArchiveTab && activeTab === 'verifyArchive') {
    setActiveTab('proposal');
  }
}, [showVerifyArchiveTab, activeTab]);
```

- [ ] **Step 4: Add interactive state handlers**

Add state:

```ts
const [interactiveWorkflowState, setInteractiveWorkflowState] = useState<InteractiveWorkflowState | null>(null);
```

Update message handling:

```ts
      } else if (msg.type === 'interactiveWorkflowState' && msg.state?.changeName === changeName) {
        setInteractiveWorkflowState(msg.state);
```

Request state when the tab is visible:

```ts
useEffect(() => {
  if (activeTab === 'verifyArchive') {
    postMessage(sendMessage.getInteractiveWorkflowState(changeName));
  }
}, [activeTab, changeName, postMessage]);
```

Add handlers:

```ts
const handleRunInteractiveWorkflow = (action: InteractiveWorkflowAction) => {
  postMessage(sendMessage.runInteractiveWorkflow(changeName, action));
};

const handleRevealInteractiveWorkflow = (action: InteractiveWorkflowAction) => {
  postMessage(sendMessage.revealInteractiveWorkflow(changeName, action));
};

const handleStopInteractiveWorkflow = (action: InteractiveWorkflowAction) => {
  postMessage(sendMessage.stopInteractiveWorkflow(changeName, action));
};

const handleClearInteractiveWorkflow = (action: InteractiveWorkflowAction) => {
  postMessage(sendMessage.clearInteractiveWorkflow(changeName, action));
};
```

- [ ] **Step 5: Render the panel instead of old Verify content**

Replace the `activeTab === 'verify'` branch with:

```tsx
        {activeTab === 'verifyArchive' ? (
          <VerifyArchivePanel
            changeName={changeName}
            isArchived={isArchived}
            state={interactiveWorkflowState}
            onRun={handleRunInteractiveWorkflow}
            onReveal={handleRevealInteractiveWorkflow}
            onStop={handleStopInteractiveWorkflow}
            onClear={handleClearInteractiveWorkflow}
          />
        ) : activeTab === 'tasks' && content !== null && !loading && !error ? (
```

Remove the old debug-only `runCommand` UI from the Verify tab branch. Keep the `runCommand` message support in extension host for now, because it may still be used by older debug views until this change fully lands.

- [ ] **Step 6: Remove Verify/Archive from top ActionBar**

In the area where `ActionBar` is rendered, keep Open in Editor/Refresh behavior but avoid showing `workflowState.nextAction` and `secondaryActions` for Verify/Archive above the tabs. The simplest first implementation is to pass a filtered workflow state:

```ts
const headerWorkflowState = useMemo(() => {
  if (!workflowState) return workflowState;
  return {
    ...workflowState,
    nextAction: workflowState.nextAction?.action === 'verify' || workflowState.nextAction?.action === 'archive'
      ? null
      : workflowState.nextAction,
    secondaryActions: workflowState.secondaryActions.filter(
      (action) => action.action !== 'verify' && action.action !== 'archive'
    ),
  };
}, [workflowState]);
```

Pass `headerWorkflowState` into `ActionBar`.

- [ ] **Step 7: Run ChangeDetail tests**

Run:

```bash
pnpm vitest run test/webview/components/changeDetailRouting.test.ts test/webview/components/verifyArchivePanel.test.ts test/webview/components/actionBar.test.ts
```

Expected: PASS after updating `actionBar.test.ts` if its fixture expects Archive in the ActionBar. If it fails because Archive is now intentionally removed from top ActionBar, update the test to assert Archive is routed through `VerifyArchivePanel` instead.

- [ ] **Step 8: Commit ChangeDetail redesign**

Run:

```bash
git add src/webview/components/ChangeDetail.tsx test/webview/components/changeDetailRouting.test.ts test/webview/components/actionBar.test.ts
git commit -m "Redesign change detail verify archive workflow"
```

Expected: commit succeeds.

---

### Task 7: Open ChangeDetail at Verify & Archive From Dashboard

**Files:**
- Modify: `src/webview/types/messages.ts`
- Modify: `src/extension/providers/changeDetailPanelManager.ts`
- Modify: `src/extension/providers/dashboardViewProvider.ts`
- Modify: `src/webview/components/Dashboard.tsx`
- Modify: `src/webview/components/ChangeCard.tsx`
- Modify: `src/webview/components/ChangesSection.tsx`
- Modify: `test/extension/providers/dashboardViewProvider.test.ts`

- [ ] **Step 1: Extend open detail message**

Modify `src/webview/types/messages.ts`:

```ts
export type ChangeDetailInitialTab = 'proposal' | 'specs' | 'design' | 'tasks' | 'verifyArchive';
```

Change the `openChangeDetailInEditor` message:

```ts
  | {
      type: 'openChangeDetailInEditor';
      changeName: string;
      initialTab?: ChangeDetailInitialTab;
      interactiveAction?: InteractiveWorkflowAction;
    }
```

Change the helper:

```ts
  openChangeDetailInEditor: (
    changeName: string,
    initialTab?: ChangeDetailInitialTab,
    interactiveAction?: InteractiveWorkflowAction
  ): WebviewMessage => ({
    type: 'openChangeDetailInEditor',
    changeName,
    ...(initialTab !== undefined ? { initialTab } : {}),
    ...(interactiveAction !== undefined ? { interactiveAction } : {}),
  }),
```

Extend `setContext` in `ExtensionMessage`:

```ts
  | {
      type: 'setContext';
      view: 'changeDetail';
      changeName: string;
      existingArtifactIds?: string[];
      debug?: boolean;
      initialTab?: ChangeDetailInitialTab;
      interactiveAction?: InteractiveWorkflowAction;
    }
```

- [ ] **Step 2: Update ChangeDetailPanelManager**

Modify `src/extension/providers/changeDetailPanelManager.ts`:

```ts
import type { ChangeDetailInitialTab, InteractiveWorkflowAction } from '../../webview/types/messages';

export interface ChangeDetailOpenOptions {
  initialTab?: ChangeDetailInitialTab;
  interactiveAction?: InteractiveWorkflowAction;
}
```

Update `buildSetContextPayload` signature:

```ts
  private async buildSetContextPayload(changeName: string, options: ChangeDetailOpenOptions = {}): Promise<{
    type: 'setContext';
    view: 'changeDetail';
    changeName: string;
    existingArtifactIds?: string[];
    debug?: boolean;
    initialTab?: ChangeDetailInitialTab;
    interactiveAction?: InteractiveWorkflowAction;
  }> {
```

Return options in both success and catch branches:

```ts
      return { type: 'setContext', view: 'changeDetail', changeName, existingArtifactIds, debug, ...options };
```

Change `open`:

```ts
  public open(changeName: string, options: ChangeDetailOpenOptions = {}): void {
```

Use `options` when posting context for existing and new panels.

- [ ] **Step 3: Update dashboard provider**

Modify the `openChangeDetailInEditor` handling in `src/extension/providers/dashboardViewProvider.ts`:

```ts
    if (message.type === 'openChangeDetailInEditor' && message.changeName && this.panelManager) {
      this.panelManager.open(message.changeName, {
        initialTab: message.initialTab,
        interactiveAction: message.interactiveAction,
      });
      return;
    }
```

- [ ] **Step 4: Update ChangeDetail setContext handling**

In `src/webview/components/ChangeDetail.tsx`, when receiving `setContext`, apply initial tab and action:

```ts
if (msg.type === 'setContext' && msg.view === 'changeDetail' && msg.changeName === changeName) {
  if (msg.initialTab === 'verifyArchive') {
    setActiveTab('verifyArchive');
  }
  if (msg.interactiveAction === 'verify' || msg.interactiveAction === 'archive') {
    setActiveTab('verifyArchive');
    postMessage(sendMessage.runInteractiveWorkflow(changeName, msg.interactiveAction));
  }
}
```

If `setContext` is currently handled in `App.tsx`, pass `initialTab` and `interactiveAction` through props or store them in App state before rendering `ChangeDetail`.

- [ ] **Step 5: Update Dashboard quick actions**

In `src/webview/components/Dashboard.tsx`, replace direct workflow launch for Verify/Archive quick actions:

```ts
  const handleLaunchWorkflow = (action: WorkflowAction, changeName: string) => {
    if (action === 'verify' || action === 'archive') {
      postMessage(sendMessage.openChangeDetailInEditor(changeName, 'verifyArchive', action));
      return;
    }
    postMessage(sendMessage.launchWorkflowAction(action, changeName));
  };
```

Pass this handler through `ChangesSection` and `ChangeCard` unchanged if they already call `onLaunchWorkflow(action, changeName)`.

- [ ] **Step 6: Add provider test**

In `test/extension/providers/dashboardViewProvider.test.ts`, add a test matching the existing style:

```ts
it('opens change detail with verify archive initial action from dashboard quick action', async () => {
  const panelManager = { open: vi.fn() };
  const provider = new DashboardViewProvider(dataManager as any, '/extension', panelManager as any);
  const webview = createWebviewMock();
  provider.resolveWebviewView({ webview, onDidDispose: vi.fn() } as any, {} as any, {} as any);

  await webview.fireMessage({
    type: 'openChangeDetailInEditor',
    changeName: 'demo-change',
    initialTab: 'verifyArchive',
    interactiveAction: 'archive',
  });

  expect(panelManager.open).toHaveBeenCalledWith('demo-change', {
    initialTab: 'verifyArchive',
    interactiveAction: 'archive',
  });
});
```

If helper names differ, adapt to the local mock helper in `dashboardViewProvider.test.ts`.

- [ ] **Step 7: Run dashboard routing tests**

Run:

```bash
pnpm vitest run test/extension/providers/dashboardViewProvider.test.ts test/webview/components/changeDetailRouting.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit dashboard integration**

Run:

```bash
git add src/webview/types/messages.ts src/extension/providers/changeDetailPanelManager.ts src/extension/providers/dashboardViewProvider.ts src/webview/components/Dashboard.tsx src/webview/components/ChangeCard.tsx src/webview/components/ChangesSection.tsx src/webview/components/ChangeDetail.tsx test/extension/providers/dashboardViewProvider.test.ts test/webview/components/changeDetailRouting.test.ts
git commit -m "Route dashboard verify archive to terminal workflow"
```

Expected: commit succeeds.

---

### Task 8: Final Verification and Packaging

**Files:**
- Modify: `package.json` if a version bump is needed for local VSIX testing.
- Modify: `README.md` and `README.zh-CN.md` if user-facing behavior documentation needs an update.

- [ ] **Step 1: Run OpenSpec strict validation**

Run:

```bash
openspec validate add-interactive-verify-archive-terminal --strict
```

Expected: valid.

- [ ] **Step 2: Run focused tests**

Run:

```bash
pnpm vitest run test/extension/services/interactiveAgentTerminalManager.test.ts test/extension/providers/webviewMessageHandler.test.ts test/extension/providers/dashboardViewProvider.test.ts test/webview/components/verifyArchivePanel.test.ts test/webview/components/changeDetailRouting.test.ts test/i18n/i18n.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run full test suite**

Run:

```bash
pnpm test
```

Expected: all tests pass.

- [ ] **Step 4: Run build**

Run:

```bash
pnpm run build
```

Expected: extension host and webview build pass.

- [ ] **Step 5: Run package if manual Cursor testing is needed**

Run:

```bash
pnpm run package
```

Expected: VSIX generated, for example `openspec-workflow-0.1.13.vsix` if version was bumped.

- [ ] **Step 6: Manual Cursor verification**

In Cursor Extension Development Host:

```text
1. Open OpenSpec dashboard.
2. Open a completed change.
3. Confirm Change Detail header no longer shows a large Verify/Archive button pile.
4. Open `Verify & Archive`.
5. Click `Run Verify`.
6. Confirm a Terminal Editor opens immediately with:
   agent --workspace "<workspaceRoot>" --model auto /opsx-verify <change>
7. If Agent asks a question, type a reply in the terminal.
8. Click `Run Archive`.
9. Confirm a separate Archive terminal opens or is reused for that change/action.
10. Click `Reveal Terminal`, `Stop`, and `Clear Session`.
11. From Dashboard quick action, click Verify/Archive and confirm it opens Change Detail at `Verify & Archive`.
```

Expected: user can continue interactive Agent prompts in the terminal.

- [ ] **Step 7: Commit verification/docs/version updates**

Run:

```bash
git add package.json README.md README.zh-CN.md
git commit -m "Document interactive verify archive terminal"
```

Expected: commit succeeds if any of those files changed. If none changed, skip this commit and record the verification results in the final response.

---

## Self-Review Checklist

- Spec coverage: Tasks 1, 3, 4, 5, 6, and 7 cover the Superpowers design sections for OpenSpec contract, terminal runner, webview messages, Change Detail redesign, Dashboard quick action, and error handling.
- Placeholder scan: This plan contains no placeholder markers, no incomplete file paths, and no generic test instructions without specific test content.
- Type consistency: The plan consistently uses `InteractiveWorkflowAction`, `InteractiveWorkflowState`, `verifyArchive`, `runInteractiveWorkflow`, and `InteractiveAgentTerminalManager`.
- Scope check: The plan is one cohesive change. It does not implement embedded PTY, Cursor Agent resume, or direct changes to `/opsx-*` skills.
