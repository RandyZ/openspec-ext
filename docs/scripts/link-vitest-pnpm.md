# link-vitest-pnpm.js

## 用途

在 **pnpm + Vitest** 环境下，解决从 **IDE 内运行测试** 时出现的 `MODULE_NOT_FOUND` 错误（找不到 `vitest/suppress-warnings.cjs`）。

## 背景

- Vitest 在启动 worker 时会通过 Node 的 `--require` 预加载 `suppress-warnings.cjs`，用于屏蔽部分实验性 ESM 相关警告。
- 该文件路径由 Vitest 包内的 `path.js` 根据 `import.meta.url` 解析得到。
- 使用 **pnpm** 时，同一依赖可能对应多个“变体”路径（例如是否带有 `_yaml@x.x.x` 等 peer 信息）。
- **终端**执行 `pnpm test` 时，解析到的是实际存在的变体路径（如带 `_yaml@2.8.2`），能正确找到文件。
- **IDE**（如 VS Code 的 Vitest 扩展）在另一套解析上下文中可能得到“无 yaml”的变体路径，而 pnpm 并未为该变体创建目录，导致 `suppress-warnings.cjs` 找不到，从而报错。

## 做法

脚本会：

1. 定位当前项目中实际安装的 Vitest 包路径（包含 `suppress-warnings.cjs` 的变体）。
2. 根据路径名推断“缺失”的变体路径（例如去掉 `_yaml@x.x.x` 后的 pnpm 目录）。
3. 若该路径不存在且确实缺少 `suppress-warnings.cjs`，则在 pnpm 的 `.pnpm` 下创建对应目录，并将“缺失”变体下的 `vitest` 目录**符号链接**到实际安装的 Vitest 包。

这样当 IDE 解析到“无 yaml”的变体路径时，也能通过符号链接访问到同一份 Vitest 文件，从而找到 `suppress-warnings.cjs`。

## 使用方式

- **自动**：已通过 `package.json` 的 `postinstall` 钩子配置，每次执行 `pnpm install` 后会自动运行。
- **手动**：若需单独执行一次（例如未跑 postinstall 或链接被删），在项目根目录执行：

  ```bash
  node scripts/link-vitest-pnpm.js
  ```

## 注意事项

- 仅在使用 **pnpm** 且从 **IDE 跑 Vitest 测试** 遇到上述 `suppress-warnings.cjs` 找不到时才有必要；终端 `pnpm test` 通常不受影响。
- 脚本在无法匹配路径或已存在目标文件时会静默退出，不会修改已正确的环境。
- 依赖 pnpm 的目录命名格式；若 pnpm 或 Vitest 的目录结构发生较大变化，脚本中的正则可能需要相应调整。
