# 测试 OpenSpec VSCode 扩展

## 快速测试步骤

### 1. 构建扩展
```bash
pnpm run compile
# 或完整构建（extension + webview）
pnpm run build
```

应看到 `[watch] build finished` 及 Vite 构建完成。

### 2. 运行单元测试
```bash
pnpm test
```

覆盖：CLI 服务（可用性、JSON 解析、超时、错误）、FileManager（任务解析、路径、缺失文件）。

### 3. 在 VSCode 中测试

#### 方式 A：使用调试器（推荐）
1. 在 VSCode 中打开本项目
2. 按 `F5` 或 Run and Debug → "Run Extension"
3. 在 Extension Development Host 中打开**包含 `openspec/config.yaml` 的工作区**（例如本项目根目录）

#### 方式 B：手动启动
```bash
code --extensionDevelopmentPath=$(pwd)
```
然后在打开的新窗口中打开带 OpenSpec 的工作区。

### 4. 验证扩展运行（Phase 11.1 手动测试清单）

- **扩展激活**：Console 出现 `OpenSpec extension is now active!`；Running Extensions 中可见 "OpenSpec"。
- **CLI 未安装**：在无 `openspec` 的 PATH 下打开项目，应出现友好提示。
- **无 openspec 工作区**：打开不含 `openspec/config.yaml` 的文件夹，扩展不激活（无错误）。
- **Dashboard 加载**：命令 "OpenSpec: Open Dashboard" 或侧边栏 OpenSpec → Dashboard，应打开 React 面板并显示数据。
- **Change 列表**：Dashboard 显示 changes 与 progress；无 changes 时显示空状态。
- **Change 详情**：点击某 change 进入详情；Proposal/Specs/Design/Tasks 标签可切换；Artifact 与 Task 列表正常。
- **Task 勾选**：在 Tasks 标签中勾选/取消勾选，应写回 `tasks.md` 并保持格式。
- **文件监视与自动刷新**：修改 `openspec/**/*.md` 或 `*.yaml` 后，约 300ms 防抖后数据刷新。
- **快捷操作**：Copy /opsx:ff、Copy /opsx:apply、Archive 等按钮可用；复制后应有提示。
- **错误场景**：如 CLI 超时、无效 JSON，应有明确错误提示。

### 5. 边界与性能（Phase 11.2 / 11.3）

- **无 changes / 无 specs**：空状态与“新建 Change”入口正常。
- **大任务文件 / 深层嵌套**：`parseTasksMarkdown` 与 toggle 单元测试已覆盖；可手动用 100+ 行 tasks.md 验证。
- **特殊字符**：change 名称含空格或特殊字符时列表与详情正常。
- **缓存与防抖**：DataManager 缓存 TTL 10s；FileWatcher 300ms 防抖（见实现与单元测试）。

### 6. 检查构建产物

```bash
ls -lh dist/
ls -lh dist/webview/
```

应存在 `extension.js` 与 webview 的 `index.html`、`index.js`、`index.css`。

## 预期结果

- Extension Development Host 启动无报错
- Console 显示扩展已激活
- Dashboard 与 Change 详情加载正常，Task 可勾选
- 单元测试全部通过

## 故障排除

- **扩展未激活**：确认工作区根目录存在 `openspec/config.yaml`；查看 Output → Extension Host。
- **构建失败**：`rm -rf dist && pnpm run build`
- **依赖问题**：`rm -rf node_modules && pnpm install`
- **Webview 空白**：查看 Webview 开发者工具（右键 webview 标题栏）；确认 `dist/webview/` 已生成。
- **CLI 超时**：CLI 调用 30s 超时、重试 3 次；见 `openspecCli.ts` 与 `openspecCli.test.ts`。
