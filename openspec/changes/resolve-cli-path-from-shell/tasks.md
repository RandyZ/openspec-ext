# Implementation Tasks

> 参考 Superpowers 实现计划：[Resolve CLI Path From Shell Implementation Plan](../../../docs/superpowers/plans/2026-04-30-resolve-cli-path-from-shell.md)。
> 执行 `/opsx:apply` 时按 RED → GREEN → REFACTOR 推进，每个任务完成后运行对应测试再勾选。

## 1. CLI 路径解析器

- [ ] 1.1 新增 `OpenSpecCliResolver` 单元测试，覆盖 `openspec.cliPath` 配置路径优先并通过 `--version` 验证。
- [ ] 1.2 实现 `OpenSpecCliResolver` 的配置路径解析、当前 PATH 解析和成功结果缓存。
- [ ] 1.3 补充 shell fallback 单元测试，模拟 Extension Host PATH 不含 `openspec` 但 login shell `command -v openspec` 返回绝对路径。
- [ ] 1.4 实现受控 shell fallback，固定执行 `command -v openspec`，设置短 timeout，并对返回路径再次执行 `--version` 验证。
- [ ] 1.5 补充常见安装路径 fallback 测试与实现，覆盖 `/opt/homebrew/bin/openspec`、`/usr/local/bin/openspec`、`/usr/bin/openspec`。

## 2. OpenSpecCliService 接入

- [ ] 2.1 编写测试证明 `OpenSpecCliService` 使用 resolver 返回的绝对路径执行 `--version` 和后续 CLI 命令。
- [ ] 2.2 修改 `OpenSpecCliService`，移除硬编码 `spawn('openspec')`，改为通过 resolver 获取命令路径后执行。
- [ ] 2.3 避免 command-not-found 场景在 resolver fallback 前重复执行三次慢重试，确保直接路径失败后尽快进入 shell/common-path 解析。
- [ ] 2.4 处理已缓存路径执行时出现 ENOENT 的场景：清空缓存并重新解析一次。
- [ ] 2.5 保留最小版本检查、permission denied、workspace not initialized 等既有错误语义。
- [ ] 2.6 确认 CLI 不可用时仍不回退到纯文件扫描状态源。

## 3. 配置与诊断

- [ ] 3.1 新增 `openspec.cliPath` 配置项及英文、中文本地化说明。
- [ ] 3.2 更新 CLI not found 诊断，记录 `openspec.cliPath`、`process.env.PATH`、`process.env.SHELL` 和各解析策略结果。
- [ ] 3.3 更新错误提示动作，保留安装说明，并提供打开设置以配置 `openspec.cliPath` 的入口。
- [ ] 3.4 监听 `openspec.cliPath` 配置变更或在下一次 resolve 前检测配置变化，确保配置修改后不会复用过期缓存。
- [ ] 3.5 增加失败诊断测试，覆盖配置路径错误、shell fallback 超时、配置变更清缓存和全部解析失败。

## 4. 验证与收口

- [ ] 4.1 运行 `pnpm test`，确保新增和既有单元测试通过。
- [ ] 4.2 运行 `pnpm run build`，确保 extension host 与 webview 构建通过。
- [ ] 4.3 使用 VS Code/Cursor Extension Development Host 手工验证：模拟 Extension Host PATH 缺少 `openspec`，确认 shell fallback 或 `openspec.cliPath` 能让扩展激活。
- [ ] 4.4 记录验证命令、日志证据和任何环境限制。
