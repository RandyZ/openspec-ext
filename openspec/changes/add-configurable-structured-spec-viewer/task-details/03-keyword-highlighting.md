# Task 3. 安全关键字上色

<!-- covers: Task 3.1, Task 3.2 -->

### Task 3.1: 为 Markdown 文本节点实现完整单词关键字上色

**Spec coverage:** `artifact-viewing` / `Configurable Spec keyword highlighting` / `Apply default semantic colors`, `Add and override configured keywords`

**Dependencies / order:** 依赖 Task 1.1 的安全 CSS 映射；可与 Task 2 并行但必须先于 Task 4。

**Files:**
- Create: `test/webview/components/markdownRenderer.test.tsx`
- Modify: `src/webview/components/MarkdownRenderer.tsx`
- Test: `test/webview/components/markdownRenderer.test.tsx`

**Implementation notes:**
- 增加可选 `keywordColors: Record<string, string>` prop，并导出纯 matcher 构建/文本切片 helper 供 node 环境测试。
- 对 key 做正则转义并按长度降序生成一次大写完整单词 matcher；`MUSTARD`、`WHENEVER` 等不得部分命中。
- 在现有 HTML 注入后用一个 effect 和一次 `TreeWalker` 替换文本命中；span 只设置 Host 已归一化的 `style.color` 与稳定 class/data attribute。

**Verification:**
- Focused: `rtk pnpm test -- test/webview/components/markdownRenderer.test.tsx`
- Expected: 默认 key、custom key、built-in override 和 partial-word fixture 的纯 helper 断言全部通过；无颜色表时输出保持既有 HTML。

**Risks / edge cases:**
- effect 不能重复包裹已生成 span；内容/映射变化时应依赖 React 重建原始 innerHTML。
- 空映射或空内容必须直接返回，避免创建无意义 TreeWalker/regex。

- [ ] **Step 1 (RED, 2–5 min):** 写完整单词、重叠长度、自定义 key、覆盖颜色和空映射测试，运行 focused 命令确认 helper/prop 缺失失败。
- [ ] **Step 2 (GREEN, 2–5 min):** 实现最小 matcher 与文本切片 helper，使纯逻辑测试通过。
- [ ] **Step 3 (GREEN, 2–5 min):** 在 `MarkdownRenderer` 增加一次文本节点遍历并生成安全 span。
- [ ] **Step 4 (VERIFY, 2–5 min):** 重跑 focused 命令并确认全部 PASS，同时运行 `rtk pnpm test -- test/webview/components/artifactViewer.test.tsx` 确认无 prop 路径无回归。

---

### Task 3.2: 覆盖自定义颜色、Markdown 强调与非语义节点跳过行为

**Spec coverage:** `artifact-viewing` / `Configurable Spec keyword highlighting` / `Apply default semantic colors`, `Ignore invalid keyword configuration safely`, `Skip non-semantic text contexts`

**Dependencies / order:** 依赖 Task 3.1；完成后实际 DOM 行为由 Task 5.2 在 Extension Host 补充验收。

**Files:**
- Create: None
- Modify: `src/webview/components/MarkdownRenderer.tsx`
- Test: `test/webview/components/markdownRenderer.test.tsx`

**Implementation notes:**
- TreeWalker filter 跳过 `CODE`、`PRE`、`A`、`.mermaid` 祖先和已高亮 span；普通 `STRONG`/`EM` 内文本仍允许命中，以保留外层强调。
- 高亮 effect 排在 innerHTML 落地之后并跳过 `.mermaid` 原始节点，不能改写 Mermaid source；Mermaid 仍由既有 effect 负责。
- 用可在 node 测试的纯祖先分类 helper 验证 skip/allow 矩阵；实际 TreeWalker 在 Task 5.2 的真实 Webview 验收。

**Verification:**
- Focused: `rtk pnpm test -- test/webview/components/markdownRenderer.test.tsx`
- Expected: code/pre/link/Mermaid 返回 skip，strong/em/普通 prose 返回 allow；自定义 hex/theme CSS 值原样应用到命中片段模型。

**Risks / edge cases:**
- anchor 内嵌 strong 仍必须整体 skip；判断需要沿祖先向上走到 renderer root。
- Mermaid 异步替换失败时也不能被关键字 effect 污染，保持现有警告与原文行为。

- [ ] **Step 1 (RED, 2–5 min):** 增加 skip ancestor、strong 保留、已高亮节点和 Mermaid fixture 测试，确认当前遍历规则失败。
- [ ] **Step 2 (GREEN, 2–5 min):** 实现最小祖先分类与重复包装 guard，使 skip/allow 矩阵通过。
- [ ] **Step 3 (GREEN, 2–5 min):** 调整 effect 依赖为 `html` 与 `keywordColors` 的稳定内容，避免 stale color 或重复包裹。
- [ ] **Step 4 (VERIFY, 2–5 min):** 重跑 focused 命令并确认全部 PASS；记录真实 DOM/主题检查留给 Task 5.2，不添加 DOM 测试依赖。

