# Spec: 市场用 README

## Purpose

定义仓库 README 结构与打包时生成仅含使用说明的市场用 README 的规则与流程。

## Requirements

### Requirement: 仓库 README 分为使用说明与开发贡献两部分

项目根目录的 README.md SHALL 在**一个文件内**明确分为两部分：**使用/产品说明**（面向安装与使用扩展的用户）与**开发/贡献**（面向贡献者与开发设置）。两部分 SHALL 用**单行分隔符**切分：一行仅包含 `---`（行首行尾可有空白）；该行之前为使用说明，该行之后为开发与贡献。提取打包用 README 时取「第一个 `---` 行之前」的内容（不包含该行）。

#### Scenario: 单文件内用 --- 分隔两部分

- **WHEN** 查看 README.md
- **THEN** 文件中存在至少一行仅由 `---` 组成（可选前后空白）作为分隔；该行之前为使用说明（如概述、安装、使用、命令、配置等），该行之后为开发/贡献（如架构、开发环境、Publishing、Contributing 等）

### Requirement: 打包时生成仅含使用说明的 README 并打入扩展

打包扩展（生成 .vsix）时，SHALL **不直接**将当前仓库的 README.md 原样打入扩展包。SHALL 从 README.md 中**提取仅含使用说明部分**的内容，生成一份新的 README，并将该内容作为扩展包内的 README.md 打入 .vsix，供市场展示。

#### Scenario: 打包后 .vsix 内 README 仅含使用说明

- **WHEN** 执行打包命令（如 pnpm run package）并检查生成的 .vsix
- **THEN** .vsix 内的 README.md 仅包含使用/产品说明内容，不包含开发环境、架构、Contributing 等开发向内容

#### Scenario: 提取逻辑可维护

- **WHEN** 维护者修改 README.md 中第一个 `---` 之前的使用说明部分
- **THEN** 无需修改提取逻辑即可使下次打包生成的“市场用 README”反映该修改（提取规则固定：取第一个仅含 `---` 的行之前的内容）

### Requirement: 提供测试生成打包用 README 的命令

项目 SHALL 提供一条命令（如 make 目标），**仅**执行「从 README.md 提取使用说明并生成打包用 README」的步骤，将结果输出到固定路径（如 build/README.md），不执行完整打包（不执行 build、不执行 vsce package），用于开发时测试与校验生成内容。

#### Scenario: 执行测试命令后得到生成文件

- **WHEN** 用户执行该测试命令（如 make readme-marketplace）
- **THEN** 在约定路径（如 build/README.md）生成仅含使用说明的 README 内容，且未修改根目录 README.md、未执行 vsce package
