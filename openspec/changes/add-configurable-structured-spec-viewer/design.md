## Context

需求、交互选择与视觉基线见 [explore.md](./explore.md)；行为契约见 [artifact-viewing delta spec](./specs/artifact-viewing/spec.md)。当前 Host 已按所选 scope 读取完整主 Spec 或 delta spec，Webview 的 `SpecViewer` 与 `ArtifactViewer` 最终都调用通用 `MarkdownRenderer`。本变更跨越 VS Code 配置、Host 消息契约和 React 渲染，但不改变内容读取、OpenSpec CLI 或 scope containment。

用户提供的深色界面参考图是视觉验收基线：Requirement 标题与规范正文构成一组，规范正文优先可见，Scenario 仅显示可展开摘要；实际颜色、边框和焦点态必须使用 VS Code theme token，不能硬编码成截图主题。

## Goals / Non-Goals

**Goals:**

- 让主 Spec 与 delta spec 复用同一套结构解析、折叠和关键字上色行为。
- 保留完整 Markdown 能力，并对非标准或无法安全分段的文档完整回退。
- 在 Host 侧把用户配置归一化成可安全传入 Webview 的生效颜色表。
- 用原生 disclosure 和既有 `marked` 渲染器完成实现，不引入依赖或自定义状态机。

**Non-Goals:**

- 不改变 Spec 文件语法、CLI 输出、Store/Workset 或 scope 解析。
- 不为 proposal、design、tasks 启用结构化 Spec 模式。
- 不支持多词/正则关键字、全局全部展开/收起、折叠状态持久化或配置热更新广播。
- 不在本变更实现 delta diff 配色。

## Decisions

### 1. Host 只负责配置边界，Webview 负责文档结构

新增一个小型纯函数配置读取器，复用 `vscode.workspace.getConfiguration('openspec')` 模式。它将内置映射与 `specKeywordColors` 合并，并只接受：

- 最多 64 个配置项；关键字长度不超过 32 且匹配 `[A-Z][A-Z0-9_-]*`。
- `#RRGGBB`；或匹配 VS Code theme color id 语法的 `vscode:<id>`。
- theme id 在 Host 转为安全的 `var(--vscode-...)` CSS 值；Webview 不再解释任意 CSS。

内置映射分别使用蓝、绿、灰、红类别的现有 VS Code theme token。无效自定义项被忽略；无效内置覆盖不会移除默认值。读取发生在 `getSpecContent` 和 `getDeltaSpecContent` 响应时，因此刷新或重新打开会自然获得新值，无需新增配置监听器。

```text
Webview request
  getSpecContent / getDeltaSpecContent
              |
              v
webviewMessageHandler -------------------+
  read scope-contained Markdown           |
  read + normalize workspace setting      |
              |                            |
              +--> specContent             |
              |      content               |
              |      keywordColors         |
              |                            |
              +--> deltaSpecContent        |
                     content               |
                     keywordColors         |
                                           v
                              shared SpecDocumentRenderer
```

备选方案是单独广播全局配置消息；它会增加生命周期与缓存同步问题，而首版只要求下一次加载生效，因此不采用。

### 2. 一个共享、行级的 canonical Spec 分段器

新增 `SpecDocumentRenderer`，由 `SpecViewer` 直接使用；`ArtifactViewer` 仅在当前输出 `kind === 'specs'` 时使用，其他 artifact 仍走 `MarkdownRenderer`。组件内导出一个纯分段函数供测试，避免再引入 parser 抽象层。

分段器逐行扫描并跟踪 fenced code block，只在代码围栏之外识别：

- `### Requirement: <title>`：开始 Requirement。
- `#### Scenario: <title>`：开始当前 Requirement 的 Scenario。
- 其他内容：原样归入前置 Markdown、Requirement 规范正文或 Scenario 明细。

输出只需要两类顶层 segment：普通 Markdown 与包含 `title/body/scenarios` 的 Requirement。找不到 Requirement、出现孤立 Scenario、边界不一致或解析抛错时返回失败标记，调用方把原始全文交回现有 `MarkdownRenderer`。这样不会出现“部分结构化、部分丢失”的中间状态。

备选方案是扩展 `marked` renderer 或引入 Markdown AST 插件；前者难以表达嵌套 disclosure，后者增加依赖与迁移成本，均不采用。

### 3. 原生 disclosure 对齐认可的阅读层级

每个 Requirement 渲染为带 `open` 的 `<details>`，每个 Scenario 渲染为不带 `open` 的嵌套 `<details>`。`<summary>` 保留可聚焦、Enter/Space 和 pointer 的平台行为；不在 React state 中镜像开关状态。重新加载组件即恢复默认状态。

