# Dashboard 与 Change Detail UI 优化设计

## 背景

`polish-dashboard-change-detail-ui` 的 proposal 已确认两个问题：

- Dashboard 侧边栏 change 卡片缺少创建日期，任务进度、更新时间、artifact 状态和 Proposal Why 摘要挤在一起，阅读成本偏高。
- Change Detail 顶部把 OpenSpec workflow 推进动作与 IDE/视图辅助动作混排，`Show in sidebar` 不再是高价值入口，且用户无法快速复制 change 名称。

这个 change 的目标是优化信息架构和操作分组，而不是重写整个 webview 组件体系。

## 目标

- Dashboard 卡片展示 `Created`，并提升 change 摘要、artifact、时间、任务进度的可扫描性。
- Change Detail 顶部拆分“对象身份和视图工具”与“OpenSpec workflow 推进动作”。
- 在 change name 旁提供复制按钮，复制纯 change name。
- 移除 Change Detail 顶部的 `Show in sidebar` 按钮。
- 保持 Verify/Archive 高影响 workflow 与普通工具动作隔离。
- 加入克制的动效，提高 hover、progress 更新、复制成功、刷新反馈的可感知性。
- 使用 VS Code/Cursor theme token 保持深浅主题一致。

## 非目标

- 不迁移到新的完整组件库。
- 不引入 `@vscode/webview-ui-toolkit`，该库已 deprecated，不适合作为新设计依赖。
- 不重构所有 UI primitives 或建立完整设计系统。
- 不改变 `launchWorkflowAction`、adapter routing、Verify/Archive terminal runner 的运行语义。
- 不改变 OpenSpec artifact 阅读、任务勾选、归档执行的业务流程。
- 不把创建时间作为 workflow、排序、归档或状态判断的真相源。

## 推荐方案

采用“信息架构重排 + 轻量组件封装”的方案。

```text
Dashboard Sidebar
└─ ChangeCard
   ├─ 身份：change name
   ├─ 摘要：Proposal Why
   ├─ 状态：artifact badges
   ├─ 时间：Created / Updated
   ├─ 进度：tasks count + percent + progress bar
   └─ 操作：hover/focus 后展示 workflow actions

Change Detail
├─ Header
│  ├─ 左：change name + copy button + status summary
│  └─ 右：Open in Editor / Refresh
├─ Workflow Step Indicator
├─ Workflow Action Bar
│  └─ Continue / FF / Apply / Sync 等推进动作
└─ Artifact Tabs + Content
```

这个方案保留当前 React + Tailwind + Radix + VS Code CSS variables 的技术路线，只在必要处补充轻量组件和样式约束。

## 组件库与图标决策

本次不引入完整 VS Code webview 组件库。

- `@vscode/webview-ui-toolkit` 不采用：它曾是 Microsoft 官方 webview component library，但已 deprecated，新功能不应依赖它。
- `@vscode-elements/elements` 暂不采用：它可以提供 VS Code 风格 Web Components，但会引入 Lit/Web Components 与当前 React/Tailwind/Radix 体系混搭成本。
- 推荐引入或使用 `@vscode/codicons`：它是 VS Code 官方产品图标系统，适合 `copy`、`check`、`open`、`refresh` 等 icon button，侵入小，能提升 VS Code 原生感。

需要沉淀的轻量 UI primitives：

- `IconButton`：统一 icon-only button 的尺寸、hover/focus、tooltip、aria-label。
- `DateLabel`：统一 Created/Updated 的解析、格式化和隐藏规则。
- `MetaRow`：用于 Dashboard card 的时间和任务进度元信息。
- `ActionGroup`：用于区分 workflow actions 与 workspace actions。

这些 primitives 应服务当前 change，不扩展成完整设计系统。

## Dashboard 卡片设计

推荐布局：

```text
┌────────────────────────────────────────┐
│ change-name                            │
│ Proposal Why 摘要，最多 2-3 行          │
│                                        │
│ [proposal] [design] [specs] [tasks]    │
│ Created Jun 10 · Updated Today         │
│ 22 / 22 tasks · 100%                   │
│ █████████████████████                  │
│                                        │
│ hover/focus: [Verify] [Archive]        │
└────────────────────────────────────────┘
```

层级规则：

