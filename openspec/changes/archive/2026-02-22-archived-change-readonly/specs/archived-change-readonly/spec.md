## ADDED Requirements

### Requirement: 已归档 change 只读约束（前端）
系统 SHALL 在 `changeName` 以 `archive:` 开头时，将 Change Detail 面板设为只读模式，隐藏或禁用所有会触发写操作的 UI 元素。

#### Scenario: 任务 checkbox 不可交互
- **WHEN** 用户在已归档 change 的 Tasks tab 中查看任务列表
- **THEN** 所有 checkbox SHALL 处于禁用状态（不可点击）
- **AND** 视觉上应有明显的"禁用"样式（如降低透明度），与可交互状态区分

#### Scenario: 任务「执行」按钮不显示
- **WHEN** 用户在已归档 change 的 Tasks tab 中查看任务列表
- **THEN** 每行任务的「执行」按钮 SHALL 不渲染

#### Scenario: Verify「执行」按钮不显示
- **WHEN** 用户在已归档 change 的 Verify tab 中
- **THEN** 「执行」按钮 SHALL 不渲染

### Requirement: 已归档 change 只读约束（后端）
扩展 message handler SHALL 对 `changeName.startsWith('archive:')` 的写操作请求（`toggleTask`、`executeTask`、`requestCreateArtifact`、`runCommand`）直接忽略并返回，不执行任何文件写入或命令执行。

#### Scenario: 后端拒绝 toggleTask 对归档 change
- **WHEN** webview 发送 `toggleTask` 且 `changeName` 以 `archive:` 开头
- **THEN** 扩展 SHALL 直接 return，不修改任何文件
- **AND** 可选：向用户显示「已归档，仅可查看」提示

#### Scenario: 后端拒绝 executeTask 对归档 change
- **WHEN** webview 发送 `executeTask` 且 `changeName` 以 `archive:` 开头
- **THEN** 扩展 SHALL 直接 return，不执行任何任务

#### Scenario: 后端拒绝 requestCreateArtifact 对归档 change
- **WHEN** webview 发送 `requestCreateArtifact` 且 `changeName` 以 `archive:` 开头
- **THEN** 扩展 SHALL 直接 return，不触发任何 AI 创建流程

### Requirement: 已归档 change 保留只读操作
已归档 change SHALL 保留不会修改 change 内容的操作。

#### Scenario: 可正常查看 artifact 内容
- **WHEN** 用户切换 Proposal / Design / Specs / Tasks tab
- **THEN** artifact 内容 SHALL 正常显示为 Markdown 渲染视图

#### Scenario: 可复制命令
- **WHEN** 用户点击「Copy /opsx:ff」或「Copy /opsx:apply」
- **THEN** 对应命令 SHALL 被复制到剪贴板，功能正常

#### Scenario: 可刷新内容
- **WHEN** 用户点击「Refresh」
- **THEN** 面板 SHALL 重新从磁盘读取并显示最新 artifact 内容
