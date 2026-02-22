## 1. 稳定 existingArtifactIds 引用（App.tsx）

- [x] 1.1 在 `App.tsx` 中，收到 `setContext` 时对新旧 `existingArtifactIds` 做内容比较（排序后比较或 Set 比较），仅当内容有实质变化时才调用 `setExistingArtifactIds`
- [ ] 1.2 验证：连续多次点击同一 change 打开面板，`ChangeDetail` 的请求 effect 不被重复触发

## 2. 在 ChangeDetail 中添加 artifact 内容缓存

- [x] 2.1 在 `ChangeDetail` 中用 `useRef` 创建 `Map<string, string>` 缓存，key 格式为 `artifactType` 或 `specs:${specId}`
- [x] 2.2 修改请求 effect：在发起请求前先查缓存，命中则直接 `setContent(cached)`、`setLoading(false)`，不发送 `getArtifactContent` 消息
- [x] 2.3 修改消息监听：收到 `artifactContent` / `deltaSpecContent` 时写入缓存
- [ ] 2.4 验证：在同一面板内切换多个 tab 后再切回，之前加载过的 tab 立即显示内容、无 loading

## 3. Refresh 清缓存

- [x] 3.1 在 `handleRefresh` 中，清空 `ChangeDetail` 的缓存 Map（调用 `.clear()` 或按 changeName 删除对应条目）
- [ ] 3.2 验证：点击 Refresh 后，当前 tab 内容重新从扩展拉取，能看到最新磁盘内容

## 4. 验证与回归测试

- [ ] 4.1 首次打开 change 面板：proposal tab 正常 loading 并显示内容
- [ ] 4.2 切到 Design tab 再切回 Proposal：Proposal 直接显示，无 loading
- [ ] 4.3 切到其他编辑器 tab 再切回 Change Detail 面板：内容不重载
- [ ] 4.4 再次点击侧边栏同一 change：面板 reveal，当前 tab 内容不重载
- [ ] 4.5 手动修改 artifact 文件后点 Refresh：面板显示最新内容
