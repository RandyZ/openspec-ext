# Task 2. 可信 Planning Store 绑定

<!-- covers: Task 2.1, Task 2.2 -->

### Task 2.1: 校验 Workset Store 成员并按显式 Store 加载 Project 数据

**Spec coverage:** `openspec-scope-management` / Workset Project and Planning Store boundaries / Current Project membership is derived from CLI、Registered Store member is encountered、User explicitly selects a Workset Planning Store、Workset Planning Store request is stale or forged、Workset metadata is unavailable；`workset-project-navigation` / Project-only Workset selection / Store action uses stale or forged membership。

**Dependencies / order:** 可与 Task 1.2 之后开始；必须先完成 Gateway 的 fresh-inventory 校验和显式 binding 读取，Provider 才能安全接入选择动作。

**Files:**
- Modify: `src/extension/services/projectDataGateway.ts`
- Modify: `src/extension/services/types.ts`
- Modify: `test/extension/services/projectDataGateway.test.ts`

**Implementation notes:** 在 `ProjectDataGateway` 复用现有 Workset/Store 列表、realpath 与成员角色分类，新增 `resolveWorksetStore(project, worksetName, memberPath)` 返回 fresh-validated `storeId`；将 `loadProjectSidebarData(project, explicitStoreId?)` 传入既有 binding readers。校验失败抛 `ProjectDataAccessError`，不猜路径、不接受 Webview 提供的 store id，也不回退到 legacy selected scope。

**Verification:** `pnpm exec vitest run test/extension/services/projectDataGateway.test.ts`；预期有效 Store 成员返回官方 id 并以该 id 解析全部 Sidebar readers，伪造、过期、Project 角色、不可 realpath 和列表失败均拒绝。

**Risks / edge cases:** 同一路径的符号链接必须在 canonicalize 后比较；Workset 名称与成员路径都来自不可信 Webview；元数据探测失败必须 fail-closed，不能污染已接受 binding。

- [ ] **Step 1（5 分钟）:** 添加有效 Store、伪造路径、过期成员、非 Store 成员和 inventory failure 的 Gateway 失败测试。
- [ ] **Step 2（2 分钟）:** 运行 `pnpm exec vitest run test/extension/services/projectDataGateway.test.ts`，确认缺少 Store 解析接口或显式 selector 透传而 FAIL。
- [ ] **Step 3（5 分钟）:** 用现有 canonical path 与官方 inventory helper 实现 `resolveWorksetStore`，只返回已注册 Store id。
- [ ] **Step 4（5 分钟）:** 扩展 `loadProjectSidebarData(project, explicitStoreId?)`，让 changes、specs、引用 Store specs 与 Workset navigation 共享同一已验证 binding。
- [ ] **Step 5（3 分钟）:** 重跑聚焦测试，确认 PASS 且所有拒绝路径没有 selector-free 或 legacy scope fallback。

---

### Task 2.2: 原子切换 Workset Store、Project 默认根与 Project 成员

**Spec coverage:** `openspec-scope-management` / Workset Project and Planning Store boundaries / User explicitly selects a Workset Planning Store、Current Planning Store is displayed、User returns to the Project-resolved Planning root、Project binding is refreshed after navigation、Workset metadata is unavailable；`workset-project-navigation` / Project-only Workset selection / Current Planning Store is a Workset member、Store action uses stale or forged membership。

**Dependencies / order:** 依赖 Task 1.1 的消息类型和 Task 2.1 的 Gateway 接口；完成后 UI 才可显示真实的 `Current root` 与 `Use project default` 状态。

**Files:**
- Modify: `src/extension/providers/dashboardViewProvider.ts`
- Modify: `test/extension/providers/dashboardViewProvider.test.ts`

**Implementation notes:** Provider 增加仅驻留当前进程的 `explicitProjectStoreId`；处理 `selectWorksetStore` 时先 fresh-validate Store，再为同一 Project resolve/load，只有 generation、Project id、command cwd、canonical root 与 store id 全匹配才一次性替换 selector、binding、watcher 和 snapshot。`selectProjectDefaultRoot` 先成功解析 selector-free binding 再清空 selector；现有 `selectWorksetProject` 在 selector 活跃时继续携带它。失败保持旧状态与可见数据。

**Verification:** `pnpm exec vitest run test/extension/providers/dashboardViewProvider.test.ts`；预期覆盖成功 Store 切换、默认根恢复、携 selector 的 Project 切换、过期响应丢弃和失败后旧 snapshot 原样保留。

**Risks / edge cases:** 不得在 await 前乐观赋值 selector；连续点击可能乱序，必须沿用 `projectRequestGeneration`；Project 切换与 Planning root 切换不能复用 legacy `selectScope`。

- [ ] **Step 1（5 分钟）:** 添加 Provider 测试，先断言 selector 只在完整验证后生效，失败和 stale generation 均不发布新 `setContext`。
- [ ] **Step 2（2 分钟）:** 运行 `pnpm exec vitest run test/extension/providers/dashboardViewProvider.test.ts`，确认新消息尚未处理而 FAIL。
- [ ] **Step 3（5 分钟）:** 让 reload 路径接收当前 `explicitProjectStoreId`，复用现有 snapshot 发布与 generation 防护。
- [ ] **Step 4（5 分钟）:** 增加 Store 选择和 Project 默认根恢复处理，并让 Project 成员切换保留已接受 selector。
- [ ] **Step 5（3 分钟）:** 重跑聚焦测试，确认成功路径一次发布、所有失败路径零状态变更。

