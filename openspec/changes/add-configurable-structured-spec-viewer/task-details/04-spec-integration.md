# Task 4. 主 Spec 与 delta spec 集成

<!-- covers: Task 4.1, Task 4.2 -->

### Task 4.1: 将共享结构化 renderer 接入主 Spec 预览

**Spec coverage:** `artifact-viewing` / `Artifact Content Rendering` / `Render specs`, `Render structured main spec`, `Fall back for a non-canonical spec`; `Configurable Spec keyword highlighting` / `Apply configuration on the next content load`

**Dependencies / order:** 依赖 Task 1.2、Task 2 和 Task 3；先完成主 Spec 再复用到 delta 路径。

**Files:**
- Create: `test/webview/components/specViewer.test.tsx`
- Modify: `src/webview/components/SpecViewer.tsx`
- Test: `test/webview/components/specViewer.test.tsx`, `test/webview/app.test.tsx`

**Implementation notes:**
- `SpecViewer` 把 `content` 与 `keywordColors` 作为同一 `specContent` 快照更新，并改用 `SpecDocumentRenderer`。
- 为 `initialContent` 保持现有兼容；测试可增加可选 `initialKeywordColors`，默认空映射，不虚构额外全局状态。
- `specContentError`、loading、标题和 scope 请求行为不在本任务改变。

**Verification:**
- Focused: `rtk pnpm test -- test/webview/components/specViewer.test.tsx test/webview/app.test.tsx`
- Expected: canonical initial content 输出 Requirement details；非 canonical 内容完整回退；消息类型仍路由到 Spec 页面。

**Risks / edge cases:**
- 新 specId 或新消息必须同时替换内容和颜色，不能短暂复用上一 Spec 的映射。
- cached/fresh 连续消息可重新渲染两次，但 disclosure 默认状态以最后 fresh 内容为准。

- [ ] **Step 1 (RED, 2–5 min):** 写 canonical、fallback 和颜色快照的 SpecViewer 测试，运行 focused 命令确认仍使用普通 Markdown 失败。
- [ ] **Step 2 (GREEN, 2–5 min):** 用最小 state 形状保存内容/颜色并替换成共享 renderer。
- [ ] **Step 3 (GREEN, 2–5 min):** 保留 loading 与 initialContent 行为，处理缺失颜色字段仅限测试/兼容入口的空映射。
- [ ] **Step 4 (VERIFY, 2–5 min):** 重跑 focused 命令并确认全部 PASS，检查主 Spec 的普通 Purpose 仍存在。

---

### Task 4.2: 将共享 renderer 接入 delta spec 并完成主题化与可访问样式

**Spec coverage:** `artifact-viewing` / `Artifact Content Rendering` / `Render proposal`, `Render structured delta spec`, `Restore disclosure defaults`, `Render design`, `Render tasks`

**Dependencies / order:** 依赖 Task 4.1；完成后进入完整回归与真实界面验收。

**Files:**
- Create: None
- Modify: `src/webview/components/ArtifactViewer.tsx`, `src/webview/components/ChangeDetail.tsx`, `src/webview/index.css`
- Test: `test/webview/components/artifactViewer.test.tsx`

**Implementation notes:**
- `ChangeDetail` 将 delta 内容和颜色表一起缓存/更新；`ArtifactViewer` 仅当所选 output 的 `kind === 'specs'` 时使用 `SpecDocumentRenderer`，普通 Markdown/任务路径保持原 renderer。
- 用 `--vscode-panel-border`、`--vscode-foreground`、`--vscode-descriptionForeground` 和现有 focus token 完成层级线、summary、间距、wrap 与 `:focus-visible`；不写截图中的固定色值。
- 原生 `<summary>` 提供 pointer、Enter/Space 与语义；不要添加只依赖颜色的展开状态提示。

**Verification:**
- Focused: `rtk pnpm test -- test/webview/components/artifactViewer.test.tsx test/webview/components/specDocumentRenderer.test.tsx`
- Expected: `kind=specs` 输出嵌套 details，`kind=markdown` 仍为普通 artifact HTML；Requirement 默认 open、Scenario 默认 closed。

**Risks / edge cases:**
- 多 output 切换时必须按 `selectedOutputPath` 判断当前 kind，不能因 artifact group 名称误判。
- 窄 sidebar 和编辑器宽面板都必须换行；summary focus ring 不能被 overflow 或自定义 marker 隐藏。

- [ ] **Step 1 (RED, 2–5 min):** 增加 specs/markdown output 分流和颜色 prop 测试，运行 focused 命令确认 specs 仍走普通 renderer。
- [ ] **Step 2 (GREEN, 2–5 min):** 在 ChangeDetail/ArtifactViewer 传递最小 spec 快照并按当前 output kind 分流。
- [ ] **Step 3 (GREEN, 2–5 min):** 加入主题化 disclosure CSS、窄宽度换行和 focus-visible 样式。
- [ ] **Step 4 (VERIFY, 2–5 min):** 重跑 focused 命令并确认全部 PASS；静态 HTML 中普通 proposal/design/tasks 路径保持不变。
