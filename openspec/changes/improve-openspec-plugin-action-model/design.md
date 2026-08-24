## Context

本 Change 的产品边界与方案选择见 [explore.md](./explore.md)，规范约束见 `specs/`。当前实现已有可复用的 Project/root binding、Project Sidebar 数据网关、CLI 状态读取、缓存、文件监听和多种 workflow adapter，但状态在进入 Webview 前被压缩：`OpenSpecCli` 的 artifact normalizer 只保留 id/outputPath/status，`workflowState.ts` 再以固定数组重建 Proposal → Specs → Design → Tasks → Apply → Verify → Archive。

Change Detail 目前只接收 `existingArtifactIds`，固定创建 tabs，并通过 `FileManager.getArtifactPath()` 猜测未知 artifact 的 `<artifact-id>.md`。`launchWorkflowAction` 已能得到 adapter 的 success/message，但没有 request-correlated 结果回传。Project binding 与 scope-aware panel key 已存在，因此本设计扩展这条链路，不建立新的工作流引擎。

## Goals / Non-Goals

**Goals:**

- 无损保留 CLI status 的动态 artifact graph，并绑定 producing root。
- 用一个纯函数 resolver 为 Sidebar、Change Detail 和 Dashboard 生成一致动作。
- 让活动 Change 从 status-owned concrete paths 安全读取任意 schema artifact。
- 在现有 adapter/terminal/CLI 路径上补充可观察的 action receipt。
- 通过现有缓存和 refresh 流程更新状态，避免每项 instructions 预取。
- 保留窄 Sidebar、宽 Dashboard 和 Change Detail 各自的信息密度与职责。

**Non-Goals:**

- 不实现插件自有 artifact registry、workflow database 或执行队列。
- 不修改 OpenSpec CLI，不扫描目录来补齐 CLI 未声明的活动 artifact。
- 不替换现有 adapter、Interactive Agent Terminal、缓存或 ProjectDataGateway。
- 不全面重写 Dashboard、Specs 或 Workset 产品面。
- 不要求 archived 数据具备与活动 Change 相同的 schema-aware status；归档视图继续安全只读。

## Decisions

### 1. 扩展现有 Change DTO，而不是建立第二套状态服务

在 shared 层定义可序列化的 `ChangeWorkflowSnapshot`、`ArtifactNode`、`ResolvedWorkflowActions` 和 `WorkflowActionReceipt`。`OpenSpecCli` 在已有 `list + status` 流程中完成 status normalization，并将 snapshot 附加到现有 Change DTO；`ProjectDataGateway`、Dashboard cache 和 Webview message 沿现有数据流透传。

```text
openspec list --json
        │
        ├── each change: status --json
        │          │
        │          ▼
        │  normalize status + artifactPaths
        │          │
        ▼          ▼
   ChangeInfo + ChangeWorkflowSnapshot
                  │
          ProjectDataGateway
                  │
        existing cache / provider
                  │
                  ▼
               Webview
```

Normalization 规则：

- 接受 `done`、`ready`、`blocked`、`skipped`，继续兼容 CLI 的 `complete → done` 别名。
- 保留 CLI artifact declaration order、`requires`、`missingDeps`、`outputPath`。
- 将 status-owned `artifactPaths[id].existingOutputPaths` 合并到对应 node，不从磁盘猜测。
- 未识别的状态按不可执行处理并记录诊断，不将其乐观映射为 done/ready。
- snapshot 携带由现有 `OpenSpecRootBinding` 稳定序列化得到的 `bindingKey`。

**Alternative:** 新建常驻 WorkflowService 并维护独立缓存。拒绝，因为现有 list/status、ProjectDataGateway 和缓存已经覆盖生命周期；再加服务会产生第二份真相。

### 2. Resolver 是 shared 纯函数，界面不再各自推导 lifecycle

用一个无副作用函数 `resolveWorkflowActions(snapshot, context)` 替代 `workflowState.ts` 的固定 step 数组和 Sidebar 的独立 lifecycle action map。它只返回展示/路由所需的动作描述，不执行 I/O。

```text
ChangeWorkflowSnapshot
  ├─ ordered artifacts
  ├─ planningComplete / task progress
  ├─ archived / delta specs
  └─ bindingKey
             │
             ▼
   resolveWorkflowActions()
  ├─ recommended
  ├─ available[]
  ├─ blocked[]
  ├─ highImpact[]
  └─ attentionReasons[]
       │          │          │
       ▼          ▼          ▼
    Sidebar    ChangeDetail Dashboard
```

