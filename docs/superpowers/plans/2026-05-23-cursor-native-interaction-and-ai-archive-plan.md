# Cursor Native Interaction And AI Archive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现两个 OpenSpec changes：`improve-cursor-native-interaction` 先提供稳定的 workflow command routing 和 Cursor 原生插件/Chat 集成，`add-ai-guided-archive-flow` 再基于该 routing 将 Archive 默认入口改成 AI 审查归档。

**Architecture:** 新增 `workflowCommand` 作为唯一命令生成边界，extension host 负责 Cursor plugin registration 和 adapter routing，webview 只表达 action intent 或消费统一生成的 command。Archive 改为 split button：主动作路由 `/opsx-archive <change>` 给 Agent，下拉 `Archive Now` 保留直接 CLI archive。

**Tech Stack:** TypeScript, React 19, VS Code Extension API, Cursor Extension API, Vitest, pnpm, Vite, esbuild.

---

## Context And Source Artifacts

- Superpowers 设计文档：`docs/superpowers/specs/2026-05-23-cursor-native-interaction-and-ai-archive-design.md`
- Change 1：`openspec/changes/improve-cursor-native-interaction/`
- Change 2：`openspec/changes/add-ai-guided-archive-flow/`

实现顺序必须先完成 `improve-cursor-native-interaction`，再完成 `add-ai-guided-archive-flow`。第二个 change 的最终验收依赖第一个 change 提供的 command builder。

测试运行必须按项目规则交给测试子代理执行；计划中的命令用于子代理执行和人工复核。测试子代理执行任何命令时必须使用 `zsh -c "source ~/.zshrc && <command>"` 包装以加载用户环境。不要自动提交 git commit，用户会自行提交。

## File Structure

### New Files

- `src/shared/workflowCommand.ts`
  - 纯函数模块，定义 workflow action、target、命令格式矩阵和 `buildWorkflowCommand()`。
  - 放在 `src/shared`，extension host 和 webview 都可引用，避免 webview 直接依赖 extension 目录。

- `src/extension/services/cursorPluginRegistration.ts`
  - Cursor 插件注册服务。检测 `vscode.cursor.plugins.registerPath/unregisterPath`，无 API 时静默跳过。

- `src/types/cursor.d.ts`
  - 扩展 Cursor API 类型声明，避免在 TypeScript 中使用 `any` 扩散。

- `cursor-plugins/openspec/commands/*.md`
  - 打包到扩展里的 Cursor commands。来源应与 `.cursor/commands/opsx-*.md` 保持一致。

- `cursor-plugins/openspec/skills/openspec-*/SKILL.md`
  - 打包到扩展里的 OpenSpec skills。来源应与 `.cursor/skills/openspec-*` 保持一致。

- `src/webview/components/ui/SplitButton.tsx`
  - 可复用主按钮 + 下拉按钮组件，用于 Archive。

- `test/shared/workflowCommand.test.ts`
  - 覆盖 action/target 命令矩阵。

- `test/extension/services/cursorPluginRegistration.test.ts`
  - 覆盖 Cursor API 有无时的 register/unregister 行为。

- `test/extension/adapters/cursorAdapter.test.ts`
  - 覆盖 Chat query 预填成功和 fallback 复制。

- `test/webview/components/splitButton.test.ts`
  - 使用 React element 级别测试验证主动作、下拉 disabled reason 和回调 wiring。

### Modified Files

- `src/extension/extension.ts`
  - activate 阶段注册 Cursor plugin path，并把 unregister disposable 加入 `context.subscriptions`。

- `src/extension/adapters/cursor-adapter.ts`
  - `fillChat` 优先调用 `workbench.action.chat.open` query 预填，失败时复制。

- `src/extension/adapters/opencode-adapter.ts`
  - 删除私有 `toHyphenFormat()` 或改为调用 `buildWorkflowCommand()`，避免重复命令格式逻辑。

- `src/extension/services/taskExecutorService.ts`
  - task execution prompt 使用 `buildWorkflowCommand({ action: 'apply', target })`。

- `src/webview/utils/workflowState.ts`
  - secondary actions 不再用空 command 表示 Archive；显式建模 `archiveReview` 与 `archiveNow`。

- `src/webview/components/ActionBar.tsx`
  - 使用 `SplitButton` 渲染 `Review & Archive` 和 `Archive Now`。

- `src/webview/components/ChangeCard.tsx`
  - Dashboard quick actions 使用统一 command builder；归档动作与 Change Detail 一致。

- `src/webview/components/ChangeDetail.tsx`
  - 发送 workflow action intent 给 extension host；`Archive Now` 才发送 `archiveChange`。

- `src/webview/components/Dashboard.tsx`
  - 区分 open chat routing 与 direct archive callbacks。

- `src/webview/types/messages.ts`
  - 新增 workflow action intent message，让 extension host 根据当前 adapter 生成目标命令；避免 webview 预先用 Clipboard target 固化命令格式。

- `.vscodeignore`
  - 显式包含 `cursor-plugins/openspec/**`。

- `README.md` / `README.zh-CN.md`
  - 更新 Cursor routing、`Review & Archive` 与 `Archive Now` 的说明。

---

## Task 1: Workflow Command Builder

**Files:**
- Create: `src/shared/workflowCommand.ts`
- Create: `test/shared/workflowCommand.test.ts`
- Modify: `test/extension/adapters/commandFormat.test.ts`

