<!-- Exploration output for openspec/changes/improve-openspec-plugin-action-model/explore.md — input for proposal, not the contract. -->

# OpenSpec 插件 Action Model 与交互层级探索

## Clarified requirements and constraints

### 要解决的问题

当前插件已经能够展示 Change、Specs、Worksets 和 Dashboard，也具备 Chat、CLI、终端和剪贴板等执行通道；主要问题不是“缺少更多页面”，而是 UI 对 OpenSpec 工作流的表达仍然偏固定、偏线性，并且不同界面对同一个 Change 推导出了不同的下一步。

具体表现为：

- Change Detail 将工作流固定为 Proposal → Specs → Design → Tasks，再附加 Apply、Verify、Archive；但 OpenSpec schema 可以定义任意 artifact 依赖图，同一时刻可能有多个 artifact 同时 ready。
- Sidebar 使用 lifecycle 映射，Change Detail 使用另一套固定 workflow 推导，两个入口可能给出不同的推荐动作。
- UI 会显示看似精确的“创建某个 artifact”按钮，但当前实际发送的是通用 `/opsx:continue <change>`，并未真正指定 artifact。
- 未知 artifact 的文件位置会被前端/扩展端猜测，而 CLI status 已经提供 `artifactPaths`、`existingOutputPaths` 等更可靠的信息。
- 动作被发送到 Copilot Chat、Cursor、剪贴板、终端或 OpenSpec CLI 后，用户看不到清晰的目标、回退和结果状态，容易把“已填入/已复制”误认为“已执行完成”。
- Dashboard 偏重统计，Sidebar 卡片重复 artifact 徽标，真正需要用户处理的下一步不够突出。
- Project、Planning root、Store 和 Workset 的语义容易混在一起；其中 Workset 只是本地项目打开器，不应成为 Change 工作流的事实源或作用域。

### 当前实现中应保留的基础

- `OpenSpecCli.listChanges()` 已使用 `list --json`，并通过每个 Change 的 `status --json` 补充 schema 状态。
- `ChangeDetailPanelManager` 已建立 Project/root binding，可继续作为面板隔离和同名 Change 防串线的基础。
- 现有 Chat、Cursor、Clipboard、CLI 和 Terminal adapters 可继续承担交付，不需要新建执行引擎。
- 现有文件监听、缓存、Project Sidebar 数据网关和 refresh 机制继续复用。
- Verify、Archive 等高影响动作继续沿用已有专用执行路径，不合并成模糊的通用按钮。

### 产品目标

本 Change 让插件成为 OpenSpec 在 VS Code 和 Cursor 中的可靠 GUI 操作层：

1. UI 忠实展示 CLI 当前给出的 artifact 图和 Change 状态。
2. 三个主要界面共享同一套动作推导，避免互相矛盾。
3. 每次只强调一个推荐动作，同时保留其他当前可执行动作。
4. 用户在执行前知道动作会送往哪里，执行后知道是已填入、已复制、运行中、完成、回退还是失败。
5. 继续保持 Project-first，明确区分当前 Project、Planning root 和 Workset。

### 本 Change 范围

纳入范围：

- 建立由 CLI status 驱动的动态 artifact graph/snapshot。
- 建立 Sidebar、Change Detail、Dashboard 共用的 action resolver。
- 将活动 Change 的 artifact 内容改为依据 CLI 返回路径动态展示。
- 重构 Change Detail 的信息层级和主动作区，移除固定线性 stepper。
- 将 Sidebar 改为紧凑的“状态 + 下一步 + 任务进度”入口。
- 在 Dashboard 顶部增加 action-first 的待处理信息，但保留现有统计能力。
- 为 Chat、Cursor、Clipboard、Terminal 和 OpenSpec CLI 动作提供目标标识与结果回执。
- 补充自定义 schema、并行 ready、blocked、skipped、多文件 artifact、同名 Change/root 隔离等验证场景。

明确不纳入：

- Specs 全文搜索、历史版本、演进关系等完整 Specs 产品化。
- Workset 两层导航或 Workset 管理体验的全面重做。
- Dashboard 图表、时间线、看板和动画的全面重写。
- 插件自建的工作流生命周期数据库或持久化执行编排器。
- 独立 artifact registry、目录扫描器或第二套 schema 解释器。
- 修改 OpenSpec CLI 或上游 OpenSpec 行为。
- 为未来可能出现的需求预留新的依赖或抽象层。

### 必须遵守的约束

- OpenSpec CLI 的 `status --json` 是 artifact 状态和依赖关系的事实源；UI 不自行推断 phase。
- `instructions` 只在 Detail 加载或用户触发具体动作时按需读取，不能在列表刷新时对每个 Change 预取。
- 不解析面向人的 `nextSteps` 文本来决定行为；推荐顺序来自 CLI 返回的有序 artifact 列表。
- 所有 snapshot 和动作都绑定不可变的 root/binding key；同名 Change 不能跨 Project 或 Store 串线。
- artifact 文件只使用当前 status 返回的具体路径，并在读取前检查路径包含关系；不猜文件名，不越出 Change/root 范围，异常时 fail closed。
- 保持高对比度、键盘操作、ARIA 语义和非颜色状态提示；动作目的地必须出现在可见文本中。
- Archive 等高影响动作保持独立确认和明确结果，不因 tasks 完成而自动推导为已归档。

