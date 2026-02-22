## Context

已归档的 change 以 `changeName.startsWith('archive:')` 识别。当前代码中 `isArchived` 已在多处计算，但仅用于隐藏「Archive Change」按钮（`ActionBar`）。其余写操作入口（taskToggle、taskExecute、createArtifact、Verify 执行）对归档 change 均未做限制，后端 message handler 也未做 `archive:` 校验。

## Goals / Non-Goals

**Goals:**
- 所有写操作前端入口在归档 change 下不可用
- 后端对写操作消息做 `archive:` 前缀防御校验
- 只读操作（查看内容、刷新、复制命令、在编辑器中打开）保持不变

**Non-Goals:**
- 改变归档目录结构或归档流程本身
- 对「在编辑器中打开」做只读限制（文件已归档，用户若主动在编辑器修改属用户行为，不在本次范围）

## Decisions

### 决策 1：在已有 `isArchived` 变量处直接扩展约束

**当前**：`ChangeDetail.tsx` 第 211 行已有 `const isArchived = changeName.startsWith('archive:')` 并传给 `ActionBar`。

**做法**：将 `isArchived` 继续传给 `TaskList` 和 `ArtifactViewer`，分别控制：
- `TaskList`：`isArchived` 为 true 时，checkbox `disabled`、不渲染「执行」按钮。
- `ArtifactViewer`：`isArchived` 为 true 时，不传 `onCreateWithAi` prop（该 prop 为 undefined 时按钮不渲染）。
- `ChangeDetail` 的 Verify tab：`isArchived` 为 true 时不渲染「执行」按钮。

**理由**：最小侵入，不引入新状态层，统一走已有的 `isArchived` 判断。

---

### 决策 2：后端用 early return 防御

**做法**：在 `webviewMessageHandler.ts` 的 `toggleTask`、`executeTask`、`requestCreateArtifact`、`runCommand` case 顶部加：
```
if (changeName.startsWith('archive:')) {
  vscode.window.showInformationMessage('已归档的 change 仅可查看，不支持该操作');
  break;
}
```

**理由**：
- 即使前端被绕过（如旧版面板），后端也不执行写操作。
- `archive:` 前缀是整个扩展已有的约定，无需新增状态。

---

### 决策 3：TaskList 接受 `isArchived` prop 控制交互

**做法**：`TaskList` 新增可选 prop `isArchived?: boolean`，用于：
- checkbox：`disabled={isArchived}` + 禁用样式（opacity 降低）
- 「执行」按钮：`isArchived` 时不渲染（`onExecuteTask` prop 为 undefined 或通过 `isArchived` 判断）

`onExecuteTask` 已是可选 prop，最简单做法是 `isArchived` 为 true 时不传 `onExecuteTask` 即可隐藏按钮；checkbox 则需要显式传 `isArchived`。

## Risks / Trade-offs

- [风险] 用户看到已归档任务时可能不理解为何 checkbox 禁用 → 缓解：可在 Tasks tab 顶部加一行小提示「此 change 已归档，仅可查看」。
- [风险] 「在编辑器中打开」允许用户直接编辑归档文件 → 接受：这是用户主动行为，扩展不强制约束文件系统写权限。

## Migration Plan

纯行为约束，无数据迁移，向前兼容（旧面板若发送 write 消息，后端直接忽略）。

## Open Questions

- Tasks tab 顶部是否加「已归档，仅可查看」提示横幅？→ 建议加，能降低用户疑惑，具体样式实现时决定。