- [ ] **Step 1: Write the failing command builder tests**

Create `test/shared/workflowCommand.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  buildWorkflowCommand,
  getWorkflowCommandTargetForAdapter,
  type WorkflowAction,
  type WorkflowCommandTarget,
} from '../../src/shared/workflowCommand';

describe('buildWorkflowCommand', () => {
  const actions: WorkflowAction[] = [
    'explore',
    'continue',
    'ff',
    'apply',
    'verify',
    'archive',
    'sync',
  ];

  it('uses hyphen format for Cursor and OpenCode targets', () => {
    for (const action of actions) {
      expect(
        buildWorkflowCommand({ action, changeName: 'demo-change', target: 'cursor' })
      ).toBe(`/opsx-${action} demo-change`);
      expect(
        buildWorkflowCommand({ action, changeName: 'demo-change', target: 'opencode' })
      ).toBe(`/opsx-${action} demo-change`);
    }
  });

  it('uses colon format for generic, copilot, clipboard, and unknown targets', () => {
    const targets: WorkflowCommandTarget[] = ['generic', 'copilot', 'clipboard', 'unknown'];
    for (const target of targets) {
      expect(
        buildWorkflowCommand({ action: 'apply', changeName: 'demo-change', target })
      ).toBe('/opsx:apply demo-change');
    }
  });

  it('supports commands without change name when requested', () => {
    expect(buildWorkflowCommand({ action: 'continue', target: 'clipboard' })).toBe('/opsx:continue');
    expect(buildWorkflowCommand({ action: 'apply', target: 'cursor' })).toBe('/opsx-apply');
  });

  it('maps adapter ids to command targets', () => {
    expect(getWorkflowCommandTargetForAdapter('cursor')).toBe('cursor');
    expect(getWorkflowCommandTargetForAdapter('opencode')).toBe('opencode');
    expect(getWorkflowCommandTargetForAdapter('vscode-copilot')).toBe('copilot');
    expect(getWorkflowCommandTargetForAdapter('clipboard')).toBe('clipboard');
    expect(getWorkflowCommandTargetForAdapter('claude-code')).toBe('generic');
    expect(getWorkflowCommandTargetForAdapter('missing-adapter')).toBe('unknown');
    expect(getWorkflowCommandTargetForAdapter(null)).toBe('unknown');
  });
});
```

- [ ] **Step 2: Run the RED test**

Run:

```bash
pnpm vitest run test/shared/workflowCommand.test.ts
```

Expected: FAIL because `src/shared/workflowCommand.ts` does not exist.

- [ ] **Step 3: Implement the command builder**

Create `src/shared/workflowCommand.ts`:

```ts
export type WorkflowAction =
  | 'explore'
  | 'continue'
  | 'ff'
  | 'apply'
  | 'verify'
  | 'archive'
  | 'sync';

export type WorkflowCommandTarget =
  | 'cursor'
  | 'opencode'
  | 'copilot'
  | 'clipboard'
  | 'generic'
  | 'unknown';

export interface WorkflowCommandRequest {
  action: WorkflowAction;
  changeName?: string;
  target: WorkflowCommandTarget;
}

const HYPHEN_TARGETS = new Set<WorkflowCommandTarget>(['cursor', 'opencode']);

export function buildWorkflowCommand(request: WorkflowCommandRequest): string {
  const prefix = HYPHEN_TARGETS.has(request.target)
    ? `/opsx-${request.action}`
    : `/opsx:${request.action}`;
  const changeName = request.changeName?.trim();
  return changeName ? `${prefix} ${changeName}` : prefix;
}

export function getWorkflowCommandTargetForAdapter(
  adapterId: string | null | undefined
): WorkflowCommandTarget {
  switch (adapterId) {
    case 'cursor':
      return 'cursor';
    case 'opencode':
      return 'opencode';
    case 'vscode-copilot':
      return 'copilot';
    case 'clipboard':
      return 'clipboard';
    case 'claude-code':
      return 'generic';
    default:
      return 'unknown';
  }
}
```

- [ ] **Step 4: Run the GREEN test**

Run:

```bash
pnpm vitest run test/shared/workflowCommand.test.ts
```

Expected: PASS.

- [ ] **Step 5: Replace old command format test**

Modify `test/extension/adapters/commandFormat.test.ts` to import the command builder:

```ts
import { describe, it, expect } from 'vitest';
import { buildWorkflowCommand } from '../../../src/shared/workflowCommand';

describe('Command format adaptation', () => {
  it('generates hyphen command for OpenCode', () => {
    expect(
      buildWorkflowCommand({ action: 'apply', changeName: 'foo', target: 'opencode' })
    ).toBe('/opsx-apply foo');
  });

  it('generates hyphen command for Cursor', () => {
    expect(
      buildWorkflowCommand({ action: 'verify', changeName: 'change-name', target: 'cursor' })
    ).toBe('/opsx-verify change-name');
  });

  it('generates colon command for Clipboard', () => {
    expect(
      buildWorkflowCommand({ action: 'continue', changeName: 'my-change', target: 'clipboard' })
    ).toBe('/opsx:continue my-change');
  });
});
```

- [ ] **Step 6: Run command format tests**

Run:

```bash
pnpm vitest run test/shared/workflowCommand.test.ts test/extension/adapters/commandFormat.test.ts
```

Expected: PASS.

---

## Task 2: Cursor Plugin Registration