Resolver 不生成文件路径、不调用 CLI，也不解析 `nextSteps` 文本。planning 时第一个 ready artifact 决定推荐文案，其他 ready artifact 保持可见；真正执行仍发送通用 action（如 `continue`）。Apply、Verify、Archive、Sync Specs 的边界只依据 snapshot 中的正式状态和现有专用执行能力。

**Alternative:** 只统一 CSS/组件、保留两套推导。拒绝，因为视觉一致不能防止动作语义继续漂移。

### 3. 活动 artifact 读取由 host 重新解析当前 status 路径

Webview 发送 `changeName + artifactId + optional outputPath` 作为选择意图；Extension Host 不信任 Webview 提交的路径。Host 在 panel 的不可变 binding 下取得当前 snapshot，要求所选 output 是该 artifact 当前 `existingOutputPaths` 的成员，完成 realpath/containment 后再读取或打开。

```text
Webview selection
  { changeName, artifactId, outputPath? }
                │
                ▼
ChangeDetailPanel boundScope / bindingKey
                │
                ▼
fresh or matching cached status snapshot
                │
     membership + canonical containment
          ┌─────┴─────┐
          ▼           ▼
       read/open    fail closed
```

单一 Markdown 输出进入现有 Markdown renderer；多个输出先展示文件列表。Specs 和 Tasks 继续使用专用 renderer，但其文件集合也来自 snapshot。`FileManager.getArtifactPath()` 保留给仍需 conventional path 的兼容/归档路径；活动自定义 artifact 不再走默认 `${artifactId}.md` 分支。

**Alternative:** Webview 直接发送绝对路径并由 Host 打开。拒绝，因为 Webview 数据不能成为文件访问授权来源。

### 4. Change Detail 获取完整 snapshot，panel binding 保持不可变

`ChangeDetailPanelManager` 的 panel key 和 bound scope 继续作为隔离基础。打开 Detail 时，Host 为该 binding 解析当前 Change snapshot并发送；来自卡片的旧 snapshot 只能用于即时占位，不能覆盖 Host 解析结果。Sidebar Project picker 改变浏览上下文时，不修改已打开 Detail 或宽 Dashboard 的 binding。

同名 Change 的 cache key、artifact request、receipt 和 invalidation message 都包含 binding key。收到不同 binding 或过期 request id 的消息时，Webview 丢弃。

**Alternative:** scope 切换时重用同一个 panel 并替换数据。拒绝，因为同名 Change 会产生无法察觉的跨 root 串线。

### 5. 在现有消息协议上增加 snapshot/output/receipt 消息

不建立 event bus。扩展现有 discriminated union 与 `sendMessage` helper：

- Host → Webview：完整 Change snapshot 或随现有 dashboard/sidebar payload 携带 snapshot。
- Webview → Host：artifact output 选择包含 `artifactId`、可选 `outputPath`、`scopeId/bindingKey`。
- Webview → Host：`launchWorkflowAction` 增加前端生成的 `requestId` 和 binding key。
- Host → Webview：`workflowActionReceipt` 携带 requestId、changeName、bindingKey、action、target、status、message。

```text
Webview                         Extension Host                       Adapter
   │                                  │                                │
   │ launchWorkflowAction(requestId)  │                                │
   ├─────────────────────────────────►│ validate binding/action         │
   │                                  │──────── launch ────────────────►│
   │ receipt(pending/running)         │                                │
   │◄─────────────────────────────────┤                                │
   │                                  │◄──── observable result ─────────┤
   │ receipt(delivered/copied/        │                                │
   │         fallback/completed/failed)                                │
   │◄─────────────────────────────────┤                                │
   │                                  │ refresh existing data path      │
```

前端在发送前即可将 requestId 标记 pending 以防双击，但只有 Host receipt 决定 delivery 结果。Chat success 映射为 delivered，Clipboard 为 copied，native adapter 失败后复制为 fallback；只有能观察到退出码的 Terminal/Agent CLI/OpenSpec CLI 才能报告 completed/failed。Verify/Archive 继续复用 `InteractiveWorkflowState`，只在 UI 层投影为相同的可见反馈，不替换 terminal manager。

**Alternative:** 继续只使用 VS Code toast。拒绝，因为 toast 无法与具体按钮、binding 和异步请求关联，也不能表达 fallback。

### 6. UI 采用三个密度层级，共享同一动作数据