- `change-name` 是对象身份，保持卡片内最醒目的文本。
- Proposal Why 是判断 change 价值的核心摘要，放在标题下方。
- artifact badges 表示结构状态，放在摘要之后。
- Created/Updated 单独成一行，避免和任务进度混在一起。
- 任务进度文本和 progress bar 靠近，形成一个状态组。
- workflow actions 不常驻展示，仅在 hover 或 keyboard focus 时展示。

交互规则：

- 点击卡片空白区域打开 Change Detail。
- 点击 hover/focus actions 不触发卡片打开。
- keyboard focus 卡片时也必须能访问 actions，不能只支持鼠标 hover。
- 长 Proposal Why 继续通过 tooltip 或等价 accessible hint 暴露完整内容。

## 创建时间语义

新增展示字段建议命名为：

```text
createdAt?: string
```

语义定义为“本地可得创建时间”，不是跨机器绝对历史真相。

来源优先级：

1. 如果 OpenSpec CLI 或 change metadata 提供明确 created 字段，优先使用。
2. 如果 metadata 不可得，extension host 使用本地工作区可得时间作为 fallback。
3. 如果获取或解析失败，不显示 Created，仅显示 Updated。

约束：

- `createdAt` 只用于 UI 展示和可选搜索文本。
- 不用它排序。
- 不用它判断 draft、active、complete。
- 不用它驱动 archive、verify、apply 或任何 workflow 行为。

## Change Detail 顶部设计

推荐布局：

```text
┌────────────────────────────────────────────────────────────┐
│ change-name                                  [Copy] [Open] [Refresh] │
│ 4 artifacts · 22/22 tasks complete                                  │
├────────────────────────────────────────────────────────────┤
│ Proposal ✓ ─ Specs ✓ ─ Design ✓ ─ Tasks ✓ ─ Apply ● ─ Verify ○ ─ Archive ○ │
├────────────────────────────────────────────────────────────┤
│ [Apply] [Sync Specs]                                             │
├──────────────── Tabs ──────────────────────────────────────┤
│ Proposal | Specs | Design | Tasks | Verify & Archive        │
└────────────────────────────────────────────────────────────┘
```

职责划分：

- Header 负责对象身份与视图工具。
- Header 左侧展示 change name 和状态摘要。
- change name 旁展示 copy icon button。
- Header 右侧展示 `Open in Editor`、`Refresh`。
- `Show in sidebar` 从顶部主要操作中移除。
- Workflow Step Indicator 继续展示 workflow 进度。
- Workflow Action Bar 只放推进流程的动作，例如 `Continue`、`FF`、`Apply`、`Sync Specs`。
- Verify/Archive 不作为普通 ActionBar 的主按钮或次按钮混入；相关入口保持高影响动作隔离。

Step Indicator 行为：

- 点击已完成 artifact 步骤切换到对应 tab。
- 点击当前 Continue/Apply 类步骤触发现有 workflow routing。
- 点击 Verify/Archive 相关步骤进入 `Verify & Archive` 入口，不直接运行高影响动作。
- archived change 保持只读，不触发写操作。

## Copy change name 交互

复制按钮使用 Codicons 的 copy 图标。

行为：

- tooltip/aria-label：`Copy change name` / `复制 change 名称`。
- 点击后发送现有 `copyToClipboard(changeName)` webview message。
- 成功时 extension 侧显示通知。
- webview 本地可短暂把 copy icon 切换为 check icon，约 `1.2s` 后恢复。
- 如果复制失败，不显示成功 icon，依赖 extension 错误通知或保持原状态。

复制内容示例：

```text
polish-dashboard-change-detail-ui
```

不包含 `/opsx:*` 命令、不包含 archive 前缀以外的额外描述。

## 动效设计

动效只服务可感知性，不做装饰性动画。

推荐动效：

- 卡片 hover/focus：背景色轻微变化，约 `120ms`。
- hover/focus actions：`opacity` 从 0 到 1，可加轻微 `translateY(2px -> 0)`，约 `120-160ms`。
- progress bar：宽度变化 `160ms ease-out`，用于任务进度刷新。
- Copy 成功：copy icon 到 check icon 的淡入淡出，约 `120ms`，`1.2s` 后恢复。
- Step indicator 当前步骤变化：圆点和文字颜色过渡，约 `160ms`。
- Refresh 后卡片状态变化：轻微背景 highlight，不闪烁。

不建议：

- 卡片大幅浮起或大阴影。
- 长时间 skeleton/shimmer。
- 导致列表高度明显跳动的展开动画。
- 会触发布局抖动的 width/height 动画。

