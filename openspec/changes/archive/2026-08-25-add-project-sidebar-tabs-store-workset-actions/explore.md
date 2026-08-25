<!-- Exploration output for openspec/changes/<change>/explore.md — input for proposal, not the contract. -->

## Clarified requirements and constraints

- Project-first Sidebar 顶部需要一个稳定的 2×2 action grid，固定顺序为 Changes、Specs、Worksets、Dashboard；New Change 与 Refresh 属于操作命令，不占用四宫格。
- Changes、Specs 和 Worksets 是 Sidebar 内的本地视图；切换它们不能创建 Editor Explorer，也不能因为点击而重新解析 OpenSpec root。
- Dashboard 是独立 Editor surface；点击第四格时打开或 reveal 单例 Dashboard Panel，不能继续复用窄 Sidebar 的页面布局。
- Worksets 入口是动态能力：当前 Project 属于至少一个官方 Workset 时启用并展示数量；没有成员关系、CLI 不支持或拓扑读取失败时保留格位并显示明确的禁用原因。
- Worksets 入口只打开本地 Project picker。Project member 表示切换 Sidebar Project；Workset 管理页的主操作才表示通过官方 CLI 打开整个 Workset。
- Project workspace 数据必须由 Host 在一个已验证的 Project binding 下统一组装，供 Sidebar 与 Dashboard 复用；不能为 Dashboard 建立第二套扫描器、Store/Workset registry 或事实源。
- Project 声明的 Store reference 必须来自官方 CLI 的 `context --json`/兼容 members shape；Store Specs 必须使用 `list --specs --json --store <id>` 并携带 Host 验证过的 Store binding。
- Workset whole-open 必须调用官方 `openspec workset open <name>` 普通输出命令，不得走 JSON 解析，也不得由插件自行生成 workspace 文件。
- Change Detail 与 Spec Detail 继续作为 binding-aware Editor 详情页；本 Change 不重构图 3 中 Tasks 分组和 Specs 分栏详情。
- 真实验收使用声明了 `aihelp-workspace` reference 的 `aihelp-knowledge-agent`，并覆盖同名 Project/Store Spec 隔离、Workset 两种粒度和 Dashboard 单例行为。

## Approaches considered

### A. 扩展当前 Change：四宫格 + 本地视图 + 独立 Dashboard（选择）

保持当前 5 个 capability delta 和 15 个 Task id，用现有 Project payload、缓存、Provider 和 Panel 能力完成图 1、图 2。图 3 的详情页重构另建后续 Change。

- 优点：一个共享数据快照解决主要交互问题，不重复规划 Dashboard 数据层。
- 代价：当前 Change 比原先“仅 Sidebar tabs”稍大，但仍可按现有 5 个任务组执行。

### B. Dashboard 另拆 Change

当前 Change 只处理 Sidebar/Workset，第四格暂时只能成为占位或旧页面入口。

- 优点：本次改动最小。
- 代价：用户确认的四宫格交互不能闭环，后续还会重复修改同一 Provider、消息协议和缓存测试。

### C. 同时重构 Change Detail Tasks/Specs

在 A 的基础上加入 Tasks 按标题分组、Specs 左右分栏以及对应解析和详情交互。

- 优点：三张参考图一次对齐。
- 代价：会跨入 Change Detail、Markdown task parser、Spec Viewer 和写操作边界，现有 15 个 Task 不足以表达风险。

## Agreed design direction

```text
OpenSpec CLI + verified Project binding
                  │
                  ▼
      Project workspace payload
      ├─ active + archived Changes
      ├─ Project Specs
      ├─ referenced Store Specs + bindings
      └─ Workset navigation
                  │
          one cache / one refresh
          ┌───────┴────────┐
          ▼                ▼
Project Sidebar      Project Dashboard Editor
┌────────┬────────┐  ├─ KPI
│Changes │ Specs  │  ├─ lifecycle distribution
├────────┼────────┤  ├─ artifact readiness
│Worksets│Dashboard│ └─ recent updates
└────────┴────────┘
```

Sidebar 默认显示 Changes。Changes、Specs、Worksets 只更新本地状态；Dashboard 发送一个明确的 Host message，Host 复用现有单例 Panel 和当前内存快照。显式 Refresh 或 watcher 更新时，Host 只组装一次 fresh payload，再分别以 `view: 'sidebar'` 和 `view: 'dashboard'` 发布给可见 surface。

## Source implementation findings

可吸收的模式：

- 使用 VS Code `view/title` 承载 New Change 与 Refresh，减少 Webview 内重复操作条。
- Dashboard Panel 单例复用，重复点击只 reveal。
- KPI、状态分布和 Artifact Readiness 的信息层级。
- 后续 Change 可吸收 Tasks 按 H2 分组、Specs 左侧文件列表与右侧内容的展示方式。

明确不吸收：

- 反编译插件自己的文件系统扫描器、module-global workspace cache 和直接 artifact 写入路径；本工程继续以 OpenSpec CLI 与已验证 binding 为事实源。
- 从 proposal/design/specs 中扫描 checkbox 的任务统计算法；任务数只使用 ChangeInfo 的官方/Host 派生 task totals。
- Chart.js CDN、自定义主题切换和基于文件 mtime 伪造的任务进度时间线。
- 为一个 Dashboard consumer 新增 DTO、cache kind、registry 或统计服务。

## Key decisions

- 保留并扩展现有 `ProjectSidebarData` 作为共享 Project workspace 快照；不并存 `DashboardDataV2`。
- 保留现有 Project page cache；Dashboard 点击读取内存快照，不新增 Dashboard cache entry。
- 四宫格是混合 action launcher，不伪装成统一 ARIA tablist；本地视图按钮使用 `aria-pressed`，Dashboard 使用普通打开动作语义。
- Dashboard 的 “Complete” 改用现有 lifecycle 的 “Ready to Verify”，避免把任务完成误写成流程结束。
- Dashboard 指标只统计当前 Project binding：Store Specs 不进入 Project change/task/readiness 汇总。
- Dashboard 不展示无可靠数据源的历史图；用 `lastModified` 排序的 Recent Updates 替代。
- Change/Spec detail 路由、legacy scope/store 管理、watcher 与 workflow delivery 保持兼容。