- **Sidebar:** 保留 2×2 导航；Change card 只显示名称、lifecycle、推荐下一步、任务进度和“另有 N 个可用动作”。复杂/高影响动作打开 Detail。
- **Change Detail:** Header 展示 Change/schema/Project/Planning root；下方为一个主动作、可展开的其他动作、Completed/Available now/Blocked artifact 分组及动态内容区。移除活动 Change 的固定 `WorkflowStepIndicator` 与固定 tabs。
- **Dashboard:** 在现有 KPI/图表之前增加 Needs attention、Ready to verify、Recommended actions 三个轻量区块；不新增看板或时间线基础设施。

共享小组件只在至少两个界面需要完全相同的可访问交互时提取；其余保持现有组件内组合，避免为视觉统一创建新的组件层级。

### 7. 缓存继续可用，但旧 shape 不能产生动作

现有 memory/disk cache 继续缓存 Project Sidebar/Dashboard 数据。新增 snapshot 字段后更新 cache shape guard：

- matching memory cache 可以立即显示；
- disk cache 可作为 stale 内容显示，但仍触发统一 fresh reload；
- 缺少合法 snapshot 的旧 cache 可显示不依赖 workflow 的基本 Change 信息，但不能运行或推荐动作；
- fresh status 到达后替换旧数据并清除 stale 状态。

不单独持久化 receipts；panel 关闭或 Extension Host 重启后 receipt 消失，避免把一次交付状态误当成 OpenSpec 工作流状态。

### 8. instructions 保持按需，不扩大列表 N+1

列表与 Sidebar 继续使用当前 `list + status` 数据。只有 Detail 需要展示 CLI 指令上下文，或某个动作的安全前置确实依赖 instructions 时，才在当前 binding 下请求对应 instructions。通用 Chat command 的 skill 会自行加载正式上下文，插件不为每张卡片预取 instructions。

## Risks / Trade-offs

- **[Risk] `list + N status` 在大型 Store 中仍有成本** → 本 Change 不叠加 `instructions` N+1，复用现有并发、缓存和 watcher；后续只根据实际性能数据考虑 CLI 批量能力。
- **[Risk] CLI schema 增加未知 artifact status** → normalizer 保留诊断并按不可执行处理，避免乐观写操作；通过 fixture 测试锁定已支持状态。
- **[Risk] active 与 archived 数据能力不同** → 活动 Change 使用 status-owned paths；归档视图保持只读兼容且不伪造 artifact 完成状态。
- **[Risk] 多文件 artifact 使 Detail 变复杂** → 只增加文件列表与现有 viewer，不引入树编辑器或全文搜索。
- **[Risk] adapter 只能观察交付、不能观察 Agent 最终工作** → receipt 文案严格区分 delivered/copied 与 completed，不做推测。
- **[Risk] 旧缓存缺少 snapshot** → 禁用其 workflow 动作并立即 fresh reload，不回退到固定 lifecycle 推导。
- **[Trade-off] 一个 resolver 降低界面自由度** → 各界面仍可选择展示字段和动作密度，但不能改变动作语义。

## Migration Plan

1. 先用 fixtures 扩展 CLI status normalizer 与 shared DTO，保持现有界面继续读取旧字段。
2. 以 TDD 建立 shared resolver，覆盖 default/custom schema、parallel ready、blocked、skipped、Apply、Verify、Archive 和 Sync 边界。
3. 将 Project Sidebar/Dashboard payload 与 Change Detail panel 接入 snapshot，并更新 cache shape guard；旧缓存只读展示且触发 fresh reload。
4. 新增 host-authoritative artifact output 读取/打开路径和 containment 测试，再切换 Change Detail 动态导航。
5. 接入 request-correlated receipts，先覆盖 Clipboard/Chat/fallback，再映射已有 terminal/CLI 可观察状态。
6. 让 Sidebar 与 Dashboard 消费 shared resolver，并移除活动 Change 的固定 stepper/独立 lifecycle action 推导。
7. 运行 focused tests、全量 tests、ESLint、build、strict OpenSpec validation，并至少在一个受支持的 IDE Extension Development Host（VS Code 或 Cursor）验收窄 Sidebar、宽 Dashboard、动态 Detail 和真实 adapter 反馈；若另一宿主需要外部登录或不可用，将其记录为未验证的兼容性风险。

回滚时可整体回退新 snapshot/resolver/UI 提交；未修改 OpenSpec 文件格式或外部持久化数据。旧 disk cache 由 shape guard 自动失效，不需要迁移脚本。

## Open Questions

无阻塞问题。具体文案与文件列表布局在实现时以现有 i18n、VS Code theme tokens 和可访问性测试收敛，不改变规范语义。

## Spec Amendments

无。设计未发现需要修改当前 delta specs 的缺口。