可访问性约束：

```css
@media (prefers-reduced-motion: reduce) {
  /* 禁用 transform 和 progress 动画，只保留即时状态 */
}
```

## 数据流

```text
OpenSpec CLI / filesystem
        │
        ▼
Extension services
  - listChanges()
  - filesystem fallback
  - proposal why enrichment
        │
        ▼
ChangeInfo
  - name
  - completedTasks / totalTasks
  - lastModified
  - createdAt?
  - artifacts
  - proposalWhy...
        │
        ▼
Webview
  - ChangeCard 显示 Created / Updated
  - filter/search 可选择纳入 created 文本
```

数据边界：

- `ChangeInfo` 的 extension 和 webview 类型都需要包含可选 `createdAt`。
- `createdAt` 应在 extension host 填充，webview 只负责格式化和展示。
- search metadata 可以包含格式化后的 created 文本，但搜索不能依赖它作为唯一匹配源。

## 错误与降级

- `createdAt` 不存在或解析失败：隐藏 Created。
- `lastModified` 不存在或解析失败：隐藏 Updated 或沿用当前 fallback 行为。
- Codicons 加载失败：按钮仍保留可点击区域、tooltip 和 `aria-label`，必要时退化为短文本或普通符号。
- Copy 失败：不显示本地成功状态。
- narrow width：Header actions 自动换行；Workflow ActionBar 单独占一行，避免和标题互相挤压。
- archived change：复制、打开、刷新仍可用；workflow 写操作保持禁用或只读。

## i18n

新增或调整文案：

```text
change.created: Created {date} / 创建于 {date}
change.updated: Updated {date} / 更新于 {date}
action.copyChangeName: Copy change name / 复制 change 名称
action.copiedChangeName: Copied change name / 已复制 change 名称
```

原则：

- icon button 不依赖可见文本表达含义，必须有 tooltip 和 aria-label。
- 中文 tooltip 不要过长，避免窄侧边栏下遮挡。
- Existing English labels 保持自然，不把 workflow 命令文案翻译成不可识别的中文命令。

## 调试与验证方案

保持当前调试方案：

- 主调试环境：VS Code Extension Development Host。
- Cursor 验证环境：作为兼容 smoke test，不作为阻塞主调试路径。
- 构建验证：`pnpm run build`。
- 单元测试：`pnpm test`。

Cursor 说明：

- Cursor 基于 VS Code，理论上可使用 Extension Development Host 或安装 `.vsix` 做验证。
- 但 Cursor 的 VS Code base version、Extension Host 行为和调试性能可能与官方 VS Code 有差异。
- 如果 Cursor F5 调试异常，不阻塞开发；先用 VS Code 完成主调试，再用 Cursor 验证 webview、commands、activation、theme token 和 Codicons 表现。

## 测试策略

建议覆盖：

- extension 数据层：`ChangeInfo` 能带上 `createdAt`；fallback 失败不影响 change list。
- webview card：有 `createdAt` 时显示 Created；无 `createdAt` 时不显示；Updated 仍显示。
- ChangeDetail：不再渲染 `Show in sidebar`；渲染 copy button；Open/Refresh 留在 Header。
- ActionBar：只渲染 workflow actions，不渲染 Open/Refresh。
- copy：点击 copy button 发送 `copyToClipboard(changeName)`。
- workflow routing：`Continue`、`FF`、`Apply`、`Sync`、Verify/Archive 入口行为不被破坏。
- reduced motion：通过 CSS 规则或样式约束验证，不需要重型 e2e。

## OpenSpec 工件落点

后续 OpenSpec artifacts 应修改：

- `openspec/changes/polish-dashboard-change-detail-ui/specs/dashboard/spec.md`
  - 增加 Created 展示、卡片信息层级、hover/focus actions 和动效要求。
- `openspec/changes/polish-dashboard-change-detail-ui/specs/workflow-control/spec.md`
  - 增加 Header/ActionBar 分组、copy change name、移除 Show in sidebar、高影响动作隔离要求。
- `openspec/changes/polish-dashboard-change-detail-ui/design.md`
  - 固化本文的数据流、组件边界、创建时间语义、Codicons 决策和验证路径。
- `openspec/changes/polish-dashboard-change-detail-ui/tasks.md`
  - 拆分为数据模型、Dashboard 卡片、ChangeDetail header、ActionBar 分组、Codicons/i18n、动效、测试与验证。
