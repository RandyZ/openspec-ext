<!-- Distilled from explore.md saved at openspec/changes/add-configurable-structured-spec-viewer/explore.md -->

## Why

当前 Spec 预览把 Requirement 与 Scenario 当作普通 Markdown 连续展示，规范句不够突出，Scenario 明细也会挤占阅读空间。需要在不改变 OpenSpec 文件格式的前提下，让主 Spec 和 delta spec 都能优先呈现规范正文、按需展开 Scenario，并允许团队按自身词汇调整语义配色。

## What Changes

- 为主 Spec 与 change 内的 delta spec 提供一致的结构化阅读模式：Requirement 默认展开并显示完整规范正文，Scenario 默认收起且可通过原生 disclosure 控件展开。
- 为 `GIVEN`、`WHEN`、`THEN`、`AND`、`MUST`、`SHALL`、`SHOULD` 提供主题感知的默认语义配色。
- 新增 `openspec.specKeywordColors` 设置，允许用户增加单词型关键字或覆盖内置关键字颜色；支持十六进制颜色与 VS Code theme color 引用。
- 在代码、链接与 Mermaid 等非规范文本上下文中跳过关键字上色，并在无法可靠识别 Spec 结构时回退到现有完整 Markdown 渲染。
- MVP 不包含全部展开/收起、折叠状态持久化、多词或正则关键字，以及配置热更新广播。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `artifact-viewing`: 明确 Spec 的 Requirement/Scenario 分层折叠、默认与自定义关键字配色、安全跳过上下文及结构解析失败回退行为。

## Impact

- Webview 的主 Spec、delta spec 与 Markdown 渲染路径将增加共享的 Spec 结构展示和安全文本高亮逻辑。
- Extension Host 将读取、校验并归一化 `openspec.specKeywordColors`，把生效后的颜色映射附加到现有 Spec 内容消息。
- `package.json` 将声明新的 VS Code 配置项；现有 OpenSpec CLI、Spec 文件格式、Store/Project binding 和普通 artifact 渲染不变。
- 不新增运行时依赖，也没有破坏性变更。
