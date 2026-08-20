## Context

本设计承接 `explore.md`、`proposal.md` 与 `project-data-access` delta spec，只解决第一阶段的数据正确性边界。

当前 `DataManager` 同时持有可变 `selectedScope`、按 scope 创建的 `OpenSpecCliService`，以及从 `scope.rootPath/openspec` 独立创建的 `FileManagerService`。这使“用户正在查看的代码 Project”和“OpenSpec 数据实际位于哪个 root”被压缩成同一个概念；CLI 与文件读取也可能在一次业务读取中指向不同 root。

另一个已确认的语义问题是 `StateReader.listSpecs()` 会合并 canonical Specs 与 active Change delta Specs，而下一代 Project-first UX 必须把 canonical、delta、referenced Store Specs 保持为不同来源。

本 Change 采用并行、只读的迁移切片：新增 Extension Host 内部的 Project 数据入口，保留现有 Dashboard、Change Detail、workflow、cache 和 watcher 路径。OpenSpec CLI 继续作为 root、Store、Workset、Changes 与 canonical Specs 的事实源；插件不复制全局 Store/Workset registry。

## Goals / Non-Goals

### Goals

- 用稳定 `ProjectContext` 表达代码工程，用独立 `OpenSpecRootBinding` 表达规划数据位置。
- 从 Project working directory 调用官方 `context --json` 完成 root resolution。
- 让一次读取中的 CLI 与 `ContentAccess` 都由同一个不可变 Binding 创建。
- 为 Current Project 返回小型 Changes 与 canonical Specs read model。
- 不依赖或修改全局 `selectedScope`，并保证并发 Project 读取互不污染。
- 用聚焦测试覆盖本地 root、外部/global-default root、显式 Store、同根绑定、canonical Specs 语义和失败边界。

### Non-Goals

- 不重做 Sidebar、Dashboard、root selector、Stores & Worksets UI 或 Change Detail Panel。
- 不新增 Workset Project 导航、Git repository/worktree identity、Project registry 或 Store consumer 反向索引。
- 不迁移 mutation、workflow delivery、Adapter、watcher lifecycle 或多 Project 缓存。
- 不删除 `selectedScope`、旧 DTO、旧消息或现有服务。
- 不归档、同步或修改 `polish-workset-store-root-management-ui`。

## Decisions

### 1. 使用两个显式、请求级身份

在现有 Extension service types 中新增最小模型，不创建新的共享模型包：

```typescript
interface ProjectContext {
  readonly id: string;
  readonly label: string;
  readonly projectPath: string;
}

interface OpenSpecRootBinding {
  readonly projectId: string;
  readonly commandCwd: string;
  readonly rootPath: string;
  readonly rootSource: string;
  readonly storeId?: string;
}
```

`ProjectContext` 只由 Extension Host 根据已知 VS Code workspace folder 创建。`projectPath` 使用文件系统 canonical absolute path；MVP 直接以该 path 作为 `id`，不引入 hash、持久化 registry 或尚未定义的 Git identity。`label` 使用 workspace folder 展示名。

`OpenSpecRootBinding` 是一次 root probe 的不可变快照。`rootSource` 保持开放字符串，避免 CLI 新增 source 时插件因封闭枚举失效。`storeId` 只有在调用方已经完成显式 Store 选择时才存在；普通 Project 与 `global_default` 都不填充该字段。

这些对象不会读取 `OpenSpecScopeManager.selectedScope`，也不会在请求开始后根据 UI 选择变化重新赋值。

### 2. 新增一个最小的 `ProjectDataGateway`

新增 `src/extension/services/projectDataGateway.ts`，复用现有 `OpenSpecCliService`、CLI resolver、`FileManagerService`、`ChangeInfo` 与 `SpecInfo`。不新增单实现接口、session class、registry 或生命周期框架。

公开入口保持为三个职责单一的方法：

```typescript
resolveBinding(project, explicitStoreId?): Promise<OpenSpecRootBinding>
loadChanges(project, explicitStoreId?): Promise<ProjectChangesData>
loadCanonicalSpecs(project, explicitStoreId?): Promise<ProjectCanonicalSpecsData>
```

返回模型只包含消费者需要的 identity 与列表：

```typescript
interface ProjectChangesData {
  readonly project: ProjectContext;
  readonly binding: OpenSpecRootBinding;
  readonly changes: readonly ChangeInfo[];
}

interface ProjectCanonicalSpecsData {
  readonly project: ProjectContext;
  readonly binding: OpenSpecRootBinding;
  readonly specs: readonly SpecInfo[];
}
```

