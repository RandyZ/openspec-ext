# Task 5. 回归与真实界面验收

<!-- covers: Task 5.1, Task 5.2 -->

### Task 5.1: 通过 focused tests、完整单测、构建与源代码 lint

**Spec coverage:** `artifact-viewing` / `Artifact Content Rendering` 和 `Configurable Spec keyword highlighting` 的全部场景回归。

**Dependencies / order:** 依赖 Tasks 1–4 全部完成；任何失败先回到拥有该逻辑的任务做最小修复，再从 focused gate 重跑。

**Files:**
- Create: None
- Modify: None；若 gate 暴露缺陷，只修改 Tasks 1–4 已列出的所属源文件或测试文件
- Test: `test/extension/services/specKeywordColors.test.ts`, `test/extension/packageConfiguration.test.ts`, `test/extension/providers/webviewMessageHandler.test.ts`, `test/webview/components/specDocumentRenderer.test.tsx`, `test/webview/components/markdownRenderer.test.tsx`, `test/webview/components/specViewer.test.tsx`, `test/webview/components/artifactViewer.test.tsx`

**Implementation notes:**
- 本任务不新增功能；RED/GREEN 已由 Tasks 1–4 完成，只收集当前 checkout 的新鲜门禁证据。
- ESLint 仅运行 `src/`；若只出现 AGENTS.md 已记录的 pre-existing global `no-undef`，必须明确区分，但本次改动引入的 lint 错误仍须修复。

**Verification:**
- Focused: `rtk pnpm test -- test/extension/services/specKeywordColors.test.ts test/extension/packageConfiguration.test.ts test/extension/providers/webviewMessageHandler.test.ts test/webview/components/specDocumentRenderer.test.tsx test/webview/components/markdownRenderer.test.tsx test/webview/components/specViewer.test.tsx test/webview/components/artifactViewer.test.tsx`
- Full: `rtk pnpm test`
- Build: `rtk pnpm run build`
- Lint: `rtk pnpm exec eslint src/`
- Expected: focused/full/build exit 0；lint 对本 change 的源文件无新增 error。

**Risks / edge cases:**
- 不能复用任务过程中的旧输出；每条 gate 都需在最终 diff 上重跑。
- build 成功不替代交互验收；lint 的既有配置噪音也不能掩盖新增问题。

- [ ] **Step 1 (VERIFY, 2–5 min):** 在最终 diff 上运行 focused gate，确认全部 PASS。
- [ ] **Step 2 (VERIFY, 2–5 min):** 运行完整 `rtk pnpm test`，确认无跨模块回归。
- [ ] **Step 3 (VERIFY, 2–5 min):** 运行 `rtk pnpm run build`，确认 extension 与 webview 均成功产出。
- [ ] **Step 4 (VERIFY, 2–5 min):** 运行 `rtk pnpm exec eslint src/`，修复本 change 新增错误并记录任何可复现的既有噪音。

---

### Task 5.2: 在 Extension Development Host 中完成主 Spec 与 delta spec 视觉交互验收

**Spec coverage:** `artifact-viewing` / `Artifact Content Rendering` / `Render structured main spec`, `Render structured delta spec`, `Restore disclosure defaults`, `Fall back for a non-canonical spec`; `Configurable Spec keyword highlighting` 的全部场景。

**Dependencies / order:** 最终任务；依赖 Task 5.1 的测试、构建和 lint 门禁完成。

**Files:**
- Create: None
- Modify: None；真实验收发现缺陷时回到对应 Tasks 1–4 的源文件并重跑 Task 5.1
- Test: 主 Spec `openspec/specs/artifact-viewing/spec.md`、delta spec `openspec/changes/add-configurable-structured-spec-viewer/specs/artifact-viewing/spec.md`

**Implementation notes:**
- 使用用户提供的深色高保真参考作为层级基线：规范正文立即可见，Scenario 明细默认隐藏；实际颜色和 focus 必须跟随 VS Code theme。
- 自定义验收值使用 `WHEN: #C586C0`、`MAY: vscode:editorWarning.foreground`；验证修改设置后当前视图不热更新，刷新/重开后生效。
- 验收必须同时覆盖主 Spec、delta spec、键盘操作、内联代码/链接不着色，以及切回 proposal/design/tasks 无视觉回归。

**Verification:**
- Launch: `rtk code --extensionDevelopmentPath=/Users/randy/workspace/projects/github/openspec-ext /Users/randy/workspace/projects/github/openspec-ext`
- Expected: Extension Development Host 中两类 Spec 满足默认折叠与颜色契约，控制台无新增 React/Mermaid/error 日志，普通 artifacts 保持原渲染。

**Risks / edge cases:**
- 仅看静态截图不足以证明键盘、刷新和 theme token；必须实际操作 summary 与 Settings。
- 若启动命令复用已有 VS Code 窗口，应明确进入 Extension Development Host，避免误测已安装版本。

- [ ] **Step 1 (VERIFY, 2–5 min):** 启动 Extension Development Host，打开 `artifact-viewing` 主 Spec，核对 Requirement open、Scenario closed 与正文层级。
- [ ] **Step 2 (VERIFY, 2–5 min):** 用 Tab 聚焦 summary 并用 Enter/Space 展开、收起，刷新后确认默认态恢复。
- [ ] **Step 3 (VERIFY, 2–5 min):** 打开本 change 的 delta spec，核对与主 Spec 相同结构及 delta operation heading 保留。
- [ ] **Step 4 (VERIFY, 2–5 min):** 设置自定义 WHEN/MAY 颜色，验证当前视图不热更新而刷新/重开生效，非法项不破坏默认色。
- [ ] **Step 5 (VERIFY, 2–5 min):** 检查完整单词、加粗、inline code、link、Mermaid/代码块和普通 artifact 回归，并确认 Webview 控制台无新增错误。