**Files:**
- Create: `src/types/cursor.d.ts`
- Create: `src/extension/services/cursorPluginRegistration.ts`
- Create: `test/extension/services/cursorPluginRegistration.test.ts`
- Modify: `src/extension/extension.ts`
- Modify: `.vscodeignore`
- Create/Copy: `cursor-plugins/openspec/commands/*.md`
- Create/Copy: `cursor-plugins/openspec/skills/openspec-*/SKILL.md`

- [ ] **Step 1: Write failing tests for plugin registration**

Create `test/extension/services/cursorPluginRegistration.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { registerCursorOpenSpecPlugin } from '../../../src/extension/services/cursorPluginRegistration';

describe('registerCursorOpenSpecPlugin', () => {
  it('registers and unregisters the bundled plugin path when Cursor API exists', () => {
    const registerPath = vi.fn();
    const unregisterPath = vi.fn();
    const context = {
      extensionPath: '/extension/root',
      subscriptions: [],
    };
    const vscodeLike = {
      cursor: {
        plugins: {
          registerPath,
          unregisterPath,
        },
      },
      Disposable: class {
        constructor(private readonly cb: () => void) {}
        dispose(): void {
          this.cb();
        }
      },
    };

    const disposable = registerCursorOpenSpecPlugin(context as any, vscodeLike as any);

    expect(registerPath).toHaveBeenCalledWith('/extension/root/cursor-plugins/openspec');
    expect(context.subscriptions).toContain(disposable);

    disposable.dispose();
    expect(unregisterPath).toHaveBeenCalledWith('/extension/root/cursor-plugins/openspec');
  });

  it('does nothing when Cursor API is missing', () => {
    const context = {
      extensionPath: '/extension/root',
      subscriptions: [],
    };

    const disposable = registerCursorOpenSpecPlugin(context as any, { Disposable: class {} } as any);

    expect(disposable).toBeUndefined();
    expect(context.subscriptions).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run the RED test**

Run:

```bash
pnpm vitest run test/extension/services/cursorPluginRegistration.test.ts
```

Expected: FAIL because `cursorPluginRegistration.ts` does not exist.

- [ ] **Step 3: Add Cursor API type declaration**

Create `src/types/cursor.d.ts`:

```ts
declare module 'vscode' {
  export namespace cursor {
    export namespace plugins {
      export const registerPath: (path: string) => void;
      export const unregisterPath: (path: string) => void;
    }
  }
}
```

- [ ] **Step 4: Implement plugin registration service**

Create `src/extension/services/cursorPluginRegistration.ts`:

```ts
import * as path from 'path';
import * as vscode from 'vscode';
import { logger } from '../utils/logger';

interface CursorPluginApi {
  cursor?: {
    plugins?: {
      registerPath?: (pluginPath: string) => void;
      unregisterPath?: (pluginPath: string) => void;
    };
  };
  Disposable: typeof vscode.Disposable;
}

interface ExtensionContextLike {
  extensionPath: string;
  subscriptions: { dispose(): unknown }[];
}

export function getBundledOpenSpecPluginPath(extensionPath: string): string {
  return path.join(extensionPath, 'cursor-plugins', 'openspec');
}

export function registerCursorOpenSpecPlugin(
  context: ExtensionContextLike,
  vscodeApi: CursorPluginApi = vscode as CursorPluginApi
): vscode.Disposable | undefined {
  const plugins = vscodeApi.cursor?.plugins;
  if (!plugins?.registerPath || !plugins.unregisterPath) {
    logger.debug('Cursor plugin API unavailable; skipping OpenSpec plugin registration');
    return undefined;
  }

  const pluginPath = getBundledOpenSpecPluginPath(context.extensionPath);
  plugins.registerPath(pluginPath);
  logger.info(`Registered bundled OpenSpec Cursor plugin: ${pluginPath}`);

  const disposable = new vscodeApi.Disposable(() => {
    plugins.unregisterPath?.(pluginPath);
    logger.info(`Unregistered bundled OpenSpec Cursor plugin: ${pluginPath}`);
  });
  context.subscriptions.push(disposable);
  return disposable;
}
```

- [ ] **Step 5: Wire registration into activation**

Modify `src/extension/extension.ts`:

```ts
import { registerCursorOpenSpecPlugin } from './services/cursorPluginRegistration';
```

Inside `activate`, after locale/logger setup and before OpenSpec CLI initialization, add:

```ts
    registerCursorOpenSpecPlugin(context);
