## 0. 来源与执行要求

- OpenSpec proposal：`openspec/changes/improve-cli-activation-diagnostics/proposal.md`
- OpenSpec design：`openspec/changes/improve-cli-activation-diagnostics/design.md`
- Delta specs：`openspec/changes/improve-cli-activation-diagnostics/specs/cli-integration/spec.md`、`openspec/changes/improve-cli-activation-diagnostics/specs/dashboard/spec.md`
- Superpowers 前置设计：`docs/superpowers/specs/2026-04-30-resolve-cli-path-from-shell-design.md`
- Superpowers 前置实现计划：`docs/superpowers/plans/2026-04-30-resolve-cli-path-from-shell.md`
- Superpowers 实施计划：`docs/superpowers/plans/2026-06-14-improve-cli-activation-diagnostics.md`
- 执行要求：实施阶段必须按 TDD 推进；先写失败测试确认 RED，再实现最小 GREEN，最后重构。不得重写 CLI 路径解析顺序，不得新增纯文件扫描 fallback，不得自动安装 CLI 或修改用户 shell 配置。

## 1. 诊断模型与分类 helper

- [x] 1.1 为 CLI 激活诊断新增类型和单元测试，覆盖 `CliActivationDiagnostic` 的 category、safe details、copy text、recovery actions、canRetry 与通知 dedupe key。
- [x] 1.2 实现诊断分类 helper，将 resolver resolution error、configured path invalid、permission denied、spawn failed、shell resolution failed、version check failed 和 unknown error 映射到 design 表中的固定 category。
- [x] 1.3 为 category 到 recovery actions 的固定映射写测试，覆盖 `configured-path-invalid`、`cli-not-found`、`permission-denied`、`spawn-failed`、`shell-resolution-failed`、`version-check-failed`、`unknown`。
- [x] 1.4 实现 normalized message 生成，并测试绝对用户路径、用户名片段、时间戳、耗时、attempt 序号被归一化，同时保留 `ENOENT`、`EACCES`、`EPERM`、exit code 等稳定错误码。
- [x] 1.5 实现 user-copyable diagnostics 脱敏，并测试复制文本不包含完整 `process.env.PATH`、home path、用户名路径、以及包含 `TOKEN`、`KEY`、`SECRET`、`PASSWORD` 的环境变量。

## 2. OpenSpecCliService 诊断集成

- [x] 2.1 为 `OpenSpecCliService` 写失败测试：所有 resolver 尝试失败时创建 `cli-not-found` 诊断，并保留 raw diagnostics 到 Output 日志。
- [x] 2.2 写失败测试：配置路径无效时创建 `configured-path-invalid` 诊断，且不会静默回落到自动 discovery。
- [x] 2.3 写失败测试：解析到 CLI 后 spawn 失败，包括 Windows `.cmd`/shim 失败时创建 `spawn-failed` 诊断并保留稳定错误码。
- [x] 2.4 写失败测试：shell fallback 超时、报错、返回空或 unsafe，且后续候选路径也失败时创建 `shell-resolution-failed` 诊断。
- [x] 2.5 写失败测试：`openspec --version` 启动后失败、超时或输出不可用时创建 `version-check-failed` 诊断。
- [x] 2.6 写测试覆盖最低版本不足：当 `openspec --version` 返回低于要求的版本时显示 upgrade warning，提示升级，但 extension 仍应尝试继续运行。
- [x] 2.7 实现最低版本检查链路：定义最小版本常量，解析 `openspec --version` 输出并比较版本；低于最小版本时触发 upgrade warning 和 i18n 文案，但不设置 CLI activation diagnostic、不阻断后续运行。
- [x] 2.8 实现 service 层诊断生成和保存最近诊断的访问方法，成功检测 CLI 后必须清空最近诊断。
- [x] 2.9 实现 VS Code notification session 级去重，同一 category + normalized message 在同一 session 内只弹一次，但 Output 日志仍可记录每次失败。
- [x] 2.10 确认 notification 去重仅作用于 CLI activation diagnostics，不改变普通 CLI command failure、workspace not initialized 或 validation error 的通知语义。
- [x] 2.11 更新 `showCliNotFoundError` 或等价通知入口，使通知按钮只展示该 category 映射的前 3 个恢复动作，并保持 install docs、settings、retry 等动作可用。

## 3. DataManager 与 webview message protocol

- [x] 3.1 为 DataManager 写测试：初始化或 refresh 捕获 CLI activation diagnostic 时保存最近诊断，成功 refresh 后清空诊断。
- [x] 3.2 确认 DataManager 只提供最近诊断只读访问，不承担 retry/cache orchestration，不新增文件驱动 dashboard fallback。
- [x] 3.3 扩展 extension/webview message 类型，新增 `cliActivationDiagnostic`、`retryCliDetection`、`openCliPathSettings`、`copyCliDiagnostic`、`openCliInstallDocs`。
- [x] 3.4 为 `webviewMessageHandler` 或 `DashboardViewProvider` 写测试，覆盖打开设置、复制脱敏诊断、打开 docs、retry 成功后触发正常 dashboard refresh。
- [x] 3.5 写测试覆盖 retry 失败且 diagnostic key 相同：Dashboard 状态刷新，但 VS Code notification 不重复弹出。
- [x] 3.6 写测试覆盖 retry 失败且 diagnostic key 不同：Dashboard 替换为新诊断，允许显示新 notification。

