## Context

参考 Superpowers 前置设计文档：[OpenSpec CLI 路径解析设计](../../../docs/superpowers/specs/2026-04-30-resolve-cli-path-from-shell-design.md)。

当前 CLI 解析链路已经集中在 `OpenSpecCliResolver` 和 `OpenSpecCliService` 中：resolver 会收集诊断字符串，失败时抛出 `OpenSpecCliResolutionError`；service 在 CLI 不可用时显示通用错误通知，并把 diagnostics 写入 Output 日志。Dashboard 初始数据加载失败时，`DashboardViewProvider` 只向 webview 发送 `{ type: "error", message }`，webview 只显示一条通用错误。

这造成三个体验断点：

1. 诊断信息存在，但主要留在 Output 日志里，用户无法从 Dashboard 直接理解或复制。
2. 错误没有稳定分类，CLI 未安装、配置路径无效、权限错误、Windows shim/spawn 失败等场景使用相近提示。
3. Dashboard 无法加载时没有恢复动作，用户需要自己猜测是安装、PATH、设置还是平台问题。

目标数据流：

```text
-------------------------+
| OpenSpecCliResolver    |
| attempts + raw errors  |
+-----------+-------------+
            |
            v
+-------------------------+
| CliActivationDiagnostic |
| category + safe summary |
+-----------+-------------+
            |
       +----+-------------------+
       |                        |
       v                        v
+---------------+        +-------------------+
| VS Code toast |        | Dashboard webview |
| actions       |        | failure state     |
+---------------+        +-------------------+
```

## Goals / Non-Goals

**Goals:**

- 将 CLI 激活/解析失败转成稳定的结构化诊断模型。
- 让 VS Code 通知和 Dashboard 故障状态使用同一份诊断数据。
- 为常见失败类别提供明确恢复动作：打开设置、重试检测、复制诊断、打开安装/故障排查文档。
- 保护用户隐私：可复制诊断必须脱敏，不泄漏完整 PATH、用户名路径、环境变量密钥或 shell 输出中的敏感片段。
- 保持现有 resolver 的解析顺序和 CLI 真相源边界不变。
- 对通知做 session 级防刷屏，避免每次 refresh 都弹出同一错误。

**Non-Goals:**

- 不重写 CLI 路径解析算法，不新增无限路径扫描。
- 不自动安装 OpenSpec CLI，不修改用户 shell 配置。
- 不引入 standalone onboarding wizard。
- 不让 Dashboard 在 CLI 不可用时通过文件系统完整替代 CLI 数据源。
- 不把完整环境变量或完整 PATH 暴露给 webview。

## Decisions

### 1. 引入结构化 `CliActivationDiagnostic`

在 extension host 定义内部诊断类型，由 service/resolver 层生成，webview 只消费安全字段。

推荐形态：

```text
CliActivationDiagnostic
  category:
    cli-not-found
    configured-path-invalid
    permission-denied
    spawn-failed
    shell-resolution-failed
    version-check-failed
    unknown
  message
  recoveryActions[]
  safeDetails[]
  copyText
  canRetry
```

设计理由：

- category 让 UI 能展示针对性标题和文案，而不是解析自由文本。
- `safeDetails` 是面向用户的短诊断项；raw diagnostics 仍只进 Output 日志。
- `copyText` 由 extension host 生成并脱敏，webview 不负责清洗敏感信息。

备选方案是继续把 `Error.message` 传给 webview。该方案实现最小，但无法稳定分类，也无法测试“不同失败给不同恢复动作”。

第一版分类到恢复动作的映射固定如下，后续实现和测试必须以该表为准：

| category | 触发条件 | title/message 语义 | recoveryActions | canRetry |
|---|---|---|---|---|
| `configured-path-invalid` | `openspec.cliPath` 非空，路径缺失、不可执行或 `--version` 失败 | 配置的 CLI 路径无效，请修正或清空设置 | `open-settings`, `copy-diagnostics`, `open-docs` | true |
| `cli-not-found` | 所有既有 resolver 尝试均无法解析 CLI | 当前 VS Code/Cursor Extension Host 找不到 OpenSpec CLI | `open-docs`, `open-settings`, `retry`, `copy-diagnostics` | true |
| `permission-denied` | spawn 或 version check 返回 EACCES、EPERM 或 permission denied | 找到了 CLI，但当前进程没有执行权限 | `open-docs`, `copy-diagnostics`, `retry` | true |
| `spawn-failed` | 解析到命令后 spawn 失败，包含 Windows shim 或 `.cmd` 相关失败 | 找到了 CLI，但当前平台无法启动该命令 | `open-settings`, `copy-diagnostics`, `retry`, `open-docs` | true |
| `shell-resolution-failed` | shell fallback 超时、返回空或被判定 unsafe，且后续路径也未恢复 | shell PATH 解析失败，Extension Host 仍无法找到 CLI | `open-settings`, `open-docs`, `copy-diagnostics`, `retry` | true |
| `version-check-failed` | CLI 可启动但 `openspec --version` 失败或输出不可用 | CLI 可执行但版本检查失败 | `open-docs`, `copy-diagnostics`, `retry` | true |
| `unknown` | 无法归类的 CLI 初始化失败 | OpenSpec CLI 初始化失败 | `copy-diagnostics`, `retry`, `open-docs` | true |

