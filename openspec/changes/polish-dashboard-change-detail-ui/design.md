## Context

`polish-dashboard-change-detail-ui` 聚焦两个已有体验问题：

1. Dashboard change 卡片缺少创建时间，Proposal Why 摘要、artifact 状态、更新时间与任务进度挤在同一层，扫描成本高。
2. ChangeDetail 顶部把 workflow 推进动作与 IDE/视图辅助动作混排，`Show in sidebar` 价值低，change 名称也缺少快速复制入口。

当前实现已经具备这些基础：

- Dashboard 数据由 extension host 的 `DataManager` 汇总后，通过 webview 消息 `dashboardData` 下发。
- `ChangeInfo` 在 extension 与 webview 两侧都有独立类型定义，目前包含 `name`、`completedTasks`、`totalTasks`、`lastModified`、`status`、`artifacts`、`proposalWhy*`、`searchText`。
- ChangeDetail 已有 `WorkflowStepIndicator`、`ActionBar` 和 artifact tabs；Dashboard 已有 `ChangeCard` hover workflow actions。

本设计只重排信息架构、补齐展示字段与交互语义，不改变 OpenSpec workflow 的业务真相源，不引入新的运行协议大类。

## Goals / Non-Goals

**Goals:**

- 固化方案 B：在不改动整体技术栈的前提下，采用“信息架构重排 + 轻量 UI primitive 收口”完成 UI 打磨。
- 为 Dashboard change card 增加 `createdAt` 展示链路，并重新组织标题、摘要、artifact、时间、进度、quick actions 的层级。
- 将 ChangeDetail 顶部收敛为紧凑双区布局，明确 workflow 操作与普通工具操作的边界。
- 增加复制纯 change name 的入口和反馈，移除顶部 `Show in sidebar`。
- 统一 icon、动效、降级和测试边界，避免实现时各处散落临时判断。

**Non-Goals:**

- 不改写 OpenSpec CLI、workflow command routing、adapter 选择逻辑和 archive/verify/apply 业务语义。
- 不引入新的重型组件库或新的消息协议类型。
- 不把 `createdAt` 升格为排序、状态判断、归档或 workflow 推进的真相源。
- 不在本 change 内重构整个 Dashboard/ChangeDetail 组件体系。

## Decisions

### 1. 采用方案 B：信息架构重排 + 轻量 primitive

采用方案 B，而不是继续在现有节点上局部堆叠字段，原因如下：

- 当前问题主要是层级混乱，不是能力缺失；重排优先于重构。
- 现有 React + Tailwind + Radix + VS Code theme token 已足够承载这次改动。
- 只抽出少量 primitive（如 `IconButton`、`MetaRow`、`DateLabel`、`ActionGroup`）即可降低重复样式和语义漂移，无需扩展成完整设计系统。

不采用“全面换组件库”方案，也不采用“完全不抽象、逐处手改”方案。前者引入额外依赖和迁移成本，后者会让 Dashboard 与 ChangeDetail 的交互语义继续分叉。

### 2. Dashboard card 信息架构改为五层

Dashboard card 固定为以下信息顺序：

```text
Change name
Proposal Why summary
Artifact badges
Created / Updated
Task progress text + progress bar
hover/focus workflow actions
```

布局规则：

- `change.name` 是主身份信号，始终最醒目。
- `proposalWhySummary` 位于标题下方，保持 2-3 行以内的紧凑摘要；完整文本继续通过 tooltip 或等价 accessible hint 暴露。
- `artifacts` 独立成一行，表达 planning 结构状态。
- `Created` 与 `Updated` 共用一行，但与任务进度分离，避免时间语义和进度语义混杂。
- 任务进度文本与 progress bar 紧邻，形成一个完整状态块。
- workflow quick actions 仅在 hover 或 keyboard focus 时显现，并且可通过键盘访问。

推荐卡片骨架：

```text
+--------------------------------------------------+
| change-name                                      |
| Proposal Why summary...                          |
| [proposal] [design] [specs] [tasks]              |
| Created 2026-06-10 · Updated Today               |
| 3 / 5 tasks · 60%                                |
| ████████████░░░░░░░░                             |
| hover/focus: [Continue] [FF] / [Verify] [Archive]|
+--------------------------------------------------+
```

### 3. ChangeDetail 顶部采用紧凑双区布局

ChangeDetail 顶部拆成两条主带：

