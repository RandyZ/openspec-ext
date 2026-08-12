# Explore: Change 生命周期状态筛选与分页

## 1. 问题背景

当前 Changes 区域已经可以：

- 按 `draft / in-progress / complete` 分组；
- 根据已加载的 Change 元数据本地搜索；
- 展示 Artifact 状态和任务进度；
- 单独展开 Archived Changes；
- 根据 Artifact 和 Task 状态推荐 Continue、FF、Apply、Verify、Archive 操作。

但这些能力之间没有统一的 Change 生命周期模型。

分页加入后，如果仍然先分页、再在当前页内按状态分组或筛选，会产生错误认知：

```text
完整数据 37 条
→ 先分页得到第 1 页 10 条
→ 再筛选 Applying
→ 页面只剩 2 条

用户看到 2 条，但实际 Applying 可能有 11 条。
```

此外，当前三状态不足以表达 OpenSpec 的真实推进阶段：

```text
Draft
Active
Completed
```

无法区分：

- 仍在补齐规划工件；
- 规划已完成、尚未开始 Apply；
- Apply 执行中；
- Tasks 已完成、等待 Verify；
- 已归档。

## 2. 当前实现观察

### 2.1 ChangeInfo 的状态过于粗粒度

当前 `ChangeInfo.status` 为：

```ts
'draft' | 'in-progress' | 'complete'
```

状态主要由任务总数和完成数推导：

```text
totalTasks = 0                  → draft
completedTasks = totalTasks    → complete
otherwise                       → in-progress
```

这会把以下两类 Change 混在一起：

```text
已有全部规划工件，但尚未执行任务
正在执行部分任务
```

### 2.2 ChangesSection 负责分组，但没有一级状态筛选

当前 `ChangesSection`：

- 在 React 中按三状态分组；
- 搜索后仍保留分组；
- Archived 在列表底部使用独立折叠区域；
- 没有分页状态模型；
- 没有稳定的全量状态计数。

### 2.3 ChangeCard 独立推导智能操作

`ChangeCard.getSmartActions()` 再次根据：

- Artifact 是否全部 `done`；
- Tasks 是否全部完成；

推导快捷操作。

因此当前至少存在两套状态推导：

```text
DataManager / CLI：draft | in-progress | complete
ChangeCard：Continue | FF | Apply | Verify | Archive
```

未来加入筛选后，如果状态栏和快捷操作继续分别推导，可能出现：

```text
卡片显示 Ready to Verify
但快捷操作仍显示 Apply
```

### 2.4 Archived 是独立数据结构

Archived Change 当前只包含：

```ts
directoryName
name
archiveDate
```

它适合只读浏览，但尚未进入统一状态筛选和分页管线。

## 3. 用户目标

用户进入 Changes Workspace 后，希望快速回答：

1. 当前 Root 有多少 Change？
2. 有多少仍在规划？
3. 有多少可以开始 Apply？
4. 有多少正在 Apply？
5. 有多少等待 Verify？
6. 有多少已经 Archived？
7. 当前筛选结果总共有多少条，而不是当前页有多少条？
8. 切换 Root 后，是否会保留每个 Root 自己的工作视图？

## 4. 生命周期模型候选

### 方案 A：保留三状态，仅增加筛选

```text
Draft / Active / Completed / Archived
```

优点：

- 实现最小；
- 与当前类型兼容。

缺点：

- 不能表达 Ready to Apply 和 Ready to Verify；
- 与智能操作阶段不一致；
- 用户仍然无法快速识别下一步。

不采用。

### 方案 B：完全使用 Artifact 状态作为筛选

```text
Done / Ready / Blocked
```

优点：

- 直接来源于 OpenSpec CLI。

缺点：

- Artifact 状态不是 Change 生命周期；
- `blocked` 常常只是正常的依赖状态，不代表异常；
- 一个 Change 可以同时存在多种 Artifact 状态。

不采用。

### 方案 C：引入 ChangeLifecycleStatus

```text
planning
ready-to-apply
applying
ready-to-verify
archived
```

同时增加正交诊断维度：

```text
needsAttention: true | false
```

优点：

- 与用户下一步动作一致；
- 可以作为筛选、卡片状态和智能操作的统一输入；
- 不会把 Artifact `blocked` 错误解释为异常；
- 可以逐步兼容当前三状态。

采用。

## 5. 状态推导原则

### 5.1 生命周期状态

```text
Archived
  → archived

必要 Schema Artifact 尚未全部 done
或没有 Tasks
  → planning

必要 Artifact 全部 done
Tasks 存在且 completed = 0
  → ready-to-apply

0 < completed < total
  → applying

total > 0 且 completed = total
  → ready-to-verify
```

### 5.2 必要 Artifact 的来源

不得在新代码中再次硬编码：

```text
proposal / specs / design / tasks
```

推导应以 CLI 返回的 Schema Artifact 列表及其状态为准。

兼容文件系统 fallback 时，可以沿用现有扫描结果，但必须明确标记数据来源，并避免把未定义工件纳入生命周期阻塞条件。

### 5.3 Needs Attention

`Needs Attention` 不是生命周期状态，而是可以叠加的诊断筛选。

第一版可由以下情况触发：

