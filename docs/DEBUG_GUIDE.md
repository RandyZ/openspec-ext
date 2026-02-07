# 快速调试指南

## 当前状态
✅ Extension Development Host 已启动
❌ 扩展还未激活（需要打开包含 OpenSpec 的项目）

## 正确的查看步骤

### 1️⃣ 打开项目激活扩展

在 Extension Development Host 窗口中：
- 点击 "Open project"
- 选择：`/Users/randy/workspace/project/randy/openspce-ui`

### 2️⃣ 打开浏览器开发者工具（重要！）

**不是底部的 "Debug Console"**

而是按：
- Mac: `Cmd + Option + I`
- Windows/Linux: `Ctrl + Shift + I`
- 或菜单：Help → Toggle Developer Tools

这会在窗口右侧或底部打开一个新面板，看起来像浏览器的开发者工具。

### 3️⃣ 切换到 Console 标签

在开发者工具面板中：
- 顶部有很多标签：Elements, Console, Sources, Network...
- 点击 **"Console"** 标签
- 在这里查找：`OpenSpec extension is now active!`

## 两种 Console 的区别

### ❌ Debug Console（底部）
- 这是 VSCode 调试器的输出
- 用于调试 VSCode 本身
- **不是我们要看的地方**

### ✅ Browser DevTools Console（开发者工具）
- 这是扩展运行时的 JavaScript 控制台
- 会显示 `console.log()` 的输出
- **这是我们要看的地方**

## 如果还是找不到

可以尝试：

### 方法 1：使用命令面板
1. 在 Extension Development Host 窗口按 `Cmd + Shift + P`
2. 输入：`Developer: Toggle Developer Tools`
3. 回车

### 方法 2：查看输出面板
1. 按 `Cmd + Shift + U` 打开 Output 面板
2. 在下拉菜单选择：`Extension Host`
3. 这里会显示扩展的日志

### 方法 3：检查扩展是否运行
1. 按 `Cmd + Shift + P`
2. 输入：`Extensions: Show Running Extensions`
3. 查找 "OpenSpec" 是否在列表中

## 预期结果

成功时你应该看到：
```
OpenSpec extension is now active!
```

如果看到这个消息，说明扩展成功运行了！
