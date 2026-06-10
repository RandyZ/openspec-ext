## 0. 来源与执行计划

- Superpowers 实施计划：`docs/superpowers/plans/2026-06-10-polish-dashboard-change-detail-ui.md`
- 设计依据：`docs/superpowers/specs/2026-06-10-polish-dashboard-change-detail-ui-design.md`
- OpenSpec 设计：`openspec/changes/polish-dashboard-change-detail-ui/design.md`
- 执行要求：实施时以 Superpowers plan 为任务拆分与验证顺序，保持本文件 checkbox 与计划进度同步。

## 1. 数据模型与 createdAt 采集

- [x] 1.1 在 `src/extension/services/types.ts` 和 `src/webview/types/messages.ts` 的 `ChangeInfo` 类型中增加可选 `createdAt?: string`，并确认 `DashboardData.changes` 仍复用同一 change 列表消息通道，不新增 dashboard 消息类型。
- [x] 1.2 为 extension 数据层补充单元测试，覆盖 CLI 返回明确创建时间时 `ChangeInfo.createdAt` 被保留，并且 `createdAt` 不参与 status、任务进度或 workflow 动作判断。
- [x] 1.3 在 `src/extension/services/dataManager.ts` 的 change 列举链路中补充 `createdAt` 填充逻辑：优先使用 CLI/change metadata 中的明确创建时间；缺失时从本地 change 目录或关键 artifact 的文件系统时间推导稳定 fallback。
- [x] 1.4 为 filesystem fallback 写失败路径测试：当 change 目录或 artifact stat 失败、时间不可解析或没有可用创建时间时，`createdAt` 保持缺失，change list 仍正常返回且 `lastModified` 继续沿用现有 fallback。
- [x] 1.5 更新 `src/extension/services/dataManager.ts` 或相关 search enrichment 逻辑，使格式化后的 created 文本可以进入 `searchText`，但搜索结果不能只依赖 created 文本作为唯一可识别字段。
- [x] 1.6 运行与数据层相关的 targeted vitest，确认 `createdAt` 采集、fallback、searchText 合并和原有 `proposalWhy` enrichment 均通过。

## 2. Dashboard ChangeCard 信息层级

- [ ] 2.1 为 `src/webview/components/ChangeCard.tsx` 增加组件测试，覆盖有 `createdAt` 时卡片按“change 名称、Proposal Why 摘要、artifact 状态、Created/Updated、任务进度”的顺序渲染。
- [ ] 2.2 调整 `ChangeCard` 的主体布局，把 Proposal Why 放在标题下方，artifact badges 独立成行，Created/Updated 独立成行，任务文本和 progress bar 组成单独进度块。
- [ ] 2.3 增加缺失 `createdAt` 的测试和实现：无可解析创建时间时隐藏 `Created`，仍显示可用的 `Updated`，且不暴露错误占位或异常文本。
- [ ] 2.4 保留 Proposal Why 的截断与完整内容提示能力：可见摘要保持短文本，完整内容继续通过 tooltip、title 或等价可访问提示暴露。
- [ ] 2.5 重构 hover/focus workflow actions：未 hover/focus 时不抢占主体阅读；鼠标 hover 与键盘 focus 均显示快捷操作；点击快捷操作必须阻止卡片主导航冒泡。
- [ ] 2.6 校准 quick actions 推荐语义：draft/planning change 优先 Continue/FF 等推进动作，planning 完整后突出 Verify/Archive 路径，并与 detail ActionBar 的 workflow 分组语义一致。
- [ ] 2.7 为卡片 hover/focus、quick actions 显隐和 progress bar 更新添加轻量动效，避免 width/height 布局动画和列表高度跳动。
- [ ] 2.8 在 `src/webview/index.css` 或局部样式中加入 `prefers-reduced-motion: reduce` 分支，禁用非必要 transform/过渡，同时保留即时可感知的状态变化。

## 3. ChangeDetail Header 与 ActionBar 分组

