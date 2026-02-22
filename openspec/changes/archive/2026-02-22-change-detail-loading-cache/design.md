## Context

### 当前状态

Change Detail 面板每次打开或被再次 reveal 时，扩展会发送 `setContext` 消息（含通过 `getDashboardData()` 新建的 `existingArtifactIds` 数组）。Webview 收到后：

1. `App.tsx` 调用 `setExistingArtifactIds(msg.existingArtifactIds)`——即使内容完全相同，也是新引用。
2. `ChangeDetail` 的 `useEffect([changeName, activeTab, existingArtifactIds])` 检测到引用变化，重跑。
3. 无条件执行 `setLoading(true); setContent(null); postMessage(getArtifactContent(...))`。
4. 扩展重新读文件，再回传内容，Webview 更新。

```
用户点击已有 change
  → open(changeName)
  → existing.reveal() + buildSetContextPayload()（调 getDashboardData()）
  → postMessage(setContext) → 新数组引用
  → setExistingArtifactIds(新引用)
  → effect 重跑 → setContent(null), loading...
  → postMessage(getArtifactContent) → 读文件
  → artifactContent 回传 → 渲染
```

### 约束

- 不改变扩展侧与 webview 的消息协议。
- 不改变 Dashboard 视图行为。
- Refresh 操作必须仍能强制从磁盘拉取最新内容。

## Goals / Non-Goals

**Goals:**
- 消除「再次打开同一 change / 切换回来」时的无效重载
- 切换 tab 时若内容已缓存则立即显示，不显示 loading
- 保持 Refresh 功能的语义：强制清缓存重新读文件

**Non-Goals:**
- 持久化缓存（面板关闭后缓存清空即可）
- 跨面板共享缓存
- 文件变更自动刷新（不在本次 change 范围内）

## Decisions

### 决策 1：缓存放在 `ChangeDetail` 组件内（`useRef`）

**选择**：在 `ChangeDetail` 组件内用 `useRef` 维护一个 `Map<string, string>` 作为缓存，key 为 `${artifactType}` 或 `${artifactType}:${specId}`，value 为 content 字符串。

**理由**：
- 缓存生命周期恰好与面板一致（组件挂载/卸载时自动创建/清除）。
- 不需要引入额外 context 或 hook，修改范围最小（仅改 `ChangeDetail.tsx`）。
- `useRef` 不会触发重渲染，适合存储"副作用数据"。

**替代方案**：
- 放在 `App.tsx` 的 state/ref → 跨 change 实例共享，面板切换时可能读到脏数据，需要额外按 changeName 隔离，复杂度更高。
- 独立 hook `useArtifactCache` → 也可行，若以后多处需要缓存可提取，当前只有一处，YAGNI。

**决策**：用 `useRef` 在 `ChangeDetail` 内维护缓存。

---

### 决策 2：`existingArtifactIds` 引用稳定化放在 `App.tsx`

**选择**：在 `App.tsx` 收到 `setContext` 时，用 `JSON.stringify` 或逐元素比较判断内容是否真的变了，不变则不调用 `setExistingArtifactIds`。

**理由**：
- 根因在 `App.tsx` 生成新引用，在此处截断最干净，不需要修改 `ChangeDetail` 的 effect 依赖。
- `existingArtifactIds` 通常是短数组（≤ 5 个元素），比较成本可忽略。

**替代方案**：
- 在 `ChangeDetail` 的 effect 里改用深比较（如用 `useMemo` 稳定引用）→ 也能解决，但把"稳定引用"的职责压给子组件，语义不清晰。
- 不稳定引用，改在 effect 里判断"有内容就跳过"→ 更复杂，且需要处理"内容需要刷新"时的边界。

**决策**：在 `App.tsx` 做内容比较，仅内容变化时才更新 state。

---

### 决策 3：缓存失效策略——仅 Refresh 清缓存

**选择**：只在用户主动点「Refresh」时清空该 change 的缓存；其它情况（`setContext` 更新、切 tab）不主动失效。

**理由**：
- 面板内的 artifact 内容在用户操作前不会自动改变（需要手动创建/编辑）。
- 自动监听文件变更并失效缓存属于后续功能（file watcher 集成），不在本次范围。
- Refresh 已有入口，用户习惯明确。

**风险**：用户在编辑器里改了 artifact 文件后不刷新，面板显示旧内容。
**缓解**：Refresh 按钮清缓存，行为与现在一致；文档/提示可说明"如需看最新内容请刷新"。

## Risks / Trade-offs

- [风险] 用户在编辑器里改了文件但没点 Refresh，面板显示旧内容 → 缓解：Refresh 清缓存；后续可加文件变更监听。
- [风险] `JSON.stringify` 比较 `existingArtifactIds` 时数组顺序敏感 → 缓解：比较前先排序，或改为 Set 比较；数组短，成本可接受。

## Migration Plan

纯前端改动，无数据迁移，无协议变更，直接替换代码即可。

## Open Questions

- 是否需要在 artifact 被"用 AI 创建"成功后主动失效缓存（目前 `requestCreateArtifact` 成功不直接通知 webview）？→ 建议留给后续，当前用户可点 Refresh 看最新内容。
