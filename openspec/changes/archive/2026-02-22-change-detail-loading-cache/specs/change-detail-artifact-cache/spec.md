## ADDED Requirements

### Requirement: Artifact 内容缓存
Change Detail 面板 SHALL 在内存中缓存每个已成功加载的 artifact 内容，以 `(changeName, artifactType)` 作为 key（specs tab 额外包含 `specId`）；缓存的生命周期与面板实例绑定。

#### Scenario: 切换 tab 时命中缓存
- **WHEN** 用户切换到已经加载过的 artifact tab
- **THEN** 系统 SHALL 直接从缓存读取内容并立即显示，不发起新的 `getArtifactContent` 请求
- **AND** 不显示 loading 状态

#### Scenario: 首次加载写入缓存
- **WHEN** artifact 内容首次从扩展返回（`artifactContent` 消息）
- **THEN** 系统 SHALL 将该内容写入缓存，key 为 `(changeName, artifactType)`

#### Scenario: 刷新时清除缓存
- **WHEN** 用户点击「Refresh」
- **THEN** 系统 SHALL 清除当前 change 的所有缓存条目
- **AND** 重新发起当前 tab 的请求，加载最新内容

### Requirement: existingArtifactIds 引用稳定性
App.tsx 在收到 `setContext` 消息时 SHALL 对 `existingArtifactIds` 做内容比较，仅当列表内容发生实质变化时才更新 state。

#### Scenario: setContext 携带相同 id 列表时不更新引用
- **WHEN** 扩展发送 `setContext` 且新 `existingArtifactIds` 与当前值的元素完全相同
- **THEN** 系统 SHALL 保持原有 state 引用不变
- **AND** `ChangeDetail` 的加载 effect 不被触发

#### Scenario: setContext 携带不同 id 列表时正常更新
- **WHEN** 扩展发送 `setContext` 且 `existingArtifactIds` 内容发生变化（如新 artifact 被创建）
- **THEN** 系统 SHALL 更新 `existingArtifactIds` state
- **AND** `ChangeDetail` 的加载 effect 正常触发以反映最新状态