```text
+------------------------------------------------------------------+
| 左区: change name + copy + status summary | 右区: Open / Refresh |
+------------------------------------------------------------------+
| Workflow Step Indicator                                                |
+------------------------------------------------------------------+
| Workflow Action Bar                                                    |
+------------------------------------------------------------------+
```

双区语义：

- 左区负责“对象身份与当前状态”：change 名称、简短状态摘要、复制按钮。
- 右区负责“视图与工作区工具”：`Open in Editor`、`Refresh`。
- Workflow Step Indicator 继续承担“当前阶段/可导航阶段”表达。
- Workflow Action Bar 只承担“推进 OpenSpec workflow”的动作，例如 `Continue`、`FF`、`Apply`、`Sync Specs`。

这意味着：

- `Show in sidebar` 从顶部移除，不再作为主操作。
- `Open in Editor`、`Refresh` 不再混入 workflow action bar。
- Verify/Archive 仍属于高影响 workflow，但不与普通视图按钮同组；其入口保持在 step/action 语义下，而不是 header 工具区。

### 4. `createdAt` 语义定义为“本地可得创建时间”

新增字段：

```text
createdAt?: string
```

该字段的语义不是“跨机器绝对真实创建历史”，而是“当前工作区可稳定取得的创建时间展示值”。

来源优先级：

1. 若 OpenSpec CLI 或 change metadata 已提供明确创建时间，直接采用。
2. 若 CLI 无该字段，则由 extension host 在列举 change 时尝试从本地文件系统推导一个稳定 fallback。
3. 若推导失败或解析失败，则不显示 `Created`，只保留 `Updated`。

约束：

- `createdAt` 仅在 extension host 填充，webview 只负责格式化展示。
- `createdAt` 可以进入 `searchText`，但不能成为唯一搜索命中依据。
- `createdAt` 不参与 status 计算、不决定排序、不影响 archive/verify/apply。

之所以不把该逻辑放在 webview：时间来源和 fallback 属于数据边界问题，应由 extension host 统一收口，避免前端根据残缺字段猜测。

### 5. 图标体系采用 Codicons，而不是引入新的 UI toolkit

采用 `@vscode/codicons` 作为图标来源，用于 copy、check、open、refresh 等图标按钮。

原因：

- 它与 VS Code / Cursor 环境视觉一致，能更自然地嵌入现有 webview。
- 只引入图标系统，依赖面小，不会改变当前 React 渲染模型。
- 比引入已 deprecated 的 `@vscode/webview-ui-toolkit` 更稳妥，也比混入 `@vscode-elements/elements` 这类 Web Components 方案更符合当前代码结构。

降级规则：

- Codicons 资源异常时，按钮交互仍保留，至少要有可点击区域、tooltip、`aria-label`。
- 必要时允许退化为短文本或普通符号，不能因为图标失败而丢失操作能力。

### 6. 复制 change name 只复制纯名称，并使用瞬时成功反馈

复制按钮放在 change name 旁，复制内容固定为当前 change 的纯名称。例如：

```text
polish-dashboard-change-detail-ui
```

不拼接 `/opsx:*` 命令，不附带额外描述。

交互决策：

- webview 继续复用既有 `copyToClipboard` 消息。
- extension 继续负责真实剪贴板写入与全局通知。
- webview 允许本地切换 `copy -> check` 的短暂成功态，约 1.2 秒后恢复。
- 失败时不显示成功态，保留 extension 侧错误提示或静默回落。

### 7. 仅使用克制动效，服务状态可感知性

动效策略：

- 卡片 hover/focus：背景或边框轻微过渡，约 `120ms`。
- quick actions 显隐：`opacity` 淡入，可叠加轻微位移，约 `120-160ms`。
- progress bar 宽度变化：约 `160ms ease-out`。
- copy 成功态：图标淡入淡出，约 `120ms`，持续约 `1.2s`。
- step indicator 当前态切换：颜色/填充过渡，约 `160ms`。

禁止项：

- 不做大幅浮起、重阴影、shimmer、长 skeleton。
- 不做引发布局跳动的宽高动画。

可访问性要求：

- 必须提供 `prefers-reduced-motion` 分支，减少 transform 和过渡动画。
- keyboard focus 与 hover 触发的可见状态必须一致，不能只优化鼠标路径。

### 8. 数据流保持现有消息通道，只扩展 `ChangeInfo`

extension 与 webview 的数据流保持原路径：

