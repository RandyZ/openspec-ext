# 如何查看扩展的 Console 输出

## 完整步骤图解

### 步骤 1：启动扩展测试环境

```
你当前的 VSCode 窗口（编辑代码的窗口）
↓
按 F5 键（或点击左侧 Run and Debug）
↓
会打开一个新的 VSCode 窗口
这个窗口标题栏显示：[Extension Development Host]
```

**重要提示**：
- 原窗口（编辑代码）保持打开
- 新窗口（测试扩展）会自动打开
- 两个窗口同时存在

### 步骤 2：在测试窗口中打开开发者工具

**在新打开的窗口**（Extension Development Host）中：

#### Mac：
```
按键：Cmd + Option + I
或者：菜单栏 → Help → Toggle Developer Tools
```

#### Windows/Linux：
```
按键：Ctrl + Shift + I
或者：菜单栏 → Help → Toggle Developer Tools
```

### 步骤 3：查看 Console

开发者工具会在窗口右侧或底部打开，显示几个标签：

```
┌─────────────────────────────────────────────────┐
│ [Console] [Sources] [Network] [Performance] ... │  ← 点击 Console 标签
├─────────────────────────────────────────────────┤
│                                                 │
│  > OpenSpec extension is now active!   ← 你要找的消息
│                                                 │
│                                                 │
└─────────────────────────────────────────────────┘
```

## 如果看不到消息

### 情况 1：Console 是空的

可能原因：
- 扩展还没激活
- 需要打开一个包含 `openspec/config.yaml` 的项目

**解决方法**：
在 Extension Development Host 窗口中：
1. 按 `Cmd + O`（Mac）或 `Ctrl + O`（打开文件夹）
2. 选择一个包含 OpenSpec 的项目
3. 或者直接打开当前的 openspce-ui 项目

### 情况 2：看到很多其他消息

Console 可能有很多 VSCode 自己的日志。

**查找方法**：
1. 在 Console 顶部有一个过滤框
2. 输入：`OpenSpec`
3. 只显示包含 "OpenSpec" 的消息

### 情况 3：看到错误消息

如果看到红色的错误：
1. 复制错误消息
2. 检查扩展是否正确构建
3. 查看 `dist/extension.js` 是否存在

## 其他有用的调试面板

除了 Console，你还可以查看：

### Output 面板（在 Extension Development Host 中）

1. 按 `Cmd + Shift + U`（Mac）或 `Ctrl + Shift + U`
2. 在下拉菜单中选择：`Extension Host`
3. 这里会显示扩展的详细日志

### 扩展列表

1. 按 `Cmd + Shift + P`（Mac）或 `Ctrl + Shift + P`
2. 输入：`Extensions: Show Running Extensions`
3. 应该能看到 "OpenSpec" 在列表中

## 快速测试命令

如果你想快速验证扩展是否工作，可以在原窗口（编辑代码的窗口）的终端运行：

```bash
# 构建扩展
pnpm run compile

# 检查输出
ls -lh dist/extension.js

# 查看内容（应该能看到我们的代码）
grep "OpenSpec extension is now active" dist/extension.js
```

如果最后一个命令有输出，说明构建正确。

## 故障排除

### 问题：按 F5 没反应

**原因**：没有正确的 launch 配置

**解决**：
1. 检查是否有 `.vscode/launch.json` 文件
2. 或者点击左侧 Run and Debug 图标
3. 在顶部下拉菜单选择 "Run Extension"
4. 然后点击绿色播放按钮

### 问题：新窗口打开了但没有任何消息

**原因**：扩展可能没有激活

**解决**：
扩展配置为只在工作区包含 `openspec/config.yaml` 时激活。

在 Extension Development Host 窗口：
1. 打开一个文件夹（`Cmd/Ctrl + O`）
2. 选择包含 OpenSpec 的项目
3. 或者创建测试文件：
   ```bash
   mkdir test-workspace
   cd test-workspace
   openspec init
   ```
4. 然后在 Extension Development Host 中打开这个文件夹

### 问题：构建失败

```bash
# 清理并重新构建
rm -rf dist node_modules
pnpm install
pnpm run compile
```

## 成功的标志

✅ 你应该看到：
1. 新的 VSCode 窗口（标题显示 [Extension Development Host]）
2. 开发者工具打开
3. Console 标签中显示：`OpenSpec extension is now active!`
4. 没有红色错误消息

## 下一步

看到消息后，你可以：
- 测试扩展的其他功能（当我们实现更多功能后）
- 查看扩展是否出现在运行列表中
- 尝试触发扩展的命令（当我们添加命令后）