恢复动作语义：

- `open-settings`: 执行 `workbench.action.openSettings` 并定位 `openspec.cliPath`。
- `retry`: 重新执行 CLI availability check，不修改用户设置。
- `copy-diagnostics`: 复制脱敏后的 `copyText`。
- `open-docs`: 打开 OpenSpec CLI 安装/故障排查文档。

通知按钮只展示映射表中的前 3 个动作；Dashboard 故障卡可以展示完整动作集。这样保持 toast 简洁，同时让 Dashboard 承载完整恢复路径。

### 2. Resolver 保留原始 attempts，Service 负责分类和脱敏

职责边界：

```text
OpenSpecCliResolver
  - 保留现有解析顺序
  - 继续记录尝试来源和原始失败原因
  - 不承担用户文案和恢复动作

OpenSpecCliService
  - 捕获 OpenSpecCliResolutionError / spawn error / permission error
  - 分类为 CliActivationDiagnostic
  - 写 raw diagnostics 到 Output 日志
  - 生成 safe details 和 copy text
```

理由：

- resolver 是低层执行组件，保留“发生了什么”即可。
- service 更接近产品语义，知道什么时候 notify、什么时候让 DataManager/Dashboard 消费。
- 这样可以避免未来 resolver 增加平台 fallback 时把 UI 文案散落进去。

### 3. DataManager 保存最近一次 CLI 诊断状态

`DataManager.initialize()` 当前在 CLI 不可用时会记录 warning 并继续启动文件监听，但后续 dashboard refresh 仍可能失败。新增一个只读诊断访问点：

```text
DataManager.getCliDiagnostic(): CliActivationDiagnostic | null
```

语义：

- 初始化或 refresh 失败时保存最近诊断。
- CLI 恢复可用后清空诊断。
- DataManager 不直接拥有 retry/cache orchestration；retry 由 webview message handler 调用 `OpenSpecCliService.checkAvailability()` 的显式重试入口后，再决定是否触发 `DataManager.refresh()`。
- 诊断状态不是 DashboardData 的一部分，避免把失败状态混入正常数据模型。

### 4. Webview 增加专用错误消息，而不是扩展通用 `error`

新增 extension-to-webview 消息：

```text
{ type: "cliActivationDiagnostic", diagnostic }
```

新增 webview-to-extension 消息：

```text
{ type: "retryCliDetection" }
{ type: "openCliPathSettings" }
{ type: "copyCliDiagnostic" }
{ type: "openCliInstallDocs" }
```

通用 `{ type: "error", message }` 保留给普通 dashboard 数据加载失败。CLI 激活失败使用专用消息，避免 UI 只能靠字符串匹配判断。

消息流：

```text
Dashboard
  -> getDashboardData
DashboardViewProvider
  -> DataManager.getDashboardData()
       fail with CLI diagnostic
  -> post cliActivationDiagnostic
Dashboard UI
  -> render failure card
  -> user clicks Retry / Settings / Copy / Docs
DashboardViewProvider
  -> handle retry/settings/copy/docs messages
```

### 5. Dashboard 故障状态使用“轻量恢复卡”，不是完整 onboarding

UI 目标：

```text
+--------------------------------------------------+
| OpenSpec CLI unavailable                         |
| We could not run OpenSpec from this VS Code host.|
| Category: configured path invalid                |
| Details:                                         |
| - openspec.cliPath is set but failed --version   |
| - Platform: win32                                |
|                                                  |
| [Open Settings] [Retry] [Copy Diagnostics] [Docs]|
+--------------------------------------------------+
```

约束：

- 卡片只在 Dashboard 无法得到正常数据且存在 CLI 诊断时作为 blocking failure 显示。
- 如果 Dashboard 已经有可用缓存数据，但后续 refresh 产生 CLI 诊断，则卡片以顶部 warning 显示，并保留当前缓存数据；这只是复用已有缓存，不新增任何文件驱动的数据路径或降级逻辑。
- 如果没有缓存数据且 CLI 诊断存在，Dashboard MUST 显示 blocking failure 卡片，不尝试新增纯文件扫描 fallback。
- 不展示完整 PATH；只展示摘要，例如 PATH entry count、是否存在常见目录、shell 名称。
- 文案需要 i18n，至少补 en/zh-cn。

