## Why

当前 Dashboard 侧边栏卡片缺少创建日期，任务进度、更新时间、artifact 状态与 Proposal Why 摘要挤在一起，用户难以快速判断 change 的时间背景和推进状态。Change 详情页顶部把推进 OpenSpec 流程的按钮与 IDE/视图辅助操作混排，且 change 名称无法快速复制，导致常用操作的语义和路径不够清晰。

## What Changes

- 优化 Dashboard change 卡片的信息层级：突出 change 名称与 Proposal Why 摘要，增加创建日期展示，并将创建时间、更新时间、任务进度、完成比例、artifact badge 和进度条组织成更易扫描的结构。
- 补充 change 列表的创建时间展示链路，具体数据来源与缺失时的回退策略在 design 中确定。
- 重构 ChangeDetail 顶部交互区，将 OpenSpec workflow 推进动作与 IDE/视图辅助动作清晰分组。
- 在 change 名称旁增加复制按钮，用于复制纯 change name，并提供复制成功反馈。
- 移除 ChangeDetail 顶部的 `Show in sidebar` 按钮，不再把它作为主要操作入口。
- 保持高影响工作流操作与普通 IDE 辅助操作的分组隔离，具体布局与交互形式在 design 中确定。
- 优化相关按钮、状态摘要、hover action、tooltip 与窄宽度布局的用户体验，使页面在 VS Code/Cursor 深浅主题下更清晰、稳定、可操作。

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- `dashboard`: 调整 Dashboard change card 的展示需求，增加创建日期展示，并明确卡片信息层级、可读性和 hover workflow action 的可操作性要求。
- `workflow-control`: 调整 ChangeDetail 顶部 workflow action 与 IDE/视图辅助操作的分组要求，增加复制 change name 操作，并移除 `Show in sidebar` 作为主要操作入口。

## Impact

受影响范围包括 Dashboard 展示链路、ChangeDetail 交互区、相关数据类型和文案资源；具体文件与测试项在 design/tasks 中展开。
