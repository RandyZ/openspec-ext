> 参考 Superpowers 设计文档：[Cursor 原生交互与 AI 归档流程设计](../../../docs/superpowers/specs/2026-05-23-cursor-native-interaction-and-ai-archive-design.md)
>
> 参考 Superpowers 实现计划：[Cursor Native Interaction And AI Archive Implementation Plan](../../../docs/superpowers/plans/2026-05-23-cursor-native-interaction-and-ai-archive-plan.md)
>
> 本 tasks.md 以该设计文档中 Change 2 的测试策略、组件边界、成功标准，实现计划，以及本 change 的 specs/design 为任务来源。实现阶段必须按 TDD 执行：先写失败测试并确认 RED，再实现最小 GREEN，最后重构。具体执行步骤以实现计划中的 Task 5-8 为准。
>
> 最终验收依赖 `improve-cursor-native-interaction` 的 command builder 和 Chat routing 能力。必须先完成该依赖，再接入本 change 的 AI 归档主路径；不得以临时硬编码或临时 `fillChat` 路由作为最终实现。

## 1. Archive Action Modeling

- [ ] 1.1 编写失败测试覆盖 workflow state 对 `Review & Archive` 与 `Archive Now` 的显式建模，包括完成、未完成、artifact 不完整、已归档状态。
- [ ] 1.2 更新 workflow state，不再通过空 command 表示 Archive 特殊行为，改为显式区分 AI 审查归档动作和直接归档动作。
- [ ] 1.3 运行 workflow state 测试，确认新增测试完成 RED→GREEN。

## 2. Split Button UI

- [ ] 2.1 编写失败组件测试覆盖 split button 主动作、下拉动作、disabled reason、键盘可访问性。
- [ ] 2.2 新增可复用 `SplitButton` 或 `ActionDropdown` 组件，支持主按钮 + 下拉菜单组合。
- [ ] 2.3 运行 split button 组件测试，确认新增测试完成 RED→GREEN。

## 3. Change Detail Archive Flow

- [ ] 3.1 编写失败测试或组件验证覆盖 Change Detail 中点击主 `Review & Archive` 只发送 Chat 路由消息，不发送 `archiveChange`。
- [ ] 3.2 将 Change Detail 的 Archive action 替换为 split button：主动作打开 `/opsx-archive <change>`，下拉 `Archive Now` 调用现有 direct archive 流程。
- [ ] 3.3 在 tasks 或 artifacts 未完成时禁用 `Archive Now` 并展示原因，同时允许 `Review & Archive` 作为 Agent review/advice 入口。
- [ ] 3.4 运行 Change Detail 相关测试或组件验证，确认新增测试完成 RED→GREEN。

## 4. Dashboard Archive Flow

- [ ] 4.1 编写失败测试或组件验证覆盖 Dashboard completed change 的归档主动作和下拉 direct archive 行为。
- [ ] 4.2 将 Dashboard change card 的 Archive quick action 改为与 Change Detail 一致的 `Review & Archive` split button 或等价菜单。
- [ ] 4.3 确保 Dashboard 对未完成 change 禁用 `Archive Now`，并显示引导用户使用 AI review 的原因。
- [ ] 4.4 运行 Dashboard 相关测试或组件验证，确认新增测试完成 RED→GREEN。

## 5. Direct Archive Compatibility

- [ ] 5.1 编写回归测试或手工验证 checklist，确认 `OpenSpec: Archive Change` command palette 仍走现有 direct CLI archive。
- [ ] 5.2 保留 `archiveChange` webview message 作为 direct archive 专用路径，并确认主 `Review & Archive` 不会调用它。
- [ ] 5.3 更新用户可见文案和 README，说明 `Review & Archive` 与 `Archive Now` 的区别。

## 6. Final Integration and Verification

- [ ] 6.1 编写失败测试确认 `Review & Archive` 通过 command builder 生成 Cursor `/opsx-archive <change>`，且不使用临时硬编码或临时 `fillChat` 路由作为最终路径。
- [ ] 6.2 接入 `improve-cursor-native-interaction` 的 command builder 生成 archive workflow command，移除任何临时硬编码或临时 `fillChat` 路由。
- [ ] 6.3 运行相关单元测试和组件测试，确认归档 flow 测试全部通过并完成 RED→GREEN。
- [ ] 6.4 派 code review 子代理审查归档交互实现，P0/P1 必须修复，P2 记录或按风险决定修复。
- [ ] 6.5 运行 `pnpm run build`，确认 extension host 和 webview 构建通过。
- [ ] 6.6 在 Cursor Extension Development Host 中手工验证：主 `Review & Archive` 预填 `/opsx-archive <change>`；下拉 `Archive Now` 经确认后执行 CLI archive；未完成 change 的 `Archive Now` 不可直接执行。
