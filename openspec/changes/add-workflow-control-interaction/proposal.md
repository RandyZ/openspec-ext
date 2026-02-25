## Why

用户在 OpenSpec 插件中查看 draft change 时，缺乏对 [OpenSpec Workflow](https://github.com/Fission-AI/OpenSpec/blob/main/docs/workflows.md) 流程的控制交互。当前插件是一个"查看工具"，用户必须自己记住工作流顺序（`new → continue/ff → apply → verify → archive`），手动 copy 命令到 Chat 中执行。插件没有根据 change 的当前状态智能推荐下一步操作，也没有提供 `/opsx:continue`、`/opsx:explore`、`/opsx:verify`、`/opsx:sync` 等关键工作流命令的入口。

具体问题：

1. **无工作流进度可视化**：ChangeCard 上的 artifact badges 只有 done/ready/blocked 颜色，没有明确告诉用户"你在哪一步"和"下一步该做什么"。
2. **缺少 `/opsx:continue` 入口**：ActionBar 只有 `Copy /opsx:ff` 和 `Copy /opsx:apply`，没有逐步推进 artifact 的 `Continue` 操作。
3. **缺少 `/opsx:explore` 入口**：draft change 在 proposal 未创建时没有建议用户先 explore 的交互。
4. **`/opsx:verify` 入口缺失**：verify tab 默认隐藏（debug only），ActionBar 没有 verify 操作，Archive 按钮不会引导先 verify。
5. **`/opsx:sync` 入口缺失**：归档前无法检查 delta spec 是否已同步到 main spec。
6. **ActionBar 不根据状态动态变化**：无论 change 处于什么状态，都展示相同的固定按钮。

## What Changes

### 1. 工作流状态指示器（Workflow Step Indicator）

在 ChangeDetail 面板顶部（标题与 ActionBar 之间）添加一个水平步骤条，展示当前 change 在工作流中的位置：

```
[Proposal] → [Specs] → [Design] → [Tasks] → [Apply] → [Verify] → [Archive]
    ✓          ✓         ●                                 
```

- 已完成的步骤（artifact 已创建）显示 ✓
- 当前推荐步骤高亮显示
- 未来步骤显示为灰色
- 步骤可点击，点击已完成步骤切换到对应 tab，点击当前推荐步骤触发创建动作

### 2. 动态 ActionBar（Context-Aware Actions）

根据 change 的工作流状态，动态调整 ActionBar 的主要操作按钮：

| Change 状态 | 主要按钮（高亮） | 次要按钮 |
|---|---|---|
| 刚创建，无 artifact | **Continue**（创建 proposal） | FF, Open in Editor |
| 有 proposal，缺其他 artifact | **Continue**（创建下一个） | FF, Copy /opsx:apply |
| 全部 planning artifact 就绪 | **Copy /opsx:apply** | Copy /opsx:ff, Verify |
| 部分 tasks 完成 | **Copy /opsx:apply** | Verify, Archive |
| 全部 tasks 完成 | **Verify** | Archive, Sync Specs |
| 已验证 | **Archive** | Sync Specs |

- "Continue" 按钮：调用当前 adapter 的 fillChat，发送 `/opsx:continue <changeName>` 命令
- "FF" 按钮从 "Copy" 改为直接 fillChat（如当前 adapter 支持）

### 3. `/opsx:continue` 和 `/opsx:explore` 入口

- ActionBar 添加 **Continue** 按钮：基于当前缺失的 artifact，生成并发送 `/opsx:continue <changeName>` 到 Chat
- 当 change 无任何 artifact 时，在空状态提示中增加 **Explore** 按钮，发送 `/opsx:explore` 到 Chat
- "用 AI 创建" 按钮改为调用 `/opsx:continue`，保持一致

### 4. `/opsx:verify` 常驻入口

- 移除 verify tab 的 debug-only 限制，改为 tasks 全部完成或 change 处于 completed 状态时显示
- ActionBar 在 tasks 有完成时显示 **Verify** 按钮
- 在 Archive Change 按钮点击时，若未 verify 过，弹窗建议先 verify

### 5. `/opsx:sync` 入口

- 当 change 有 delta specs 且未归档时，在 ActionBar 显示 **Sync Specs** 按钮
- 点击后发送 `/opsx:sync <changeName>` 到 Chat

## Capabilities

### New Capabilities

- `workflow-step-indicator`：ChangeDetail 面板中的工作流进度指示器
- `dynamic-action-bar`：根据 change 状态动态调整主要/次要操作按钮
- `continue-action`：通过 adapter fillChat 发送 `/opsx:continue` 命令
- `explore-action`：通过 adapter fillChat 发送 `/opsx:explore` 命令
- `verify-action`：非 debug 模式下的 verify 入口和归档前 verify 引导
- `sync-specs-action`：通过 adapter fillChat 发送 `/opsx:sync` 命令

### Modified Capabilities

- `artifact-viewing`：空 artifact 的 "用 AI 创建" 按钮改为调用 `/opsx:continue`
- `task-management`：ActionBar 按 task 完成度动态展示 Verify/Archive 入口
- `dashboard`：ChangeCard hover 操作根据 change 状态智能推荐

## Impact

- 新增文件：`src/webview/components/WorkflowStepIndicator.tsx`
- 修改文件：`src/webview/components/ActionBar.tsx`、`src/webview/components/ChangeDetail.tsx`、`src/webview/components/ArtifactViewer.tsx`、`src/webview/components/ChangeCard.tsx`、`src/extension/providers/webviewMessageHandler.ts`
- 不涉及 CLI 流程变更，仅增加 adapter fillChat 调用
- 不涉及新增消息协议（复用 `executeTask` / `runCommand` / 已有 adapter 机制）
