# Task 1. CLI 与 Project 基础契约

<!-- covers: Task 1.1, Task 1.2 -->

### Task 1.1: 为 CLI context JSON 与显式 Store selector 提供类型化读取能力

**Spec coverage:** `project-data-access` / `OpenSpec CLI Owns Root Resolution` / `Ordinary Project uses selector-free resolution`, `CLI resolves an external or global default root`, `Explicit Store selector remains explicit`, `Root resolution cannot be established`

**Dependencies / order:** 无代码前置；先完成本任务，Task 2 才能通过官方 context surface 解析 Binding。

**Files:**
- Create: 无
- Modify: `src/extension/services/openspecCli.ts`, `src/extension/services/types.ts`
- Test: `test/extension/services/openspecCli.test.ts`

**Implementation notes:**
- 在现有 CLI service 上新增 `getContext(scope?: ScopeOption | OpenSpecScope): Promise<OpenSpecContextResult>`；内部只调用 `runJson(withStoreFlag(['context', '--json'], scope))`，不复制进程启动、resolver 或 JSON parsing。
- `OpenSpecContextResult` 只类型化 Gateway 必需的 `root`、`source`，并允许 CLI 返回其他字段；运行时字段合法性由 Gateway 的 trust boundary 校验。
- 无 scope 时参数必须精确保持 `context --json`；只有显式 `{ storeId }` 时才追加 `--store <id>`。
- JSON 解析、CLI exit 或 resolution error 必须继续抛出，不能返回空 context 或扫描文件兜底。

**Verification:** focused test 必须观察命令参数和返回值；selector-free case 不得出现 `--store`，Store case 必须只追加一次指定 id。

**Risks / edge cases:** CLI source 是开放字符串；不要把 `nearest`、`store`、`global_default` 写成封闭 enum。现有 `runJson()` 的其他调用者行为不得改变。

- [ ] **Step 1（2–5 分钟）: 写失败测试**

在 `openspecCli.test.ts` 增加 selector-free、显式 Store、malformed JSON 三个 `getContext()` case，并 spy 实际 CLI 参数。

- [ ] **Step 2（2–5 分钟）: 运行测试并确认 RED**

Run: `rtk pnpm exec vitest run test/extension/services/openspecCli.test.ts`

Expected: FAIL，原因是 `OpenSpecCliService.getContext` 或 `OpenSpecContextResult` 尚不存在。

- [ ] **Step 3（2–5 分钟）: 写最小实现**

只新增 context result 类型和 `getContext()`，复用 `withStoreFlag()` 与 `runJson()`；不重构其他 CLI 方法。

- [ ] **Step 4（2–5 分钟）: 运行测试并确认 GREEN**

Run: `rtk pnpm exec vitest run test/extension/services/openspecCli.test.ts`

Expected: PASS；现有 list/status/spec cases 也保持通过。

- [ ] **Step 5（2–5 分钟）: 检查变更范围**

Run: `rtk git diff -- src/extension/services/openspecCli.ts src/extension/services/types.ts test/extension/services/openspecCli.test.ts`

Expected: 仅包含 context surface、类型和对应测试，无 resolver 或旧 fallback 改写。

---

### Task 1.2: 建立稳定的 Project Context 与专用只读数据模型

**Spec coverage:** `project-data-access` / `Project Context Is Separate From OpenSpec Root Binding` / `Current workspace project creates a stable Project Context`, `Project and planning root are different paths`; `Gateway Returns Purpose-Specific Project Data`

**Dependencies / order:** 依赖 Task 1.1 的 context result 类型；Task 2–3 复用这里的 Project、Binding 与 read model。

**Files:**
- Create: `src/extension/services/projectDataGateway.ts`, `test/extension/services/projectDataGateway.test.ts`
- Modify: `src/extension/services/types.ts`
- Test: `test/extension/services/projectDataGateway.test.ts`

**Implementation notes:**
- 在现有 service types 中增加 readonly `ProjectContext`、`OpenSpecRootBinding`、`ProjectChangesData`、`ProjectCanonicalSpecsData`；不新增共享 package 或第二个 Dashboard DTO。
- 在 Gateway 文件中实现 `createProjectContext(label, projectPath)`：`path.resolve()` 后使用 `fs.promises.realpath()` 得到 canonical absolute path，并让 `id === projectPath`。
- Helper 只接收 Extension Host 已知 workspace folder 的 label/path，不导入 `vscode`，也不接受 Store、scope 或 root selector。
- Project label 只用于展示；Store/root 变化不得改变 Project identity。

**Verification:** 同一个 workspace path 使用不同 label 或后续 Store selector 时，canonical id/path 保持稳定；symlink alias 应解析为同一个 physical Project。

**Risks / edge cases:** MVP identity 是 canonical path，不尝试表达 Git repository/worktree identity；`realpath` 失败必须明确抛出，不能保留未验证 path。

- [ ] **Step 1（2–5 分钟）: 写失败测试**

用临时 Project 目录和 symlink alias 测试 canonical identity，并对四个 DTO 做 TypeScript readonly/shape 使用断言。

- [ ] **Step 2（2–5 分钟）: 运行测试并确认 RED**

Run: `rtk pnpm exec vitest run test/extension/services/projectDataGateway.test.ts`

Expected: FAIL，原因是 Gateway module、Project factory 或模型导出尚不存在。

- [ ] **Step 3（2–5 分钟）: 写最小实现**

添加四个 readonly 模型与 `createProjectContext()`；Gateway class 的 root/data 方法留给后续任务，不添加 registry、cache 或 UI wiring。

- [ ] **Step 4（2–5 分钟）: 运行测试并确认 GREEN**

Run: `rtk pnpm exec vitest run test/extension/services/projectDataGateway.test.ts`

Expected: PASS；两个路径 alias 产生同一 canonical Project identity。

- [ ] **Step 5（2–5 分钟）: 运行类型与格式检查**

Run: `rtk pnpm run build`

Expected: extension 与 webview build 成功，新增 Extension-only 类型未进入 Webview message contract。
