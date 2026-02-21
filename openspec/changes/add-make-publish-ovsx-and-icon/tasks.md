## 1. Make 发布 OVSX

- [ ] 1.1 新增 Makefile，定义目标 publish-ovsx：若存在 .env 则从中加载 OVSX_TOKEN（再 export），再执行 pnpm run package，最后执行 pnpm run publish:openvsx
- [ ] 1.2 在 README 或 docs/PUBLISHING.md 中补充 make publish-ovsx 用法（说明可从 .env 读取 OVSX_TOKEN）

## 2. 扩展市场图标

- [ ] 2.1 将 OpenSpec 官方 SVG（https://openspec.dev/_astro/openspec_icon_light.BXKVBxjB.svg）下载到工程并保存为 resources/icon.svg
- [ ] 2.2 在 package.json 根级别增加 "icon": "resources/icon.svg"（若已存在则改为该路径）
- [ ] 2.3 确认 .vscodeignore 未排除 resources/icon.svg，打包后 .vsix 内包含该图标

## 3. README 结构与打包用 README

- [ ] 3.1 将当前 README.md 结构调整为用单行 `---` 分隔：`---` 之前为使用/产品说明，之后为开发与贡献；提取规则为「第一个仅含 `---` 的行之前的内容」（不包含该行）
- [ ] 3.2 新增脚本或 package 流程：从 README.md 按「第一个 `---` 行之前」提取内容，生成 build/README.md 或临时文件，在调用 vsce package 前将该内容作为要打包的 README.md（如临时覆盖根目录 README.md），执行 vsce 后恢复根目录 README.md
- [ ] 3.3 在 Makefile 中增加用于测试的目标（如 readme-marketplace）：仅执行从 README 生成打包用 README 的步骤，输出到 build/README.md，不执行完整打包，便于本地校验
- [ ] 3.4 确认打包后 .vsix 内 README.md 仅含使用说明内容