- [ ] 3.1 为 `src/webview/components/ChangeDetail.tsx` 增加测试，断言 header 展示 change 名称、状态摘要、复制按钮、Open in Editor 和 Refresh，且顶部不再渲染 `Show in sidebar`。
- [ ] 3.2 将 ChangeDetail 顶部调整为紧凑双区布局：左区负责 change name、copy、status summary；右区负责 Open in Editor 与 Refresh；窄宽度下允许工具区换行但不遮挡标题。
- [ ] 3.3 增加 copy change name 行为：点击名称旁复制按钮时仅发送 `sendMessage.copyToClipboard(change.name)`，不拼接 `/opsx:*` 命令、路径或额外描述。
- [ ] 3.4 为 copy 成功态增加本地瞬时反馈：成功后短暂切换为 check 状态约 1.2 秒，失败时不显示成功态且不改变 change 状态。
- [ ] 3.5 为 `src/webview/components/ActionBar.tsx` 增加测试，断言 ActionBar 只渲染 Continue、FF、Apply、Sync Specs 等 workflow 推进动作，不渲染 Open in Editor、Refresh 或复制类工具动作。
- [ ] 3.6 调整 ActionBar 分组：普通推进动作与 Verify/Archive 等高影响 workflow 入口分开表达，且高影响动作不与 header 工具按钮混排。
- [ ] 3.7 保持 `src/webview/components/WorkflowStepIndicator.tsx` 的阶段导航语义：已完成 artifact 可切 tab，Continue/Apply 类步骤复用现有 workflow routing，Verify/Archive 步骤进入对应入口而不直接执行高影响动作。
- [ ] 3.8 验证 archived change 的只读状态：复制、打开、刷新仍可用，写入型 workflow 动作继续禁用或隐藏，并且不被 header 重排重新暴露。

## 4. Codicons、IconButton 与 i18n

- [ ] 4.1 检查 `@vscode/codicons` 是否已安装；若未安装，使用 `pnpm add @vscode/codicons` 引入，并确认构建产物能加载 codicon 字体或样式资源。
- [ ] 4.2 在 `src/webview/components/ui/` 中沉淀轻量 `IconButton` primitive，统一 icon-only button 的尺寸、对齐、hover/focus、disabled、tooltip 和 `aria-label` 行为。
- [ ] 4.3 使用 `IconButton` 替换或承载 ChangeDetail header 中的 copy、open、refresh 图标按钮，并确保 Codicons 加载失败时按钮仍有可点击区域和可访问名称。
- [ ] 4.4 在 Dashboard quick actions 或其他仅图标按钮中复用同一 `IconButton` 约束，避免 Dashboard 与 ChangeDetail 的按钮尺寸和 focus ring 分叉。
- [ ] 4.5 更新 `src/i18n/locales/en.json` 和 `src/i18n/locales/zh-cn.json`，新增或调整 `change.created`、`change.updated`、`action.copyChangeName`、`action.copiedChangeName` 等文案。
- [ ] 4.6 检查 `src/i18n/index.ts` 与 webview 文案调用点，确保 Created/Updated、tooltip、aria-label 和复制成功反馈全部通过 `t('key')` 获取，不硬编码用户可见字符串。
- [ ] 4.7 为 icon-only button 增加可访问性测试或组件断言，确认每个按钮都有 `aria-label`、tooltip 或等价提示，并且键盘可聚焦、可触发。

## 5. 测试、构建与人工 smoke 验证

- [ ] 5.1 补充 Dashboard 组件测试：有 created/updated、缺 created、Proposal Why 截断、hover/focus actions、quick action click 不触发卡片打开、reduced motion 样式约束。
- [ ] 5.2 补充 ChangeDetail/ActionBar 组件测试：header 工具与 workflow 动作分组隔离、`Show in sidebar` 移除、copy 发送纯 change name、Open/Refresh 不出现在 ActionBar。
- [ ] 5.3 补充 extension 数据层测试：CLI metadata 优先级、filesystem fallback、stat/解析失败降级、`createdAt` 不参与 status/排序/workflow 判断。
- [ ] 5.4 运行 `rtk zsh -c 'source ~/.zshrc && pnpm test'`，确认全部 vitest 通过；若失败，先修复与本 change 相关的失败，不借机改动无关测试。
- [ ] 5.5 运行 `rtk zsh -c 'source ~/.zshrc && pnpm run build'`，确认 extension host esbuild 与 webview Vite 构建均通过。
- [ ] 5.6 运行 `rtk zsh -c 'source ~/.zshrc && openspec validate polish-dashboard-change-detail-ui --strict'`，确认 change artifact 严格校验通过。
- [ ] 5.7 在 VS Code Extension Development Host 中执行 smoke：打开 Dashboard，确认卡片 Created/Updated、信息层级、hover/focus actions、深浅主题、复制名称、Open/Refresh 和 ActionBar 分组均符合设计。
- [ ] 5.8 在 Cursor 中执行兼容 smoke：确认 extension 激活、Dashboard webview、theme token、Codicons、copy/open/refresh、workflow 按钮路由和窄宽度布局无明显回归。
- [ ] 5.9 记录验证结果和任何未解决风险；若 VS Code/Cursor smoke 需要临时启动服务或占用端口，验证完成后停止对应进程并释放端口。
