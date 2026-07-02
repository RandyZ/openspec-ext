# Extension Cache Specification

## Purpose

The Extension Cache provides workspace- and scope-aware warm-start storage for OpenSpec dashboard and artifact data while keeping the OpenSpec CLI and file system as the authoritative sources.

## Requirements

### Requirement: Scope-aware persistent cache storage
扩展 SHALL 将持久化缓存写入 VS Code 扩展存储位置，而不是写入用户打开的项目目录。

每个缓存条目 MUST 包含缓存 schema 版本、工作区身份、scope 身份、scope 根路径、数据类型、生成时间与数据载荷。不同 workspace 或不同 scope 的缓存 MUST 相互隔离，即使它们包含相同的 change 名称或 spec 名称。

#### Scenario: Cache stored outside workspace
- **GIVEN** 用户打开一个包含 OpenSpec 的项目
- **WHEN** 扩展持久化 dashboard 或 detail 缓存
- **THEN** 缓存文件 MUST 写入 VS Code extension storage
- **AND** 扩展 MUST NOT 在用户项目根目录创建缓存目录或缓存文件

#### Scenario: Same change name in different scopes
- **GIVEN** `Local Root` 与一个 store scope 都包含名为 `add-auth` 的 change
- **WHEN** 扩展读取或写入缓存
- **THEN** 两个 scope 的 `add-auth` 缓存 MUST 使用不同缓存键
- **AND** 一个 scope 的缓存 MUST NOT 覆盖或污染另一个 scope 的缓存

#### Scenario: Invalid cache entry
- **GIVEN** 某个持久化缓存条目缺少必需元数据或 schema 版本不兼容
- **WHEN** 扩展尝试读取该缓存
- **THEN** 扩展 MUST 忽略该缓存条目
- **AND** 扩展 MUST 继续通过正常 OpenSpec CLI 或文件读取路径加载数据

### Requirement: Cache warm start and refresh reconciliation
扩展 SHALL 能够使用有效缓存作为 warm start 数据，并在后台用 OpenSpec CLI 或文件读取结果进行刷新校准。

缓存数据 MUST 被视为临时展示数据。CLI 和文件系统读取结果仍然是最终权威数据源。

#### Scenario: Dashboard warms from cache
- **GIVEN** 扩展存储中存在当前 workspace 和 scope 的有效 dashboard 缓存
- **WHEN** 用户打开 OpenSpec dashboard
- **THEN** dashboard MUST 能够先展示缓存数据
- **AND** 扩展 MUST 发起后台刷新以获取最新 OpenSpec 数据
- **AND** 新鲜数据返回后 MUST 替换缓存展示

#### Scenario: Cache refresh succeeds
- **GIVEN** dashboard 当前展示缓存数据
- **WHEN** 后台刷新成功返回最新数据
- **THEN** dashboard MUST 显示最新数据
- **AND** 扩展 MUST 用最新数据更新该 scope 的缓存条目

#### Scenario: Cache refresh fails
- **GIVEN** dashboard 当前展示缓存数据
- **WHEN** 后台刷新失败
- **THEN** dashboard MUST 保留当前缓存数据
- **AND** dashboard MUST 显示数据可能过期的错误或警告状态
- **AND** 扩展 MUST NOT 将失败结果写入缓存覆盖已有可用数据

### Requirement: Cache invalidation
扩展 SHALL 在 OpenSpec 数据发生变更时使受影响 scope 的缓存失效或更新。

缓存失效 MUST 覆盖由扩展触发的数据变更与文件 watcher 发现的数据变更。

#### Scenario: Extension mutates OpenSpec data
- **GIVEN** 用户通过扩展创建 change、切换任务状态、归档 change、注册 store 或执行 store setup
- **WHEN** 对应操作成功完成
- **THEN** 扩展 MUST 使受影响 scope 的相关缓存失效或刷新
- **AND** 后续 dashboard 展示 MUST NOT 依赖变更前的旧缓存

#### Scenario: File watcher observes OpenSpec artifact change
- **GIVEN** dashboard 已缓存某个 scope 的 OpenSpec 数据
- **WHEN** 文件 watcher 发现该 scope 下的 proposal、spec、design、tasks 或 OpenSpec 配置发生变化
- **THEN** 扩展 MUST 使该 scope 的相关缓存失效或刷新
- **AND** 未受影响的其他 scope 缓存 MUST 保持可用

### Requirement: Artifact content cache
扩展 SHALL 支持对 change detail 中加载的 artifact 内容进行 scope-aware 缓存。

Artifact 内容缓存键 MUST 包含 workspace 身份、scope 身份、change 名称、artifact 类型，以及适用时的 spec 名称。缓存命中后仍 MUST 通过文件读取路径刷新并校准内容。

#### Scenario: Detail artifact warms from cache
- **GIVEN** 当前 workspace 和 scope 存在某个 change artifact 的有效缓存
- **WHEN** 用户打开该 change detail 并查看对应 artifact
- **THEN** detail view MUST 能够先展示缓存内容
- **AND** 扩展 MUST 在后台读取最新 artifact 文件
- **AND** 最新内容返回后 MUST 替换缓存展示

#### Scenario: Artifact cache is scoped
- **GIVEN** 两个不同 scope 都包含名为 `improve-flow` 的 change
- **WHEN** 用户在其中一个 scope 打开 `improve-flow` 的 `tasks` artifact
- **THEN** 扩展 MUST 只读取该 scope 对应的 artifact 缓存
- **AND** 扩展 MUST NOT 展示另一个 scope 中同名 change 的 artifact 内容

#### Scenario: Artifact mutation invalidates cache
- **GIVEN** detail view 已缓存某个 change 的 `tasks` artifact 内容
- **WHEN** 用户通过扩展切换任务完成状态或文件 watcher 发现该 artifact 发生变化
- **THEN** 扩展 MUST 使该 artifact 缓存失效或更新
- **AND** detail view 后续 MUST NOT 展示变更前的旧任务内容

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
