# Proposal: 优化插件与多 IDE/AI 的交互

## Why

用户在 OpenSpec 插件中查看 change 与 tasks 时，希望能从任务直接触发 AI 执行（或把上下文填入 Chat），而不是手动复制命令到不同工具。当前插件仅提供复制命令到剪贴板，且未区分 Cursor、Claude Code、VSCode Copilot 等环境。需要统一抽象、可扩展地与多种「命令执行者」对接，并让用户选择使用哪一个，同时与主代码隔离便于维护和后续扩展。

## What Changes

- **Adapter 层**：引入 IDE/Agent 执行器适配器（Adapter），主逻辑只依赖接口，具体实现（Cursor / Claude Code / 纯 VSCode 等）在独立模块中按需加载。
- **执行模式**：保留「自动执行」与「填入 Chat」两种模式，由用户配置；当无法预填 Chat 时，使用「复制到剪贴板」作为 fillChat 的兜底。
- **Adapter 选择**：激活时检测可用 Adapter，在设置或执行前让用户选择使用哪个执行者（不自动写死优先级）。
- **任务触发**：在任务列表上提供「执行」入口；点击后先做依赖检查（文档顺序），再根据当前模式与所选 Adapter 执行或填 Chat/剪贴板。
- **Claude Code 定位**：从插件视角，Claude Code 仅是众多执行者之一，可通过 VSCode 中的 Claude Code 集成触发，也可通过新建 Terminal 执行对应 openspec 命令（如 `/opsx:apply`）实现。
- **第一期范围**：先实现 Adapter 抽象与 1～2 个具体 Adapter（如 Cursor + 剪贴板兜底），设计上预留扩展点，便于后续增加更多 Adapter。

## Capabilities

### New Capabilities

- **ide-adapter**：定义 Agent 执行器适配器接口与发现机制。包含：Adapter 接口（isAvailable、executeTask、fillChat）、加载/发现可用 Adapter、用户选择当前 Adapter 的配置与 UI 入口、以及「复制到剪贴板」作为 fillChat 的通用兜底行为。

### Modified Capabilities

- **task-management**：在现有任务展示与勾选基础上，增加「基于任务的执行触发」：每个任务提供执行入口；点击后先做依赖检查（按 tasks.md 文档顺序，前序未完成则阻止或警告）；再根据配置的执行模式（自动执行 / 填入 Chat）与当前所选 Adapter 调用 executeTask 或 fillChat（含剪贴板兜底）。插件不负责任务完成后的勾选更新，由 Agent/OpenSpec 流程负责。

## Impact

- **代码结构**：新增 `src/extension/adapters/`（或等价目录），主逻辑通过接口调用，不直接依赖具体 Adapter 实现。
- **配置**：新增「当前 Adapter」选择与「任务执行模式」（自动执行 / 填入 Chat）；可选「依赖未完成时」为阻止或仅警告。
- **依赖**：无新增运行时依赖；Adapter 内可能调用外部 CLI（如 `agent`、`claude`）或 VSCode Chat API，需在实现时注明环境要求。
- **文档**：需在 README/设置说明中描述各 Adapter 的适用环境与可选配置。
