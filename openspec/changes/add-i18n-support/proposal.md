## Why

扩展中有约 126 个用户可见的硬编码字符串（约 46 个中文、80 个英文），分散在 webview 组件和 extension 后端中。没有任何 i18n 基础设施，无法支持多语言切换。

## What Changes

1. **创建轻量 i18n 模块**：分别为 extension host 和 webview 创建 `t(key)` 翻译函数
2. **提取翻译资源**：创建 `en.json` 和 `zh-cn.json` 翻译文件
3. **语言检测**：extension 端从 `vscode.env.language` 获取语言，传递给 webview
4. **替换硬编码字符串**：将所有组件和服务中的硬编码文本替换为 `t('key')` 调用

### 支持的语言

- **English (en)** — 默认语言
- **简体中文 (zh-cn)** — 完整翻译

### 架构

```
src/
├── i18n/
│   ├── index.ts          # 共享类型和工具
│   ├── locales/
│   │   ├── en.json       # 英文翻译
│   │   └── zh-cn.json    # 中文翻译
├── extension/
│   └── utils/
│       └── i18n.ts       # extension 端 t() 函数，读取 vscode.env.language
└── webview/
    └── utils/
        └── i18n.ts       # webview 端 t() 函数，接收 locale 参数
```

## Impact

- 新增文件：`src/i18n/`、翻译 JSON 文件、`i18n.ts` 工具
- 修改文件：所有含硬编码字符串的 `.tsx` 和 `.ts` 文件（约 15 个）
- 不影响现有功能，仅改变字符串来源
