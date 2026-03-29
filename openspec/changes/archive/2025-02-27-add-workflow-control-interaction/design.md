# Design: 工作流控制交互

## 设计目标

- 将插件从"artifact 查看器"进化为"工作流推进引擎"
- 用户打开 change 时立刻知道：当前在哪一步、下一步该做什么、如何触发
- 通过 adapter fillChat 将命令发送到 AI Chat，而非直接执行 CLI

## 1. 工作流状态模型

### 1.1 步骤定义

```typescript
type WorkflowStep =
  | 'proposal'   // 对应 artifact: proposal.md
  | 'specs'      // 对应 artifact: specs/
  | 'design'     // 对应 artifact: design.md
  | 'tasks'      // 对应 artifact: tasks.md
  | 'apply'      // 虚拟步骤：tasks 有内容但未全部完成
  | 'verify'     // 虚拟步骤：tasks 全部完成后
  | 'archive';   // 虚拟步骤：已验证或用户选择直接归档

type StepStatus = 'done' | 'current' | 'upcoming';

interface WorkflowState {
  steps: { step: WorkflowStep; status: StepStatus }[];
  currentStep: WorkflowStep;
  nextAction: WorkflowAction | null;
}
```

### 1.2 状态推导逻辑

```
输入：existingArtifactIds, completedTasks, totalTasks, isArchived

if isArchived → 全部 done，无 nextAction
if !has('proposal') → current=proposal
elif !has('specs') || !has('design') → current=specs 或 design（取先缺失的）
elif !has('tasks') → current=tasks
elif completedTasks < totalTasks → current=apply
elif completedTasks === totalTasks && totalTasks > 0 → current=verify
else → current=archive
```

### 1.3 WorkflowAction 定义

```typescript
interface WorkflowAction {
  label: string;          // 按钮文案，如 "Continue → Specs"
  command: string;        // opsx 命令，如 "/opsx:continue add-auth"
  variant: 'primary' | 'secondary';
}
```

## 2. 组件架构

```
ChangeDetail
├── Title Bar (changeName, "Show in sidebar")
├── WorkflowStepIndicator  ← 新组件
│   └── StepDot × 7 (proposal → archive)
├── ActionBar  ← 改造：动态按钮
│   ├── PrimaryAction (根据 workflowState)
│   ├── SecondaryActions[]
│   └── AlwaysVisible: Open in Editor, Refresh
├── Tabs (Proposal | Specs | Design | Tasks | Verify?)
└── Tab Content (ArtifactViewer / TaskList)
```

### 2.1 WorkflowStepIndicator 组件

```
┌──────────────────────────────────────────────────────────────┐
│  ✓ Proposal ──── ✓ Specs ──── ● Design ──── ○ Tasks ─ ...   │
└──────────────────────────────────────────────────────────────┘
```

- 每个步骤渲染为一个 dot + label
- dot 颜色：done=绿色，current=蓝色/主色，upcoming=灰色
- 步骤间用横线连接
- 点击行为：done 步骤 → 切换 tab；current 步骤 → 触发 fillChat

Props:

```typescript
interface WorkflowStepIndicatorProps {
  steps: { step: WorkflowStep; status: StepStatus }[];
  onStepClick: (step: WorkflowStep) => void;
  isArchived: boolean;
}
```

### 2.2 动态 ActionBar 改造

当前 ActionBar 接收固定的 callback props。改造为接收 `WorkflowState`，内部根据状态生成按钮列表。

```typescript
interface ActionBarProps {
  changeName: string;
  isArchived: boolean;
  workflowState: WorkflowState;
  hasDeltaSpecs: boolean;
  onAction: (command: string) => void;  // 统一 fillChat 入口
  onOpenInEditor: () => void;
  onArchive: (changeName: string) => void;
  onRefresh: () => void;
}
```

主要按钮（primary 样式）：workflowState.nextAction
次要按钮（secondary 样式）：固定的辅助操作

### 2.3 命令发送统一入口

所有工作流命令通过一个统一方法发送：

```typescript
// ChangeDetail 中
const handleWorkflowAction = (command: string) => {
  sendMessage(postMessage, { type: 'runCommand', command });
};
```

扩展端 `webviewMessageHandler.ts` 的 `runCommand` handler 调用 adapter fillChat：

```typescript
case 'runCommand': {
  const adapter = await getCurrentAdapter();
  if (adapter) {
    await adapter.fillChat({ prompt: message.command });
  } else {
    await vscode.env.clipboard.writeText(message.command);
    vscode.window.showInformationMessage('已复制到剪贴板');
  }
  break;
}
```

## 3. Verify Tab 显示逻辑

```
当前：debug=true 时显示
改为：满足以下任一条件时显示
  1. debug=true
  2. change 有 tasks.md 且至少 1 个 task 已完成
  3. change 全部 tasks 完成（强烈推荐 verify）
```

Verify tab 内容：通过 adapter fillChat 发送 `/opsx:verify <changeName>`，在 tab 内展示一个触发按钮和说明文字。

## 4. Archive 前 Verify 引导

```
用户点击 Archive
  ↓
检查：是否有 tasks 全部完成 && 未执行过 verify？
  ↓ 是
弹出 ConfirmDialog：
  "建议在归档前执行 /opsx:verify 验证实现完整性。"
  [先 Verify]  [直接 Archive]  [取消]
  ↓ 否
直接走现有 archive 流程
```

verify 状态可从 `.openspec.yaml` 的 `extension` 字段读取（若有标记），或简单地每次都提示。

## 5. ChangeCard 智能 hover 操作

```typescript
function getCardActions(change: ChangeInfo): CardAction[] {
  const hasAllArtifacts = change.artifacts?.every(a => a.status === 'done');
  const allTasksDone = change.totalTasks > 0 && change.completedTasks === change.totalTasks;

  if (!hasAllArtifacts) {
    return [
      { label: 'Continue', command: `/opsx:continue ${change.name}` },
      { label: 'FF', command: `/opsx:ff ${change.name}` },
    ];
  }
  if (allTasksDone) {
    return [
      { label: 'Verify', command: `/opsx:verify ${change.name}` },
      { label: 'Archive', action: 'archive' },
    ];
  }
  return [
    { label: 'Apply', command: `/opsx:apply ${change.name}` },
    { label: 'Verify', command: `/opsx:verify ${change.name}` },
  ];
}
```

## 6. 视觉风格

- 步骤条高度约 36px，紧凑但清晰
- 使用 VS Code 主题变量：
  - done: `--vscode-testing-iconPassed`（绿色）
  - current: `--vscode-progressBar-background`（蓝色）
  - upcoming: `--vscode-descriptionForeground`（灰色）
  - 连接线: `--vscode-panel-border`
- 主要按钮用 `--vscode-button-background`
- 窄面板（<400px）时步骤条省略 label 仅显示 dot
