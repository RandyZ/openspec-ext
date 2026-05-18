# OpenSpec CLI 路径解析设计

## 背景

用户在终端中可以执行 `openspec`，但 Cursor/VS Code 插件激活时仍报 `spawn openspec ENOENT`。原因是 macOS GUI 启动的 Extension Host 通常不会继承交互式 shell 的 PATH，导致插件的 `process.env.PATH` 看不到 npm、Homebrew 或用户自定义安装目录。

## 目标

- 支持用户显式配置 `openspec.cliPath`，直接指定 OpenSpec CLI 绝对路径。
- 当直接 `spawn openspec` 失败时，通过用户 login shell 解析 `command -v openspec`。
- 在常见安装路径中做有限 fallback，包括 `/opt/homebrew/bin/openspec` 和 `/usr/local/bin/openspec`。
- 解析成功后缓存绝对路径，后续 CLI 调用复用同一路径。
- 解析失败时提供可诊断的错误信息，包括当前 PATH、SHELL、配置项建议。

## 推荐方案

采用 A+B 组合方案：

1. **配置优先**：新增 `openspec.cliPath`。如果配置非空，插件优先验证并使用该路径。
2. **PATH 直连**：配置为空时先按现有方式尝试 `openspec`，保持 Linux/Windows/已正确继承 PATH 的环境不变。
3. **Shell 解析**：遇到 ENOENT 时执行 `${SHELL:-/bin/zsh} -l -c 'command -v openspec'`，拿到绝对路径后验证 `--version`。
4. **常见路径 fallback**：shell 解析失败后再尝试 `/opt/homebrew/bin/openspec`、`/usr/local/bin/openspec` 等只读候选路径。
5. **缓存与日志**：成功解析后缓存路径并记录来源；失败时展示更具体的安装/配置指引。

## 边界

- 不做纯文件扫描 fallback；OpenSpec CLI 仍是状态源。
- 不自动修改用户 shell 配置或环境变量。
- 不执行任意用户输入命令；shell 解析命令固定为 `command -v openspec`。

## 需要修改的能力

- `cli-integration`：CLI 可用性检测、命令执行路径解析、错误提示与诊断信息。

## 验证重点

- 模拟 `PATH` 缺少 `openspec` 但 shell login PATH 能找到的场景。
- 验证显式 `openspec.cliPath` 优先级高于 shell 解析。
- 验证解析失败时提示不再只说“未安装”，而是包含 PATH/SHELL/config 建议。
