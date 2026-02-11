# Tasks: 优化插件与多 IDE/AI 的交互

## 1. 类型与接口

- [ ] 1.1 在 extension 中新增类型定义文件（如 `services/agentExecutor.types.ts`），定义 `TaskExecuteRequest`、`TaskExecuteResult`、`IAgentExecutorAdapter` 接口
- [ ] 1.2 确保主逻辑与 adapters 仅引用该类型文件，不直接引用具体 adapter 实现

## 2. 配置项

- [ ] 2.1 在 `package.json` 的 `contributes.configuration` 中新增 `openspec.taskExecutionMode`（auto | fillChat，默认 fillChat）
- [ ] 2.2 新增 `openspec.preferredAgentAdapter`（string，用户选择的 adapter id）
- [ ] 2.3 新增 `openspec.taskDependencyPolicy`（block | warn，默认 block）

## 3. Adapter 加载器与目录

- [ ] 3.1 创建 `src/extension/adapters/` 目录
- [ ] 3.2 在 `adapters/index.ts` 中实现 Adapter 注册列表与「发现可用 Adapter」的加载函数（对每个注册项调用 `isAvailable()`，返回可用列表）
- [ ] 3.3 实现根据 `openspec.preferredAgentAdapter` 解析当前 Adapter 的逻辑（不可用时回退到第一个可用或 clipboard）

## 4. Clipboard Adapter（第一期）

- [ ] 4.1 实现 `clipboard-adapter.ts`：`isAvailable()` 恒为 true，`fillChat` 将生成的 prompt/命令写入剪贴板并提示用户
- [ ] 4.2 在 clipboard adapter 中 `executeTask` 行为定义为复制到剪贴板或明确 no-op，并在加载器中注册该 adapter

## 5. Cursor Adapter（第一期）

- [ ] 5.1 实现 `cursor-adapter.ts`：`isAvailable()` 检测 `agent` CLI 是否存在（或 Cursor 环境）
- [ ] 5.2 实现 `executeTask`：构造 prompt 并调用 `agent` CLI 执行
- [ ] 5.3 实现 `fillChat`：复制到剪贴板并提示（或若存在 Cursor Chat API 则预填），在加载器中注册

## 6. 依赖检查与 TaskExecutorService

- [ ] 6.1 复用或扩展 FileManager/readTasks 能力，在给定 change 下解析 tasks.md 得到任务列表与完成状态（含文档顺序索引）
- [ ] 6.2 实现依赖检查函数：给定 taskIndex，判断所有 j < taskIndex 的任务是否均为已完成；若未完成则返回未完成列表
- [ ] 6.3 实现 TaskExecutorService：接收 changeName、taskIndex、taskText；执行依赖检查并根据 taskDependencyPolicy 决定阻止/警告；读取 taskExecutionMode 与当前 Adapter，调用 `executeTask` 或 `fillChat`；将结果或错误反馈给用户

## 7. 消息与命令串联

- [ ] 7.1 在 webview 消息类型中新增 `executeTask`（changeName, taskIndex, taskText）
- [ ] 7.2 在 Extension 侧 message handler 中处理 `executeTask`：调用 TaskExecutorService，并根据结果向 webview 或用户提示成功/失败

## 8. Webview 任务列表执行入口

- [ ] 8.1 在任务列表每条任务行上增加「执行」入口（按钮或链接），与任务一一对应
- [ ] 8.2 点击时向 extension 发送 `executeTask` 消息，携带当前 change 名、任务索引、任务文本

## 9. 用户选择 Adapter 的入口

- [ ] 9.1 在设置页或执行相关 UI 中展示当前可用 Adapter 列表及当前选中项（读取配置与加载器可用列表）
- [ ] 9.2 允许用户切换选中 Adapter，并将选择写入 `openspec.preferredAgentAdapter`

## 10. 文档与收尾

- [ ] 10.1 在 README 或设置说明中补充各配置项及 Adapter 的适用环境（如 Cursor 需 agent CLI、Clipboard 始终可用）
- [ ] 10.2 运行扩展并验证：选择 adapter、执行模式、点击任务执行/填 Chat、依赖未完成时阻止或警告
