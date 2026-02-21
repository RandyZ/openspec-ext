# Proposal: Make 发布 OVSX + 扩展图标 + 市场用 README

## Why

发布到 Open VSX 时希望用一条 make 命令完成打包并发布，且能从项目根目录的 `.env` 读取 token，减少手工导出环境变量；扩展在 Open VSX 上无头像，需要设置官方图标；市场展示的 README 应只含使用说明，不应把开发/贡献内容直接打包进扩展。

## What Changes

- 新增 **Makefile**，提供 `make publish-ovsx`：先打包再发布到 Open VSX。**从项目根目录的 `.env` 中读取 OVSX_TOKEN**（若存在），无需在命令行显式传入。不涉及 VS Code Marketplace。
- 使用 [openspec.dev 官方 SVG](https://openspec.dev/_astro/openspec_icon_light.BXKVBxjB.svg) 作为扩展图标：**直接下载到工程**中（如 `resources/icon.svg`），打包时使用该文件；package.json 根级别增加 `icon` 指向该资源。
- **README 结构调整与打包行为**：当前项目中的 README.md **拆成两部分但保留在一个文件内**（例如「使用/产品说明」与「开发/贡献」）。打包发布时**不直接打包该 README.md**，而是**生成一份新的、仅含使用说明部分的 README**，将该内容作为扩展包内的 README.md 打入 .vsix，供市场展示。

## Capabilities

### New Capabilities

- **make-publish-ovsx**：通过 make 命令一键打包并发布到 Open VSX；make 可从根目录 `.env` 读取 OVSX_TOKEN。
- **extension-marketplace-icon**：扩展图标使用 OpenSpec 官方 SVG，下载到工程（如 resources/icon.svg）并在 manifest 中声明；打包时使用该文件。
- **marketplace-readme**：README.md 在仓库内分为「使用说明」与「开发/贡献」两部分；打包时生成仅含使用说明的 README 并作为扩展内的 README.md 打入 .vsix。

### Modified Capabilities

- 无。

## Impact

- 新增 Makefile（含从 .env 加载 OVSX_TOKEN 的逻辑）；现有 pnpm 脚本可保持不变，make 封装调用；publish:openvsx 脚本可扩展为支持从 .env 读取 token（或由 make 注入）。
- 新增或更新脚本：从 README.md 提取「使用说明」并生成打包用 README；打包流程（如 package 脚本）在调用 vsce 前生成该 README 并使其成为打入 .vsix 的 README.md。
- 替换或新增 resources/icon.svg（官方 SVG 下载到工程）；package.json 增加根级 `icon`。
- README.md 结构调整为明确的两部分（同一文件内），便于提取。
