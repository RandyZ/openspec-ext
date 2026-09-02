# Task 3. Worksets 列表与详情

<!-- covers: Task 3.1, Task 3.2 -->

### Task 3.1: 实现列表、详情与刷新后的本地状态协调

**Spec coverage:** `workset-project-navigation` / Workset list and detail navigation / Render containing Worksets as a list、Open Workset detail、Return from detail、Selected Workset disappears after refresh；`workset-creation` / Workset creation result and refresh / Workset capability is unavailable。

**Dependencies / order:** 依赖 Task 1.1 的消息契约；只消费 `ProjectSidebarData.worksetNavigation`，不依赖创建与 Store mutation 已完成。

**Files:**
- Modify: `src/webview/components/WorksetProjectPicker.tsx`
- Modify: `src/webview/components/Dashboard.tsx`
- Modify: `test/webview/components/worksetProjectPicker.test.tsx`
- Modify: `test/webview/components/dashboard.test.tsx`

**Implementation notes:** 在现有 `WorksetProjectPicker` 内保留最小 `list | detail(name) | create(draft)` 状态，不引入 router 或全局 store。列表仅渲染当前 Project 的 trusted navigation；row body 进入详情，Back 回列表；Project identity 变化重置列表，普通 snapshot refresh 仅在 Workset 仍存在时保留详情，否则回列表并显示可恢复提示。能力不可用时沿用现有升级说明并隐藏或禁用 Create。

**Verification:** `pnpm exec vitest run test/webview/components/worksetProjectPicker.test.tsx test/webview/components/dashboard.test.tsx`；预期列表初始折叠成员、详情不触发外部打开、Back 保持 Project/binding、删除后的 stale detail 回列表。

**Risks / edge cases:** Workset 同名只以官方 name 标识；binding-only refresh 不应误清 detail；Project 变化不得保留旧 Workset action；不要从 legacy `DashboardData.worksets` 重建角色。

- [ ] **Step 1（5 分钟）:** 添加列表初态、row drill-down、Back、同 Project refresh、Project 变化和 Workset 消失的组件测试。
- [ ] **Step 2（2 分钟）:** 运行聚焦 Vitest，确认当前全展开实现使新断言 FAIL。
- [ ] **Step 3（5 分钟）:** 在现有组件中加入局部状态和 selected-name 协调逻辑，先保持渲染结构最小。
- [ ] **Step 4（5 分钟）:** 将 Dashboard 的 Worksets tab 保持为同一组件入口，并传入 capability/binding 所需数据。
- [ ] **Step 5（3 分钟）:** 重跑聚焦测试，确认 PASS 且未增加 router、状态库或持久化字段。

---

### Task 3.2: 接通独立的打开、Project 切换与 Planning root 操作

**Spec coverage:** `workset-project-navigation` / Workset list and detail navigation / Narrow Sidebar keyboard navigation；Project-only Workset selection / Workset contains Project and Store members、Current Planning Store is a Workset member、Workset contains a same-repository Git worktree、Workset has no selectable Project members；`workset-cli-open` / Official Workset open action / Project picker selects a member；Unambiguous Workset action labels / Workset list row、Workset management card、Workset detail actions、Project-first member row、Planning Store member row。

**Dependencies / order:** 依赖 Task 1.1、1.2、2.2 和 Task 3.1；使用已经验证的角色与 binding，不在 React 中重新分类路径。

**Files:**
- Modify: `src/webview/components/WorksetProjectPicker.tsx`
- Modify: `src/webview/components/Dashboard.tsx`
- Modify: `src/extension/providers/webviewMessageHandler.ts`
- Modify: `test/webview/components/worksetProjectPicker.test.tsx`
- Modify: `test/extension/providers/webviewMessageHandler.test.ts`

**Implementation notes:** 列表 row 与内联 `Open` 分离并阻止事件冒泡；详情提供 `Open all`、可编辑的 one-time opener、Project switch、validated Planning root 和 `Use project default`。Project、Store、invalid 与 current 状态只消费 Host 返回字段。共享 handler 将可选工具传给 `DataManager.openWorkset`，错误继续走现有 recoverable `error` 消息。

**Verification:** `pnpm exec vitest run test/webview/components/worksetProjectPicker.test.tsx test/extension/providers/webviewMessageHandler.test.ts`；预期每个动作产生唯一消息，键盘激活与点击等价，Store 不会发送 Project 选择，普通 CLI 错误可恢复显示。

**Risks / edge cases:** 嵌套交互元素会造成双触发，必须用独立 button 和 propagation 防护；current 项是状态文本而非 disabled action；custom opener id 允许输入但不在 UI 假装已验证。

- [ ] **Step 1（5 分钟）:** 添加 row/Open 分流、键盘激活、角色动作、current 状态、无其他 Project 和 one-time tool 的失败测试。
- [ ] **Step 2（2 分钟）:** 运行聚焦 Vitest，确认消息路由与详情动作缺失而 FAIL。
- [ ] **Step 3（5 分钟）:** 在详情中复用 trusted member 字段渲染 Project、Store、git metadata 与无可选 Project 状态。
- [ ] **Step 4（5 分钟）:** 接通 Dashboard callbacks 和 shared Host handler，使每个动作只发送或执行一个明确命令。
- [ ] **Step 5（3 分钟）:** 重跑聚焦测试，确认 PASS，尤其不存在 Store→Project、detail→open 或 open→detail 的串扰。
