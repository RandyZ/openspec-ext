# Task 1. 配置与消息契约

<!-- covers: Task 1.1, Task 1.2 -->

### Task 1.1: 声明关键字颜色设置并实现带默认值的安全归一化

**Spec coverage:** `artifact-viewing` / `Configurable Spec keyword highlighting` / `Apply default semantic colors`, `Add and override configured keywords`, `Ignore invalid keyword configuration safely`

**Dependencies / order:** 首个实现任务；完成后 Task 1.2 和 Task 3 才能依赖同一个生效颜色契约。

**Files:**
- Create: `src/extension/services/specKeywordColors.ts`
- Modify: `package.json`
- Test: `test/extension/services/specKeywordColors.test.ts`, `test/extension/packageConfiguration.test.ts`

**Implementation notes:**
- 声明 `openspec.specKeywordColors` 为 object setting，value schema 仅接受 string；描述中写明 key、`#RRGGBB`、`vscode:<theme-color-id>`、64 项和 32 字符边界。
- 导出 `getSpecKeywordColors(): Record<string, string>`；从 `vscode.workspace.getConfiguration('openspec')` 读取配置并合并内置映射：`GIVEN/WHEN` 使用 `textLink.foreground`，`THEN` 使用 `testing.iconPassed`，`AND` 使用 `descriptionForeground`，`MUST/SHALL/SHOULD` 使用 `testing.iconFailed`。
- 只把合法 hex 或 theme id 转为 hex/`var(--vscode-...)`；非法覆盖不得删除内置默认值。不要新增依赖或通用配置框架。

**Verification:**
- Focused: `rtk pnpm test -- test/extension/services/specKeywordColors.test.ts test/extension/packageConfiguration.test.ts`
- Expected: 两个文件全部通过；默认、添加、覆盖、错误类型、非法颜色、超长 key 和第 65 项均有确定断言。

**Risks / edge cases:**
- VS Code theme id 中的 `.` 只转换为 CSS 变量分隔符，其他字符必须先通过白名单校验。
- 遍历配置时先应用 64 项上限，避免超限输入扩大后续 matcher；合法项顺序不能改变内置回退语义。

- [ ] **Step 1 (RED, 2–5 min):** 新增配置解析测试和 package schema 断言，运行 focused 命令并确认因 setting/helper 缺失而失败。
- [ ] **Step 2 (GREEN, 2–5 min):** 在 `package.json` 增加最小 setting 声明并实现默认颜色常量与合法值转换。
- [ ] **Step 3 (GREEN, 2–5 min):** 加入 key/value/数量边界和“非法内置覆盖保留默认值”逻辑，不处理多词或正则。
- [ ] **Step 4 (VERIFY, 2–5 min):** 重跑 focused 命令并确认全部 PASS，且测试没有依赖真实 VS Code Host。

---

### Task 1.2: 在主 Spec 与 delta spec 内容消息中传递生效颜色映射

**Spec coverage:** `artifact-viewing` / `Configurable Spec keyword highlighting` / `Add and override configured keywords`, `Ignore invalid keyword configuration safely`, `Apply configuration on the next content load`

**Dependencies / order:** 依赖 Task 1.1；必须在 Task 4 接入 Webview 状态前完成 typed payload。

**Files:**
- Create: None
- Modify: `src/webview/types/messages.ts`, `src/extension/providers/webviewMessageHandler.ts`
- Test: `test/extension/providers/webviewMessageHandler.test.ts`, `test/extension/providers/dashboardViewProvider.test.ts`

**Implementation notes:**
- 给 `specContent` 和 `deltaSpecContent` 响应增加必填 `keywordColors`，包括 stale cache 和 fresh 两条响应；内容缓存格式保持 string，不缓存配置。
- 每次处理内容请求时调用一次 `getSpecKeywordColors()`，让同一请求的 cached/fresh 消息使用相同快照；下一次请求重新读取设置。
- 保持 scope 解析、路径 containment、错误消息和普通 `artifactContent` 完全不变。

**Verification:**
- Focused: `rtk pnpm test -- test/extension/providers/webviewMessageHandler.test.ts test/extension/providers/dashboardViewProvider.test.ts`
- Expected: 主/delta 的 cached 与 fresh 响应都包含同一安全映射；既有 store-scoped 内容断言继续通过。

**Risks / edge cases:**
- 现有精确对象断言会因新增必填字段失败，必须更新预期而不能放宽成无意义的断言。
- 不得因配置异常跳过内容响应；helper 必须总能返回默认映射。

- [ ] **Step 1 (RED, 2–5 min):** 为主/delta cached 与 fresh 消息增加 `keywordColors` 断言，运行 focused 命令并确认字段缺失失败。
- [ ] **Step 2 (GREEN, 2–5 min):** 扩展共享消息 union，并在两个 handler 分支复用一次配置快照。
- [ ] **Step 3 (GREEN, 2–5 min):** 更新受影响的精确消息断言，保留 scope、cache metadata 和错误分支检查。
- [ ] **Step 4 (VERIFY, 2–5 min):** 重跑 focused 命令并确认全部 PASS，且普通 artifact 消息没有新增字段。