每次 `load*` 先解析 Binding，再通过一个私有 `bind()` helper 从该 Binding 构造请求局部的 CLI 与 `FileManagerService`。helper 返回普通对象，不引入额外抽象。`FileManagerService` 的构造不执行 I/O，因此即使 Changes/Specs MVP 只调用 CLI，也可以低成本建立并测试“两个 reader 来自同一个 Binding”的约束。

默认生产实现直接构造现有服务；测试只注入两个小型 factory function 以观察 cwd、selector 与 content root，不为此新增 interface hierarchy。

### 3. Root resolution 完全服从 CLI

在 `OpenSpecCliService` 上新增最小 `getContext(scope?)` JSON 方法，内部复用现有命令执行与 resolver，不让 Gateway 自己复制进程调用逻辑。

普通 Project 的解析顺序：

```text
ProjectContext.projectPath
          |
          v
OpenSpecCliService(cwd = projectPath)
          |
          v
openspec context --json        (no selector)
          |
          v
validate root + source
          |
          v
canonical root path
          |
          v
OpenSpecRootBinding
```

Gateway 只接受 CLI 响应中的 root identity 和 source，不扫描 `projectPath/openspec`，不查询 Store registry 推断 selector，也不使用 Workset membership 或历史选择兜底。CLI 返回外部 root 或 `global_default` 时照常接受，且不自动转换成 Store binding。

显式 Store 流程只把调用方给出的 Store id 转成现有 CLI `--store` 选项，并把它保存在该次 Binding 中。该 selector 不写入 Gateway、DataManager 或 ScopeManager 的全局状态。并发请求各自创建 CLI 实例和参数，不能共享可变 selector。

### 4. Binding 在进入文件读取前 fail closed

Root probe 成功后执行以下边界检查：

1. root 必须是非空 absolute path，source 必须是非空字符串；
2. root 必须能够通过文件系统 `realpath` canonicalize；
3. `root/openspec` 必须能够 canonicalize，且 canonical content path 必须位于 canonical root 内；
4. CLI 响应、canonical path 或 selector identity 不一致时，不创建 readers。

这里的“允许范围”是 CLI 返回的 canonical root，不是 VS Code workspace。外部 Store/global-default root 是合法输入；从该 root 派生的 `openspec` 路径若通过 symlink 逃逸 root 才失败。

任何检查失败都直接抛出带 `projectId`、失败阶段和可用 Binding 信息的单一 `ProjectDataAccessError`。不建立错误类层级，不返回空成功结果，也不回退到另一个 Project 或本地 `projectPath/openspec`。

### 5. CLI 与 ContentAccess 只从同一 Binding 创建

`bind()` 的唯一输入是已验证 Binding：

```text
                 OpenSpecRootBinding
                    /          \
                   /            \
                  v              v
  OpenSpecCliService         FileManagerService
  cwd = commandCwd           dir = rootPath/openspec
  selector = storeId?        canonical + contained
                   \            /
                    \          /
                     v        v
                    one read result
```

CLI 数据命令保持与 root probe 相同的 `commandCwd` 和 selector。文件内容只能使用 Binding 派生的 canonical `rootPath/openspec`。Gateway 不接受由调用方单独传入的 content root，因此不存在“CLI 用 A、文件用 B”的组合入口。

本 Change 暂不新增 artifact/task/archive 公开读取方法；但构造约束和 factory-observation test 会固定同根行为。后续文件型方法必须复用 `bind()`，不得重新从 Project path 或当前 scope 创建 `ContentAccess`。

### 6. Changes 与 canonical Specs 直接使用官方 CLI 语义

- `loadChanges()` 使用已绑定 `OpenSpecCliService.listChanges()`；继续复用现有 list + status enrichment。
- `loadCanonicalSpecs()` 使用已绑定 `OpenSpecCliService.listSpecs()`，即官方 `list --specs --json` surface。
- 新 Gateway 不调用 `StateReader.listSpecs()`，因为该方法当前会合并 main Specs 与 active Change delta Specs。
- canonical surface 返回空时保持空；不扫描 active Changes 伪造 canonical Specs。
- referenced Store Specs 不在 MVP 中加载，也不影响本地 canonical 结果。后续 UX 必须使用独立来源和独立 DTO。

该差异是语义修正，不要求新 Gateway 为“表面 parity”复制旧路径的混合行为。

### 7. 本阶段不接入 cache

Gateway 首版直接执行 CLI 读取。现有 `OpenSpecCacheService` 保持不变并继续服务旧 Dashboard；新路径不创建第二套缓存抽象，也不把旧 scope cache 强行适配成 Project cache。

delta spec 对 cache 的要求是条件式的：当后续 Change 确实接入 cache 时，key 至少必须包含 Project id、canonical root path、root source 与显式 Store id；每次读取仍先做当前 CLI root resolution，cache 不能覆盖新的 Binding。

