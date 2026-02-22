## Why

已归档的 change 在面板中目前仍然允许用户勾选/取消任务、执行任务、用 AI 创建 artifact，与"归档 = 历史记录、只读"的语义不符，存在误操作风险（如意外改写归档目录里的文件）。

## What Changes

- **前端（webview）**：当 `changeName.startsWith('archive:')` 时，隐藏或禁用所有写操作入口：任务 checkbox、任务「执行」按钮、artifact 缺失时的「用 AI 创建」、Verify tab 的「执行」按钮；ActionBar 的「Archive Change」按钮已隐藏（不变）；「在编辑器中打开」、「Copy /opsx:ff」、「Copy /opsx:apply」、「Refresh」等只读操作保留。
- **后端（扩展 message handler）**：对 `toggleTask`、`executeTask`、`requestCreateArtifact`、`runCommand` 等写操作，若 `changeName.startsWith('archive:')` 则直接 return，可选提示「已归档，仅可查看」，防止旧面板或其他调用绕过前端限制。

## Capabilities

### New Capabilities

- `archived-change-readonly`: 已归档 change 的只读约束——前端隐藏/禁用所有写操作，后端拒绝 archive: 开头的写请求。

### Modified Capabilities

- `task-management`: 任务勾选与执行的行为变更——已归档 change 下均不可操作。
- `artifact-viewing`: 已归档 change 下「用 AI 创建」按钮不显示，视图其余行为不变。

## Impact

- 修改文件：`src/webview/components/ChangeDetail.tsx`、`src/webview/components/TaskList.tsx`、`src/webview/components/ArtifactViewer.tsx`、`src/extension/providers/webviewMessageHandler.ts`
- 不涉及 CLI、OpenSpec 核心流程、消息协议新增
