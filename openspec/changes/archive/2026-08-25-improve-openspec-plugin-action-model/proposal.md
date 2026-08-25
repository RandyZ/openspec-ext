<!-- Distilled from explore.md saved at openspec/changes/improve-openspec-plugin-action-model/explore.md -->

## Why

插件当前用固定线性阶段和多套独立规则解释 OpenSpec Change，无法可靠表达自定义 schema、并行 ready artifact、真实文件路径和动作交付结果。现在需要让 GUI 以 OpenSpec CLI 状态为事实源，使 Sidebar、Change Detail 和 Dashboard 给出一致、诚实且可执行的下一步。

## What Changes

### MVP

- 将 CLI `status --json` 投影为绑定具体 root 的 Change workflow snapshot，保留有序 artifact、依赖、状态和实际输出路径。
- 建立一个共享 action resolver，统一三个界面的推荐动作、其他可用动作、阻塞原因和高影响动作。
- 用动态 artifact 分组与导航替换 Change Detail 的固定线性 stepper，并安全展示单文件、多文件、Specs 和 Tasks 内容。
- 保持 `/opsx:continue` 的通用语义，不再用按钮文案暗示它能创建指定 artifact。
- 将 Sidebar 收敛为紧凑的下一步入口，并在 Dashboard 首屏优先展示 Needs attention、Ready to verify 和 Recommended actions。
- 在动作前显示真实交付目标，在动作后区分已预填、已复制、运行中、完成、回退和失败。
- 保持 Project/root binding 不可变，使用 CLI 返回路径并执行 containment 校验，防止同名 Change 跨 root 串线。

### 后续阶段（不在本 Change）

- Specs 全文搜索、版本历史和演进关系。
- Workset 信息架构与管理体验的全面重做。
- Dashboard 看板、时间线、动画和完整分析面板重构。
- 插件自建工作流引擎、持久化执行队列或上游 OpenSpec CLI 改动。

## Capabilities

### New Capabilities

无。本 Change 扩展已有插件能力，不建立新的独立产品域。

### Modified Capabilities

- `cli-integration`: Change 数据读取需要保留 CLI status 的动态 artifact 图、实际路径和 root 绑定，并只在详情或动作时按需读取 instructions。
- `workflow-control`: 工作流动作需要由共享 resolver 基于有序 artifact 状态推导，支持并行可用动作、真实 blocked/skipped 语义以及 planning/apply/verify/archive 边界。
- `artifact-viewing`: Change Detail 需要按 status 返回的动态 artifact 与实际输出路径展示内容，支持安全的单文件、多文件和专用渲染。
- `agent-command-routing`: 动作需要显示真实交付目标并返回可观察的 receipt，明确区分预填、复制、运行、完成、回退和失败。
- `dashboard`: Sidebar 与宽 Dashboard 需要消费共享动作结果，分别提供紧凑下一步和 action-first 跨 Change 优先级。

## Impact

- 扩展端：OpenSpec CLI 响应映射、Change/root binding、webview message handling、现有 adapter 结果回传与缓存刷新。
- Webview：Change Detail、artifact 导航、ActionBar、Sidebar Change 卡片和 Dashboard 首屏信息层级。
- 数据契约：补充 workflow snapshot、resolved actions 和 action receipt；不新增持久化存储或外部依赖。
- 兼容性：保留现有 CLI、文件监听、缓存、Chat/Cursor/Clipboard/Terminal adapters 和 Verify/Archive 专用路径；Archived Change 继续安全只读。
- 验证：覆盖自定义 schema、并行 ready、blocked/skipped、多文件 artifact、路径越界、同名 Change 跨 root、adapter 回退、重复动作和 refresh 一致性。
