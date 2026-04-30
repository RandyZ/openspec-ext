## Why

用户在终端中可以正常运行 `openspec`，但从 Cursor/VS Code GUI 启动扩展时，Extension Host 的 `PATH` 可能不包含终端 shell 配置中的 npm/Homebrew 安装路径，导致激活阶段 `spawn openspec ENOENT`。这会让已正确安装 OpenSpec CLI 的用户误判为未安装，并阻断 Dashboard 激活。

参考 Superpowers 设计文档：[OpenSpec CLI 路径解析设计](../../../docs/superpowers/specs/2026-04-30-resolve-cli-path-from-shell-design.md)。

## What Changes

- 新增 `openspec.cliPath` 配置项，允许用户显式指定 OpenSpec CLI 绝对路径。
- 在直接执行 `openspec` 失败或不可用时，使用用户 shell 的 login 环境解析 `command -v openspec`，找到后缓存绝对路径并继续执行。
- 在 shell 解析失败时，尝试常见安装路径，例如 `/opt/homebrew/bin/openspec` 和 `/usr/local/bin/openspec`。
- 改进 CLI not found 错误信息，区分“未安装”和“终端可用但 Extension Host PATH 不可见”，并提示配置 `openspec.cliPath`。
- 保持 CLI 作为状态来源，不引入纯文件扫描 fallback。

## Capabilities

### New Capabilities

无。本次变更修复现有 CLI 集成能力中的 CLI 路径发现问题。

### Modified Capabilities

- `cli-integration`: CLI 可用性检查必须支持显式路径配置、Extension Host PATH、用户 shell PATH 解析和常见安装路径 fallback，并在失败时提供可诊断的错误提示。

## Impact

- Extension Host: `OpenSpecCliService` 的 CLI 路径解析、缓存、spawn 调用和错误提示。
- Configuration: 新增 `openspec.cliPath` 设置项及 i18n 文案。
- Tests: 增加 CLI 路径解析单元测试，覆盖配置路径、PATH 直接命中、shell fallback、常见路径 fallback 和失败诊断。
