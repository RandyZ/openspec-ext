# Design: Make 发布 OVSX + 扩展图标 + 市场用 README

## Context

- 项目已有 `pnpm run package`（生成 .vsix）和 `pnpm run publish:openvsx`（依赖 OVSX_TOKEN）。无 Makefile。根目录可有 `.env`（含 OVSX_TOKEN），且已加入 .gitignore / .vscodeignore，不应打入扩展包。
- 扩展在 package.json 的 viewsContainers 中已使用 `resources/icon.svg`；根级别无 `icon` 字段，导致市场无头像。图标需从 openspec.dev 下载到工程后使用。
- 当前 .vscodeignore 为 `*.md` 且 `!README.md`，即打包时会把根目录 README.md 打入 .vsix；该 README 含大量开发/架构内容，不适合作为市场展示的“产品说明”。

```
┌─────────────────────────────────────────────────────────────────────────┐
│  make publish-ovsx                                                       │
│  (从 .env 加载 OVSX_TOKEN，若存在)                                        │
├─────────────────────────────────────────────────────────────────────────┤
│  1. 加载 .env → export OVSX_TOKEN（若存在）                               │
│  2. pnpm run package  →  打包（内层会生成市场用 README 并打入 .vsix）     │
│  3. pnpm run publish:openvsx                                            │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│  pnpm run package（打包流程增强）                                         │
├─────────────────────────────────────────────────────────────────────────┤
│  1. pnpm run build                                                        │
│  2. 从 README.md 提取「使用说明」→ 生成 build/README.md（或临时 README）  │
│  3. 使 vsce 打包时使用的 README.md = 上述生成内容（见下文）               │
│  4. vsce package --no-dependencies                                        │
└─────────────────────────────────────────────────────────────────────────┘
```

## Goals / Non-Goals

**Goals:**

- make publish-ovsx 可从项目根目录 `.env` 读取 OVSX_TOKEN，无需每次 `OVSX_TOKEN=xxx make publish-ovsx`。
- 图标：将 openspec.dev 官方 SVG 下载到工程（resources/icon.svg），打包时使用；package.json 根级声明 icon。
- README：仓库内 README.md 分为「使用说明」与「开发/贡献」两部分（同一文件）；打包时生成仅含使用说明的 README 并作为扩展内 README.md 打入 .vsix。
- 提供 **make 命令用于测试**：仅执行「从 README 生成打包用 README」的步骤并输出到固定路径（如 build/README.md），不执行完整打包，便于开发时校验生成内容。

**Non-Goals:**

- 不实现 VS Code Marketplace 的 make 发布。
- 不改变开发者本地查看的 README.md 的完整性（仍为一个文件、两部分）。

## Decisions

### 1. Make 如何从 .env 读取 OVSX_TOKEN

- **选择**：在 Makefile 的 `publish-ovsx` 目标中，若存在 `.env` 则用 shell 加载并 export。例如使用 `include .env` 并 export（GNU make 可 `-include .env` 后解析为 make 变量再在 recipe 里 export），或 recipe 内执行 `set -a; [ -f .env ] && . ./.env; set +a` 再调用 pnpm。推荐在 recipe 中：`[ -f .env ] && export $$(grep -v '^#' .env | xargs)` 或简单 `source .env`（若 .env 格式简单），然后执行 package 与 publish:openvsx。
- **理由**：用户可将 OVSX_TOKEN 写在 .env，不提交到仓库；make 一次执行即可，无需记环境变量。
- **备选**：由 Node 脚本 publish-openvsx.js 在无 OVSX_TOKEN 时自动读取 .env（如 dotenv）；则 make 仅需调用 pnpm，token 由脚本统一读。两种均可；若 Makefile 读 .env 则跨平台需注意（Windows 上 make 的 shell 可能不同）。

### 2. 图标：下载到工程后打包使用

- **选择**：将 https://openspec.dev/_astro/openspec_icon_light.BXKVBxjB.svg 下载到 `resources/icon.svg`（可脚本或文档说明一次性下载）；package.json 根级 `"icon": "resources/icon.svg"`。打包时 .vscodeignore 不排除该文件，.vsix 内即含此图标。
- **理由**：与现有“包内路径”要求一致；直接落库，不依赖发布时网络。

### 3. README 结构与打包时生成“市场用”README

- **选择（分隔方式）**：README.md 保留一个文件，两大部分用**单行分隔符**切分：
  - **分隔符**：一行仅包含 `---`（Markdown 水平线，行首行尾可有空白）。该行**不**写入打包用 README。
  - **第一部分（使用/产品说明）**：从文件开头到**第一个** `---` 行之前的所有内容，作为市场与扩展包内的 README。
  - **第二部分（开发与贡献）**：从第一个 `---` 行之后到文件末尾（Architecture、Development Setup、Publishing、Contributing 等）。
- **选择（打包）**：在 `package` 脚本或单独脚本中，在调用 vsce 之前：(1) 从 README.md 按上述规则提取「第一个 `---` 之前」的内容写入临时文件（如 `build/README.md`）；(2) 临时将根目录 README.md 备份并用该内容覆盖；(3) 执行 vsce package；(4) 恢复根目录 README.md。这样打入 .vsix 的 README.md 仅为使用说明部分。
- **理由**：用 `---` 分隔简单、可见、与 Markdown 习惯一致；解析时只需查找第一行仅含 `---` 的行即可，无需依赖标题文本。

### 4. make 目标：仅测试生成打包用 README

- **选择**：在 Makefile 中增加目标（如 `readme-marketplace` 或 `test-readme-marketplace`），仅调用「从 README.md 提取使用说明并写入 build/README.md」的脚本，不执行 build 与 vsce package。便于开发时运行 `make readme-marketplace` 后查看 `build/README.md` 校验内容。
- **理由**：打包流程较重的场景下，单独验证 README 提取逻辑可节省时间；与 package 流程共用同一提取脚本，保证一致性。

### 5. package.json 根级 icon

- **选择**：在 package.json 根级增加 `"icon": "resources/icon.svg"`（若已有则改为该路径）。市场使用根级 icon 作为列表/详情头像。

## Risks / Trade-offs

| 风险 | 缓解 |
|------|------|
| make 读 .env 在不同 shell/make 下行为不一 | 文档注明 .env 格式（如 OVSX_TOKEN=xxx）；可选由 Node 脚本统一读 .env。 |
| README 提取逻辑与后续修改不同步 | 分隔符固定为单行 `---`；在 README 顶部或分隔处注释说明“`---` 上方为市场展示用”。 |
| 打包中途失败导致 README.md 未恢复 | 脚本用 try/finally 或 trap 恢复；或使用临时目录拷贝再替换。 |

## Migration Plan

- 新增 Makefile；调整 package 流程（先生成市场用 README 再 vsce）；重构 README.md 为两段；下载 icon 到 resources。无运行时行为变更。发布前确保 .env 中有 OVSX_TOKEN（或环境变量已设置）。

## Open Questions

- 无。若需兼容 Windows 下 make，可优先采用“Node 脚本读 .env”方案，make 仅调用 pnpm。
