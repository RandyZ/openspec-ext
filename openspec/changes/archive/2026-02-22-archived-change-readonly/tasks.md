## 1. 后端防御：message handler 拒绝归档 change 的写操作

- [x] 1.1 在 `webviewMessageHandler.ts` 的 `toggleTask` case 顶部：若 `changeName.startsWith('archive:')` 则 `break`，并可选 toast「已归档，仅可查看」
- [x] 1.2 在 `executeTask` case 顶部：同样加 `archive:` 检查并 `break`
- [x] 1.3 在 `requestCreateArtifact` case 顶部：同样加 `archive:` 检查并 `break`
- [x] 1.4 在 `runCommand` case 顶部：同样加 `archive:` 检查并 `break`

## 2. TaskList 组件：归档时禁用 checkbox、隐藏「执行」按钮

- [x] 2.1 `TaskList` 新增可选 prop `isArchived?: boolean`
- [x] 2.2 当 `isArchived` 为 true 时，`TaskCheckbox` 使用 `disabled` 状态（不可点击，降低 opacity 或添加 cursor-not-allowed 样式）
- [x] 2.3 当 `isArchived` 为 true 时，不渲染每行任务的「执行」按钮（条件渲染或不传 `onExecuteTask`）

## 3. ChangeDetail：将 isArchived 传给各子组件

- [x] 3.1 在 `ChangeDetail` 中将 `isArchived` 传给 `TaskList`（新增 `isArchived` prop）
- [x] 3.2 在 `ChangeDetail` 中当 `isArchived` 为 true 时，不向 `ArtifactViewer` 传 `onCreateWithAi`（传 `undefined` 或条件渲染），隐藏「用 AI 创建」按钮
- [x] 3.3 在 `ChangeDetail` 的 Verify tab：当 `isArchived` 为 true 时，隐藏「执行」按钮
- [x] 3.4 （可选）Tasks tab 顶部：当 `isArchived` 为 true 时，显示一行小提示「此 change 已归档，仅可查看」

## 4. 验证与回归测试

- [x] 4.1 打开一个已归档的 change，查看 Tasks tab：checkbox 为禁用状态，无「执行」按钮
- [x] 4.2 尝试点击已归档 change 的 checkbox：无任何反应，后台无 toggleTask 消息
- [x] 4.3 查看 Proposal / Design / Specs tab：内容正常显示，无「用 AI 创建」按钮（若 artifact 不存在也不显示）
- [x] 4.4 「Copy /opsx:ff」「Refresh」「在编辑器中打开」功能正常
- [x] 4.5 打开一个活跃 change：所有功能（checkbox、执行、用 AI 创建）正常，不受影响
