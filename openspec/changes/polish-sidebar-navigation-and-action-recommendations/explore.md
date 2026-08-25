<!-- Exploration output for openspec/changes/polish-sidebar-navigation-and-action-recommendations/explore.md — input for proposal, not the contract. -->

## Clarified requirements and constraints

- 当前 Project-first Sidebar 的四个入口虽然已经稳定为 2×2，但仍像四个普通文本按钮：缺少边框层级、图标、选中态和外部打开提示，无法形成清晰的导航入口。
- `RECOMMENDED ACTIONS` 目前只是裸露的 Change 名称。用户无法知道为什么推荐、将执行什么动作，也没有明确的点击目标和视觉反馈。
- 四宫格必须继续保持固定顺序：Changes、Specs、Worksets、Dashboard。Changes、Specs、Worksets 更新 Sidebar 本地视图；Dashboard 打开或 reveal 单例 Editor，不改变 Sidebar 当前视图。
- Worksets 在无可信 membership 时仍占据固定位置，但必须以可访问的禁用态展示简短原因，不能猜测或伪造可用性。
- 推荐区最多展示 3 条，优先级固定为 Needs Attention → Ready to Verify → Recommended。每条必须同时呈现 Change 名称、动作语义和一个明确 CTA。
- 继续复用 `resolveWorkflowActions()`、现有 workflow launch handler、Project binding 和 receipt attention 数据；不新增动作模型、DTO、缓存、消息协议或第三方依赖。
- 使用 VS Code/Cursor 主题 token 和仓库已安装的 Codicons，保证暗色、浅色、高对比主题可读；键盘焦点、`aria-pressed`、禁用原因和按钮名称必须可访问。
- 本 Change 只改善信息层级、视觉样式和既有动作的可发现性，不重做 Dashboard 数据结构、Changes 列表、Project/Store binding 或 Workset 发现逻辑。

## Approaches considered

### A. 主题原生的小型导航卡片和动作行（采用）

四宫格使用轻量卡片：1px 主题边框、轻微背景、Codicon、标题和一行辅助信息。选中的 Sidebar 本地视图使用 focus/selection token；Dashboard 使用 Editor 外部打开提示；Worksets 保留明确禁用态。推荐区使用紧凑的带边框动作行，左侧说明优先级与 Change，右侧显示真实 CTA。

优点：在窄 Sidebar 中仍清晰；复用现有状态和动作路由；改动集中在 `Header`、`Dashboard`、locale 和现有测试。缺点：需要细致校准窄宽度、禁用态和主题 token。

### B. 只给现有按钮补颜色和圆角

保留现有 DOM，只增加更明显的背景色、hover 和间距。

优点：代码最少。缺点：仍然没有图标、动作解释、Dashboard 外部打开语义和推荐 CTA，不能解决用户指出的核心信息层级问题。

### C. 在 Sidebar 中复制宽 Dashboard 的大卡片

把四宫格和推荐区做成 KPI/大卡片风格，并展示更多摘要。

优点：视觉冲击强。缺点：窄 Sidebar 会拥挤、滚动更长，并重复宽 Dashboard 的职责，不适合作为发布候选的小范围改造。

## Agreed design direction

### Project action grid

```text
┌──────────────────┬──────────────────┐
│ ◫  Changes       │ ≡  Specs         │
│ Current work     │ Project + Store  │
├──────────────────┼──────────────────┤
│ ⧉  Worksets      │ ◧  Dashboard  ↗  │
│ Unavailable / N  │ Open in Editor   │
└──────────────────┴──────────────────┘
```

- 每格是完整 button click target，使用统一高度、边框、内边距、hover 和 focus ring。
- Changes、Specs、Worksets 的 active 状态来自现有 `activeProjectTab`，继续使用 `aria-pressed`；Dashboard 不伪装成当前 Sidebar tab。
- Dashboard 的辅助文字和外部打开图标说明它会打开 Editor。
- Worksets 可用时显示可信 membership 数量；不可用时降低强调度并显示单行原因，保留 title/ARIA 完整说明。
- 文本允许截断，但按钮自身保持至少两行信息和稳定的 2×2 布局；不新增响应式 JS。

### Recommended Actions

```text
RECOMMENDED ACTIONS
┌─────────────────────────────────────┐
│ ⚠ Needs attention                  │
│ change-name                 Review │
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│ ✓ Ready to verify                  │
│ another-change              Verify │
└─────────────────────────────────────┘
```

- 不再按组渲染裸名字。每条使用独立边框、轻微主题背景、状态图标/标签、可截断 Change 名称和明确 CTA。
- Needs Attention 的 CTA 为 Review，安全打开绑定正确的 Change Detail。
- Ready to Verify 的 CTA 为 Verify，继续走现有交互式 Verify & Archive 路由。
- Recommended 的 CTA 使用 shared resolver 返回的真实动作标签，并通过现有 workflow launch handler 执行；高影响动作仍遵守 Detail 安全导航规则。
- 全区按固定优先级扁平化后取前 3 条，避免推荐区挤占 Changes 主列表。
- receipt failure/fallback 继续进入 Needs Attention；错 binding 或过期 receipt 继续由现有逻辑拒绝。

## Key decisions

- 采用方案 A；方案 B 信息不足，方案 C 不适合窄 Sidebar。
- 使用现有 Codicons 和 VS Code CSS variables，不新增图片资产、设计依赖或自建颜色系统。
- 视觉结构留在现有 `Header`/`Dashboard` surface；只在重复明显且能减少代码时使用文件内渲染 helper，不创建通用设计系统组件。
- 推荐动作的行为仍以 `resolveWorkflowActions()` 为唯一来源，不根据生命周期文案重新推导动作。
- 测试以语义、ARIA、动作路由、最大条数和优先级为主，不使用脆弱的整页快照；真实 Extension Development Host 验收必须覆盖暗色主题、窄 Sidebar、禁用 Worksets、键盘焦点及推荐 CTA。
