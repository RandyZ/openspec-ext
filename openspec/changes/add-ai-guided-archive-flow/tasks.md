## 1. 共享归档资格

- [ ] 1.1 编写 RED 测试，证明只有绑定正确的 resolver 返回高影响 Archive action 时才允许 direct archive。
- [ ] 1.2 将 resolver 派生的 `canArchiveNow` 和可访问的禁用原因传入现有 Verify & Archive surface，不新增动作模型。
- [ ] 1.3 运行 resolver 与 Change Detail 聚焦测试，完成 RED -> GREEN。

## 2. Change Detail 归档动作

- [ ] 2.1 编写 RED 组件测试，覆盖 `Review & Archive`、次要 `Archive Now`、Archived 只读态和键盘可访问的禁用原因。
- [ ] 2.2 将现有交互式 Archive 动作改名为 `Review & Archive`，保留 terminal session 控制与 `/opsx-archive <change>` 执行。
- [ ] 2.3 仅在 resolver gating 允许时，通过现有 `archiveChange` message 增加次要 `Archive Now` 动作。
- [ ] 2.4 证明主动作不会发送 direct `archiveChange`，次要动作不会启动交互式 session。

## 3. Dashboard 安全导航

- [ ] 3.1 编写 RED 测试，证明 Verify/Archive 高影响入口会打开绑定正确的 Change Detail `Verify & Archive`。
- [ ] 3.2 通过现有 Detail 导航处理 Dashboard 高影响动作，并移除任何卡片内 direct archive 行为。
- [ ] 3.3 证明 Dashboard 不渲染 `Archive Now` split button/menu，且不能绕过 Detail 安全流程。

## 4. Direct Archive 兼容性

- [ ] 4.1 增加确认、取消、Verify-first、scope binding、CLI 失败与成功刷新回归测试。
- [ ] 4.2 保留 `confirmDirectArchive()`、direct `archiveChange` message、scope-aware `DataManager.archiveChange()` 和普通 CLI 输出处理。
- [ ] 4.3 验证 Command Palette direct archive 入口仍可用并复用相同确认行为。
- [ ] 4.4 成对更新中英文 locale 与精简用户文档，说明 `Review & Archive` 和 `Archive Now` 的区别。

## 5. 验证

- [ ] 5.1 运行聚焦测试和完整 `pnpm test`。
- [ ] 5.2 运行 `pnpm exec eslint src/` 与 `pnpm run build`，要求零错误。
- [ ] 5.3 运行 OpenSpec strict validation 与 `git diff --check`。
- [ ] 5.4 在真实 VS Code Extension Development Host 中验证 Dashboard 导航、交互式 Review & Archive、禁用 Archive Now、取消和一个安全 direct-archive fixture。
- [ ] 5.5 完成最终代码审查，修复所有阻塞发现，并记录留待 VSIX 验收的 Cursor 兼容性风险。
