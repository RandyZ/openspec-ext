# Project Data Access Specification

## Purpose

Provide Project-scoped OpenSpec reads through an official-CLI-owned root binding, keeping Project identity separate from planning-root identity.

## Requirements

### Requirement: Project Context Is Separate From OpenSpec Root Binding
系统 SHALL 使用 Project Context 表达用户正在查看的代码工程，并使用独立的 OpenSpec Root Binding 表达该工程的规划数据位置。Project Context MUST 保留稳定的工程身份和工程路径，Root Binding MUST 保留 CLI 返回的 root path 与 root source；系统 MUST NOT 用一个可变 scope 值同时代替这两个概念。

#### Scenario: Current workspace project creates a stable Project Context
- **GIVEN** VS Code workspace folder 被识别为当前 Project
- **WHEN** Project 数据访问入口为该 folder 创建 Project Context
- **THEN** Context MUST 包含稳定的 Project identity、展示名称和规范化 project path
- **AND** Context MUST NOT 因当前选择的 Store 或 Dashboard root selector 变化而改变 Project identity

#### Scenario: Project and planning root are different paths
- **GIVEN** 一个 Project 的 OpenSpec CLI 上下文解析到 Project 目录之外的规划 root
- **WHEN** 系统创建 Project Context 与 OpenSpec Root Binding
- **THEN** Project Context MUST 继续指向代码工程
- **AND** Root Binding MUST 指向 CLI 返回的规划 root
- **AND** 系统 MUST NOT 把外部规划 root 重新解释为代码 Project

### Requirement: OpenSpec CLI Owns Root Resolution
Project Data Gateway SHALL 从 Project working directory 调用官方 OpenSpec JSON surface，并 MUST 将 CLI 返回的 root identity 与 source 作为 Root Binding 的事实源。系统 MUST NOT 根据仓库布局、已知 Store、Workset membership 或历史选择猜测替代 root。

#### Scenario: Ordinary Project uses selector-free resolution
- **GIVEN** 用户查看普通 Current Project
- **AND** 用户没有明确选择 Store
- **WHEN** Gateway 解析该 Project 的 OpenSpec Root Binding
- **THEN** root probe MUST 从 Project working directory 以 selector-free 方式执行
- **AND** 后续 Project 数据命令 MUST 保持 selector-free
- **AND** CLI 返回的 root path 与 source MUST 被保留在 Binding 中

#### Scenario: CLI resolves an external or global default root
- **GIVEN** selector-free CLI resolution 返回位于 Project 目录之外的 root 或 source `global_default`
- **WHEN** Gateway 接受该响应
- **THEN** Gateway MUST 使用 CLI 返回的 canonical root
- **AND** `global_default` MUST NOT 被解释为用户明确选择了某个 Store
- **AND** Gateway MUST NOT 自动追加 Store selector

#### Scenario: Explicit Store selector remains explicit
- **GIVEN** 用户通过独立交互明确选择了一个已由 OpenSpec 解析的 Store
- **WHEN** Gateway 为该显式 Store 上下文执行支持 selector 的命令
- **THEN** Gateway MUST 只在该绑定的命令链中携带对应 Store id
- **AND** Gateway MUST NOT 把该 selector 泄漏到其他 Project Context

#### Scenario: Root resolution cannot be established
- **GIVEN** CLI root probe 失败、返回不可用 JSON 或缺少所需 root identity
- **WHEN** Gateway 尝试创建 Root Binding
- **THEN** Gateway MUST 返回明确失败
- **AND** Gateway MUST NOT 通过扫描 `projectPath/openspec` 猜测 root
- **AND** Gateway MUST NOT 构造部分可用的 Binding

### Requirement: CLI And Content Access Share One Binding
Project Data Gateway SHALL 从同一个已验证的 OpenSpec Root Binding 创建 CLI 与 ContentAccess 读取路径。Artifact、task、archive 或其他文件内容 MUST 来自该 Binding 对应的 OpenSpec root，且 MUST NOT 默认固定到 `projectPath/openspec`。

#### Scenario: Local root binds both readers locally
- **GIVEN** CLI 将 Project 自身目录解析为 OpenSpec root
- **WHEN** Gateway 创建 bound readers
- **THEN** CLI calls MUST 在该 Project 上下文中解析到该 root
- **AND** ContentAccess MUST 绑定到该 root 的 `openspec` 内容目录

#### Scenario: External root binds file reads externally
- **GIVEN** CLI 将 Project 解析到外部 OpenSpec root
- **WHEN** Gateway 读取 CLI 状态和 artifact 内容
- **THEN** CLI 状态 MUST 来自外部 resolved root
- **AND** ContentAccess MUST 从同一个外部 resolved root 读取
- **AND** Gateway MUST NOT 混入 Project 本地 `openspec` 目录中的文件

#### Scenario: Binding path fails containment validation
- **GIVEN** Root Binding 的 concrete path 无法 canonicalize、逃逸允许范围或与 CLI root identity 不一致
- **WHEN** Gateway 即将创建 ContentAccess 或读取文件
- **THEN** Gateway MUST fail closed
- **AND** Gateway MUST perform zero file reads or writes through that invalid Binding

### Requirement: Project Reads Use Explicit Immutable Context
Project Data Gateway SHALL 要求每次 Project 数据读取携带显式 Project Context 或已验证 Binding，并 MUST NOT 从全局 `selectedScope` 推断目标。一次读取开始后，其 Project 与 Root Binding MUST 保持不可变。

