## Context

参考 Superpowers 设计文档：[Cursor 原生交互与 AI 归档流程设计](../../../docs/superpowers/specs/2026-05-23-cursor-native-interaction-and-ai-archive-design.md)。

当前扩展已经具备 Dashboard、Change Detail、Task execution entry、Agent adapter 等基础能力，但 workflow command 生成分散在多个 webview 组件和 service 中。Cursor 环境下还存在两个问题：一是 Cursor commands/skills 需要以插件形式被 Cursor 发现；二是 UI 生成的 `/opsx:*` 命令与 Cursor command 文件当前使用的 `/opsx-*` 形式不一致。

本 change 只解决“扩展如何稳定发起 OpenSpec workflow command”。Apply、Verify、Archive 等具体 AI 推理流程仍由 Agent 根据已注册的 OpenSpec commands/skills 执行。

```mermaid
flowchart TD
  A[Webview action] --> B[Workflow command builder]
  B --> C{Adapter target}
  C -->|Cursor/OpenCode| D[/opsx-action change]
  C -->|Generic/Clipboard| E[/opsx:action change]
  D --> F[Cursor adapter]
  F --> G{Chat prefill available}
  G -->|yes| H[Open Chat with query]
  G -->|no| I[Copy command fallback]
```

## Goals / Non-Goals

**Goals:**

- 在 Cursor 环境中自动注册扩展内置的 OpenSpec commands/skills 插件路径。
- 通过共享 command builder 统一生成 workflow command。
- Cursor/OpenCode 使用 hyphen 格式，通用/Clipboard/未知目标使用 colon 格式。
- Cursor adapter 优先预填 Chat，失败时复制命令。
- UI 文案表达真实动作，避免用户误解为点击后已经完成 workflow。
- 保持 VS Code 和非 Cursor 环境兼容。

**Non-Goals:**

- 不实现 MCP。
- 不修改 OpenSpec skills/commands 的业务流程。
- 不在扩展中直接实现 Apply/Verify 的 AI 逻辑。
- 不默认自动发送 Chat。
- 不改变直接 CLI archive 的现有 command palette 行为；归档 AI 主路径属于后续 `add-ai-guided-archive-flow`。

## Decisions

### Decision: 使用独立 command builder 作为命令格式唯一来源

将 command 生成收敛到纯函数模块，例如 `workflowCommand`。输入为 workflow action、change name、adapter target，输出最终命令文本。这样 `ChangeCard`、`ChangeDetail`、`TaskExecutorService` 不再分别硬编码 `/opsx:*`。

备选方案是在每个 adapter 内部自行转换命令格式。该方案会让 webview 继续散落命令字符串，且 Dashboard 和 task execution 容易产生不一致，因此不采用。

### Decision: Cursor/OpenCode 使用 hyphen，Generic/Clipboard 使用 colon

Cursor commands 文件当前以 `/opsx-apply` 等 hyphen 形式存在，OpenCode adapter 也已经有 hyphen 转换逻辑。因此 command builder 将 Cursor/OpenCode 作为 hyphen target。Clipboard、VS Code Copilot、Generic 和未知 target 使用 colon 形式，保持 README 和既有非 Cursor 工作流兼容。

### Decision: Cursor plugin registration 作为渐进增强

新增 Cursor 插件注册服务，在 extension activation 中检测 `vscode.cursor?.plugins?.registerPath`。存在则注册扩展内置的 Cursor plugin 目录，不存在则静默跳过。这样 Cursor 用户获得自动发现 commands/skills 的体验，VS Code 用户不受影响。

插件目录应作为发布包的一部分，例如 `cursor-plugins/openspec/commands` 和 `cursor-plugins/openspec/skills`。发布配置需要显式包含该目录，避免 `.vscodeignore` 的 markdown 忽略规则把命令和技能文件排除。

### Decision: Chat prefill 优先，clipboard fallback 保底

Cursor adapter 的 `fillChat` 优先尝试通过 IDE command 以 query 参数打开 Chat。若该 command 不可用或参数不兼容，则复制生成后的命令到剪贴板并通知用户。该行为只负责“发起 workflow”，不会直接修改 OpenSpec change 文件。

Agent CLI 自动执行仍保留在 `executeTask` 或 `taskExecutionMode=auto` 路径中，不作为普通 Chat 路由的默认行为。

### Decision: UI 传递 action intent 或使用 builder 输出

长期目标是 webview 层不要自行拼接 `/opsx:*` 字符串，而是传递 workflow action intent 给 extension host 或消费共享 builder 输出。若出于构建边界需要在 webview 中也生成命令，应复用同一模块或等价的共享类型，避免两个实现分叉。

## Risks / Trade-offs

- [Risk] Cursor Chat prefill command 不是本次官方文档公开的稳定 `vscode.cursor` API。→ Mitigation: 作为渐进增强使用，失败时复制命令 fallback，不阻塞工作流。
- [Risk] 发布包未正确包含内置 plugin 目录会导致 Cursor 无法自动发现 commands/skills。→ Mitigation: 增加 `.vscodeignore`/package 验证，并在手工测试中检查 VSIX 内容。
- [Risk] command builder target 推断错误会生成错误格式。→ Mitigation: 为每个 adapter target 增加单元测试，并让未知 target 默认 colon 格式保证兼容。
- [Risk] UI 文案调整可能影响既有用户理解。→ Mitigation: 文案使用动作语义而非实现细节，例如 `Open in Chat` 和 `Copy Command`。

## Migration Plan

1. 新增 command builder 和单元测试。
2. 将 task execution、Dashboard quick actions、Change Detail actions 迁移到 command builder。
3. 新增 Cursor plugin registration，并调整发布包包含规则。
4. 更新 Cursor adapter 的 fillChat prefill/fallback 行为。
5. 更新 README 和用户可见文案，说明 Cursor/VS Code 的不同 routing 行为。

Rollback 策略：如果 Cursor plugin registration 或 Chat prefill 出现兼容问题，可保留 command builder，同时禁用注册或 prefill 路径，退回到 clipboard fallback。

## Open Questions

- 无阻塞性 open question。Chat prefill 的具体 command 参数需要在 Cursor Extension Development Host 中验证；若当前 Cursor 版本不支持 query prefill，应以 clipboard fallback 作为可接受结果。
