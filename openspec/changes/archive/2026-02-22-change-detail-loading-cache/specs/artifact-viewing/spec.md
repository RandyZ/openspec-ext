## MODIFIED Requirements

### Requirement: Performance
The system SHALL render artifacts efficiently, with in-memory caching to eliminate redundant network requests within the same panel session.

#### Scenario: Fast initial render
- **WHEN** an artifact < 1MB is opened for the first time
- **THEN** rendering MUST complete < 1 second
- **AND** a loading indicator MUST show if > 300ms

#### Scenario: Cached tab switching（新增）
- **WHEN** the user switches to a tab whose artifact was already loaded in this session
- **THEN** the content MUST appear immediately without any loading indicator
- **AND** no new `getArtifactContent` request SHALL be sent to the extension

#### Scenario: Smooth scrolling
- **WHEN** scrolling a rendered artifact
- **THEN** scrolling MUST be smooth (60fps)
- **AND** large documents SHOULD use virtual scrolling

## ADDED Requirements

### Requirement: Artifact 刷新语义
系统 SHALL 确保「Refresh」操作始终从磁盘重新读取最新内容，无论缓存状态如何。

#### Scenario: 刷新后显示最新内容
- **WHEN** 用户点击「Refresh」按钮
- **THEN** 系统 SHALL 清除当前 change 的 artifact 缓存
- **AND** 向扩展发送新的内容请求
- **AND** 最终显示从磁盘读取的最新内容
