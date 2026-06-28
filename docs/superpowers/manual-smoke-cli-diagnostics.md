# Manual Smoke: CLI Activation Diagnostics

> 对应 change: `improve-cli-activation-diagnostics`（已归档至 `openspec/changes/archive/2026-06-14-improve-cli-activation-diagnostics/`）
>
> 自动化测试: 233/233 通过；`openspec validate --strict` 通过；build 通过。
>
> 以下两个场景需要人工在 IDE 中完成，无法通过 CLI session 驱动。

---

## 6.9 VS Code Extension Development Host (EDH) 烟雾测试

**启动方式:** `F5` → "Run Extension"

### 测试矩阵

| # | 操作 | 预期结果 |
|---|---|---|
| 1 | 设置 `openspec.cliPath` 为一个不存在的路径（如 `/bad/openspec`），打开 OpenSpec Dashboard | Dashboard 显示 **blocking** 诊断卡片，标题提示配置路径无效，下方有 Open Settings / Copy Diagnostics / Open Docs 按钮 |
| 2 | 点击 **Open Settings** | VS Code 设置面板打开，定位到 `openspec.cliPath` |
| 3 | 再次打开 Dashboard，点击 **Copy Diagnostics** | 剪贴板内容包含 `category=configured-path-invalid`，**不含** `/Users/…` 或 `SECRET` 等敏感信息 |
| 4 | 再次打开 Dashboard，点击 **Open Docs** | 浏览器打开 OpenSpec GitHub quick-start 页面 |
| 5 | 修正 `openspec.cliPath` 为空字符串，点击 **Retry** | Dashboard 正常加载 changes 和 specs，诊断卡片消失 |
| 6 | 设置 `openspec.cliPath` 为有效路径，正常启动后，人为断开 CLI（如 `mv $(which openspec) /tmp/`），点击 Refresh | 如有缓存数据则顶部显示 **warning** 诊断 + stale 提示；无缓存则显示 blocking |
| 7 | 恢复 CLI 后点击 Retry | 诊断消失，Dashboard 恢复正常 |
| 8 | 在未初始化的 workspace 中打开 Dashboard（`openspec/` 目录不存在） | 应显示 workspace 初始化引导（`openspec init`），**不应** 显示 CLI 诊断卡片，**不应** 有 Open Settings / Copy Diagnostics / Open Docs 按钮 |

---

## 6.10 Cursor 烟雾测试

**启动方式:** 在 Cursor 中打开本仓库，从侧边栏打开 OpenSpec Dashboard

### 测试矩阵

| # | 操作 | 预期结果 |
|---|---|---|
| 1 | 删除 `openspec.cliPath`，确保 CLI 在 Extension Host PATH 中不可用（或设为无效路径），打开 Dashboard | 显示 **blocking** 诊断卡片，4 个恢复动作按钮可用 |
| 2 | 点击 **Retry** 多次（不修正环境） | Dashboard 状态每次刷新，但 VS Code notification 不重复弹出同一 diagnostic（dedupe） |
| 3 | 修正环境后点击 Retry | Dashboard 恢复正常 |
| 4 | 点击 **Copy Diagnostics** | 剪贴板内容不含完整 PATH / home path / TOKEN / KEY / SECRET / PASSWORD |
| 5 | 点击 **Open Settings** | Cursor 设置面板打开到 `openspec.cliPath` |
| 6 | 点击 **Open Docs** | 浏览器打开 OpenSpec 文档 |
| 7 | 在 **Windows** 上（如可用）设置 `openspec.cliPath` 指向一个 `.cmd` shim 路径，确认 spawn 失败时的文案不误导为"未安装" | 诊断信息提到 spawn failure / ENOENT，不显示"CLI not installed" |

---

## 验证通过标准

- 所有 ✅ 项行为符合预期
- Copy Diagnostics 输出不泄露敏感信息
- Workspace 未初始化 与 CLI 激活诊断 两种状态不混淆
- Retry 不修改 `openspec.cliPath`，不自动安装 CLI，不修改 shell 配置