## Approaches considered

| 方案 | 做法 | 优点 | 主要问题 | 结论 |
|---|---|---|---|---|
| A. 只修 UI | 替换 stepper、调整文案和卡片，但保留现有 host contract 与两套动作推导 | 改动最小，能快速改善截图效果 | 根因仍在；自定义 schema、并行 ready、路径和动作回执仍会错误 | 不采用 |
| B. CLI status 驱动的共享 Action Model | 扩展现有 host/webview 数据契约，建立 root-bound snapshot 和单一 action resolver，再由三个界面消费 | 与 OpenSpec 语义一致；复用现有 binding、缓存和 adapters；范围可控 | 需要同步调整数据契约、Detail 和两个摘要入口 | 采用 |
| C. 插件自建工作流引擎并全面重做 Shell | 插件维护 artifact registry、生命周期、执行队列和全新 Dashboard/Workset 信息架构 | 理论上控制力最强 | 重复 CLI 事实源，长期漂移，测试和迁移成本高，明显超出本 Change | 拒绝并不预留 |

选择方案 B。它修复状态与动作模型这一处共同根因，现有界面只负责投影，不引入第二套工作流系统。

## Agreed design direction

### 1. 单一事实流

```text
OpenSpec CLI
  list / status / on-demand instructions
                  │
                  ▼
       ChangeWorkflowSnapshot
       (immutable root binding)
                  │
                  ▼
          Shared Action Resolver
          ├─ recommended action
          ├─ other available actions
          ├─ blocked reasons
          └─ high-impact actions
                  │
          ┌───────┼────────┐
          ▼       ▼        ▼
       Sidebar  Detail  Dashboard
          │       │        │
          └───────┼────────┘
                  ▼
 Existing Adapter / CLI / Terminal
                  │
                  ▼
          WorkflowActionReceipt
```

`ChangeWorkflowSnapshot` 是现有 CLI 响应的稳定 UI 投影，不是新的持久化模型。概念字段如下，最终命名由 design/specs 再确定：

```ts
type ChangeWorkflowSnapshot = {
  changeName: string;
  schemaName: string;
  bindingKey: string;
  isPlanningComplete: boolean;
  isComplete: boolean;
  completedTasks: number;
  totalTasks: number;
  artifacts: ArtifactNode[];
};

type ArtifactNode = {
  id: string;
  outputPath: string;
  existingOutputPaths: string[];
  status: "done" | "ready" | "blocked" | "skipped";
  requires: string[];
  missingDeps: string[];
};
```

这组数据由现有 OpenSpec CLI service 和 Project binding 产生，并进入现有缓存/消息通道；不新增 registry 或后台服务。

### 2. 动作推导规则

- Planning 未完成时，从 CLI 返回的有序 artifacts 中取第一个 `ready` 节点作为 Recommended；其他 `ready` 节点仍显示在 Available now 中。
- `blocked` 节点显示依赖原因，但不可点击；`done` 和 `skipped` 分开表达，不能都伪装成“完成”。
- 当前 `/opsx:continue` 是通用继续动作，因此主按钮使用“Continue planning”，辅助文本显示“Next artifact: Specs；Also available: Design”。在 CLI/skill 真正支持目标 artifact 前，不提供误导性的 “Create Specs”/“Create Design” 执行按钮。
- Fast-forward 是 planning 未完成时的可选加速动作，不替代 Recommended。
- Planning 完成且仍有未完成 tasks 时，推荐 Apply。
- Tasks 完成后，推荐 Verify；Archive 仍作为独立高影响动作，不自动执行。
- 有 spec delta 时才显示 Sync Specs，不能作为所有 Change 的固定阶段。
- Archived Change 为只读历史记录；不能通过补齐固定步骤来制造“全部完成”的假象。

### 3. Change Detail 是完整操作面

Change Detail 承担复杂判断和高影响动作，结构调整为：

1. 顶部上下文：Change 名称、schema、Project、Planning root（Local/Store）和当前状态。
2. 主动作区：一个 Recommended，其他可用动作渐进展开；按钮直接标注交付目标，例如 “Continue in Cursor Chat”。
3. Artifact graph 摘要：按 Completed、Available now、Blocked 分组，保留真实依赖而非固定线性阶段。
4. 动态 artifact 导航：只展示 CLI status 中存在的节点，并使用 `existingOutputPaths` 打开内容。
5. 内容渲染：单个 Markdown 使用通用 viewer；多个输出先显示文件列表；Specs 和 Tasks 继续复用现有专用渲染；缺失 artifact 不生成固定空标签页。
6. 结果回执：在动作附近显示 pending、delivered/copied、running、completed、fallback 或 failed，并提供简短下一步。

