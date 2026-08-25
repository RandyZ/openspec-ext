# Task 3. Bound Project 数据读取

<!-- covers: Task 3.1, Task 3.2, Task 3.3, Task 3.4 -->

### Task 3.1: 从同一 Binding 创建请求级 CLI 与 ContentAccess readers

**Spec coverage:** `project-data-access` / `CLI And Content Access Share One Binding` / `Local root binds both readers locally`, `External root binds file reads externally`, `Binding path fails containment validation`; `Project Reads Use Explicit Immutable Context`

**Dependencies / order:** 依赖 Task 2 全部安全边界；Task 3.2–3.4 只能通过这里的 bound readers 读取数据。

**Files:**
- Create: 无
- Modify: `src/extension/services/projectDataGateway.ts`
- Test: `test/extension/services/projectDataGateway.test.ts`

**Implementation notes:**
- 新增私有 `bind(project, explicitStoreId?)`：先调用 `resolveBinding()`，再从 Binding 的 `commandCwd/storeId` 创建 data CLI，从 canonical `rootPath/openspec` 创建 `FileManagerService`。
- helper 返回请求局部普通对象 `{ binding, cli, contentAccess, scope }`；不创建 session class、registry 或可变 service cache。
- Gateway 不接受调用方单独提供 content root；所有 file access 的 root 必须由 Binding 派生。
- 即使 Changes/Specs MVP 暂不调用 content methods，也要通过 factory spy 固定 local/external root 构造参数与 fail-before-construction 行为。

**Verification:** local root 的 CLI cwd/ContentAccess dir 都指向 local Binding；external root 的 CLI 仍使用 Project command cwd，而 ContentAccess 精确指向 external canonical `openspec`。

**Risks / edge cases:** `FileManagerService` constructor 当前无 I/O，但不能依赖该事实绕过 Task 2.2 的 path 校验；future file method 必须复用 `bind()`。

- [ ] **Step 1（2–5 分钟）: 写失败测试**

注入 CLI/content factory，记录 local 与 external Binding 下的 cwd、scope、content dir，并覆盖 invalid Binding 零构造。

- [ ] **Step 2（2–5 分钟）: 运行测试并确认 RED**

Run: `rtk pnpm exec vitest run test/extension/services/projectDataGateway.test.ts -t "bound readers"`

Expected: FAIL，原因是 `bind()` 尚未创建同源 readers 或 content factory 未被正确调用。

- [ ] **Step 3（2–5 分钟）: 写最小实现**

实现一个私有 helper 和两个默认 factory；复用现有 `OpenSpecCliService`、resolver 与 `FileManagerService`，不新增 interface hierarchy。

- [ ] **Step 4（2–5 分钟）: 运行测试并确认 GREEN**

Run: `rtk pnpm exec vitest run test/extension/services/projectDataGateway.test.ts -t "bound readers"`

Expected: PASS；每个 request 的两个 reader 都可追溯到同一 Binding。

---

### Task 3.2: 返回 Project-scoped Change summaries 并保留明确失败

**Spec coverage:** `project-data-access` / `Gateway Returns Purpose-Specific Project Data` / `Current Project change summaries are requested`, `One Project read fails`; `Project Reads Use Explicit Immutable Context` / `Two Projects load concurrently`

**Dependencies / order:** 依赖 Task 3.1 bound readers；canonical Specs 由 Task 3.3 独立实现。

**Files:**
- Create: 无
- Modify: `src/extension/services/projectDataGateway.ts`
- Test: `test/extension/services/projectDataGateway.test.ts`, `test/extension/services/openspecCli.test.ts`

**Implementation notes:**
- 实现 `loadChanges(project, explicitStoreId?)`，只调用 bound CLI 的现有 `listChanges(scope)`，保留 list + status enrichment 和 lifecycle/attention 语义。
- 返回 `ProjectChangesData { project, binding, changes }`；不加入 Stores、Worksets、archive、diagnostics、cache metadata 或 Dashboard 字段。
- overall CLI/root failure 包装为 `ProjectDataAccessError(phase='changes')` 并携带 Project/Binding；不把失败降级为空数组或另一 Project 的结果。
- `OpenSpecCliService.listChanges()` 内部已定义的单 change status attention fallback 保持不变；Gateway 不重复或改写该策略。

**Verification:** 成功结果与 fake CLI 返回的 enriched Changes 一致；overall list failure 明确抛出；并发 Project A/B 返回各自数据。

**Risks / edge cases:** 不要把 status enrichment 的已知局部降级误判成 Gateway overall success fallback；两者语义不同。

- [ ] **Step 1（2–5 分钟）: 写失败测试**

增加 change success、overall list failure、并发 Project A/B 三个 case，并断言专用 DTO 不含 Dashboard 聚合字段。

- [ ] **Step 2（2–5 分钟）: 运行测试并确认 RED**

Run: `rtk pnpm exec vitest run test/extension/services/projectDataGateway.test.ts -t "loadChanges"`

Expected: FAIL，原因是 `loadChanges()` 尚不存在或错误被错误降级。

- [ ] **Step 3（2–5 分钟）: 写最小实现**

通过 `bind()` 调一次 `listChanges(scope)` 并构造专用 DTO；只在 Gateway boundary 包装 overall error。

- [ ] **Step 4（2–5 分钟）: 运行测试并确认 GREEN**

Run: `rtk pnpm exec vitest run test/extension/services/projectDataGateway.test.ts test/extension/services/openspecCli.test.ts -t "loadChanges|listChanges"`

