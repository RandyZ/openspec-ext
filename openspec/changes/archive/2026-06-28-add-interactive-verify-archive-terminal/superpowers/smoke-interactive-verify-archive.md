# Manual Smoke: Interactive Verify & Archive Terminal

> 对应 change: `add-interactive-verify-archive-terminal`
>
> 自动化测试: `pnpm test` 233/233 通过；`openspec validate --strict` 通过；build 通过。
>
> 以下场景涉及真实 `agent` 进程、VS Code Integrated Terminal Editor 与用户键入交互，无法在 headless 环境完成，必须在带 GUI 的 Cursor / VS Code Extension Development Host 中人工执行。

---

## 前置条件

- 本仓库已 `pnpm install` 且 `pnpm run build` 成功。
- Cursor Agent CLI 可用：`which agent` 返回路径，`agent --version` 正常（macOS/Linux）。Windows 上需 `where agent` 可解析。
- `openspec.cursorAgentModel` 已配置或接受默认 `auto`。
- workspace 根目录存在 `openspec/config.yaml`，且至少有一个 **未归档** 的 change（建议用一个可丢弃的测试 change）。
- 建议准备两个 change：一个 tasks 未完成（用于验证 tab 出现条件）、一个 tasks 全部完成（用于验证 Run Verify/Run Archive 可启动）。

---

## 7.5 Extension Development Host 烟雾测试

**启动方式:** 在本仓库按 `F5` → 选择 "Run Extension"，等待 Extension Development Host 窗口打开。

### 测试矩阵 — Change Detail `Verify & Archive` tab

| # | 操作 | 预期结果 |
|---|---|---|
| 1 | 打开一个 tasks 全完成的 change 的 Change Detail | Header 只显示 change 标题 + 紧凑状态摘要 + Open File / Refresh / More；**顶部不堆叠** Verify/Archive 按钮堆叠 |
| 2 | tab 列表显示 `Verify & Archive`（**不**是旧的独立 `Verify` tab） | ✅ |
| 3 | 切到 `Verify & Archive` tab | 显示 **Run Verify** 与 **Run Archive** 两张卡片，以及说明文案 |
| 4 | 点击 **Run Verify** | 立即在 editor 区域打开一个新的 VS Code Integrated Terminal，名为 `OpenSpec Verify: <change>`；终端中自动执行 `agent --workspace "<root>" --model <model> /opsx-verify <change>`；命令**不含** `-p` / `--print` / `--force` |
| 5 | Run Verify 卡片状态 | 显示 running 状态、terminal 名、最后执行的命令；提供 Reveal Terminal / Stop / Clear Session |
| 6 | 在终端中 Agent 抛出 follow-up 问题（如是否 sync delta specs）时，直接在终端键入回答 | Agent 正常接收输入并继续，不被 OutputChannel 吞掉 |
| 7 | 保持 Verify terminal 运行，再次点击 **Run Verify** | 不再新开终端、**不**重复发送命令；只 reveal 已有 terminal（或显示 existing-session 状态） |
| 8 | 点击 **Reveal Terminal** | 已有 Verify terminal 被前置显示 |
| 9 | 点击 **Stop** | 对应 terminal 被 dispose；该卡片 session 状态不再为 running |
| 10 | 重新点击 **Run Verify** 启动新 session，然后点击 **Clear Session** | 行为与 Stop 等价（terminal 关闭、状态清空） |
| 11 | 点击 **Run Archive** | 打开**独立的** Archive terminal（名为 `OpenSpec Archive: <change>`），与 Verify terminal **不共用**；执行 `agent ... /opsx-archive <change>` |
| 12 | 打开一个**已归档** change 的 Change Detail，切到 `Verify & Archive` | **Run Archive** 被禁用并显示 "Archived changes are read-only" 提示；**Run Verify** 仍可用（只读验证入口） |
| 13 | 点击已归档 change 的 **Run Verify** | 可启动只读 Verify terminal；点击 **Run Archive**（如仍可点）应被拒绝并返回 error 状态 |

### 测试矩阵 — Agent CLI 不可用

| # | 操作 | 预期结果 |
|---|---|---|
| 14 | 临时让 `agent` 不可用（例如 `PATH=/none agent ...` 失效，或在测试机重命名 shim），点击 **Run Verify** | **不创建** terminal；`Verify & Archive` 卡片显示 error 状态，文案说明 Agent CLI 未找到 |
| 15 | 恢复 `agent` 后再次点击 Run Verify | 正常创建 terminal |

### 测试矩阵 — Dashboard quick action

| # | 操作 | 预期结果 |
|---|---|---|
| 16 | Dashboard 上 change card 的 Verify quick action | 打开 Change Detail 并切到 `Verify & Archive` tab；Verify terminal workflow 可立即启动；**不**走 headless `agentCli` |
| 17 | Dashboard 上 change card 的 Archive quick action | 打开 Change Detail 并切到 `Verify & Archive` tab；Archive terminal workflow 可立即启动；**不**直接调用 `archiveChange` 移动文件 |

### 测试矩阵 — Direct archive 引导（对应 spec：Direct archive keeps Verify guidance）

| # | 操作 | 预期结果 |
|---|---|---|
| 18 | 通过仍存在的 direct archive 入口（command palette / Change Detail 旧入口）对一个**未 verify** 的 change 触发归档 | 确认对话框应**建议先 verify**、提供进入 `Verify & Archive` 的选择，并保留明确继续 direct archive 的逃生路径 |

> 注：矩阵 #18 的 direct archive verify-first 引导已实现并有自动化测试覆盖；仍需在真实 Cursor Extension Development Host 中按本矩阵复测交互行为。

---

## 验证通过标准

- 矩阵 1–17 全部 ✅。
- 矩阵 18 在真实 Cursor Extension Development Host 中复核通过。
- 终端命令形态始终为 `agent --workspace "<root>" --model <model> /opsx-<action> <change>`，绝无 `-p` / `--print` / `--force`。
- Verify 与 Archive terminal 互相独立，重复启动只 reveal 不重发命令。
- Agent 反问可在终端直接输入作答。
- `agent` 不可用时不创建 terminal 并返回可读 error 状态。
- 已归档 change 的 Archive 被拒绝、Verify 可只读运行。
