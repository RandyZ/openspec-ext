<!-- Exploration output for this change — input for proposal, not the contract. -->

## Clarified requirements and constraints

### Problem

当前主 Spec 预览和 change 内的 delta spec 都只把完整 `spec.md` 交给通用 Markdown renderer。Requirement、规范正文和 Scenario 虽能阅读，但没有结构化层级：Scenario 明细会一次性展开，BDD/规范关键字也没有语义配色。用户需要接近已提供视觉参考的阅读体验，让规范句优先、Scenario 明细按需展开。

### Required outcomes

- 主 Spec 与 delta spec 使用一致的结构化阅读模式。
- `Purpose` 等非 Requirement 内容继续按普通 Markdown 显示。
- 每个 `### Requirement:` 默认展开，标题下立即显示其到首个 Scenario 之间的完整规范正文。
- 每个 `#### Scenario:` 默认收起，只显示标题；点击或键盘操作后显示完整明细。
- 默认关键字配色：
  - `GIVEN`、`WHEN`：蓝色主题 token。
  - `THEN`：绿色主题 token。
  - `AND`：灰色说明 token。
  - `MUST`、`SHALL`、既有规格要求的 `SHOULD`：红色错误/测试失败 token。
- 新增 `openspec.specKeywordColors` 设置，允许用户新增任意单词型关键字，也允许覆盖内置关键字颜色。
- 配置值支持十六进制颜色和 `vscode:<theme-color-id>`；Host 校验、归一化并与默认值合并。
- 只匹配大写完整单词；保留 Markdown 加粗，但跳过代码块、行内代码、链接和 Mermaid。
- 无法识别标准 OpenSpec 标题结构时，fail-open 到当前完整 Markdown 渲染，不丢正文。

### Constraints and boundaries

- 复用 Host 已经发送的完整 Spec 文本；不修改 OpenSpec CLI、Spec 文件格式、Content Access 或 Store/Project binding。
- 不新增运行时依赖、路由、全局折叠状态或新的 Markdown 引擎。
- 使用原生 `<details>/<summary>` 获得键盘与可访问性基础行为。
- 配置变化在下一次打开或刷新 Spec 时生效；首版不增加全局配置热更新广播。
- 自定义关键字首版为单个英文 token：`[A-Z][A-Z0-9_-]*`；不支持多词短语或正则表达式。
- 不提供“全部展开/收起”，不持久化展开状态，不改变普通 proposal/design/tasks 的 Markdown 表现。

## Agreed design direction

### Approaches considered

| Approach | Benefits | Costs | Decision |
|---|---|---|---|
| 单一 `keyword -> color` 对象设置 | 可新增和覆盖，设置面最小，容易与默认值合并 | 需要 Host 校验和一条 typed config payload | Selected |
| 为 GIVEN/WHEN、THEN、规范关键字分别提供固定设置 | Schema 提示明确 | 不能自然增加 `MAY`、`NEVER` 等任意关键字，设置项膨胀 | Rejected |
| 注册 VS Code `contributes.colors` 并让关键字引用静态 color id | 主题集成原生 | 动态关键字无法动态注册 color contribution，结构过重 | Rejected |

### Final interaction model

```text
Spec title
  |
  +-- Purpose                         normal Markdown
  |
  +-- Requirements
       |
       +-- ▼ Requirement A            open by default
       |      normative statement     always visible while open
       |      ▸ Scenario A1            closed by default
       |      ▸ Scenario A2            closed by default
       |
       +-- ▼ Requirement B
              normative statement
              ▸ Scenario B1
```

Requirement 使用外层 `<details open>`，Scenario 使用嵌套且不带 `open` 的 `<details>`。刷新或重新打开后恢复该默认状态。

### Effective configuration

```text
Built-in keyword colors
          +
openspec.specKeywordColors
          |
          v
Host normalize + validate
          |
          v
specContent / deltaSpecContent
          |
          v
Structured Spec renderer
```

配置示例：

```json
{
  "openspec.specKeywordColors": {
    "WHEN": "#C586C0",
    "MAY": "vscode:editorWarning.foreground",
    "NEVER": "#FF8800"
  }
}
```

无效的内置覆盖回退到默认色；无效的自定义项被忽略并记录一次诊断，不阻断 Spec 阅读。

## Key decisions

- **Webview owns structure rendering:** Host 继续返回完整 Markdown；结构化解析只影响展示。
- **One shared Spec renderer:** 主 Spec 与 delta spec 复用同一组件，普通 Artifact 继续使用现有 `MarkdownRenderer`。
- **Canonical grammar, fail-open:** 只识别标准 `### Requirement:` 与 `#### Scenario:`；遇到不规则结构时完整回退。
- **Native disclosure controls:** 使用 `<details>/<summary>`，不实现自定义 Accordion 状态机。
- **Safe text-node highlighting:** 在 Markdown 已生成的 DOM 文本节点上应用转义后的完整单词 matcher，跳过非语义节点，避免正则替换 HTML。
- **Theme-first defaults:** 默认值使用 VS Code theme tokens；用户可显式选择 literal hex。
- **Bounded custom input:** 限制关键字数量和长度，拒绝正则、多词短语及非法颜色，避免异常配置造成慢匹配或 CSS 注入。
- **No live config synchronization in MVP:** 重新打开或刷新时读取最新配置。
- **Existing contract alignment:** `artifact-viewing` 已要求区分 Requirement/Scenario 并高亮 `SHALL/MUST/SHOULD`；正式 delta spec 将补足折叠、具体颜色、自定义配置和安全回退语义。

