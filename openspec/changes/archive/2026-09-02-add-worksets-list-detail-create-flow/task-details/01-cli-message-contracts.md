# Task 1. CLI 与消息契约

<!-- covers: Task 1.1, Task 1.2 -->

### Task 1.1: 定义创建、选成员、结果回传与单次工具覆盖消息契约

**Spec coverage:** `workset-creation` / Project-first Workset creation form / Open the creation form；Trusted Workset member selection / Add multiple folders；Workset creation result and refresh / Workset creation succeeds、Workset creation fails；`workset-cli-open` / Official Workset open action / Open a saved Workset with a one-time tool override；Unambiguous Workset action labels / Worksets launcher、Workset list row、Workset detail actions、Planning Store member row。

**Dependencies / order:** 首个实现任务；先固定跨 Webview/Host 边界的判别联合类型和发送器，再让后续 Host 与 UI 任务消费同一契约。

**Files:**
- Modify: `src/webview/types/messages.ts`
- Create: `test/webview/types/messages.test.ts`

**Implementation notes:** 在现有 `WebviewMessage`、`ExtensionMessage` 与 `sendMessage` 中直接加入 `pickWorksetMembers`、`createWorkset { name, members, tool? }`、带可选 `tool` 的 `openWorkset`、`selectWorksetStore { worksetName, memberPath }`、`selectProjectDefaultRoot`、`worksetMembersPicked { paths }`、`worksetCreateResult { success, name, message? }`。不增加第二套消息总线、request registry 或持久状态。

**Verification:** `pnpm exec vitest run test/webview/types/messages.test.ts`；预期新增发送器产生精确 payload，省略可选值时不产生空字段，测试退出码为 0。

**Risks / edge cases:** 可选工具必须保持一次性值而非保存配置；数组仍是不可信输入，Host 校验留给 Task 4.2；不要改变既有消息的字段名或 `setContext` 路径。

- [ ] **Step 1（5 分钟）:** 新建消息测试，断言六类 Webview 消息、两个 Host 结果消息以及 `openWorkset(name, tool?)` 的精确对象结构。
- [ ] **Step 2（2 分钟）:** 运行 `pnpm exec vitest run test/webview/types/messages.test.ts`，确认因类型或发送器尚不存在而 FAIL。
- [ ] **Step 3（5 分钟）:** 只扩展现有判别联合与 `sendMessage`，不引入新的消息抽象。
- [ ] **Step 4（3 分钟）:** 重跑聚焦测试，确认全部 PASS 且可选字段按是否提供决定是否出现。
- [ ] **Step 5（3 分钟）:** 运行 `pnpm run build:webview`，确认消息联合在 React 构建中无类型分支遗漏。

---

### Task 1.2: 实现 selector-free 创建与普通 Workset 打开命令

**Spec coverage:** `workset-creation` / Selector-free official Workset creation / Create a Workset without a preferred tool、Create a Workset with a preferred tool；`workset-cli-open` / Official Workset open action / Open a saved Workset、Open a saved Workset with its configured tool、Open a saved Workset with a one-time tool override、Workset open reports an error。

**Dependencies / order:** 依赖 Task 1.1 的 `openWorkset` 工具参数契约；在创建 Host 流程前先锁定 CLI argv 与普通/JSON runner 边界。

**Files:**
- Modify: `src/extension/services/dataManager.ts`
- Modify: `test/extension/services/dataManager.test.ts`

**Implementation notes:** 将 `openWorkset(name, tool?)` 保持在 `runCommand`，仅在 trim 后工具非空时追加 `--tool`；新增 `createWorkset(name, members, tool?)`，按输入顺序构造重复 `--member`，可选追加 `--tool`，最后追加 `--json` 并调用 `runJson`。任何 Workset argv 都不得加入 `--store`，也不得通过 shell 拼接字符串。

**Verification:** `pnpm exec vitest run test/extension/services/dataManager.test.ts`；预期覆盖有/无工具的 create/open 精确 argv、普通 runner 与 JSON runner 分流、CLI reject 原样向上传播。

**Risks / edge cases:** Primary 只由成员数组首项表达；不要在服务层重排或去重；创建 payload 的信任边界由 Task 4.2 先校验；普通打开输出不能经过 JSON 解析。

- [ ] **Step 1（5 分钟）:** 在现有 DataManager 测试中加入四个精确 argv 断言，并加入 `runCommand` reject 不被吞掉的用例。
- [ ] **Step 2（2 分钟）:** 运行 `pnpm exec vitest run test/extension/services/dataManager.test.ts`，确认新用例因缺少 create/override 行为而 FAIL。
- [ ] **Step 3（5 分钟）:** 最小修改 `openWorkset` 并新增 `createWorkset`，直接构造字符串数组调用现有 CLI service。
- [ ] **Step 4（3 分钟）:** 重跑聚焦测试，确认 PASS，且断言所有 Workset argv 均不含 `--store`。
- [ ] **Step 5（3 分钟）:** 运行 `pnpm run compile`，确认 Extension Host 构建通过。
