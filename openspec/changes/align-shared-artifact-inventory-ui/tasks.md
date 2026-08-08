## 1. Shared Inventory 数据契约与 Host 构建

- [ ] 1.1 在 shared 类型中新增 `ArtifactInventory` / `ArtifactInventoryItem`（对齐 design D1 / PRD §22 字段：key、displayName、source、schemaDefined、status、paths、fileCount、dependencies、updatedAt）
- [ ] 1.2 实现 `buildArtifactInventory(changeDir, schemaArtifacts, changeName)`：`defined` 来自 Schema/fallback artifacts，`other` 复用现有 `buildOtherArtifacts`
- [ ] 1.3 在 `DataManager.getChangeDetails`（及必要的 Dashboard 拉取路径）返回统一 `inventory`；迁移期可同时保留 `otherArtifacts` 兼容字段
- [ ] 1.4 为 `buildArtifactInventory` 与 getChangeDetails  enrichment 编写单元测试（Schema+Other、Missing 仍出现、Workspace/Detail 同 payload 形状）

## 2. 可复用 Webview Inventory / Plan Readiness 组件

- [ ] 2.1 新增 `ArtifactInventoryView`：Schema 卡片行 + `Other Artifacts · Not defined in schema` / `其他工件 (未定义)` 分区；空 Other 不渲染
- [ ] 2.2 新增 `PlanReadinessCards`：基于 `inventory.defined` 展示状态、文件数、依赖摘要、Open/Reveal 入口
- [ ] 2.3 统一卡片主点击与 More 菜单动作：Open / Reveal / Copy path；Missing 走 continue/create，不 reveal
- [ ] 2.4 为上述组件补充渲染/交互测试（空 Other、目录计数文案、Missing 不发 reveal）

## 3. Change Detail 对齐设计稿

- [ ] 3.1 从 Change Detail 主布局移除固定 `WorkflowStepIndicator`（Proposal→Archive）作为 readiness 主导航；保留 ActionBar / VerifyArchive 等动作入口
- [ ] 3.2 接入 Plan Readiness + 共享 `ArtifactInventoryView`；内容 Tab 继续由 Schema ids 动态生成，并与 Inventory 选择联动
- [ ] 3.3 增加 Execution Progress 区（tasks completed/total）与 Header 上下文（writable root、schema、任务进度；有 store 时摘要）
- [ ] 3.4 更新 Change Detail 相关路由/源码断言测试与 i18n 文案

## 4. Changes Workspace（Dashboard）共用 Inventory

- [ ] 4.1 Dashboard 增加 `selectedChangeName`（或等价选中态）：选中 change 后请求与 Detail 同源的 inventory
- [ ] 4.2 在选中面板渲染同一套 `ArtifactInventoryView`（workspace variant）；提供明确 Open Detail 入口，避免破坏现有打开习惯
- [ ] 4.3 确保同一 scope 下 Workspace 与 Detail 展示的 Schema keys / Other entries 一致（集成或单测断言同 payload）
- [ ] 4.4 Dashboard 无选中时不展示张冠李戴的 Inventory

## 5. 收尾验证

- [ ] 5.1 运行 `pnpm test` 与 `pnpm run build`
- [ ] 5.2 运行 `openspec validate align-shared-artifact-inventory-ui --strict`
- [ ] 5.3 手工验证：Dashboard 选中 `add-change-lifecycle-filtering-and-pagination` 可见 `task-details · 6 files`；打开 Detail 看到相同 Other，且无固定 Stepper 作为主 readiness UI
