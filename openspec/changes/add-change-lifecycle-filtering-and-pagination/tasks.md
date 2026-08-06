## 1. 生命周期领域模型

- [ ] 1.1 在 `src/shared/changeLifecycle.ts` 定义 `ChangeLifecycleStatus`、`ActiveChangeLifecycleStatus`、`ChangeAttention`、`ChangeAttentionReason` 和 `ChangeStatusCounts`
- [ ] 1.2 实现 `deriveChangeLifecycleStatus()`，覆盖 planning、ready-to-apply、applying、ready-to-verify
- [ ] 1.3 实现非法任务进度和非法 Artifact 数据的保守回退与 Attention reason
- [ ] 1.4 实现 `getWorkflowActionsForLifecycle()`，建立生命周期到 workflow 操作的唯一映射
- [ ] 1.5 为生命周期边界、动态 Artifact id、非法数据和 workflow 映射编写表驱动单元测试

## 2. Extension Host 数据契约

- [ ] 2.1 扩展 `ChangeInfo`，新增 `lifecycleStatus` 和可选 `attention`，暂时保留 legacy `status`
- [ ] 2.2 扩展 `DashboardData`，新增 `changeStatusCounts`
- [ ] 2.3 在 `DataManager` 中为 CLI 路径和 filesystem fallback 路径统一补充生命周期
- [ ] 2.4 实现当前 Root 的 Active + Archived 全量状态计数
- [ ] 2.5 确保 Scope 切换后计数和 Change 数据来自同一个 Root
- [ ] 2.6 更新 Extension/Webview message types、fixtures 和 contract tests

## 3. Change 列表视图模型与管线

- [ ] 3.1 新增 `ChangeListItemView`，分别适配 Active Change 和 Archived Change
- [ ] 3.2 新增 `ChangesViewState` 和默认值
- [ ] 3.3 在 `src/webview/utils/changeListPipeline.ts` 实现状态筛选、Attention、搜索、排序、分页纯函数
- [ ] 3.4 实现页码 clamp 和结果范围计算
- [ ] 3.5 为“先筛选后分页”、搜索、排序和 pageSize 编写单元测试
- [ ] 3.6 为 All 合并 Archived 和 Archived 只读视图编写单元测试

## 4. 状态筛选与分页 UI

- [ ] 4.1 在 Editor 宽屏实现生命周期 segmented controls 和全量状态计数
- [ ] 4.2 在 Sidebar 窄屏实现紧凑状态 selector
- [ ] 4.3 实现排序控件和 `Needs Attention` 高级筛选
- [ ] 4.4 实现分页、每页数量、结果范围和禁用状态
- [ ] 4.5 状态、Attention、搜索、排序和 pageSize 变化时自动重置到第一页
- [ ] 4.6 为筛选控件和分页补充键盘操作、aria-label、focus 和 tooltip
- [ ] 4.7 增加各筛选状态的 Root 相关空状态

## 5. Archived 一级状态迁移

- [ ] 5.1 将 Archived 数据接入 `ChangeListItemView`
- [ ] 5.2 在 `All` 和 `Archived` 状态中支持归档名称/日期搜索、排序和分页
- [ ] 5.3 保留归档详情打开行为并确保所有归档卡片只读
- [ ] 5.4 删除 ChangesSection 底部旧 Archived accordion
- [ ] 5.5 增加 Local Root 与 Store Root 归档隔离测试

## 6. ChangeCard 状态与智能操作

- [ ] 6.1 在 ChangeCard 上展示统一生命周期状态 badge
- [ ] 6.2 删除或停止使用卡片内部 `getSmartActions()` 的独立阶段推导
- [ ] 6.3 使用 `getWorkflowActionsForLifecycle()` 生成快捷操作
- [ ] 6.4 确保 Ready to Verify 进入 `Verify & Archive` 交互路径
- [ ] 6.5 确保 Archived 卡片不展示任何写操作
- [ ] 6.6 为状态 badge 与快捷操作一致性编写组件测试

## 7. Root 级视图状态

- [ ] 7.1 实现稳定的 Root view-state key
- [ ] 7.2 使用 VS Code Webview state 保存每个 Root 的筛选、查询、排序、页码和 pageSize
- [ ] 7.3 Root 切换时保存离开状态并恢复目标 Root 状态
- [ ] 7.4 数据刷新后对恢复页码执行 clamp
- [ ] 7.5 为两个 Root 的独立筛选和分页状态编写 reducer/组件测试

## 8. i18n、兼容与验证

- [ ] 8.1 更新 `en.json` 和 `zh-cn.json` 的生命周期、筛选、分页、Attention 和空状态文案
- [ ] 8.2 更新旧 tests/fixtures，使生产路径显式提供 lifecycleStatus
- [ ] 8.3 为缺少 lifecycleStatus 的 legacy fixture 保留一次性兼容 adapter 并增加 TODO
- [ ] 8.4 运行 `pnpm test`
- [ ] 8.5 运行 `pnpm run build`
- [ ] 8.6 运行 `openspec validate add-change-lifecycle-filtering-and-pagination --strict`
- [ ] 8.7 执行 Sidebar 与 Editor 宽度的手工 smoke test
- [ ] 8.8 更新 README/CHANGELOG，记录新状态模型、筛选语义和分页顺序
