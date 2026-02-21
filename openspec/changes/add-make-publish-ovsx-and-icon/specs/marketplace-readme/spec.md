# Spec: 市场用 README

## ADDED Requirements

### Requirement: 仓库 README 分为使用说明与开发贡献两部分

项目根目录的 README.md SHALL 在**一个文件内**明确分为两部分：**使用/产品说明**（面向安装与使用扩展的用户）与**开发/贡献**（面向贡献者与开发设置）。两部分可通过固定标题或标记区分，便于工具提取。

#### Scenario: 单文件内两部分结构

- **WHEN** 查看 README.md
- **THEN** 文件包含明确的使用说明部分（如概述、安装、使用、命令、配置等）和开发/贡献部分（如架构、开发环境、Publishing、Contributing 等），且边界清晰（如从开头到「## 开发与贡献」之前为使用说明）

### Requirement: 打包时生成仅含使用说明的 README 并打入扩展

打包扩展（生成 .vsix）时，SHALL **不直接**将当前仓库的 README.md 原样打入扩展包。SHALL 从 README.md 中**提取仅含使用说明部分**的内容，生成一份新的 README，并将该内容作为扩展包内的 README.md 打入 .vsix，供市场展示。

#### Scenario: 打包后 .vsix 内 README 仅含使用说明

- **WHEN** 执行打包命令（如 pnpm run package）并检查生成的 .vsix
- **THEN** .vsix 内的 README.md 仅包含使用/产品说明内容，不包含开发环境、架构、Contributing 等开发向内容

#### Scenario: 提取逻辑可维护

- **WHEN** 维护者修改 README.md 的使用说明部分
- **THEN** 无需修改提取逻辑即可使下次打包生成的“市场用 README”反映该修改（提取规则基于固定标题或标记，与当前 README 结构一致）
