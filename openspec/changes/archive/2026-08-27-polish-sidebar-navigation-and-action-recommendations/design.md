## Context

当前 `Header` 直接渲染四个相同的 secondary button，`Dashboard` 则把三组优先级渲染成裸 Change 名称。数据、binding 和动作路由已经由 Project Sidebar payload、`getDashboardPriorityChanges()`、`resolveWorkflowActions()` 与 `handleLaunchWorkflow()` 提供；问题集中在呈现和少量动作选择。需求背景与方案比较见 `explore.md`。

本 Change 涉及 `Header`、`Dashboard`、locale 和组件测试，但不需要 Host 数据或协议变更。仓库已经加载 `@vscode/codicons` CSS，并已有 `getWorkflowActionButtonLabel()` / `getWorkflowActionTitle()` 处理 adapter-aware CTA 文案。

## Goals / Non-Goals

**Goals:**

- 用 VS Code 主题原生卡片层级呈现稳定 2×2 action grid。
- 用最多三条动作行替代裸推荐名称，明确状态、Change 和 CTA。
- 保持 Project binding、receipt correlation、workflow launch 与 high-impact safety 路由不变。
- 在窄 Sidebar、暗色/浅色/高对比主题和键盘操作下保持可读可用。

**Non-Goals:**

- 不改变 ProjectSidebarData、Host message、缓存、CLI 或 Workset membership 发现。
- 不创建通用设计系统、全局 Card 组件或新图标资产。
- 不重做 ChangeCard、宽 Project Dashboard KPI/图表或全局 action model。
- 不为 Store Change 增加当前产品不存在的 Sidebar 入口。

## Decisions

### 1. 四宫格保留在 Header，仅做文件内数据驱动渲染

`Header` 继续拥有四个入口。实现使用一个文件内 action 描述数组或极小 render helper 统一卡片骨架，差异仍由现有 callbacks、`activeProjectTab`、`worksetCount` 和禁用原因决定。图标直接使用已加载的 `codicon codicon-*` class；CSS 使用 Tailwind 布局与 VS Code variables，不新增 CSS framework 或组件文件。

```text
ProjectSidebarData
       |
       v
Dashboard props -------> Header
                          |
                          +--> Changes / Specs / Worksets: setProjectFirstTab
                          |
                          +--> Dashboard: openProjectDashboard message
```

选中背景优先使用 `--vscode-list-activeSelectionBackground` / foreground，普通卡片使用 `--vscode-sideBar-background`、`--vscode-panel-border` 和 hover token。Dashboard 只显示 Editor/外部打开提示，不设置 `aria-pressed`。Worksets disabled 继续使用原生 `disabled`，并通过 title/ARIA 提供完整原因。

替代方案是新增 `ProjectActionCard` 通用组件；四个只在一个文件使用的入口不足以支撑新公共抽象，因此拒绝。

### 2. 优先级先互斥分类，再扁平化截取三条

`getDashboardPriorityChanges()` 继续返回 Change 数组，避免新 DTO。分类顺序改为互斥：一旦命中 attention 就不再同时进入 Recommended；否则 Verify recommendation 进入 Ready to Verify，其余 recommendation 进入 Recommended。渲染时按固定组顺序扁平化并 `slice(0, 3)`。

```text
accepted Project Changes + binding-matching receipts
                         |
                         v
          getDashboardPriorityChanges
             /             |             \
      attention          verify       recommended
             \             |             /
              fixed order + dedupe + limit 3
                         |
                         v
                 compact action rows
```

替代方案是引入 `PriorityActionItem` DTO 并在 Host 计算；这会复制 resolver 结果并扩展消息契约，因此拒绝。

### 3. CTA 在点击时从共享 resolver 读取，不从展示文案反推

Needs Attention 直接调用现有 `handleOpenChange()`。Ready to Verify 调用 `handleLaunchWorkflow('verify', ...)`。Recommended 在 render/click 时使用当前 Change snapshot 再调用 `resolveWorkflowActions()`，取得 `recommended` action；普通动作进入现有 `launchWorkflowAction`，Verify/Archive 仍由 `handleLaunchWorkflow()` 导向 binding-aware Detail。

CTA 文案和 title 复用 `getWorkflowActionButtonLabel()` / `getWorkflowActionTitle()`，因此 Clipboard、Cursor 和其他 adapter 的行为说明保持一致。状态说明、四宫格辅助文字和 Review 文案使用成对 locale key。

```text
Priority CTA
   |
   +-- Needs Attention --> openChangeDetailInEditor
   |
   +-- Verify/Archive --> bound Detail / Verify & Archive
   |
   +-- Continue/FF/Apply/Sync --> launchWorkflowAction message
                                      |
                                      v
                              existing Host adapter route
                                      |
                                      v
                         correlated workflowActionReceipt
```

### 4. 样式只使用主题 token，测试锁语义不锁像素

卡片/动作行必须具备 border、background、hover、focus-visible、disabled 和高对比可见性。测试断言 DOM 结构、Codicon class、ARIA、优先级、最大条数和消息路由；不对完整 class 字符串或截图像素做单元断言。真实 Extension Development Host 负责最终视觉和键盘验收。

## Risks / Trade-offs

- [主题 token 在不同 IDE 组合下对比度不足] → 只使用 VS Code 语义 token，并在 VS Code/Cursor 暗色主题及高对比焦点下做真实验收。
- [窄 Sidebar 中辅助文字挤压] → 固定两列、统一最小高度、文本截断，完整信息放入 title/ARIA，不引入 JS 宽度监听。
- [同一 Change 同时进入多个优先级] → 分类阶段按 attention → verify → recommended 互斥，并增加回归测试。
- [推荐 CTA 与当前 adapter 行为不一致] → 复用 workflow launch label helpers 和现有 handler，不新增硬编码执行文案。
- [动作区遮挡 Changes 主列表] → 全区最多三条，不增加展开/分页状态。

## Migration Plan

1. 先用 RED 测试锁定四宫格语义、优先级互斥、三条上限和 CTA 路由。
2. 最小修改 `Header`、`Dashboard` 与 locale，保留既有 props/messages。
3. 运行 focused/full tests、lint、build、strict 与真实 Extension Development Host 验收。
4. 回滚时恢复旧 DOM 样式和旧 priority render；无数据迁移或缓存清理。

## Open Questions

无。图标名称和微调间距可在真实 Host 验收中选择，但不得改变规格定义的语义、顺序或动作。

## Spec Amendments

无。当前 `project-sidebar-tabs` 和 `dashboard` delta 已覆盖视觉层级、优先级、上限、CTA 与 binding 安全要求。