活动 Change 优先实现完整 schema-aware 展示。Archived Change 保持安全、只读兼容；本 Change 不承诺重做历史归档数据结构。

### 4. Sidebar 是紧凑的下一步入口

- 保留当前稳定的 2×2 导航：Changes、Specs、Worksets、Overview。
- Change 卡片减少重复 artifact badges，突出 lifecycle、推荐下一步和 task progress。
- 提供紧凑的 Next action；并行可用动作通过数量或简短文本提示，完整选择进入 Detail。
- Sidebar 不直接承载 Archive 等复杂/高影响流程。
- Project picker 只改变 Sidebar 浏览上下文；已打开的 Dashboard/Detail 继续保持各自不可变 binding，除非用户明确重新打开。

### 5. Dashboard 先回答“现在要做什么”

本 Change 不重做整套 Dashboard，只调整首屏优先级：

1. Needs attention：阻塞、失败、缺少依赖或需要人工处理的 Change。
2. Ready to verify：tasks 已完成但尚未验证的 Change。
3. Recommended actions：当前最值得继续的 Change 及其下一步。
4. 现有 KPI、artifact readiness、进度图表继续保留在下方。

这样 Dashboard 从纯统计面板变成操作入口，同时避免引入看板、时间线等新产品面。

### 6. Project、Store 与 Workset 的上下文表达

- `Project` 表示用户当前浏览/操作的项目。
- `Planning root` 表示 Change/Specs 的真实来源，并明确标记 Local 或 Store。
- `Workset` 只负责按已有配置打开一组本地项目，不成为 artifact 状态、动作推导或 root binding 的来源。
- 本 Change 只修正文案、层级和绑定提示；Workset 的完整信息架构留给独立 Change。

### 7. 动作目标与结果回执

概念回执结构如下：

```ts
type WorkflowActionReceipt = {
  requestId: string;
  action: string;
  target:
    | "copilot-chat"
    | "cursor-chat"
    | "agent-cli"
    | "clipboard"
    | "terminal"
    | "openspec-cli";
  status:
    | "pending"
    | "delivered"
    | "copied"
    | "running"
    | "completed"
    | "fallback"
    | "failed";
  message?: string;
};
```

语义要求：

- 打开或预填 Chat 只报告 delivered，不报告 completed。
- 复制到剪贴板只报告 copied；从其他 adapter 回退到剪贴板必须明确显示 fallback。
- Terminal/OpenSpec CLI 只有在能观察到真实退出结果时才报告 completed/failed。
- 同一动作 pending 时禁用重复触发；动作完成后通过现有 refresh 机制重新读取 CLI 状态，而不是乐观修改本地 lifecycle。

### 8. 性能、安全与验证边界

- 列表刷新保持 `list + status` 的现有模式；本 Change 不再叠加每项 `instructions` 请求。
- `instructions` 仅用于 Detail 的补充信息或动作触发前的即时上下文。
- snapshot、缓存键、面板消息和 receipt 都携带 binding key；收到过期 binding 的消息直接丢弃。
- 文件读取使用 status 当次返回的实际路径，逐个做 root containment 和存在性检查；路径异常时展示不可用原因，不回退到猜测路径。
- 重点验证：自定义 schema、两个并行 ready artifacts、blocked/missing dependencies、skipped artifact、单/多文件输出、同名 Change 跨 root 隔离、adapter 回退、重复点击抑制和 refresh 后状态一致性。

## Key decisions

1. **CLI status 是唯一工作流事实源。** 插件只做 root-bound UI projection，不维护第二套 phase/lifecycle 真相。
2. **只保留一个 action resolver。** Sidebar、Detail 和 Dashboard 使用相同输入和规则，界面差异仅在信息密度与可执行动作范围。
3. **推荐不等于唯一允许。** 第一个 ready artifact 获得主视觉，其他 ready artifacts 始终可见。
4. **不伪造 artifact 定向执行。** 在通用 `/opsx:continue` 不能选择 artifact 时，UI 使用诚实的通用动作名称。
5. **路径由 status 提供。** 删除未知 artifact 的文件名猜测方向，动态内容读取必须经过绑定和 containment 检查。
6. **Change Detail 是主操作面。** Sidebar 负责快速继续，Dashboard 负责跨 Change 排优先级，高影响动作集中到 Detail。
7. **复用现有 adapters 和执行路径。** 只补充目标标识和 receipt，不建立执行队列、registry 或插件自有 workflow engine。
8. **状态回执描述可观察事实。** “已预填”“已复制”“运行中”和“已完成”严格区分，回退不得静默。
9. **Workset 不参与工作流建模。** Project/root binding 决定数据与动作作用域，Workset 仅是本地打开能力。
10. **Dashboard 只做 action-first 增量。** 先把待处理和推荐动作放到首屏，完整分析面板重构不进入本 Change。
11. **无额外依赖。** 使用现有 TypeScript、React、Radix、Tailwind、CLI service、缓存和消息通道完成。
12. **后续正式工件拥有约束权。** proposal/specs/design 若与本探索产生冲突，需要显式解决；本文件本身不替代需求契约。
