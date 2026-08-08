## Why

`add-complete-artifact-inventory` 已经把 Schema 动态 Tab、Other Artifacts 扫描和 Reveal+Open 接到 Change Detail，但视觉与信息架构仍停留在旧页：固定 `Proposal → … → Archive` 步进条、无 Plan Readiness 卡片、Other Artifacts 只是一条紧凑 chip，且 Dashboard / Changes Workspace 完全看不到同一份 Inventory。对照 v2 Change Detail 高保真与 v4 Changes Workspace，用户感知是「功能有了，设计稿完全对不上」。现在需要把 **Changes Workspace（Dashboard 选中 Change）** 与 **Change Detail** 一起对齐设计，并强制 **共用同一份 Artifact Inventory 数据源**。

## What Changes

- 抽出共享的 `ArtifactInventory` 数据模型与构建入口（`defined` / `other`），供 Changes Workspace 与 Change Detail 共同消费；禁止两套各自拼装的列表。
- **Changes Workspace（Dashboard 选中 Change 面板）**：按 v4 §9.4 展示 Complete Artifact Inventory——Schema Artifact 卡片行（类型、文件/任务数、状态）+ `Other Artifacts · Not defined in schema` 分区；主点击 Reveal+Open。
- **Change Detail**：对齐 v2/v4 Detail 设计——移除固定生命周期 Stepper；用 **Plan Readiness** Artifact Cards（Done/Ready/Blocked/Missing/Error、文件数、依赖、Open/Reveal）；同一 Inventory 的 Schema + Other 分区；独立 **Execution Progress** 区；Header 补充 Writable Root / Schema / 任务进度等关键上下文。
- Artifact Content View：保留 Schema 动态 Tab；Other 作为内容分组/入口与 Inventory 联动，不再只是永久贴在 Tab 下的无名 chip 条。
- 升级 Other Artifacts 文案与布局至设计稿语义（「Not defined in schema / 未定义」）；条目支持 Open / Reveal / Copy path（More 或等价入口）。

## Capabilities

### New Capabilities

- `artifact-inventory`: 定义共享 Artifact Inventory 的数据契约、Schema vs Other 分区规则，以及 Changes Workspace 与 Change Detail 必须共用同一数据源的行为要求。

### Modified Capabilities

- `artifact-viewing`: Change Detail 从「动态 Tab + 紧凑 Other strip」升级为 Plan Readiness 卡片 + 共享 Inventory 分区 + 去掉固定 Stepper；内容区与 Inventory 联动。
- `dashboard`: Changes Workspace / Dashboard 在选中 Change 时展示与 Detail 同源的 Complete Artifact Inventory（Schema 卡片 + Other 分区），而不只是列表卡片上的简单徽标。

## Impact

- Extension Host：在现有 `buildOtherArtifacts` / `getChangeDetails` 之上收敛为统一的 `ArtifactInventory` 构建与消息载荷；Dashboard 与 Detail 的 webview 消息共用该结构。
- Webview：新增可复用的 Inventory / Plan Readiness 组件；改造 `ChangeDetail.tsx` 与 Dashboard 选中态面板；移除或降级 `WorkflowStepIndicator` 固定阶段条在 Detail 上的主导地位。
- Types / i18n：共享 Inventory 类型；中英文「Other Artifacts · Not defined in schema / 其他工件 (未定义)」等文案。
- 依赖前序 change：`add-complete-artifact-inventory` 的扫描与 open/reveal 能力作为基础，本 change 做 UI 对齐与数据共享。
- **不在本 change**：Store Add Operation / Store Quick View 完整表单、Workset Workspace、Rendered|Source 全套内容编辑器能力、自定义 Schema 的通用多文件子选择器泛化。