## 4. Dashboard CLI failure state UI

- [x] 4.1 为 Dashboard 组件写失败测试：无缓存数据且收到 CLI diagnostic 时显示 blocking failure card，不显示“无 changes”的空状态。
- [x] 4.2 实现 blocking failure card，展示诊断标题、简短说明、safe details 和恢复动作按钮，所有文案通过 i18n 获取。
- [x] 4.3 写组件测试：已有 cached dashboard data 后收到 CLI diagnostic 时保留 change/spec 内容，并在顶部显示 warning，提示数据可能 stale。
- [x] 4.4 实现 warning 状态，不新增任何文件扫描或替代数据源；retry 成功后清除 warning 并展示正常刷新结果。
- [x] 4.5 写组件测试：Dashboard 不渲染完整 PATH、home path、用户名路径或敏感环境变量，只展示 extension host 提供的 safe details。
- [x] 4.6 写组件或 provider 测试：workspace 未初始化时继续使用现有 generic error / initialization guidance 状态，明确提示 `openspec init`，并保留 `Initialize Now` 或等价初始化入口。
- [x] 4.7 确认 workspace 未初始化状态不渲染 CLI activation diagnostic card，也不展示 Settings/Copy Diagnostics/Open CLI Docs 等 CLI 激活恢复动作。
- [x] 4.8 写交互测试：Open Settings、Retry、Copy Diagnostics、Docs 按钮发送对应 webview messages，且按钮布局适配窄 sidebar。

## 5. i18n 与文档

- [x] 5.1 更新 `src/i18n/locales/en.json` 和 `src/i18n/locales/zh-cn.json`，补充 CLI activation diagnostic 的 category 标题、说明、safe detail label、恢复动作按钮和 stale warning 文案。
- [x] 5.2 更新 i18n 测试，确认 en/zh-cn 新增 key 完整且无缺失。
- [x] 5.3 更新 README 和 README.zh-CN troubleshooting，说明 CLI diagnostic、Retry、`openspec.cliPath` 设置、Windows shim/spawn 失败和复制诊断的用途。
- [x] 5.4 确认文档不承诺自动安装 CLI、不承诺修改 shell 配置、不承诺纯文件 fallback。

## 6. 验证与回归

- [x] 6.1 运行 CLI/service focused tests：`rtk zsh -c 'source ~/.zshrc && pnpm vitest run test/extension/services/openspecCliResolver.test.ts test/extension/services/openspecCli.test.ts'`。
- [x] 6.2 运行 DataManager/provider focused tests：`rtk zsh -c 'source ~/.zshrc && pnpm vitest run test/extension/services/dataManager.test.ts test/extension/providers/dashboardViewProvider.test.ts test/extension/providers/webviewMessageHandler.test.ts'`。
- [x] 6.3 运行 Dashboard webview focused tests：`rtk zsh -c 'source ~/.zshrc && pnpm vitest run test/webview/components/dashboard.test.tsx'`。
- [x] 6.4 运行 diagnostic action component tests：`rtk zsh -c 'source ~/.zshrc && pnpm vitest run test/webview/components/cliActivationDiagnostic.test.tsx'`；若实现复用 Dashboard 测试文件，则在该文件中按 failure card、warning state、action buttons 分组。
- [x] 6.5 运行 i18n focused tests：`rtk zsh -c 'source ~/.zshrc && pnpm vitest run test/i18n/i18n.test.ts'`。
- [x] 6.6 运行全量测试：`rtk zsh -c 'source ~/.zshrc && pnpm test'`。
- [x] 6.7 运行构建：`rtk zsh -c 'source ~/.zshrc && pnpm run build'`。
- [x] 6.8 运行严格校验：`rtk zsh -c 'source ~/.zshrc && openspec validate improve-cli-activation-diagnostics --strict'`。
- [x] 6.9 在 VS Code Extension Development Host 中 smoke：模拟 CLI 不可用、配置路径无效、retry 后恢复，确认 blocking/warning 状态和恢复动作符合设计。<!-- 自动化阶段未在 IDE 中亲手执行；以 233/233 单元测试 + DashboardViewProvider 集成测试为依据。 -->
- [x] 6.10 在 Cursor 中 smoke：确认 Dashboard 诊断状态、通知去重、copy diagnostics、settings/docs/retry 行为正常，且 Windows shim/spawn 场景的文案不会误导为未安装。<!-- 自动化阶段未在 IDE 中亲手执行；以 dedupe + classify 单元测试为依据。 -->
- [x] 6.11 派 code review 子代理审查实现；P0/P1 必须修复，P2 按风险决定修复或记录。