- Change 状态或 Artifact 状态解析失败；
- Artifact `outputPath` 缺失或非法；
- 读取 Change 元数据失败；
- 当前 Root 健康诊断阻止该 Change 的读写；
- Validation 结果明确失败（如果已有数据）。

以下情况不能单独触发 Needs Attention：

- 某个 Artifact 处于正常依赖导致的 `blocked`；
- 尚未创建下一工件；
- Tasks 尚未开始。

## 6. 筛选、搜索、排序和分页顺序

必须固定为：

```text
当前 Root 的完整 Change 集合
→ 生命周期状态筛选
→ Needs Attention 等高级筛选
→ 搜索
→ 排序
→ 分页
```

状态数量基于当前 Root 的完整数据集统计，不受：

- 当前页；
- 搜索词；
- 排序方式；

影响。

筛选、搜索或排序发生变化时，页码回到第 1 页。

## 7. Archived 的产品行为

Archived 作为一级状态筛选显示。

`All` 包含：

```text
active changes + archived changes
```

Archived 项使用只读卡片，不展示写操作。

为了兼容现有数据结构，第一版不必把 Archived 强行改造成完整 `ChangeInfo`。Webview 可以将 active 与 archived 映射为统一的 `ChangeListItemView` 后进入展示管线。

## 8. Root 级视图状态

筛选状态必须按 Root 独立保存：

```text
Local Root
→ Applying / 第 2 页

Store: team-plans
→ Ready to Verify / 第 1 页
```

推荐使用：

```ts
vscode.getState()
vscode.setState()
```

保存键至少包含：

```text
scope.id
```

如果 scope id 不稳定，则使用：

```text
source + rootPath + storeId
```

构造稳定键。

## 9. 响应式策略

Editor 宽屏：

```text
[All 17] [Planning 5] [Ready 3] [Applying 4] [Verify 2] [Archived 3]
```

Sidebar 窄屏：

```text
[Status: Applying (4) ▼]
```

两种布局必须共享同一个状态模型。

## 10. 变更边界

本 Change 不处理：

- Store 注册与项目 Store 关联的语义拆分；
- Workset 侧边栏列表；
- Store Quick View；
- 动态 Artifact 详情页改造；
- 后端/CLI 服务端分页；
- 新增 OpenSpec CLI 能力。

这些应作为独立 Change 交付，避免状态筛选改造被跨领域需求阻塞。

## 11. 最终方向

采用：

```text
Extension Host 统一推导生命周期与计数
→ Webview 执行纯本地筛选、搜索、排序和分页
→ ChangeCard 直接消费生命周期状态
→ 每个 Root 独立保存视图状态
```

第一版继续全量加载当前 Root 的 Change。未来只有在 Change 数量明显增长并造成性能问题时，才升级为 Host 查询式分页。

## 12. 与当前代码的进一步核对

本次探索对照了当前 Extension Host 和 Webview 实现，确认了几个会影响落地顺序的事实：

- `DataManager.runRefresh()` 当前已经在同一次 Root 刷新中并行取得 Active Change、Specs 和 Archived Change；因此首版不需要新增 Archived 专用 CLI 调用，也不应为了分页引入服务端查询。
- `DashboardData` 当前没有生命周期计数，`ChangeInfo` 仍只有 legacy `draft / in-progress / complete` 状态；生命周期和计数必须在 Host 发布数据时一次性补齐。
- `ChangesSection` 的搜索状态是组件本地状态，分页前没有统一的纯函数管线；实现时不能继续在 React render 中分散 `filter`、`sort`、`slice`。
- `ChangeCard.getSmartActions()` 会根据 Artifact/Task 再次推导阶段；它必须改为消费 Host 提供的生命周期状态，否则状态标签和操作按钮仍可能不一致。
- 当前 `openArtifact` 仍按 Artifact ID 拼接 `${artifactType}.md`，动态 Schema、目录型 Artifact 和嵌套输出路径不属于本 Change，应保留为后续独立 Change。

## 13. 写入 Root 是实施前置约束

本 Change 不重新设计 OpenSpec Root 解析，也不实现 Store link/unlink；但在实际实现前，所有会改变 Change 状态的已有写操作必须显式绑定当前有效 Root：

```text
New Change / Archive / Task Toggle / Workflow Launch
→ 使用同一个 scopeId 解析 Effective Root
→ 读写、缓存失效、刷新都绑定该 Root
```

特别是 New Change、Archive 和创建 Artifact 的消息目前存在未携带 `scopeId` 的路径。若先实现筛选而不修复这个边界，用户在 Store 视图中操作时仍可能写入 Local Root。该修复应作为实施前置任务或独立 Change 完成，不应在本 Change 中扩展 Store 领域模型。

## 14. 收敛后的实施边界

本 Change 只负责：

```text
统一生命周期 → Root 全量计数 → 筛选/搜索/排序/分页 → Archived 一级视图 → Root 级视图状态
```

以下内容继续独立规划，避免和生命周期改造互相阻塞：

- Project Store 的关联、切换和断开语义；
- Store Quick View 与跨窗口打开策略；
- Schema-aware Artifact Inventory、Other Artifacts 和真实 `outputPath` 定位；
- Sidebar Workset 列表与完整 Workset Workspace。
