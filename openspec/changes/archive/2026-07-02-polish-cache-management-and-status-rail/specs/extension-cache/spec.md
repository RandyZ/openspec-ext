## ADDED Requirements

### Requirement: Cache management actions
扩展 SHALL 提供可发现的缓存管理入口，使用户无需手动查找 VS Code 或 Cursor 的深层 extension storage 路径即可管理 OpenSpec 缓存。

缓存管理入口 MUST 至少包含打开缓存目录、复制缓存路径、清理缓存、查看缓存详情四类操作。所有缓存管理操作 MUST 仅作用于本扩展的缓存根目录，MUST NOT 删除或修改用户项目目录中的 OpenSpec 源文件。

#### Scenario: Open cache folder
- **GIVEN** 扩展已经初始化 OpenSpec cache root
- **WHEN** 用户执行 `OpenSpec: Open Cache Folder` 或从 dashboard 缓存入口选择打开目录
- **THEN** 扩展 MUST 在编辑器或系统文件管理器中打开当前 OpenSpec cache root
- **AND** 如果 cache root 尚不存在，扩展 MUST 创建该目录或显示可操作错误

#### Scenario: Copy cache path
- **GIVEN** 扩展已经初始化 OpenSpec cache root
- **WHEN** 用户执行 `OpenSpec: Copy Cache Path` 或从 dashboard 缓存入口选择复制路径
- **THEN** 扩展 MUST 将当前 OpenSpec cache root 的绝对路径复制到剪贴板
- **AND** 扩展 MUST 显示非阻塞确认通知

#### Scenario: Clear cache
- **GIVEN** OpenSpec cache root 中存在 dashboard 或 artifact 缓存文件
- **WHEN** 用户执行 `OpenSpec: Clear Cache` 并确认清理
- **THEN** 扩展 MUST 删除本扩展缓存根目录下的缓存内容
- **AND** 扩展 MUST NOT 删除用户项目目录中的 `openspec/` 文件
- **AND** 扩展 MUST 触发 dashboard 重新加载或标记现有缓存统计为待刷新

#### Scenario: Show cache details
- **GIVEN** 扩展已经计算出缓存统计信息
- **WHEN** 用户执行 `OpenSpec: Show Cache Details` 或打开 dashboard 缓存详情
- **THEN** 扩展 MUST 展示缓存根目录、总大小、文件数量、最后统计时间以及可用管理操作
- **AND** 展示内容 MUST 明确区分缓存目录与当前 OpenSpec project 或 scope 根目录

### Requirement: Cache usage summary
扩展 SHALL 异步计算并暴露 OpenSpec cache root 的轻量统计信息，以支持 dashboard 展示缓存占用摘要。

缓存统计 MUST 包含总字节数、文件数量、统计时间和是否正在计算。统计计算 MUST 限定在本扩展 cache root 内，MUST NOT 扫描用户项目目录。统计结果 MUST 使用短 TTL、debounce 或等价机制避免在 dashboard 渲染和 scope 切换时重复进行昂贵扫描。

#### Scenario: Dashboard requests cache stats
- **GIVEN** dashboard webview 已连接 extension host
- **WHEN** dashboard 请求缓存统计信息
- **THEN** extension host MUST 返回当前 cache root 的总大小、文件数量和统计时间
- **AND** 如果统计仍在计算，extension host MUST 返回 `isCalculating` 或等价状态
- **AND** dashboard MUST NOT 因等待统计完成而阻塞主要数据渲染

#### Scenario: Cache stats use bounded scan
- **GIVEN** OpenSpec cache root 中存在多级 workspace 和 scope 缓存目录
- **WHEN** extension host 计算缓存统计
- **THEN** 扫描 MUST 限定在 OpenSpec cache root 内
- **AND** 扩展 MUST 使用异步文件系统 API 或等价机制避免阻塞 extension host 的交互路径
- **AND** 扩展 MUST 复用短期有效的统计结果而不是每次 dashboard render 都重新扫描

#### Scenario: Cache stats refresh after mutation
- **GIVEN** dashboard 正在展示缓存占用摘要
- **WHEN** 扩展写入、清理或失效 OpenSpec cache root 下的缓存
- **THEN** extension host MUST 标记缓存统计过期
- **AND** 下一次 dashboard 请求或后台刷新 MUST 重新计算统计信息
- **AND** dashboard MUST 更新显示新的大小和文件数量

#### Scenario: Cache stats failure is non-blocking
- **GIVEN** cache root 不可读或统计计算失败
- **WHEN** dashboard 请求缓存统计信息
- **THEN** extension host MUST 返回可恢复的统计错误状态
- **AND** dashboard MUST 继续展示 changes、specs 与 scope 状态
- **AND** dashboard MUST NOT 将缓存统计失败渲染为 OpenSpec CLI 或 workspace 初始化失败