### 6. 通知防刷屏按 category + message 做 session 去重

新增 session 内 key：

```text
dedupeKey = category + normalizedMessage
```

`normalizedMessage` 规则：

- 转小写。
- 去掉绝对路径中的用户目录片段，仅保留 basename 或 `<path>`。
- 去掉连续空白和换行。
- 去掉时间戳、耗时、attempt 序号等易变片段。
- 保留错误 code，例如 `ENOENT`、`EACCES`、`EPERM`、exit code。
- 截断到 160 字符。

示例：

```text
raw: Configured OpenSpec CLI path is invalid: /Users/randy/bin/openspec
normalized: configured openspec cli path is invalid: <path>/openspec

raw: Failed to spawn openspec: spawn C:\Users\Randy\AppData\Roaming\npm\openspec.cmd ENOENT
normalized: failed to spawn openspec: spawn <path>/openspec.cmd enoent
```

同一个 `dedupeKey` 在当前 extension session 内只弹一次 VS Code error notification；Output 日志仍可记录每次失败。用户点击 Retry 后如果类别/归一化消息没有变化，不再次弹窗，但 Dashboard 状态必须刷新。用户修改 `openspec.cliPath` 或 reload window 后视为新 session/新诊断上下文。

理由：

- file watcher、dashboard warm、manual refresh 都可能触发 CLI 调用。
- 重复弹窗会让用户误以为多个不同故障。

### 7. 复制诊断必须脱敏

允许进入复制文本的信息：

- extension version
- platform / arch
- workspace basename 或相对标识，不复制完整用户目录
- `openspec.cliPath` 是否为空；若非空，只保留 basename 和是否绝对路径
- PATH entry count；可标记是否包含 Homebrew/npm 常见目录，但不列全量
- shell basename
- resolver attempt labels 和错误类别
- OpenSpec CLI version check 是否成功

禁止进入复制文本的信息：

- 完整 `process.env.PATH`
- 完整 home path、用户名路径
- 任意包含 `TOKEN`、`KEY`、`SECRET`、`PASSWORD` 的环境变量
- shell 命令的未清洗 stdout/stderr 全文

## Risks / Trade-offs

- [Risk] 过度脱敏导致诊断对维护者不够用。  
  → Mitigation: Output 日志保留本地 raw diagnostics；复制文本保留 attempt label、错误 code、平台和设置状态，足够定位大多数用户反馈。

- [Risk] Dashboard 故障状态与 VS Code 通知文案漂移。  
  → Mitigation: 两者都从 `CliActivationDiagnostic` 派生；通知只展示短文案，Dashboard 展示同一诊断的详细安全字段。

- [Risk] retry 行为可能被用户误解为重新安装或修改配置。  
  → Mitigation: Retry 只重新运行 CLI detection，不修改用户配置；按钮文案和 README 明确这一点。

- [Risk] CLI 不可用时已有缓存数据与新诊断同时存在，用户可能误以为系统在使用新的文件 fallback。  
  → Mitigation: 第一版规则是“缓存数据优先，诊断作为顶部 warning；无缓存时显示 blocking failure”，并明确不新增任何文件驱动的数据路径。

## Migration Plan

1. 定义 `CliActivationDiagnostic` 类型和分类 helper。
2. 在 `OpenSpecCliService` 中把 resolver/spawn/permission/version 错误转换为诊断，并保留 raw Output 日志。
3. 在 `DataManager` 中保存最近诊断并提供只读访问方法；retry orchestration 留在 webview message handler/service 层。
4. 扩展 webview message 类型和 handler，支持诊断消息与恢复动作。
5. 在 Dashboard 中增加 CLI 故障状态组件，复用 VS Code theme token 和 i18n 文案。
6. 更新 README/README.zh-CN troubleshooting。
7. 增加单元测试和组件测试，最后运行 `pnpm test`、`pnpm run build`、`openspec validate improve-cli-activation-diagnostics --strict`。

回滚策略：

- 若 Dashboard 故障状态存在兼容问题，可先保留 extension host 结构化诊断和通知动作，临时退回通用 `error` UI。
- 若诊断分类过细导致误判，可保留 `unknown` fallback，不影响 CLI 执行主路径。

## Open Questions

无阻塞性 open question。第一版不新增安装器和 onboarding wizard；重点是失败诊断与恢复动作。