Expected: PASS；现有 lifecycle/status enrichment 未回归。

---

### Task 3.3: 仅从官方 canonical-spec surface 返回 Project Specs

**Spec coverage:** `project-data-access` / `Canonical Specs Remain Distinct From Delta And Referenced Specs` / `Active Change contains delta Specs`, `No canonical Specs exist but delta Specs exist`, `Project references a Store`; `Gateway Returns Purpose-Specific Project Data`

**Dependencies / order:** 依赖 Task 3.1；不得调用旧 `StateReader.listSpecs()`，也不等待后续 referenced Store UI。

**Files:**
- Create: 无
- Modify: `src/extension/services/projectDataGateway.ts`
- Test: `test/extension/services/projectDataGateway.test.ts`, `test/extension/services/openspecCli.test.ts`

**Implementation notes:**
- 实现 `loadCanonicalSpecs(project, explicitStoreId?)`，只调用 bound CLI 的 `listSpecs(scope)` 官方 canonical surface。
- 返回 `ProjectCanonicalSpecsData { project, binding, specs }`；空 canonical list 原样返回空。
- 测试 fake ContentAccess 即使报告 delta Specs 也不得被调用；context 即使含 references 也不加载、合并或重新标记 Store Specs。
- 不修改 `StateReader.listSpecs()`，因为旧 Dashboard 仍依赖其 legacy 混合语义，删除/迁移属于后续 Change。

**Verification:** canonical-only、canonical-empty-with-delta、context-with-references 三个 case 均只反映 CLI `list --specs --json` 结果。

**Risks / edge cases:** 不为表面 parity 合并 delta；CLI 返回空与 CLI failure 必须区分，failure 继续抛出并关联 Project/Binding。

- [ ] **Step 1（2–5 分钟）: 写失败测试**

添加 canonical list、empty canonical + delta fixture、referenced Store context 和 CLI failure case，并 spy file-spec methods 零调用。

- [ ] **Step 2（2–5 分钟）: 运行测试并确认 RED**

Run: `rtk pnpm exec vitest run test/extension/services/projectDataGateway.test.ts -t "canonical Specs"`

Expected: FAIL，原因是 `loadCanonicalSpecs()` 尚不存在或错误使用 legacy `StateReader.listSpecs()`。

- [ ] **Step 3（2–5 分钟）: 写最小实现**

只调用 `cli.listSpecs(scope)` 并返回专用 DTO；不添加 filesystem fallback 或 referenced Store 查询。

- [ ] **Step 4（2–5 分钟）: 运行测试并确认 GREEN**

Run: `rtk pnpm exec vitest run test/extension/services/projectDataGateway.test.ts test/extension/services/openspecCli.test.ts -t "canonical Specs|listSpecs"`

Expected: PASS；delta/reference fixtures 从未进入 canonical result。

---

### Task 3.4: 证明无缓存状态下 Root 变化可由 CLI 重新解析

**Spec coverage:** `project-data-access` / `Project-Bound Cache Is Disposable And Isolated` / `Same Project resolves to a different root`, `Cache is absent or cleared`

**Dependencies / order:** 依赖 Task 3.1–3.3 的完整 load path；本任务固定“不接 cache”的 MVP 行为。

**Files:**
- Create: 无
- Modify: 无业务代码，除非测试暴露 Gateway 错误保存了 request state
- Test: `test/extension/services/projectDataGateway.test.ts`

**Implementation notes:**
- 同一 `ProjectContext` 连续两次读取时，每次都必须重新调用 `getContext()`；第一次返回 Root A，第二次返回 Root B。
- 第二次 DTO、CLI selector 和 content factory root 必须全部来自 Root B，不能复用 A 的 Binding/result。
- Gateway 不依赖 `OpenSpecCacheService`、Store registry 或 Workset registry；本 Change 不新增 cache key 或 invalidation abstraction。
- 若测试发现 Gateway 保存了 Binding/readers，删除该状态，保持请求局部实现。

**Verification:** probe call count 为 2，结果 root 顺序为 A/B，第二次 Specs/Changes 只含 B 数据；清空所有 fake result 后可由 CLI fixture 重新构造。

**Risks / edge cases:** 本任务验证 correctness，不做性能基准；只有后续真实性能数据才授权增加 Project-bound cache。

- [ ] **Step 1（2–5 分钟）: 写失败测试**

增加 sequential Root A→B fixture 和无 cache service fixture，记录两次 probe/read/content roots。

- [ ] **Step 2（2–5 分钟）: 运行测试并确认 RED 或确认现有最小实现已满足**

Run: `rtk pnpm exec vitest run test/extension/services/projectDataGateway.test.ts -t "re-resolves|cache absent"`

Expected: 若存在跨请求 Binding 状态则 FAIL；若 Task 3.1 已保持完全无状态则直接 PASS，并保留该回归测试作为证据。

- [ ] **Step 3（2–5 分钟）: 必要时删除跨请求状态**

只在 RED 时移除 Gateway 上缓存的 Binding/readers；不要新增 invalidation manager。

- [ ] **Step 4（2–5 分钟）: 运行测试并确认 GREEN**

Run: `rtk pnpm exec vitest run test/extension/services/projectDataGateway.test.ts -t "re-resolves|cache absent"`

Expected: PASS；第二次读取完全来自 Root B，且不依赖插件 registry/cache。