这样可以先验证正确性边界，再根据实际性能数据决定是否缓存。

### 8. Extension/Webview 消息在本 Change 中保持不变

当前消息路径完全保留：

```text
Webview
  |  getDashboardData
  v
WebviewMessageHandler / DashboardViewProvider
  |
  v
DataManager -> legacy scope-aware readers
  |
  |  dashboardData
  v
Webview
```

本 Change 不新增 Webview message type，也不把 `ProjectContext` 暴露给 Webview；`ProjectDataGateway` 仅作为 Extension Host 内部并行 read path 存在。因此现有 Dashboard、root selector、Change Detail 与 workflow message 行为不变。

后续 Project-first UI Change 才拥有新的 request/response contract 和 provider wiring。届时 Webview 只能发送 Extension 已知的 `projectId`，不能提交任意文件系统 path；Extension 根据 VS Code workspace folders 还原 `ProjectContext` 后再调用 Gateway。该约束在本 Change 不提前实现。

### 9. 通过 TDD 固定语义，而不是改造旧路径

测试优先覆盖：

- 同一 workspace folder 在不同 selector 下产生相同 Project identity；
- 普通 Project 从 project cwd 进行 selector-free context 与数据调用；
- 外部 root 和 `global_default` 被接受且不自动携带 Store selector；
- 显式 Store selector 仅存在于对应请求；
- CLI/file factories 接收到同一 Binding 派生的 cwd、selector 和 content root；
- 不可 canonicalize、缺失 root/source、symlink 逃逸等情况在文件访问前失败；
- 两个 Project 并发读取时结果、selector、错误互不影响；
- Changes 复用现有 CLI list/status 语义；
- canonical Specs 不混入 delta Specs，canonical 空集合保持为空；
- 单个 Project 失败带回该 Project/Binding identity，且没有空结果或跨 Project fallback；
- 旧 Dashboard message path 不因 Gateway 存在而改变。

测试使用临时目录和小型 factory fakes，不访问 machine-global Store/Workset state，不新增依赖，也不依赖真实用户配置。

## Risks / Trade-offs

- **临时双路径**：新旧读取会短期并存。通过不共享 mutable scope、聚焦 parity 测试和后续按消费者迁移控制风险；本 Change 不为了消除重复而重写 `DataManager`。
- **CLI JSON shape 演进**：只校验本能力必需的 root/source，并把 source 保持开放字符串；未知附加字段忽略，缺少必需字段 fail closed。
- **额外 CLI 调用**：每次 Gateway read 都先解析 root，首版也不缓存。正确性优先；只有真实性能数据证明需要时才增加 Project-bound cache。
- **外部 root 与 symlink**：外部 root 合法，但 content path 必须 canonicalize 且受 root containment 约束。这可能拒绝有意把整个 `openspec` 目录 symlink 到 root 外的布局；该限制来自 fail-closed spec。
- **短期未被 UI 使用**：Gateway 在本 Change 中是受测试的迁移边界，不是新 UI 功能。这样 rollback 简单，也避免基础正确性与大规模界面改造同时发生。
- **MVP Project id 只是 canonical path**：它不能表达跨路径 Git repository/worktree identity；该能力明确留给后续 Change，当前不建立错误的永久 registry。

## Migration Plan

1. 先为 Project Context、CLI context parsing、root canonicalization 和错误边界写失败测试。
2. 在现有 service types 与 `OpenSpecCliService` 中加入最小类型和 `getContext()` surface，使测试通过。
3. 为 Changes、canonical Specs、同根 reader factory 与并发隔离写失败测试。
4. 实现 `ProjectDataGateway` 的三个公开入口与私有 `bind()`，不接 UI、不接 cache、不修改 selected scope。
5. 运行 focused tests、全量 unit tests、build、lint 以及 OpenSpec strict validation；确认旧 Dashboard 消息测试保持通过。
6. 后续独立 UX Change 按页面接入 Gateway，并在所有消费者迁移完成后再删除旧 scope/root UI 与聚合 DTO。

回滚只需移除新增 Gateway、相关类型/测试以及 `OpenSpecCliService.getContext()`；由于本 Change 没有替换现有消费者，也没有新持久化数据或 mutation，旧路径无需恢复数据。

## Open Questions

无阻塞问题。Project registry、Git/worktree identity、Workset 反向 membership、referenced Store Specs、watcher 生命周期、cache 接入及新 Webview message contract 均已明确延期到各自后续 Change，不影响本设计落地。

## Spec Amendments

无。设计审查未发现需要修改当前 `project-data-access` delta spec 的缺口；外部 root 的合法性与 content path 的 root containment 已在上述实现决策中明确。
