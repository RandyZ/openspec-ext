# Task 4. 兼容性与验收

<!-- covers: Task 4.1, Task 4.2 -->

### Task 4.1: 验证旧 Dashboard 消息路径与新旧读取语义边界保持兼容

**Spec coverage:** `project-data-access` / `Gateway Introduction Is Additive And Read-Only` / `Existing Dashboard remains on the legacy path`, `Gateway parity is evaluated`; `Canonical Specs Remain Distinct From Delta And Referenced Specs`

**Dependencies / order:** 依赖 Task 1–3；这是兼容性验收，不接线新 UI、不修改旧 scope consumers。

**Files:**
- Create: 无
- Modify: 仅在缺少语义断言时修改 `test/extension/services/projectDataGateway.test.ts`
- Test: `test/extension/services/projectDataGateway.test.ts`, `test/extension/services/dataManager.test.ts`, `test/webview/components/dashboard.test.tsx`

**Implementation notes:**
- 增加/确认 parity case：Changes 的重叠字段沿用现有 CLI 语义；canonical Specs 与 legacy `StateReader.listSpecs()` 的 delta 混合差异必须被明确断言，而不是抹平。
- 不实例化 Gateway 到 `DataManager`、Provider 或 Webview handler，不新增 message type，不改变 `getDashboardData`/`dashboardData`。
- 检查本 Change 的 source diff 不包含 `dataManager.ts`、Dashboard provider/handler、Webview message types 或 workflow mutation path。
- 本任务是回归/验收测试，不新增生产行为；已有实现满足时测试可以首次运行即通过。

**Verification:** Gateway tests、DataManager tests、Dashboard component tests 全部通过；受保护的 legacy/message 文件没有本 Change 产生的 diff。

**Risks / edge cases:** 工作区若已有用户的无关 diff，只判断本 Change 是否触碰这些文件，不重置、覆盖或删除用户改动。

- [ ] **Step 1（2–5 分钟）: 补齐验收断言**

在 Gateway test 中断言 Changes overlap 与 canonical/delta intentional difference；不复制 legacy fallback 到 Gateway。

- [ ] **Step 2（2–5 分钟）: 运行新旧路径测试**

Run: `rtk pnpm exec vitest run test/extension/services/projectDataGateway.test.ts test/extension/services/dataManager.test.ts test/webview/components/dashboard.test.tsx`

Expected: PASS；旧 Dashboard 与新 Gateway 可并行存在。

- [ ] **Step 3（2–5 分钟）: 检查消息与旧门面无变更**

Run: `rtk git diff -- src/extension/services/dataManager.ts src/extension/providers/dashboardViewProvider.ts src/extension/providers/webviewMessageHandler.ts src/webview/types/messages.ts`

Expected: 本 Change 对这些文件无 diff；若已有无关用户改动，记录并保持原样。

- [ ] **Step 4（2–5 分钟）: 检查只读边界**

Run: `rtk rg -n "createChange|archiveChange|selectScope|OpenSpecCacheService" src/extension/services/projectDataGateway.ts`

Expected: 无匹配；Gateway 未执行 mutation、修改 selected scope 或接入 cache。

---

### Task 4.2: 完成聚焦测试、全量测试、构建、lint 与严格 OpenSpec 校验

**Spec coverage:** `project-data-access` 全部 Requirements 与 Scenarios；作为 Change 完成前的总体验收门禁。

**Dependencies / order:** 最后执行；任一命令暴露本 Change 的失败都返回对应 Task 修复，不通过勾选任务掩盖。

**Files:**
- Create: 无
- Modify: 仅修改验证定位出的本 Change source/test 缺陷
- Test: `test/extension/services/openspecCli.test.ts`, `test/extension/services/projectDataGateway.test.ts`, `test/extension/services/dataManager.test.ts`, `test/webview/components/dashboard.test.tsx`

**Implementation notes:**
- 先跑 focused tests，再跑全量 tests 与 build，避免长命令掩盖具体回归。
- targeted lint 必须通过；全量 `src/` lint 若仅出现 AGENTS.md 已记录的 pre-existing globals/config 问题，要保存精确分类并确认新增/改动行没有新错误。
- 最后运行 task-details validator、strict OpenSpec validation 和 `git diff --check`。
- 不启动 VS Code Extension Host 或浏览器：本 Change 没有 UI/message wiring；现有 unit/build regression 是与风险相称的验证。

**Verification:** focused/full tests 与 build exit 0；targeted lint exit 0；task-details validator 无 error；OpenSpec `valid: true`；diff check 无输出。

**Risks / edge cases:** 不把已知 lint baseline 描述成新回归，也不因 baseline 存在跳过 targeted lint。任何真实 test/build/strict failure 都是阻塞项。

- [ ] **Step 1（2–5 分钟）: 运行 focused tests**

Run: `rtk pnpm exec vitest run test/extension/services/openspecCli.test.ts test/extension/services/projectDataGateway.test.ts test/extension/services/dataManager.test.ts test/webview/components/dashboard.test.tsx`

Expected: PASS，0 failed。

- [ ] **Step 2（2–5 分钟）: 运行全量 tests 与 build**

Run: `rtk pnpm test`

Expected: PASS，0 failed。

Run: `rtk pnpm run build`

Expected: extension esbuild 与 webview Vite build 均成功。

- [ ] **Step 3（2–5 分钟）: 运行 targeted 与全量 lint**

Run: `rtk npx eslint src/extension/services/projectDataGateway.ts src/extension/services/types.ts src/extension/services/openspecCli.ts`

Expected: 新增/修改代码无 lint error；若 `openspecCli.ts` 命中既有环境 globals 问题，需确认错误不在新增行。

Run: `rtk npx eslint src/`

Expected: exit 0，或仅保留 AGENTS.md 已说明且与本 Change 无关的 pre-existing globals/config 分类；任何新增错误阻塞完成。

- [ ] **Step 4（2–5 分钟）: 校验 task-details 与 OpenSpec**

Run: `rtk node /Users/randy/.codex/plugins/cache/aihelp-dev/aihelp-agent-plugin/0.1.7/skills/aihelp-writing-task/scripts/validate-task-details.mjs --change-dir /Users/randy/workspace/projects/github/openspec-ext/openspec/changes/add-project-data-gateway --json`

Expected: validator 无 `error` severity finding，11 个 checklist ids 与 11 个 detail headings 双向一对一。

Run: `rtk openspec validate add-project-data-gateway --type change --strict --json`

Expected: `valid: true` 且 `issues: []`。

- [ ] **Step 5（2–5 分钟）: 检查 diff 完整性**

Run: `rtk git diff --check`

Expected: 无输出；检查最终 diff 仅包含本 Change 授权的 planning、source 与 tests。
