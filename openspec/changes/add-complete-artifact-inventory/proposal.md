## Why

Change 目录里经常存在 Schema 未声明、但真实存在的文件（例如本仓库自己的多个 change 已经在用的 `task-details/` 子目录），但 Change Detail 目前把 Artifact Tab 硬编码为 `proposal/specs/design/tasks` 四种固定 id，这些真实文件既不出现在任何 Tab 里，也没有入口可以打开，用户只能去文件系统里自己翻找。同时现有的"Open in Editor"动作只在编辑器里打开一个 Tab，不会在 VS Code Explorer 中定位文件，用户会丢失这个文件在目录结构里的位置感。

## What Changes

- Change Detail 的 Artifact Tab 改为完全由当前 Schema 动态生成（不再硬编码 `proposal/specs/design/tasks` 这四个 id），为自定义 Schema 铺路。
- 扫描 Change 目录，识别 Schema 未声明、但真实存在的文件或子目录（例如 `task-details/`、历史遗留文件），归入一个独立的 `Other Artifacts` 分组：不隐藏、不丢弃、也不猜测归类到某个已知 Artifact 类型。
- 扩展现有"Open in Editor"动作为"Reveal + Open"：单文件 Artifact 在 VS Code Explorer 中 Reveal 并在编辑器打开；多文件 Artifact（如 `specs/` 目录、`Other Artifacts` 里的子目录）Reveal 并展开对应目录，默认聚焦最近更新的文件。
- Missing（Schema 已声明但文件尚未创建）的 Artifact 保持现有"继续规划"入口，不尝试定位不存在的文件。

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `artifact-viewing`: Artifact 列表从硬编码四类改为按当前 Schema 动态生成，并新增 `Other Artifacts` 分组；Artifact 打开动作从"仅在编辑器打开"扩展为"Reveal in Explorer + Open in Editor"。

## Impact

- Extension Host：新增 Artifact Inventory 构建逻辑，对比当前 Schema 声明的 Artifact 路径与 Change 目录实际内容，得到 `Other Artifacts` 列表（文件/子目录路径与文件数量）。
- Extension Host：扩展 `openArtifact` / `openDeltaSpec` 消息处理，复用 `openChange` 中已经在用的 `revealInExplorer` 调用，使其对新的 Other Artifacts 同样生效。
- Webview：`ChangeDetail` / `ArtifactViewer` 新增 `Other Artifacts` 分组渲染；Artifact Tab 列表改为读取当前 Schema 的 artifact 顺序,不再写死四个固定 id。
- Types：新增描述 Other Artifact 的展示类型（路径、文件数量、来源标记）。
- i18n：新增 `Other Artifacts / Not defined in schema` 及相关空状态、tooltip 文案（中英文）。
- 不影响 Dashboard / ChangeCard 上现有的 Schema Artifact 徽标；`Other Artifacts` 仅在 Change Detail 内展示，Dashboard 卡片层的展示留作后续独立 Change。
- 不涉及 OpenSpec CLI 改动，不改变 Root 解析、Store 关联或 Workset 逻辑。
