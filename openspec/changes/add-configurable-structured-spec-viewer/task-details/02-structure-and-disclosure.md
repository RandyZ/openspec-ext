# Task 2. Spec 结构解析与折叠

<!-- covers: Task 2.1, Task 2.2 -->

### Task 2.1: 实现 canonical Spec 分段与完整 Markdown 回退

**Spec coverage:** `artifact-viewing` / `Artifact Content Rendering` / `Render structured main spec`, `Render structured delta spec`, `Fall back for a non-canonical spec`

**Dependencies / order:** 可在 Task 1 后独立实现；Task 2.2、Task 4 均依赖分段结果。

**Files:**
- Create: `src/webview/components/SpecDocumentRenderer.tsx`, `test/webview/components/specDocumentRenderer.test.tsx`
- Modify: None
- Test: `test/webview/components/specDocumentRenderer.test.tsx`

**Implementation notes:**
- 在组件文件内导出纯 `parseSpecDocument(content)`；只在 fenced code block 外识别 `### Requirement:` 与属于当前 Requirement 的 `#### Scenario:`。
- 保留前置/中间 Markdown、完整规范正文和 Scenario 明细原文；delta operation 标题属于普通 Markdown segment。
- 无 Requirement、孤立 Scenario、未闭合边界或异常一律返回失败结果，由 renderer 把原始全文交给 `MarkdownRenderer`；不要输出部分解析结果。

**Verification:**
- Focused: `rtk pnpm test -- test/webview/components/specDocumentRenderer.test.tsx`
- Expected: canonical main/delta fixture 分段稳定；代码围栏内伪 heading 不分段；非 canonical fixture 的回退 HTML 含全部原文。

**Risks / edge cases:**
- CRLF 与 LF 必须产生相同段落；空正文和多个 Scenario 不能吞掉相邻内容。
- 标题识别必须锚定完整行，不能把普通正文中的 `### Requirement:` 当边界。

- [ ] **Step 1 (RED, 2–5 min):** 写 main、delta、代码围栏、孤立 Scenario 和无 Requirement 的纯函数测试，运行 focused 命令确认导出缺失失败。
- [ ] **Step 2 (GREEN, 2–5 min):** 实现带 fence 状态的单次行扫描和最小 segment 类型。
- [ ] **Step 3 (GREEN, 2–5 min):** 在解析失败分支直接复用完整 `MarkdownRenderer`，不添加纠错启发式。
- [ ] **Step 4 (VERIFY, 2–5 min):** 重跑 focused 命令并确认全部 PASS，逐字断言回退内容未丢失。

---

### Task 2.2: 渲染默认展开的 Requirement 与默认收起的 Scenario

**Spec coverage:** `artifact-viewing` / `Artifact Content Rendering` / `Render specs`, `Render structured main spec`, `Render structured delta spec`, `Restore disclosure defaults`

**Dependencies / order:** 依赖 Task 2.1；完成后 Task 4 才可接入两个入口。

**Files:**
- Create: None
- Modify: `src/webview/components/SpecDocumentRenderer.tsx`
- Test: `test/webview/components/specDocumentRenderer.test.tsx`

**Implementation notes:**
- Requirement 使用 `<details className="spec-requirement" open>`，Scenario 使用嵌套且无 `open` 的 `<details className="spec-scenario">`；summary 显示解析标题。
- 普通 segment、Requirement body、Scenario body 均复用 `MarkdownRenderer`，并把同一 `keywordColors` 向下传递。
- 不创建 disclosure React state；组件重新挂载或内容 key 变化后由原生默认属性恢复状态。

**Verification:**
- Focused: `rtk pnpm test -- test/webview/components/specDocumentRenderer.test.tsx`
- Expected: server-rendered HTML 中 Requirement 带 `open`、Scenario 不带 `open`，规范正文可见，delta operation heading 保留。

**Risks / edge cases:**
- summary 内不得嵌套块级 heading；标题作为文本/最小 inline 内容呈现。
- Requirement 没有 Scenario 时仍显示完整 body；Scenario 没有 body 时仍保留可操作 summary。

- [ ] **Step 1 (RED, 2–5 min):** 增加 disclosure 默认属性、嵌套顺序、正文保留和重新渲染默认态断言，确认当前占位 renderer 失败。
- [ ] **Step 2 (GREEN, 2–5 min):** 用原生 details/summary 渲染 segment，不引入 accordion 或本地开关状态。
- [ ] **Step 3 (GREEN, 2–5 min):** 把普通/body/scenario Markdown 和颜色表接到既有 renderer。
- [ ] **Step 4 (VERIFY, 2–5 min):** 重跑 focused 命令并确认全部 PASS；人工检查生成 HTML 中只有 Requirement 默认 open。
