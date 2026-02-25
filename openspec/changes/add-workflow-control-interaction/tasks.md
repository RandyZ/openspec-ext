# Tasks

## 1. 工作流状态模型

- [x] 1.1 新建 `src/webview/utils/workflowState.ts`，定义 `WorkflowStep`、`StepStatus`、`WorkflowState`、`WorkflowAction` 类型
- [x] 1.2 实现 `deriveWorkflowState(existingArtifactIds, completedTasks, totalTasks, isArchived)` 函数，根据 change 状态推导工作流进度和推荐动作
- [x] 1.3 实现 `getNextArtifact(existingArtifactIds)` 辅助函数，返回下一个待创建的 artifact 类型
- [x] 1.4 编写 `workflowState.test.ts` 单元测试，覆盖所有状态组合

## 2. WorkflowStepIndicator 组件

- [x] 2.1 新建 `src/webview/components/WorkflowStepIndicator.tsx` 组件
- [x] 2.2 实现水平步骤条 UI：dot + label + 连接线，使用 VS Code 主题变量
- [x] 2.3 实现步骤点击交互：done 步骤切换 tab，current 步骤触发 fillChat
- [x] 2.4 实现窄面板自适应：宽度不足时省略 label 仅显示 dot
- [x] 2.5 归档 change 步骤条显示为全部完成且不可触发创建

## 3. 动态 ActionBar 改造

- [x] 3.1 修改 `ActionBar.tsx` 的 Props 接口，增加 `workflowState` 和 `onAction` 回调
- [x] 3.2 实现主要按钮（primary）根据 `workflowState.nextAction` 动态渲染
- [x] 3.3 实现次要按钮根据状态动态显示/隐藏（Continue、FF、Apply、Verify、Sync Specs）
- [x] 3.4 Continue 按钮文案动态标注下一个 artifact（如 "Continue → Specs"）
- [x] 3.5 保持 Open in Editor、Refresh 始终可见；归档 change 隐藏所有写操作按钮

## 4. 命令发送机制

- [x] 4.1 在 webview 消息类型中添加 `runCommand` 类型（如尚未存在）
- [x] 4.2 在 `webviewMessageHandler.ts` 中实现 `runCommand` handler：通过当前 adapter 的 fillChat 发送命令，无 adapter 时回退到剪贴板
- [x] 4.3 在 ChangeDetail 中实现 `handleWorkflowAction(command)` 统一入口

## 5. ArtifactViewer 改造

- [x] 5.1 修改 ArtifactViewer 的 "用 AI 创建" 按钮行为：改为通过 `handleWorkflowAction` 发送 `/opsx:continue <changeName>`
- [x] 5.2 无 artifact 的空状态增加 **Explore** 按钮，发送 `/opsx:explore`

## 6. Verify 入口改造

- [x] 6.1 修改 ChangeDetail 的 Verify tab 显示条件：有 task 已完成时显示（移除 debug-only 限制）
- [x] 6.2 Verify tab 内容：展示说明文字和触发按钮，点击后 fillChat 发送 `/opsx:verify <changeName>`
- [x] 6.3 Archive 按钮点击时增加 verify 引导：若 tasks 全部完成且未 verify，弹窗建议先 verify

## 7. Sync Specs 入口

- [x] 7.1 ActionBar 增加 Sync Specs 按钮：change 有 delta specs 且非归档时显示
- [x] 7.2 点击后通过 adapter fillChat 发送 `/opsx:sync <changeName>`

## 8. ChangeCard 智能操作

- [x] 8.1 修改 ChangeCard 的 hover 操作：根据 change 状态动态生成按钮（Continue/FF/Apply/Verify/Archive）
- [x] 8.2 hover 操作按钮通过 adapter fillChat 发送对应命令

## 9. 集成与 ChangeDetail 组装

- [x] 9.1 在 ChangeDetail 中引入 WorkflowStepIndicator，传递 workflowState 和步骤点击回调
- [x] 9.2 在 ChangeDetail 中调用 deriveWorkflowState，将结果传递给 ActionBar 和 WorkflowStepIndicator
- [ ] 9.3 端到端测试：创建新 change → 逐步 continue → apply → verify → archive 全流程

## 10. 文档与收尾

- [ ] 10.1 更新 README 的 Dashboard / Change Detail 部分说明新增的工作流控制交互
- [ ] 10.2 运行扩展并验证：各状态下 ActionBar 按钮、步骤条、ChangeCard hover 操作正确
