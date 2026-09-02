# Task 4. Workset 创建流程

<!-- covers: Task 4.1, Task 4.2 -->

### Task 4.1: 实现可恢复的创建草稿与原生文件夹选择

**Spec coverage:** `workset-creation` / Project-first Workset creation form / Open the creation form、Choose a different Primary member、Cancel creation；Trusted Workset member selection / Add multiple folders、Folder selection is cancelled、Duplicate or invalid member is returned。

**Dependencies / order:** 依赖 Task 1.1 与 Task 3.1；创建提交暂由 Task 4.2 接通，本任务先固定草稿、成员顺序和 picker 回传语义。

**Files:**
- Modify: `src/webview/components/WorksetProjectPicker.tsx`
- Modify: `src/extension/providers/dashboardViewProvider.ts`
- Modify: `test/webview/components/worksetProjectPicker.test.tsx`
- Modify: `test/extension/providers/dashboardViewProvider.test.ts`

**Implementation notes:** Create 是同一组件内单屏 form；current Project 默认加入且不可删除。`pickWorksetMembers` 只调用 `vscode.window.showOpenDialog({ canSelectFolders: true, canSelectMany: true })`，Host 返回绝对路径；Webview 仅在 create state 接受回传，按 canonical path 去重，并用成员数组首项表达 Primary。取消 picker 不发送错误、不改草稿；invalid path 返回可恢复说明。

**Verification:** `pnpm exec vitest run test/webview/components/worksetProjectPicker.test.tsx test/extension/providers/dashboardViewProvider.test.ts`；预期 current Project 锁定、Primary 重排、取消保持、晚到响应忽略、重复/非法成员不加入。

**Risks / edge cases:** folder picker 结果可能晚于离开表单；跨平台路径比较必须由 Host canonicalize 后返回；不要增加并行 Primary 字段或持久 draft。

- [ ] **Step 1（5 分钟）:** 添加草稿初始值、Primary 重排、取消、picker cancel、重复路径、非法路径和 late response 测试。
- [ ] **Step 2（2 分钟）:** 运行聚焦 Vitest，确认 Create state 与 picker message 尚不存在而 FAIL。
- [ ] **Step 3（5 分钟）:** 最小实现 Create form 状态、成员列表和首项 Primary 排序。
- [ ] **Step 4（5 分钟）:** 在 Provider 接入原生 folder picker、绝对路径 canonicalization 与可恢复错误回传。
- [ ] **Step 5（3 分钟）:** 重跑聚焦测试，确认 PASS 且取消/晚到响应零副作用。

---

### Task 4.2: 接通创建校验、结果刷新与成功后详情跳转

**Spec coverage:** `workset-creation` / Selector-free official Workset creation / Create a Workset without a preferred tool、Create a Workset with a preferred tool、Webview submits malformed creation input；Workset creation result and refresh / Workset creation succeeds、Workset creation fails、Workset capability is unavailable。

**Dependencies / order:** 依赖 Task 1.2 的 DataManager、Task 3.1 的详情协调和 Task 4.1 的草稿；成功路径必须在官方刷新后才改变 UI。

**Files:**
- Modify: `src/extension/providers/dashboardViewProvider.ts`
- Modify: `src/webview/components/Dashboard.tsx`
- Modify: `src/webview/components/WorksetProjectPicker.tsx`
- Modify: `test/extension/providers/dashboardViewProvider.test.ts`
- Modify: `test/webview/components/worksetProjectPicker.test.tsx`

**Implementation notes:** Provider 在调用 CLI 前验证 message 类型、trim 后 name、非空字符串 members、绝对 canonical paths 与可选 tool；随后调用 `createWorkset`，成功后走既有 Project Sidebar reload。只在 fresh navigation 包含新 name 后回传 success 并进入详情；CLI 或 refresh 失败回传 failure，保留 draft，不发布 optimistic Workset。Workset capability unavailable 时拒绝 Host 调用。

**Verification:** `pnpm exec vitest run test/extension/providers/dashboardViewProvider.test.ts test/webview/components/worksetProjectPicker.test.tsx`；预期 malformed 输入零 CLI 调用，成功等待 fresh snapshot，duplicate/invalid opener/refresh failure 均保留 draft 并显示消息。

**Risks / edge cases:** CLI 成功但新 snapshot 尚未包含当前 Project 时不得伪造详情；连续 submit 必须防止重复创建；错误文案不得清空用户输入或泄漏私有 registry 路径。

- [ ] **Step 1（5 分钟）:** 添加 malformed payload、能力不可用、CLI failure、refresh missing-name 与完整 success 的失败测试。
- [ ] **Step 2（2 分钟）:** 运行聚焦 Vitest，确认 Host 尚未处理 create result 而 FAIL。
- [ ] **Step 3（5 分钟）:** 实现 Host 输入守卫和单次提交锁，调用 Task 1.2 的 selector-free DataManager 方法。
- [ ] **Step 4（5 分钟）:** 在 fresh snapshot 后发送 result，并让 Webview 仅在 success 且 name 存在时从 draft 进入 detail。
- [ ] **Step 5（3 分钟）:** 重跑聚焦测试，确认 PASS，失败草稿完整且无 optimistic snapshot。

