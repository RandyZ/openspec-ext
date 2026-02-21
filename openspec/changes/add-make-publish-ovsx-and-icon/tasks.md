## 1. Make 发布 OVSX

- [ ] 1.1 新增 Makefile，定义目标 publish-ovsx：若存在 .env 则从中加载 OVSX_TOKEN（再 export），再执行 pnpm run package，最后执行 pnpm run publish:openvsx
- [ ] 1.2 在 README 或 docs/PUBLISHING.md 中补充 make publish-ovsx 用法（说明可从 .env 读取 OVSX_TOKEN）

## 2. 扩展市场图标

- [ ] 2.1 将 OpenSpec 官方 SVG（https://openspec.dev/_astro/openspec_icon_light.BXKVBxjB.svg）下载到工程并保存为 resources/icon.svg
- [ ] 2.2 在 package.json 根级别增加 "icon": "resources/icon.svg"（若已存在则改为该路径）
- [ ] 2.3 确认 .vscodeignore 未排除 resources/icon.svg，打包后 .vsix 内包含该图标

## 3. README 结构与打包用 README

- [ ] 3.1 将当前 README.md 结构调整为明确的两部分（同一文件内）：使用/产品说明（到「开发与贡献」之前）、开发与贡献；用固定标题（如 ## 开发与贡献）分隔
- [ ] 3.2 新增脚本或 package 流程：从 README.md 按分隔标题提取「使用说明」部分，生成临时或 build 下的 README 内容，在调用 vsce package 前将该内容作为要打包的 README.md（如临时覆盖根目录 README.md），执行 vsce 后恢复根目录 README.md
- [ ] 3.3 确认打包后 .vsix 内 README.md 仅含使用说明内容
