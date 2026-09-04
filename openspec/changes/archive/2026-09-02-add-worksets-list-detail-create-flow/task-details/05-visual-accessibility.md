# Task 5. 视觉、文案与可访问性

<!-- covers: Task 5.1, Task 5.2 -->

### Task 5.1: 补齐双语文案、键盘焦点与窄 Sidebar 主题样式

**Spec coverage:** `workset-project-navigation` / Workset list and detail navigation / Render containing Worksets as a list、Narrow Sidebar keyboard navigation；Project-only Workset selection / Workset contains Project and Store members、Current Planning Store is a Workset member；`workset-cli-open` / Unambiguous Workset action labels / Worksets launcher、Workset list row、Workset detail actions、Project-first member row、Planning Store member row；`workset-creation` / Project-first Workset creation form / Open the creation form。

**Dependencies / order:** 依赖 Task 3 与 Task 4 的最终交互结构；只补齐现有组件、locale 与主题 token，不增加设计系统或 CSS 依赖。

**Files:**
- Modify: `src/webview/components/WorksetProjectPicker.tsx`
- Modify: `src/i18n/locales/en.json`
- Modify: `src/i18n/locales/zh-cn.json`
- Modify: `test/i18n/i18n.test.ts`
- Modify: `test/webview/components/worksetProjectPicker.test.tsx`

**Implementation notes:** 所有可见与 accessible name 文案使用 `t()`；列表是一组轻分隔 surface，详情成员是一组 surface，Create 是单一可滚动 form。使用 `--vscode-focusBorder`、button/error/foreground/panel tokens；Project/Store 同时用图标和文本，不只靠颜色。约 430 px 时名称先截断、动作不重叠、无横向滚动；icon-only 控件有 tooltip 与 `aria-label`；动画限 120–160 ms 并尊重 reduced motion。

**Verification:** `pnpm exec vitest run test/i18n/i18n.test.ts test/webview/components/worksetProjectPicker.test.tsx`；预期中英文 key 对齐、独立控件可按 Tab 访问、visible focus 与 role label 存在，窄宽度无非预期固定最小宽度。

**Risks / edge cases:** 不复制 PNG 的硬编码颜色、字体或外层 VS Code chrome；`Current`/`Current root` 是状态而非 disabled button；英文和中文长度都必须在窄栏可截断。

- [ ] **Step 1（5 分钟）:** 添加 locale key 对齐、accessible name、focusable action、role 文本和 reduced-motion class 的失败测试。
- [ ] **Step 2（2 分钟）:** 运行聚焦 Vitest，确认缺失文案或语义使测试 FAIL。
- [ ] **Step 3（5 分钟）:** 补齐 en/zh-cn 文案并将组件内新增可见字符串全部替换为 `t()`。
- [ ] **Step 4（5 分钟）:** 用现有 Tailwind utility 与 VS Code tokens 完成分组、focus、overflow、主题和 reduced-motion 样式。
- [ ] **Step 5（3 分钟）:** 重跑聚焦测试，确认 PASS 且两份 locale 无缺 key。

---

### Task 5.2: 在真实 Extension Host 中对照两张高保真设计稿验收

**Spec coverage:** `workset-project-navigation` / Workset list and detail navigation / Render containing Worksets as a list、Open Workset detail、Narrow Sidebar keyboard navigation；`workset-creation` / Project-first Workset creation form / Open the creation form；`workset-cli-open` / Unambiguous Workset action labels / Workset detail actions。

**Dependencies / order:** 依赖 Task 5.1 和此前所有功能任务；这是视觉验收与最小修正，不引入新交互。

**Files:**
- Modify: `src/webview/components/WorksetProjectPicker.tsx`
- Modify: `test/webview/components/worksetProjectPicker.test.tsx`
- Reference: [Worksets 列表与详情高保真稿](../assets/worksets-list-detail-high-fidelity.png)
- Reference: [Create Workset 高保真稿](../assets/workset-create-high-fidelity.png)

**Implementation notes:** 在真实 VS Code Extension Development Host 的同一约 430 px Sidebar 宽度分别捕获 list、detail、create。逐项比较信息层级、分组密度、间距、动作位置、截断、focus 与滚动；外层 Activity Bar/window chrome 不属于 Webview。对每个发现的语义性偏差先增加组件回归断言，再做最小 class/markup 修正；不做易受主题影响的像素级 golden test。

**Verification:** 先运行 `pnpm run build`，再启动 `code --extensionDevelopmentPath=/Users/randy/workspace/projects/github/openspec-ext /Users/randy/workspace/projects/github/openspec-ext`。预期 list/detail/create 在 dark、light、high-contrast 主题均可用，在窄栏无重叠或横向滚动，键盘可达；验收后关闭 Development Host。

**Risks / edge cases:** 设计稿只有一种暗色视觉且含宿主 chrome，比较目标是层级与布局而非硬编码像素；若 fixture 缺少多个 Project/Store 角色，先用现有测试数据覆盖语义，不伪造生产 registry 文件。

- [ ] **Step 1（3 分钟）:** 运行 `pnpm run build` 并确认 Extension Host 使用的是最新 `dist`。
- [ ] **Step 2（5 分钟）:** 在约 430 px 宽度捕获 list 与 detail，逐项对照列表/详情高保真稿并记录可复现偏差。
- [ ] **Step 3（5 分钟）:** 打开 Create state，对照创建高保真稿检查字段顺序、Primary、成员组、工具输入、按钮与滚动。
- [ ] **Step 4（5 分钟）:** 对每个语义偏差先在 `worksetProjectPicker.test.tsx` 写失败断言，再做最小 markup/class 修正并确认 PASS。
- [ ] **Step 5（5 分钟）:** 切换 dark、light、high-contrast，完整走一次 Tab/Enter/Escape 与窄栏截断验收。
- [ ] **Step 6（2 分钟）:** 关闭本任务启动的 Extension Development Host，确认未遗留占用进程。