```

The resulting block should be:

```ts
  try {
    registerCursorOpenSpecPlugin(context);

    const workspaceRoot = await getOpenSpecWorkspaceRoot();
    if (!workspaceRoot) {
      logger.error('No workspace folder found');
      vscode.window.showErrorMessage(t('extension.noWorkspace'));
      return;
    }
```

- [ ] **Step 6: Create bundled plugin directory**

Copy the existing commands and OpenSpec skills:

```bash
mkdir -p cursor-plugins/openspec/commands cursor-plugins/openspec/skills
cp .cursor/commands/opsx-*.md cursor-plugins/openspec/commands/
cp -R .cursor/skills/openspec-* cursor-plugins/openspec/skills/
```

Expected: `cursor-plugins/openspec/commands/opsx-apply.md` and `cursor-plugins/openspec/skills/openspec-apply-change/SKILL.md` exist.

- [ ] **Step 7: Ensure VSIX includes bundled plugins**

Modify `.vscodeignore` by adding these allow rules after `docs/superpowers/**`:

```gitignore
!cursor-plugins/
!cursor-plugins/**
```

Keep existing ignores for `src/` and `*.md`; the explicit allow rules must appear after broader ignore rules that would otherwise exclude markdown.

- [ ] **Step 8: Run plugin registration tests**

Run:

```bash
pnpm vitest run test/extension/services/cursorPluginRegistration.test.ts
```

Expected: PASS.

---

## Task 3: Adapter Prompt Routing

**Files:**
- Modify: `src/extension/adapters/cursor-adapter.ts`
- Modify: `src/extension/adapters/opencode-adapter.ts`
- Modify: `src/extension/services/taskExecutorService.ts`
- Create: `test/extension/adapters/cursorAdapter.test.ts`
- Modify or Create: `test/extension/services/taskExecutorService.test.ts`

- [ ] **Step 1: Write failing Cursor adapter tests**

Create `test/extension/adapters/cursorAdapter.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const executeCommand = vi.fn();
const writeText = vi.fn();
const showInformationMessage = vi.fn();

vi.mock('vscode', () => ({
  commands: { executeCommand },
  env: { clipboard: { writeText } },
  window: {
    createOutputChannel: () => ({
      clear: vi.fn(),
      show: vi.fn(),
      append: vi.fn(),
      appendLine: vi.fn(),
    }),
    showInformationMessage,
  },
  workspace: {
    getConfiguration: () => ({
      get: () => 'auto',
    }),
  },
}));

vi.mock('child_process', () => ({
  spawn: vi.fn(() => ({
    stdout: { on: vi.fn() },
    stderr: { on: vi.fn() },
    on: vi.fn(),
  })),
}));

describe('cursorAdapter.fillChat', async () => {
  const { cursorAdapter } = await import('../../../src/extension/adapters/cursor-adapter');

  beforeEach(() => {
    executeCommand.mockReset();
    writeText.mockReset();
    showInformationMessage.mockReset();
  });

  it('opens chat with query before using clipboard', async () => {
    executeCommand.mockResolvedValue(undefined);

    const result = await cursorAdapter.fillChat({
      changeName: 'demo-change',
      taskIndex: -1,
      taskText: '',
      contextFiles: [],
      workspaceRoot: '/workspace',
      promptOverride: '/opsx-apply demo-change',
    });

    expect(result.success).toBe(true);
    expect(executeCommand).toHaveBeenCalledWith('workbench.action.chat.open', {
      query: '/opsx-apply demo-change',
      isPartialQuery: true,
    });
    expect(writeText).not.toHaveBeenCalled();
  });

  it('copies to clipboard when chat query prefill fails', async () => {
    executeCommand.mockRejectedValue(new Error('unsupported'));

    const result = await cursorAdapter.fillChat({
      changeName: 'demo-change',
      taskIndex: -1,
      taskText: '',
      contextFiles: [],
      workspaceRoot: '/workspace',
      promptOverride: '/opsx-apply demo-change',
    });

    expect(result.success).toBe(true);
    expect(writeText).toHaveBeenCalledWith('/opsx-apply demo-change');
  });
});
```

- [ ] **Step 2: Run the RED test**

Run:

```bash
pnpm vitest run test/extension/adapters/cursorAdapter.test.ts
```

Expected: FAIL because current `cursorAdapter.fillChat` calls `workbench.action.chat.open` without query and writes clipboard first.

- [ ] **Step 3: Update Cursor adapter fillChat**

Modify `src/extension/adapters/cursor-adapter.ts` `fillChat`:

```ts
  async fillChat(request: TaskExecuteRequest): Promise<TaskExecuteResult> {
    const text = request.promptOverride ?? buildPromptText(request);
    try {
      await vscode.commands.executeCommand('workbench.action.chat.open', {
        query: text,
        isPartialQuery: true,
      });
      return { success: true, adapterId: ADAPTER_ID, message: 'Chat opened with prompt' };
    } catch {
      await vscode.env.clipboard.writeText(text);
      vscode.window.showInformationMessage(t('clipboard.copiedCursorChat'));
      return { success: true, adapterId: ADAPTER_ID, message: 'Copied to clipboard' };
    }
  },
```

- [ ] **Step 4: Replace OpenCode private command conversion**

Modify `src/extension/adapters/opencode-adapter.ts`:

```ts
import { buildWorkflowCommand } from '../../shared/workflowCommand';
```

Remove `toHyphenFormat()`. Replace prompt construction in both `executeTask` and `fillChat`:

```ts
const prompt = request.promptOverride ?? buildWorkflowCommand({
  action: 'apply',
  changeName: request.changeName,
  target: 'opencode',
});
```

- [ ] **Step 5: Use command builder in task executor**

Modify `src/extension/services/taskExecutorService.ts` imports:

```ts
import { buildWorkflowCommand, getWorkflowCommandTargetForAdapter } from '../../shared/workflowCommand';
```

Replace request construction after adapter lookup:

```ts
    const target = getWorkflowCommandTargetForAdapter(adapter.id);
    const request: TaskExecuteRequest = {
      changeName,
      taskIndex,
      taskText,
      contextFiles: [],
      workspaceRoot: this.workspaceRoot,
      promptOverride: buildWorkflowCommand({ action: 'apply', changeName, target }),
    };
```

- [ ] **Step 6: Run adapter and command tests**

Run:

```bash
pnpm vitest run test/shared/workflowCommand.test.ts test/extension/adapters/commandFormat.test.ts test/extension/adapters/cursorAdapter.test.ts
```

Expected: PASS.

---

## Task 4: Webview Command Migration

**Files:**
- Modify: `src/webview/components/ChangeDetail.tsx`
- Modify: `src/webview/components/Dashboard.tsx`
- Modify: `src/webview/components/ChangeCard.tsx`
- Modify: `src/webview/components/ActionBar.tsx`
- Modify: `src/webview/utils/workflowState.ts`
- Modify: `src/webview/types/messages.ts`
- Modify: `src/extension/providers/webviewMessageHandler.ts`
- Modify: `test/webview/utils/workflowState.test.ts`
- Modify: `test/extension/providers/webviewMessageHandler.test.ts`

- [ ] **Step 1: Write failing workflow state tests for command builder-compatible state**

Modify `test/webview/utils/workflowState.test.ts`:

```ts
  it('all tasks done: exposes review archive secondary action instead of empty command archive', () => {
    const state = deriveWorkflowState(name, ['proposal', 'specs', 'design', 'tasks'], 5, 5, false, false);
    const archive = state.secondaryActions.find((a) => a.kind === 'archiveReview');
    expect(archive).toBeDefined();
    expect(archive?.label).toBe('Review & Archive');
    expect(archive?.command).toBe('/opsx:archive test-change');
    expect(state.secondaryActions.some((a) => a.label === 'Archive' && a.command === '')).toBe(false);
  });

  it('partial task progress exposes archive review but direct archive is disabled', () => {
    const state = deriveWorkflowState(name, ['proposal', 'specs', 'design', 'tasks'], 2, 5, false, false);
    const archive = state.secondaryActions.find((a) => a.kind === 'archiveReview');
    expect(archive).toBeDefined();
    expect(archive?.disabledReason).toBeUndefined();
    expect(archive?.directArchiveDisabledReason).toContain('incomplete');
  });
```

Update the `WorkflowAction` import expectations only after implementation.

- [ ] **Step 2: Run RED workflow state tests**

Run:

```bash
pnpm vitest run test/webview/utils/workflowState.test.ts
```

Expected: FAIL because `WorkflowAction.kind`, `archiveReview`, and `directArchiveDisabledReason` do not exist.

- [ ] **Step 3: Extend workflow action type**

Modify `src/webview/utils/workflowState.ts`:

```ts
export type WorkflowActionKind =
  | 'command'
  | 'archiveReview'
  | 'archiveNow';

export interface WorkflowAction {
  label: string;
  command: string;
  variant: 'primary' | 'secondary';
  kind?: WorkflowActionKind;
  disabledReason?: string;
  directArchiveDisabledReason?: string;
}
```

Update existing action builders to set `kind: 'command'`.

- [ ] **Step 4: Update archive state construction**

In `deriveWorkflowState`, replace Archive empty-command actions:

```ts
  if (allTasksDone) {
    secondaryActions.push({
      label: 'Review & Archive',
      command: `/opsx:archive ${changeName}`,
      variant: 'secondary',
      kind: 'archiveReview',
    });
  }

  if (hasAnyTaskDone && !allTasksDone) {
    secondaryActions.push({
      label: 'Review & Archive',
      command: `/opsx:archive ${changeName}`,
      variant: 'secondary',
      kind: 'archiveReview',
      directArchiveDisabledReason: 'Direct archive is unavailable while tasks are incomplete.',
    });
  }
```

For incomplete artifacts, keep archive absent until all artifact steps exist; `Review & Archive` appears after tasks exist or partial progress exists.

- [ ] **Step 5: Run workflow state GREEN tests**

Run:

```bash
pnpm vitest run test/webview/utils/workflowState.test.ts
```

Expected: PASS after updating existing expectations from `Archive` to `Review & Archive`.

- [ ] **Step 6: Add extension-host workflow command routing**

Modify `src/webview/types/messages.ts` to import the action type:

```ts
import type { WorkflowAction } from '../../shared/workflowCommand';
```

Add this union member to `WebviewMessage`:

```ts
  | { type: 'routeWorkflowCommand'; action: WorkflowAction; changeName?: string }
```

Add helper:

```ts
  routeWorkflowCommand: (action: WorkflowAction, changeName?: string): WebviewMessage => ({
    type: 'routeWorkflowCommand',
    action,
    ...(changeName !== undefined ? { changeName } : {}),
  }),
```

Modify `src/extension/providers/webviewMessageHandler.ts` imports:

```ts
import { buildWorkflowCommand, getWorkflowCommandTargetForAdapter } from '../../shared/workflowCommand';
```

Add this case before `fillChat`:

```ts
    case 'routeWorkflowCommand': {
      const adapter = await getCurrentAdapter();
      const target = getWorkflowCommandTargetForAdapter(adapter?.id ?? null);
      const prompt = buildWorkflowCommand({
        action: message.action,
        changeName: message.changeName,
        target,
      });
      if (adapter) {
        await adapter.fillChat({
          changeName: message.changeName ?? '',
          taskIndex: -1,
          taskText: '',
          contextFiles: [],
          workspaceRoot: dataManager.getWorkspaceRoot(),
          promptOverride: prompt,
        });
      } else {
        await vscode.env.clipboard.writeText(prompt);
        vscode.window.showInformationMessage(t('clipboard.copiedChat'));
      }
      break;
    }
```

This is the only path webview workflow actions should use for Chat routing. It lets Cursor receive `/opsx-apply <change>` while Clipboard/Generic targets keep `/opsx:apply <change>`.

- [ ] **Step 7: Migrate ChangeDetail and Dashboard to action intent**

Modify `src/webview/components/ChangeDetail.tsx`:

```ts
  const handleRouteWorkflow = (
    action: 'explore' | 'continue' | 'ff' | 'apply' | 'verify' | 'archive' | 'sync'
  ) => {
    postMessage(sendMessage.routeWorkflowCommand(action, changeName));
  };
```

Replace hard-coded calls:

```ts
handleRouteWorkflow('apply');
handleRouteWorkflow('verify');
handleRouteWorkflow('continue');
handleRouteWorkflow('explore');
```

Modify `src/webview/components/ChangeCard.tsx` so smart actions carry intent:

```ts
import type { WorkflowAction } from '../../shared/workflowCommand';

function getSmartActions(change: ChangeInfo): { label: string; action: WorkflowAction }[] {
  const hasAllArtifacts = change.artifacts?.every((a) => a.status === 'done') ?? false;
  const allTasksDone = change.totalTasks > 0 && change.completedTasks === change.totalTasks;

  if (!hasAllArtifacts) {
    return [
      { label: 'Continue', action: 'continue' },
      { label: 'FF', action: 'ff' },
    ];
  }
  if (allTasksDone) {
    return [
      { label: 'Verify', action: 'verify' },
    ];
  }
  return [
    { label: 'Apply', action: 'apply' },
  ];
}
```

Change button click from:

```ts
onFillChat(action.command);
```

to:

```ts
onWorkflowAction?.(action.action, change.name);
```

Update `Dashboard.tsx` to post:

```ts
postMessage(sendMessage.routeWorkflowCommand(action, changeName));
```

- [ ] **Step 8: Run webview utility tests**

Run:

```bash
pnpm vitest run test/webview/utils/workflowState.test.ts test/shared/workflowCommand.test.ts
```

Expected: PASS after webview workflow actions no longer require hard-coded `/opsx:*` strings.

---

## Task 5: Split Button UI For Archive

**Files:**
- Create: `src/webview/components/ui/SplitButton.tsx`
- Modify: `src/webview/components/ui/index.ts`
- Create: `test/webview/components/splitButton.test.ts`
- Modify: `src/webview/components/ActionBar.tsx`
- Modify: `src/webview/components/ChangeCard.tsx`

- [ ] **Step 1: Write failing SplitButton test**

Create `test/webview/components/splitButton.test.ts`:

```ts
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { SplitButton } from '../../../src/webview/components/ui/SplitButton';

describe('SplitButton', () => {
  it('renders primary label and menu items as React elements', () => {
    const onPrimary = vi.fn();
    const onArchiveNow = vi.fn();
    const element = SplitButton({
      label: 'Review & Archive',
      onPrimary,
      items: [
        { id: 'archive-now', label: 'Archive Now', onSelect: onArchiveNow },
      ],
    });

    expect(element.props.children).toBeDefined();
    expect(JSON.stringify(element)).toContain('Review & Archive');
    expect(JSON.stringify(element)).toContain('Archive Now');
  });

  it('renders disabled reason for disabled menu item', () => {
    const element = SplitButton({
      label: 'Review & Archive',
      onPrimary: vi.fn(),
      items: [
        {
          id: 'archive-now',
          label: 'Archive Now',
          disabled: true,
          disabledReason: 'Direct archive is unavailable while tasks are incomplete.',
          onSelect: vi.fn(),
        },
      ],
    });

    expect(JSON.stringify(element)).toContain('Direct archive is unavailable');
  });
});
```

- [ ] **Step 2: Run RED SplitButton test**

Run:

```bash
pnpm vitest run test/webview/components/splitButton.test.ts
```

Expected: FAIL because `SplitButton.tsx` does not exist.

- [ ] **Step 3: Implement SplitButton**

Create `src/webview/components/ui/SplitButton.tsx`:

```tsx
import React, { useState } from 'react';
import { Button, type ButtonVariant } from './Button';

export interface SplitButtonItem {
  id: string;
  label: string;
  disabled?: boolean;
  disabledReason?: string;
  onSelect: () => void;
}

export interface SplitButtonProps {
  label: string;
  variant?: ButtonVariant;
  onPrimary: () => void;
  items: SplitButtonItem[];
}

export const SplitButton: React.FC<SplitButtonProps> = ({
  label,
  variant = 'primary',
  onPrimary,
  items,
}) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative inline-flex items-center gap-0" data-split-button>
      <Button variant={variant} size="sm" onClick={onPrimary}>
        {label}
      </Button>
      <Button
        variant={variant}
        size="sm"
        aria-label={`${label} menu`}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        ▾
      </Button>
      {open && (
        <div
          role="menu"
          className="absolute z-10 top-full left-0 mt-1 min-w-40 rounded border p-1"
          style={{
            background: 'var(--vscode-menu-background, var(--vscode-editor-background))',
            borderColor: 'var(--vscode-menu-border, var(--vscode-panel-border))',
            color: 'var(--vscode-menu-foreground, var(--vscode-foreground))',
          }}
        >
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              title={item.disabled ? item.disabledReason : undefined}
              className="block w-full rounded px-2 py-1 text-left text-xs disabled:opacity-60"
              onClick={() => {
                if (item.disabled) return;
                setOpen(false);
                item.onSelect();
              }}
            >
              <span>{item.label}</span>
              {item.disabled && item.disabledReason && (
                <span className="block text-[10px]" style={{ color: 'var(--vscode-descriptionForeground)' }}>
                  {item.disabledReason}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
```

- [ ] **Step 4: Export SplitButton**

Modify `src/webview/components/ui/index.ts`:

```ts
export { SplitButton, type SplitButtonItem } from './SplitButton';
```

- [ ] **Step 5: Run SplitButton GREEN test**

Run:

```bash
pnpm vitest run test/webview/components/splitButton.test.ts
```

Expected: PASS.

- [ ] **Step 6: Wire SplitButton into ActionBar**

Modify `src/webview/components/ActionBar.tsx` imports:

```ts
import { SplitButton } from './ui/SplitButton';
```

Extend props:

```ts
  onReviewArchive?: (changeName: string) => void;
```

In secondary action map, replace archive special case:

```tsx
          action.kind === 'archiveReview' ? (
            <SplitButton
              key="review-archive"
              label={action.label}
              variant="danger"
              onPrimary={() => onReviewArchive?.(changeName)}
              items={[
                {
                  id: 'archive-now',
                  label: t('action.archiveNow'),
                  disabled: Boolean(action.directArchiveDisabledReason),
                  disabledReason: action.directArchiveDisabledReason,
                  onSelect: () => onArchive(changeName),
                },
              ]}
            />
          ) : (
```

Add i18n key later in Task 7.

- [ ] **Step 7: Wire ActionBar caller**

Modify `src/webview/components/ChangeDetail.tsx`:

```tsx
        onReviewArchive={() => handleRouteWorkflow('archive')}
```

Keep:

```tsx
        onArchive={(name) => postMessage(sendMessage.archiveChange(name))}
```

This preserves `Archive Now` direct path and changes the primary action to extension-host command routing, so Cursor can receive `/opsx-archive <change>`.

---

## Task 6: Dashboard Archive Flow

**Files:**
- Modify: `src/webview/components/ChangeCard.tsx`
- Modify: `src/webview/components/Dashboard.tsx`
- Modify: `src/i18n/locales/en.json`
- Modify: `src/i18n/locales/zh-cn.json`

- [ ] **Step 1: Add labels to i18n**

Modify `src/i18n/locales/en.json`:

```json
"action.reviewArchive": "Review & Archive",
"action.archiveNow": "Archive Now",
"action.archiveNowDisabledIncompleteTasks": "Direct archive is unavailable while tasks are incomplete.",
"action.archiveNowDisabledIncompleteArtifacts": "Complete required artifacts before direct archive."
```

Modify `src/i18n/locales/zh-cn.json`:

```json
"action.reviewArchive": "审查并归档",
"action.archiveNow": "立即归档",
"action.archiveNowDisabledIncompleteTasks": "存在未完成任务，不能直接归档。",
"action.archiveNowDisabledIncompleteArtifacts": "请先完成必需工件再直接归档。"
```

Ensure JSON commas remain valid.

- [ ] **Step 2: Update ChangeCard props for review archive**

Modify `src/webview/components/ChangeCard.tsx`:

```ts
  onReviewArchive?: (changeName: string) => void;
```

Destructure:

```ts
  onReviewArchive,
```

- [ ] **Step 3: Render dashboard archive split action**

Import `SplitButton` and use it when `change.totalTasks > 0`:

```tsx
          {onReviewArchive && change.totalTasks > 0 && (
            <SplitButton
              label={t('action.reviewArchive')}
              variant="danger"
              onPrimary={() => onReviewArchive(change.name)}
              items={[
                {
                  id: 'archive-now',
                  label: t('action.archiveNow'),
                  disabled: change.completedTasks !== change.totalTasks,
                  disabledReason:
                    change.completedTasks !== change.totalTasks
                      ? t('action.archiveNowDisabledIncompleteTasks')
                      : undefined,
                  onSelect: () => onArchive?.(change.name),
                },
              ]}
            />
          )}
```

Remove the old standalone `Archive` button block to avoid two archive actions.

- [ ] **Step 4: Wire Dashboard callback**

Add:

```ts
  const handleReviewArchive = (changeName: string) => {
    postMessage(sendMessage.routeWorkflowCommand('archive', changeName));
  };
```

Pass to `ChangesSection`; then update `ChangesSection` props to pass it to `ChangeCard`.

- [ ] **Step 5: Run i18n and workflow tests**

Run:

```bash
pnpm vitest run test/i18n/i18n.test.ts test/webview/utils/workflowState.test.ts
```

Expected: PASS.

---

## Task 7: Direct Archive Message Compatibility

**Files:**
- Modify: `src/extension/providers/webviewMessageHandler.ts`
- Modify: `test/extension/providers/webviewMessageHandler.test.ts`
- Modify: `README.md`
- Modify: `README.zh-CN.md`

- [ ] **Step 1: Write failing route workflow regression test**

Modify `test/extension/providers/webviewMessageHandler.test.ts` with a case that sends `routeWorkflowCommand`:

```ts
it('routes Review & Archive through adapter command routing without calling archiveChange', async () => {
  const archiveChange = vi.fn();
  const fillChat = vi.fn().mockResolvedValue({ success: true, adapterId: 'cursor' });
  const dataManager = {
    archiveChange,
    getWorkspaceRoot: () => '/workspace',
  };
  const webview = { postMessage: vi.fn() };
  vi.mocked(getCurrentAdapter).mockResolvedValue({
    id: 'cursor',
    displayName: 'Cursor',
    isAvailable: vi.fn(),
    executeTask: vi.fn(),
    fillChat,
  });

  await handleWebviewMessage(
    { type: 'routeWorkflowCommand', action: 'archive', changeName: 'demo-change' } as any,
    webview as any,
    dataManager as any
  );

  expect(archiveChange).not.toHaveBeenCalled();
  expect(fillChat).toHaveBeenCalledWith(
    expect.objectContaining({
      changeName: 'demo-change',
      promptOverride: '/opsx-archive demo-change',
    })
  );
});
```

Ensure the file imports or mocks `getCurrentAdapter` consistently with the existing test setup.

- [ ] **Step 2: Run RED route workflow test**

Run:

```bash
pnpm vitest run test/extension/providers/webviewMessageHandler.test.ts
```

Expected: FAIL until `routeWorkflowCommand` is implemented in `webviewMessageHandler.ts`.

- [ ] **Step 3: Keep archiveChange direct path unchanged**

Do not change `case 'archiveChange'` except message wording if needed. It must continue:

```ts
await dataManager.archiveChange(name);
```

after modal confirmation.

- [ ] **Step 4: Update README quick actions docs**

Modify `README.md` Usage section:

```md
5. Use the action bar or change-card actions to open/copy OpenSpec workflow commands. In Cursor, Review & Archive opens the Agent archive workflow; Archive Now remains available as an explicit direct archive action.
```

Modify `README.zh-CN.md` with equivalent Chinese:

```md
5. 使用操作栏或 change 卡片操作打开/复制 OpenSpec workflow 命令。在 Cursor 中，审查并归档会进入 Agent 归档流程；立即归档仍作为显式的直接归档入口保留。
```

---

## Task 8: Package Verification And Manual Cursor Check

**Files:**
- Modify only if checks fail: `.vscodeignore`, `README.md`, `README.zh-CN.md`

- [ ] **Step 1: Run unit tests through test subagent**

Command for the test subagent:

```bash
pnpm vitest run test/shared/workflowCommand.test.ts test/extension/services/cursorPluginRegistration.test.ts test/extension/adapters/cursorAdapter.test.ts test/extension/providers/webviewMessageHandler.test.ts test/webview/utils/workflowState.test.ts test/webview/components/splitButton.test.ts test/i18n/i18n.test.ts
```

Expected: all tests PASS.

- [ ] **Step 2: Run full test suite through test subagent**

Command:

```bash
pnpm test
```

Expected: all tests PASS.

- [ ] **Step 3: Run build through test subagent**

Command:

```bash
pnpm run build
```

Expected: extension and webview build complete without TypeScript or bundling errors.

- [ ] **Step 4: Verify VSIX packaged files**

Command:

```bash
pnpm run package
```

Then inspect package contents with:

```bash
rtk unzip -l *.vsix | rtk rg "cursor-plugins/openspec/(commands|skills)"
```

Expected: output includes `cursor-plugins/openspec/commands/opsx-apply.md` and at least one `cursor-plugins/openspec/skills/openspec-*/SKILL.md`.

- [ ] **Step 5: Manual Cursor Extension Development Host verification**

Launch Extension Development Host using the project’s VS Code/Cursor launch config. In a workspace with `openspec/config.yaml`:

- Open OpenSpec dashboard.
- Open a change with incomplete tasks.
- Click Apply.
- Expected: Cursor Chat opens with `/opsx-apply <change>` or command is copied if prefill is unsupported.
- Open a completed change.
- Click `Review & Archive`.
- Expected: Cursor Chat opens with `/opsx-archive <change>` or command is copied if prefill is unsupported.
- Open archive dropdown.
- Expected: `Archive Now` is enabled only when tasks and artifacts are complete.

- [ ] **Step 6: Request code review**

Dispatch code review subagent with this scope:

```text
Review implementation for improve-cursor-native-interaction and add-ai-guided-archive-flow.
Focus on command routing correctness, Cursor API fallback safety, no direct file mutation from Chat routing, Archive Now gating, VS Code compatibility, packaging rules, and test coverage.
P0/P1 must be fixed before marking OpenSpec tasks complete.
```

Expected: no P0/P1 findings remain.

---

## Self-Review

### Spec Coverage

- `agent-command-routing`: covered by Tasks 1, 2, 3, 4, 8.
- `dashboard` command routing: covered by Tasks 4, 6, 7.
- `task-management` prompt routing: covered by Task 3.
- `ai-guided-archive`: covered by Tasks 5, 6, 7, 8.
- `cli-integration` direct archive compatibility: covered by Task 7.

### Placeholder Scan

No `TBD`, `TODO`, `implement later`, or unspecified “add tests” steps remain. Each code-changing task includes concrete file paths, code snippets, and expected test commands.

### Type Consistency

The plan consistently uses:

- `WorkflowAction`
- `WorkflowCommandTarget`
- `buildWorkflowCommand()`
- `getWorkflowCommandTargetForAdapter()`
- `WorkflowAction.kind`
- `SplitButton`
- `archiveReview`

These names must be preserved unless implementation discovers a compile-time conflict; if renamed, update tests and all references in the same task before proceeding.
