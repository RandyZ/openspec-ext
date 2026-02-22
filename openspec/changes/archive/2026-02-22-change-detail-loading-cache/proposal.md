## Why

Change Detail 面板在每次打开以及每次从其他位置切换回来时都会重新请求并加载 artifact 内容，导致明显的白屏/loading 闪烁。根本原因是：`setContext` 消息每次都携带新创建的 `existingArtifactIds` 数组引用，触发 `ChangeDetail` 的请求 effect 重跑，同时 webview 侧没有任何 artifact 内容缓存。

## What Changes

- **前端（webview）增加 artifact 内容缓存**：按 `(changeName, artifactType)` / `(changeName, specId)` 作为 key，缓存已成功加载过的内容；切换 tab 或再次打开同一 change 时直接从缓存读取，不发送新请求。
- **稳定 `existingArtifactIds` 引用**：在 `App.tsx` 中收到 `setContext` 时，仅当 id 列表内容发生实质变化时才更新 state，否则保持原引用，避免 `ChangeDetail` 的 effect 因无意义的"新引用"被触发。
- **手动刷新时清缓存**：用户点击「Refresh」时，清空该 change 在当前 tab 的缓存并重新请求，确保"明确要刷新"的场景仍能获取最新内容。

## Capabilities

### New Capabilities

- `change-detail-artifact-cache`: Change Detail 面板中的 artifact 内容缓存层，按 `(changeName, artifactType[, specId])` 缓存已加载内容，并在刷新时失效。

### Modified Capabilities

- `artifact-viewing`: 加载行为变更——切换 tab 或再次打开同一 change 时不再重新发起请求，改为从缓存读取；刷新操作语义不变（强制重新加载）。

## Impact

- 修改文件：`src/webview/App.tsx`、`src/webview/components/ChangeDetail.tsx`（或抽出独立的缓存 hook）
- 不涉及扩展后端、CLI、消息协议的变更
- 不影响 Dashboard 视图
