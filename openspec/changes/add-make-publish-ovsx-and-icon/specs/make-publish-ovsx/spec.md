# Spec: Make 发布 OVSX

## ADDED Requirements

### Requirement: 通过 make 一键发布到 Open VSX

项目 SHALL 提供 Makefile，且包含目标（如 `publish-ovsx`），执行该目标时依次执行打包与发布到 Open VSX。发布所需 OVSX_TOKEN SHALL 可从项目根目录的 `.env` 文件中读取（若存在），无需在命令行显式传入环境变量。不在此变更中实现 VS Code Marketplace 的 make 发布。

#### Scenario: 执行 make 目标且 .env 中存在 OVSX_TOKEN

- **WHEN** 项目根目录存在 `.env` 且其中包含 OVSX_TOKEN，用户执行该 make 目标
- **THEN** make 从 .env 加载 OVSX_TOKEN（或通过所调用的脚本加载），先执行打包（生成 .vsix），再执行发布到 Open VSX 的命令

#### Scenario: 执行 make 目标且未设置 OVSX_TOKEN

- **WHEN** .env 中无 OVSX_TOKEN 且环境变量也未设置，用户执行该 make 目标
- **THEN** 打包可能成功，发布步骤失败并给出需设置 OVSX_TOKEN 的明确提示（与现有 publish:openvsx 行为一致）

### Requirement: make 不替代现有 pnpm 脚本

Make 目标 SHALL 仅调用现有的 pnpm 脚本（如 package、publish:openvsx），不复制或替换其逻辑。

#### Scenario: make 调用现有脚本

- **WHEN** 实现该 make 目标
- **THEN** 目标内部仅调用 pnpm run package 与 pnpm run publish:openvsx（或等价脚本），且可在调用前或通过脚本从 .env 加载 OVSX_TOKEN
