## Why

参考 Superpowers 前置设计文档：[OpenSpec CLI 路径解析设计](../../../docs/superpowers/specs/2026-04-30-resolve-cli-path-from-shell-design.md)。

现有 resolver 已经负责 CLI 路径解析与 fallback，但当解析失败或平台兼容问题导致激活失败时，用户主要只能从通知和 Output 日志里拼凑原因。真实反馈中已经出现 Windows 下 `openspec.cmd` spawn 失败导致扩展无法激活的问题；这类失败会让 Dashboard 完全不可达，因此需要把 CLI 激活失败变成可诊断、可恢复的产品体验。

## What Changes

- 在 CLI 可用性检查失败时提供结构化诊断结果，覆盖当前平台、workspace、配置的 `openspec.cliPath`、Extension Host PATH 摘要、shell 信息、现有 resolver 尝试过的解析方法和失败原因。
- 改进激活失败的用户提示：区分 CLI 未安装、配置路径无效、shell/path 解析失败、权限不足、Windows shim/spawn 失败等场景，并给出下一步恢复动作。
- 提供可操作恢复入口，例如打开 `openspec.cliPath` 设置、复制诊断信息、重试 CLI 检测、打开 OpenSpec 安装/故障排查文档。
- 在 Dashboard 无法正常加载时展示轻量故障状态，避免用户只看到空白或通用加载失败。
- 保持 OpenSpec CLI 仍是运行时真相源；本变更不引入纯文件扫描 fallback，不改变 change/spec/task 数据来源。
- 补充测试覆盖 CLI 激活诊断、错误分类、一次性通知防刷屏、诊断信息脱敏和 UI 恢复动作消息链路。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `cli-integration`: CLI 可用性检查失败时必须产生可展示、可复制、可恢复的诊断信息，并针对不同失败类别提供明确恢复动作。
- `dashboard`: Dashboard 在 CLI 不可用或初始化失败时必须展示轻量故障状态，并提供恢复动作入口，而不是只显示通用加载失败或空白状态。

## Impact

- Extension Host: CLI path resolver、OpenSpec CLI service、DataManager 初始化失败处理、错误通知和 Output 日志。
- Webview: Dashboard 加载失败或 CLI 不可用时的故障状态与恢复动作入口。
- Configuration: 复用现有 `openspec.cliPath`，可能补充打开设置或重试检测的命令/消息，不新增重型配置体系。
- Documentation: README/README.zh-CN troubleshooting 需要补充 CLI 诊断和 Windows shim/spawn 失败恢复说明。
- Tests: 增加 extension service/provider/webview 相关单元测试，覆盖失败分类、诊断结构、恢复动作和非刷屏行为。
