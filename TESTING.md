# 测试 OpenSpec VSCode 扩展

## 快速测试步骤

### 1. 构建扩展
```bash
pnpm run compile
```

应该看到输出：
```
[watch] build started
[watch] build finished
```

### 2. 在 VSCode 中测试

#### 方式 A：使用调试器（推荐）
1. 在 VSCode 中打开这个项目
2. 按 `F5` 或点击左侧的 "Run and Debug"
3. 选择 "Run Extension"
4. 会打开一个新的 VSCode 窗口（Extension Development Host）

#### 方式 B：手动启动
```bash
code --extensionDevelopmentPath=/Users/randy/workspace/project/randy/openspce-ui
```

### 3. 验证扩展运行

在 Extension Development Host 窗口中：

1. **打开开发者工具**
   - Mac: `Cmd + Option + I`
   - Windows/Linux: `Ctrl + Shift + I`

2. **查看 Console**
   - 应该能看到：`OpenSpec extension is now active!`

3. **检查扩展是否加载**
   - 打开命令面板：`Cmd + Shift + P` (Mac) 或 `Ctrl + Shift + P`
   - 输入 "Extensions: Show Running Extensions"
   - 在列表中找到 "OpenSpec"

### 4. 测试激活条件

我们的扩展配置为在工作区包含 `openspec/config.yaml` 时激活。

1. 在 Extension Development Host 中打开一个包含 OpenSpec 的项目
2. 或者在测试窗口中创建一个：
   ```bash
   mkdir test-workspace
   cd test-workspace
   mkdir openspec
   touch openspec/config.yaml
   ```
3. 然后在 Extension Development Host 中打开这个文件夹

### 5. 检查构建输出

查看 `dist/extension.js` 是否存在：
```bash
ls -lh dist/
```

## 当前状态

✅ **可以测试的功能**：
- 扩展激活
- 基本的 activate/deactivate 生命周期

❌ **还不能测试的功能**（尚未实现）：
- 命令（还没有注册任何命令）
- Dashboard UI（还没有实现）
- CLI 集成（还没有实现）

## 预期结果

成功的测试应该：
1. ✅ Extension Development Host 启动
2. ✅ Console 显示 "OpenSpec extension is now active!"
3. ✅ 扩展在运行列表中出现
4. ✅ 没有错误信息

## 如果遇到问题

### 问题：扩展没有激活
- 检查是否有 `openspec/config.yaml` 文件
- 查看 Output 面板中的 "Extension Host" 日志

### 问题：构建失败
```bash
# 清理并重新构建
rm -rf dist
pnpm run compile
```

### 问题：找不到模块
```bash
# 重新安装依赖
rm -rf node_modules
pnpm install
```

## 下一步测试

当我们实现更多功能后，可以测试：
- [ ] Phase 2: CLI 命令调用
- [ ] Phase 6: Dashboard 显示
- [ ] Phase 8: Change 列表
- [ ] Phase 9: Task 切换功能
