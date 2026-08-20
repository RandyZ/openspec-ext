# Task 2. Root Binding 安全边界

<!-- covers: Task 2.1, Task 2.2, Task 2.3 -->

### Task 2.1: 实现 selector-free 的本地及外部 Root Binding 解析

**Spec coverage:** `project-data-access` / `Project Context Is Separate From OpenSpec Root Binding` / `Project and planning root are different paths`; `OpenSpec CLI Owns Root Resolution` / `Ordinary Project uses selector-free resolution`, `CLI resolves an external or global default root`

**Dependencies / order:** 依赖 Task 1.1 的 `getContext()` 与 Task 1.2 的模型；先完成成功路径，再由 Task 2.2 收紧失败边界。

**Files:**
- Create: 无
- Modify: `src/extension/services/projectDataGateway.ts`
- Test: `test/extension/services/projectDataGateway.test.ts`

**Implementation notes:**
- 实现 `resolveBinding(project, explicitStoreId?)`；使用 `createCli(project.projectPath)` 创建 probe CLI，并从 Project working directory 调 `getContext()`。
- 普通 Project 传 `undefined` scope；不枚举 Store/Workset、不读取 selected scope、不扫描 `projectPath/openspec`。
- 接受 CLI 返回的 Project 外部 root 与 `global_default`，使用 `fs.promises.realpath()` 保存 canonical `rootPath`；`commandCwd` 保持 canonical Project path，`rootSource` 原样保留。
- `global_default` 不生成 `storeId`；ProjectContext 继续指向代码工程，不能被外部 root 替换。

**Verification:** local、external、global-default 三个 fixture 都应保留同一 Project identity，并分别返回 CLI-owning root/source。

**Risks / edge cases:** 外部 root 是合法输入，不能以“不在 workspace 内”为由拒绝；source 未知值也必须保留。

- [ ] **Step 1（2–5 分钟）: 写失败测试**

为 local root、Project 外部 root、`global_default` 建立临时目录 fixtures，并断言 probe cwd、无 selector、Binding identity。

- [ ] **Step 2（2–5 分钟）: 运行测试并确认 RED**

Run: `rtk pnpm exec vitest run test/extension/services/projectDataGateway.test.ts -t "resolveBinding"`

Expected: FAIL，原因是 `resolveBinding()` 尚不存在。

- [ ] **Step 3（2–5 分钟）: 写最小实现**

实现成功路径和 canonical root 保存；不要在本任务加入 cache、registry 或 reader lifecycle。

- [ ] **Step 4（2–5 分钟）: 运行测试并确认 GREEN**

Run: `rtk pnpm exec vitest run test/extension/services/projectDataGateway.test.ts -t "resolveBinding"`

Expected: PASS；所有普通请求参数均不含 `--store`。

---

### Task 2.2: 对无效或逃逸的 Root Binding 执行 fail-closed 校验

**Spec coverage:** `project-data-access` / `OpenSpec CLI Owns Root Resolution` / `Root resolution cannot be established`; `CLI And Content Access Share One Binding` / `Binding path fails containment validation`; `Gateway Returns Purpose-Specific Project Data` / `One Project read fails`

**Dependencies / order:** 依赖 Task 2.1 的成功解析；Task 3 的 readers 必须只接受本任务验证后的 Binding。

**Files:**
- Create: 无
- Modify: `src/extension/services/projectDataGateway.ts`, `src/extension/services/types.ts`
- Test: `test/extension/services/projectDataGateway.test.ts`

**Implementation notes:**
- 添加单一 `ProjectDataAccessError`，保存 `projectId`、`phase`、可用时的 `binding` 和原始 cause；不创建错误类层级。
- root/source 必须为非空字符串，root 必须为 absolute path 且可以 `realpath`；任何不满足直接在 `resolve` phase 失败。
- 在创建 ContentAccess 前 canonicalize `root/openspec`，使用 `path.relative(canonicalRoot, canonicalContentRoot)` 拒绝 `..` 或 absolute escape；symlink 把内容目录带出 root 时 fail closed。
- 失败前不得调用 content factory、不得读取文件、不得构造部分 Binding，也不得回退到 Project 本地目录或空成功结果。