```text
OpenSpec CLI / filesystem
        |
        v
DataManager.listChangesWithFallback()
        |
        v
DataManager.enrichChangesWithProposalWhy()
        |
        v
DashboardData.changes: ChangeInfo[]
        |
        v
webview postMessage({ type: "dashboardData", data })
        |
        v
Dashboard / ChangeCard / ChangeDetail 消费展示
```

消息与数据边界决策：

- 不新增新的 dashboard 消息类型；继续使用 `dashboardData` 下发变更列表。
- `ChangeInfo` 的 extension 侧和 webview 侧接口都要增加可选 `createdAt`。
- `refresh`、文件监听触发的刷新、任务勾选后的回刷，仍走既有 `DataManager.refresh()` / `getDashboardData()`。
- copy、open、workflow action 继续复用既有 `copyToClipboard`、`openChangeDetailInEditor`、`launchWorkflowAction` 等消息，不新增平行协议。

### 9. 错误与降级采用“缺字段不阻断、缺资源不失能”

降级规则固定如下：

- `createdAt` 缺失或不可解析：不显示 `Created`。
- `lastModified` 缺失或不可解析：隐藏 `Updated` 文案或维持现有 fallback，不阻断卡片渲染。
- Proposal Why 提取失败：保留 card，只缺少摘要。
- Codicons 加载失败：按钮退化但仍可操作。
- copy 失败：不显示成功图标，不污染 change 状态。
- 窄宽度下：header 工具自动换行；workflow action bar 保持独立一行；不允许标题与按钮互相覆盖。
- archived change：复制、打开、刷新仍可用；所有写操作保持既有只读约束。

## Risks / Trade-offs

- [Risk] `createdAt` fallback 依赖本地文件系统，跨机器一致性有限  
  → Mitigation: 在设计与实现中明确其仅为展示值，不参与业务判断。

- [Risk] Dashboard 与 ChangeDetail 同时调整，容易出现交互语义分叉  
  → Mitigation: 通过共用 primitive、统一 icon/button 约束和消息边界减少分叉。

- [Risk] hover-only action 在窄侧边栏和键盘路径下可发现性不足  
  → Mitigation: focus 态与 hover 态同等触发，必要时保留明确的 focus ring 和 tooltip。

- [Risk] Codicons 接入可能带来样式尺寸不一致  
  → Mitigation: 通过单一 `IconButton` primitive 统一尺寸、对齐、tooltip 和成功态。

- [Risk] 头部双区布局在窄宽度下容易拥挤  
  → Mitigation: 允许右区按钮换行，但不把 workflow actions 挤回 header。

## Migration Plan

1. 扩展 extension 与 webview 两侧 `ChangeInfo` 类型，加入可选 `createdAt`。
2. 在 `DataManager` 的 change 列举链路中补充 `createdAt` 采集与 fallback，同时决定是否把格式化后的 created 文本并入 `searchText`。
3. 重构 Dashboard `ChangeCard` 的信息顺序与 hover/focus actions 布局。
4. 重构 ChangeDetail 顶部为双区布局，移除 `Show in sidebar`，加入 copy 按钮并保留 `Open in Editor` / `Refresh`。
5. 接入 Codicons 和轻量 `IconButton` 类 primitive，统一 tooltip、aria 与成功态样式。
6. 为动效、窄宽度和降级路径补测试与 smoke 验证。

回滚策略：

- 若 `createdAt` 链路不稳定，可先保留 UI 结构调整，只移除 `Created` 展示。
- 若 Codicons 接入异常，可暂时退回文本按钮，但保留分组与布局决策。

## Testing / Debugging Boundaries

本 change 的验证边界固定如下：

- 单元测试重点放在 `ChangeInfo` 扩展、`createdAt` fallback、searchText 合并、Dashboard/ChangeDetail 条件渲染、copy 消息发送、`Show in sidebar` 移除、workflow/工具按钮分组不串位。
- 不在这个 design 范围内引入重型 e2e；布局与动效以组件测试 + 手动 smoke test 为主。
- 构建验证以 `pnpm run build` 为基线。
- 行为调试以 VS Code Extension Development Host 为主，Cursor 只做兼容 smoke test，不作为主调试真相源。
- 由于 workflow routing 仍复用现有消息协议，验证重点是“UI 分组变化不破坏既有 command 行为”，而不是重测 CLI 业务本身。

## Open Questions

无。当前设计所需的关键决策已收敛，后续 specs 与 tasks 应直接基于本 design 展开。
