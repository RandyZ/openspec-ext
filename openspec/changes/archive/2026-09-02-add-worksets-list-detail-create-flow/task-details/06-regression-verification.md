# Task 6. 回归验证

<!-- covers: Task 6.1 -->

### Task 6.1: 通过聚焦测试、全量测试、构建与源码 lint 门禁

**Spec coverage:** `workset-creation`、`workset-project-navigation`、`workset-cli-open` 与 `openspec-scope-management` 的全部 requirements/scenarios；本任务验证前五组产生的实现证据，不替代各任务内的 RED/GREEN 步骤。

**Dependencies / order:** 最后执行；Task 1–5 全部通过各自聚焦测试与真实 Extension Host 验收后才开始。

**Files:**
- Modify: `test/extension/services/dataManager.test.ts`
- Modify: `test/extension/services/projectDataGateway.test.ts`
- Modify: `test/extension/providers/dashboardViewProvider.test.ts`
- Modify: `test/extension/providers/webviewMessageHandler.test.ts`
- Modify: `test/webview/components/worksetProjectPicker.test.tsx`
- Modify: `test/webview/components/dashboard.test.tsx`
- Modify: `test/webview/types/messages.test.ts`

**Implementation notes:** 先运行覆盖本 change 的聚焦套件，再运行全量 Vitest、完整 build 与本 change 触及的 `src/` 文件 lint。任何失败先在所属现有测试文件增加最小回归断言，确认该断言稳定 FAIL 后只修根因并重跑；不顺手清理仓库既有无关 lint 问题，不增加依赖。

**Verification:** 聚焦 Vitest、`pnpm test`、`pnpm run build` 和触及文件的 `pnpm exec eslint` 均退出 0；`git diff --check` 无 whitespace error；`git status --short` 只包含本 change 与用户原有无关改动。

**Risks / edge cases:** 不复用旧或中断的测试结果；全量 lint 的既有全局声明问题仅作为诊断，不得用批量无关改动掩盖；不得提交、push、archive 或删除用户文件。

- [ ] **Step 1（5 分钟）:** 运行 `pnpm exec vitest run test/extension/services/dataManager.test.ts test/extension/services/projectDataGateway.test.ts test/extension/providers/dashboardViewProvider.test.ts test/extension/providers/webviewMessageHandler.test.ts test/webview/components/worksetProjectPicker.test.tsx test/webview/components/dashboard.test.tsx test/webview/types/messages.test.ts`，预期全部 PASS。
- [ ] **Step 2（5 分钟）:** 运行 `pnpm test`，预期全量 Vitest 退出 0；若失败，先添加或收紧所属最小回归断言并确认 RED，再修根因至 GREEN。
- [ ] **Step 3（5 分钟）:** 运行 `pnpm run build`，预期 Extension Host 与 Webview 构建均退出 0。
- [ ] **Step 4（5 分钟）:** 对本 change 触及的 `src/extension/services/dataManager.ts src/extension/services/projectDataGateway.ts src/extension/providers/dashboardViewProvider.ts src/extension/providers/webviewMessageHandler.ts src/webview/types/messages.ts src/webview/components/WorksetProjectPicker.tsx src/webview/components/Dashboard.tsx` 运行 `pnpm exec eslint`，预期退出 0。
- [ ] **Step 5（3 分钟）:** 运行 `git diff --check` 与 `git status --short`，确认无格式错误、无意外生成文件且未触碰用户原有 `articles/`。