```text
<details class="spec-requirement" open>
  <summary>Requirement title</summary>
  [Markdown: complete normative body]
  <details class="spec-scenario">
    <summary>Scenario title</summary>
    [Markdown: complete scenario body]
  </details>
</details>
```

样式放入现有 `src/webview/index.css`：使用 `panel-border` 表达左侧层级线，Requirement 标题采用正文强调色，Scenario 使用次级前景色，并补齐 `:focus-visible`。窄宽度下只允许正文换行，不引入固定宽度或横向布局。

### 4. 在已生成 DOM 的文本节点上安全上色

`MarkdownRenderer` 增加可选 `keywordColors` 属性。HTML 仍由既有 `marked` 配置生成；随后 effect 使用 `TreeWalker` 遍历文本节点，用转义并按长度排序的关键字构造一次完整单词 matcher，把命中片段替换成仅设置已归一化 `color` 的 `<span>`。

遍历时跳过祖先为 `CODE`、`PRE`、`A` 或 `.mermaid` 的节点，也跳过已生成的关键字 span。由于替换发生在文本节点而不是 HTML 字符串上，`<strong>` 等 Markdown 结构保持不变，也不会把配置值注入 markup。内容或颜色表变化时，React 先重建原始 `dangerouslySetInnerHTML`，再重新执行一次高亮，不需要清理增量 DOM。

备选方案是在 Markdown 原文上做正则替换；这会污染代码块、链接和 HTML，且容易产生注入问题，因此不采用。

### 5. 消息与组件状态保持最小扩展

`specContent` 与 `deltaSpecContent` 在共享消息类型中各增加 `keywordColors: Record<string, string>`。`SpecViewer` 保存对应内容和颜色表；`ChangeDetail` 在接收 delta 内容时把颜色表与当前 spec 内容一起交给 `ArtifactViewer`。普通 `artifactContent` 消息不变。

```text
main Spec:  specContent ------> SpecViewer ------+
                                                |
                                                v
                                      SpecDocumentRenderer
                                                ^
                                                |
delta Spec: deltaSpecContent -> ChangeDetail -> ArtifactViewer(kind=specs)

other artifactContent -------------------------> MarkdownRenderer
```

测试按边界分层：Host 纯函数覆盖默认值、添加、覆盖和非法输入；Webview 纯分段函数覆盖主/delta 结构、代码围栏和 fail-open；DOM 测试覆盖 disclosure 默认状态、键盘原生元素、完整单词、加粗保留及跳过节点；既有 `ArtifactViewer`/消息处理测试覆盖主与 delta 接线。

## Risks / Trade-offs

- **[行级解析只支持 canonical heading]** → 这是明确的 MVP 边界；任何不确定结构整篇回退，保证内容完整。
- **[大 Spec 会进行一次 DOM 文本遍历]** → 单次 `TreeWalker` 与一个合并 matcher，且配置最多 64 项；不引入逐关键字全树扫描。
- **[分段后 heading id 作用域可能重复]** → Requirement/Scenario 标题由 `<summary>` 承担，不依赖原 heading anchor；普通 Markdown 仍沿用现有 heading 行为。
- **[用户选择的 literal hex 可能在某些主题对比度不足]** → 默认值始终 theme-aware；自定义 literal 是用户显式选择，focus 与 disclosure 状态仍不依赖颜色。
- **[配置改变不会立即更新已打开页面]** → UI 不伪装实时更新；按契约在刷新或重新打开时读取最新值。

## Migration Plan

1. 先加入配置归一化及单元测试，再扩展 typed 消息，保证 Host 永远发送安全且包含默认值的映射。
2. 加入纯分段器、共享 renderer 与 DOM 测试，再接入主 Spec 和 delta spec 两条现有路径。
3. 补充主题/窄宽度样式与真实 Extension Host 视觉验收，对照用户提供的参考图检查层级、默认开关和四类颜色。
4. 发布不需要数据迁移；未配置用户自动使用默认映射。

回滚时移除新配置声明、消息字段和 Spec 专用 renderer，两个入口恢复直接调用现有 `MarkdownRenderer`；Spec 文件与用户内容无需转换。

## Open Questions

无。多词匹配、状态持久化与实时配置更新保留为有真实需求时再评估的后续项。

## Spec Amendments

- [x] **Capability: `artifact-viewing`** — 设计确认必须给配置匹配建立确定上限；已在 delta spec 中补充最多 64 项、关键字最长 32 字符，并把超限归入安全忽略场景。
- [x] **Capability: `artifact-viewing`** — 最终校验发现 MODIFIED requirement 必须保留既有 `Render specs` 场景；已补回该兼容场景，并保留更具体的主 Spec 与 delta spec 场景。