#### Scenario: Sidebar selection changes during a bound read
- **GIVEN** 一个 Project 数据读取已绑定 Project A 与 Root A
- **WHEN** Dashboard 或 Sidebar 的旧 selected scope 在读取期间切换到另一个目标
- **THEN** 该读取 MUST 继续使用 Project A 与 Root A
- **AND** 返回结果 MUST NOT 包含新选择目标的数据

#### Scenario: Two Projects load concurrently
- **GIVEN** Project A 与 Project B 同时请求数据
- **WHEN** 两个 Project 解析到不同 OpenSpec roots
- **THEN** 每个请求 MUST 使用自己的 immutable Binding
- **AND** 任一请求的 CLI selector、ContentAccess、错误或缓存 MUST NOT 改变另一请求

### Requirement: Gateway Returns Purpose-Specific Project Data
Project Data Gateway SHALL 为 Current Project 提供职责单一的 read models，而 MUST NOT 新建另一个包含 Store、Workset、cache、diagnostic、Changes、Specs 和 archive 全部字段的大一统 Dashboard DTO。

#### Scenario: Current Project change summaries are requested
- **GIVEN** Root Binding 已验证
- **WHEN** 消费者请求 Current Project 的 change summaries
- **THEN** Gateway MUST 通过该 Binding 对应的官方 CLI list/status surface 读取数据
- **AND** 返回值 MUST 只包含该消费者所需的 change summary 与 Project/root identity
- **AND** 返回值 MUST NOT 依赖当前 Dashboard selected scope

#### Scenario: One Project read fails
- **GIVEN** 多个 Project 数据请求彼此独立
- **WHEN** 其中一个 Project 的 CLI 调用失败
- **THEN** Gateway MUST 将失败关联到该 Project 与 Binding
- **AND** Gateway MUST NOT 返回另一 Project 的数据作为 fallback
- **AND** Gateway MUST NOT 用空成功结果隐藏 root 或 CLI failure

### Requirement: Canonical Specs Remain Distinct From Delta And Referenced Specs
Project Data Gateway SHALL 将 canonical Specs、Change delta Specs 与 referenced Store Specs 作为不同来源。Current Project 的 canonical Specs 结果 MUST 来自该 Binding 的官方 canonical-spec surface，且 MUST NOT 因 active Changes 或 Store references 存在而静默合并其他来源。

#### Scenario: Active Change contains delta Specs
- **GIVEN** Current Project 有一个或多个 active Changes 且包含 delta Specs
- **WHEN** 消费者请求 canonical Specs
- **THEN** Gateway MUST 返回 canonical-spec surface 报告的 Specs
- **AND** active Change delta Specs MUST NOT 被加入 canonical Specs 集合

#### Scenario: No canonical Specs exist but delta Specs exist
- **GIVEN** canonical-spec surface 返回空集合
- **AND** active Changes 中存在 delta Specs
- **WHEN** Gateway 返回 canonical Specs 结果
- **THEN** canonical Specs MUST 保持空集合
- **AND** Gateway MUST NOT 通过扫描 active Changes 伪造 canonical Specs

#### Scenario: Project references a Store
- **GIVEN** OpenSpec context 报告一个或多个 referenced Stores
- **WHEN** Gateway 构造 Current Project Specs 数据
- **THEN** referenced Store Specs MUST 保持独立来源标识
- **AND** referenced Store Specs MUST NOT 被标记为 Project 本地 canonical Specs
- **AND** 本 Change 的 canonical Specs MVP MUST NOT 因无法加载 reference 内容而改变本地结果

### Requirement: Project-Bound Cache Is Disposable And Isolated
Gateway 使用缓存时 SHALL 将 Project identity 与 Root Binding identity 纳入 cache boundary。缓存 MUST 仅用于加速，且 MUST NOT 覆盖当前 CLI root resolution 或成为 Store、Workset、Project relationship 的事实源。

#### Scenario: Same Project resolves to a different root
- **GIVEN** Project 先前已有 Root A 的缓存数据
- **WHEN** 当前 CLI resolution 将同一 Project 解析到 Root B
- **THEN** Gateway MUST NOT 把 Root A 的缓存作为 Root B 的当前数据返回
- **AND** Root B MUST 使用独立 cache identity 或使旧缓存失效

#### Scenario: Cache is absent or cleared
- **GIVEN** Project-bound cache 不存在、已过期或被用户清除
- **WHEN** Gateway 加载 Current Project 数据
- **THEN** Gateway MUST 能通过 CLI-owned Binding 重新构造结果
- **AND** 系统 MUST NOT 需要插件维护的 Store/Workset registry 才能恢复

### Requirement: Gateway Introduction Is Additive And Read-Only
本 Change 中的 Project Data Gateway SHALL 作为并行 read path 引入。它 MUST NOT 删除现有 `DataManager`、改变当前 Dashboard/root selector 行为、执行 OpenSpec mutation，或修改全局 selected scope。

#### Scenario: Existing Dashboard remains on the legacy path
- **GIVEN** Gateway 已安装但后续 Project-first UI 尚未迁移
- **WHEN** 用户继续使用现有 Dashboard 与 Change Detail
- **THEN** 现有消息和 workflow 操作 MUST 保持可用
- **AND** Gateway MUST NOT 自动替换或重定向这些消费者

#### Scenario: Gateway parity is evaluated
- **GIVEN** 新旧 read paths 对同一个 Current Project 返回语义重叠的数据
- **WHEN** 测试比较 change 与 canonical spec 结果
- **THEN** 差异 MUST 按各自明确的数据语义解释或暴露为失败
- **AND** 系统 MUST NOT 为追求表面一致而把旧路径的 delta-spec 混合语义复制到 Gateway
