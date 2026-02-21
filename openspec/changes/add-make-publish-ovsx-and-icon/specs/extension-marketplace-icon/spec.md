# Spec: 扩展市场图标

## ADDED Requirements

### Requirement: 扩展在市场上展示图标

扩展清单（package.json）SHALL 在根级别声明 `icon` 字段，指向包内图标文件（如 `resources/icon.svg`），以便 Open VSX 等市场在列表与详情页展示扩展头像。

#### Scenario: 清单中包含根级 icon

- **WHEN** 打包并发布扩展
- **THEN** package.json 根级别存在 `icon` 字段且指向包内存在的路径（如 resources/icon.svg）

#### Scenario: 图标文件存在且被打包

- **WHEN** 执行打包（如 pnpm run package）
- **THEN** .vsix 内包含该 icon 路径所指向的文件（且 .vscodeignore 未排除该资源）

### Requirement: 使用 OpenSpec 官方图标并下载到工程

项目 SHALL 使用 OpenSpec 官方图标（来源：openspec.dev 提供的 SVG，如 https://openspec.dev/_astro/openspec_icon_light.BXKVBxjB.svg）。该图标 SHALL **直接下载到工程**中（如 `resources/icon.svg`），打包时使用该本地文件，不依赖发布时从外网 URL 拉取。

#### Scenario: 图标已下载到工程并参与打包

- **WHEN** 实现本能力
- **THEN** resources/icon.svg 内容与 OpenSpec 官方 light 图标 SVG 一致（或等效），且在 package.json 的 icon 中引用该文件；打包后 .vsix 内包含此图标