**Verification:** malformed/missing fields、relative root、missing root、unresolvable root、symlink escape 都抛出带正确 `projectId/phase` 的错误，content factory 调用次数为 0。

**Risks / edge cases:** Windows volume/case 由 canonical path 与 `path.relative` 处理；不能用字符串前缀判断 containment。外部 root 本身不是 escape。

- [ ] **Step 1（2–5 分钟）: 写失败测试**

增加五类无效 context/root fixture 与一个 `openspec` symlink escape fixture，并 spy content factory 零调用。

- [ ] **Step 2（2–5 分钟）: 运行测试并确认 RED**

Run: `rtk pnpm exec vitest run test/extension/services/projectDataGateway.test.ts -t "fail closed"`

Expected: FAIL，当前成功路径会接受至少一种无效输入或错误缺少 Project identity。

- [ ] **Step 3（2–5 分钟）: 写最小实现**

加入字段验证、canonicalization、containment helper 和单一错误类型；不要修改 `FileManagerService` 的全局语义。

- [ ] **Step 4（2–5 分钟）: 运行测试并确认 GREEN**

Run: `rtk pnpm exec vitest run test/extension/services/projectDataGateway.test.ts -t "fail closed"`

Expected: PASS；无效 Binding 产生零 file reader construction/read。

- [ ] **Step 5（2–5 分钟）: 回归有效外部 root**

Run: `rtk pnpm exec vitest run test/extension/services/projectDataGateway.test.ts -t "external|global_default|fail closed"`

Expected: PASS；合法外部 root 未被 containment 误拒绝。

---

### Task 2.3: 隔离显式 Store 与并发 Project 请求上下文

**Spec coverage:** `project-data-access` / `OpenSpec CLI Owns Root Resolution` / `Explicit Store selector remains explicit`; `Project Reads Use Explicit Immutable Context` / `Sidebar selection changes during a bound read`, `Two Projects load concurrently`

**Dependencies / order:** 依赖 Task 2.1–2.2；Task 3 的所有数据方法沿用这里的请求级 selector 隔离。

**Files:**
- Create: 无
- Modify: `src/extension/services/projectDataGateway.ts`
- Test: `test/extension/services/projectDataGateway.test.ts`

**Implementation notes:**
- 只有 `explicitStoreId` 非空时创建请求局部 `{ storeId }`，并让 context probe 与后续 bound CLI 使用同一个值。
- Gateway 不保存 current Store、current Project 或 selected scope；每次调用创建新的 CLI/readers 普通对象。
- 用受控 Promise 交错 Project A/Store A 与 Project B/selector-free 的 probe，证明完成顺序不会交换 Binding、selector 或 error identity。
- 模拟外部 selected-scope 变量在读取期间变化，结果仍只由传入 ProjectContext 决定。

**Verification:** 并发调用记录中，Store A 的每个相关 CLI call 只含 `store-a`，Project B 从未出现 Store selector；两个结果保持各自 Project/root。

**Risks / edge cases:** 不使用共享 mutable mock 记录“最后一次 selector”作为实现状态；测试记录应按 CLI instance/request id 分组，避免测试自身制造串扰。

- [ ] **Step 1（2–5 分钟）: 写失败测试**

添加 explicit Store、selector-free sibling、交错并发与 selected-scope 变化测试。

- [ ] **Step 2（2–5 分钟）: 运行测试并确认 RED**

Run: `rtk pnpm exec vitest run test/extension/services/projectDataGateway.test.ts -t "Store|concurrent|selected scope"`

Expected: FAIL，直到 Gateway 的 selector 和 readers 完全请求局部化。

- [ ] **Step 3（2–5 分钟）: 写最小实现**

删除或避免任何 Gateway 级 current selector 字段，只通过方法参数和局部 const 传递 selector。

- [ ] **Step 4（2–5 分钟）: 运行测试并确认 GREEN**

Run: `rtk pnpm exec vitest run test/extension/services/projectDataGateway.test.ts -t "Store|concurrent|selected scope"`

Expected: PASS；两条命令链无 selector、root、error 交叉。
