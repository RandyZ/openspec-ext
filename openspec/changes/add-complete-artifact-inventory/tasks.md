## 1. Artifact Inventory 共享模块

- [ ] 1.1 新增 `src/extension/services/artifactInventory.ts`，定义 `OtherArtifactEntry` 类型（`id`、`relativePath`、`isDirectory`、`fileCount`）
- [ ] 1.2 实现 `buildOtherArtifacts(changeDir, knownOutputPaths)`：扫描 change 目录直接子项，跳过 `.openspec.yaml` 及隐藏文件/目录，与 `knownOutputPaths` 做 diff
- [ ] 1.3 实现目录型条目的文件计数（对识别为"其他"的子目录做单层 `readdir`，不递归子目录内部）
- [ ] 1.4 为 `buildOtherArtifacts` 编写单元测试：已知文件被排除、未知文件/目录被识别、目录文件计数正确、无 Other Artifacts 时返回空数组

## 2. Extension Host 数据接入

- [ ] 2.1 在 `DataManager` 的 CLI 数据路径（`getChangeDetails` 之后）接入 `buildOtherArtifacts`，`knownOutputPaths` 取自 `ChangeDetails.artifacts[].outputPath`
- [ ] 2.2 在 `getFilesystemArtifactStatuses` fallback 路径接入 `buildOtherArtifacts`，`knownOutputPaths` 取自 fallback 现有的固定已知列表（`proposal`/`design`/`tasks`/`specs`）
- [ ] 2.3 扩展 `ChangeDetails` 类型新增 `otherArtifacts?: OtherArtifactEntry[]` 字段，同步更新 `src/webview/types/messages.ts` 里对应的 payload 类型
- [ ] 2.4 为两条路径分别编写测试，覆盖 CLI 成功、CLI 失败回退到 filesystem 两种场景下 `otherArtifacts` 的正确性

## 3. openArtifact 改造与 openOtherArtifact 新增

- [ ] 3.1 改造 `webviewMessageHandler.ts` 的 `openArtifact` case：改用已发送给 Webview 的 Inventory 中记录的真实 `outputPath`，不再拼接 `` `${artifactType}.md` ``
- [ ] 3.2 为 `openArtifact` 的单文件分支补上 `revealInExplorer` 调用，对齐 `openChange` 现有行为
- [ ] 3.3 实现目录型 `outputPath` 的"定位最近修改文件 + reveal + open"逻辑，封装成可复用的辅助函数（`openArtifact` 与 `openOtherArtifact` 共用）
- [ ] 3.4 新增 `openOtherArtifact` 消息类型：`src/webview/types/messages.ts` 增加 `{ type: 'openOtherArtifact'; changeName; entryId; scopeId? }` 及对应 `sendMessage.openOtherArtifact()` 构造函数
- [ ] 3.5 在 `webviewMessageHandler.ts` 新增 `openOtherArtifact` case：重新调用 `buildOtherArtifacts` 按 `entryId` 定位条目，复用 3.3 的辅助函数打开
- [ ] 3.6 为 `openArtifact`/`openOtherArtifact` 编写测试：路径解析正确性、`isPathUnderRoot` 安全校验仍然生效、单文件与目录分支各自的 reveal/open 调用

## 4. Webview Tab 动态化

- [ ] 4.1 将 `ChangeDetailTabId` 从固定联合类型放宽为 `string`；提取 `SPECS_TAB_ID`、`VERIFY_ARCHIVE_TAB_ID` 命名常量替换现有裸字符串比较（如 `activeTab === 'specs'`）
- [ ] 4.2 实现 `buildTabs(artifacts, showVerifyArchiveTab)` 纯函数，替换 `ChangeDetail.tsx` 中的模块级 `ALL_TABS` 常量
- [ ] 4.3 补充 id → 展示名映射表，覆盖 `proposal`/`specs`/`design`/`tasks` 现有翻译；未命中的自定义 id 使用 title-case 兜底
- [ ] 4.4 在 `buildTabs` 中加入保留字冲突防御：Schema artifact id 命中 `VERIFY_ARCHIVE_TAB_ID` 时记录 warning 并跳过该条，不覆盖内置 Tab
- [ ] 4.5 为 `buildTabs` 编写单元测试：默认四个 id 的顺序与 label、自定义 Schema id 的兜底展示、`verifyArchive` 冲突防御

## 5. Other Artifacts 条目区 UI

- [ ] 5.1 在 `ChangeDetail.tsx` 的 Tab 栏与内容区之间新增 Other Artifacts 展示区域，`otherArtifacts` 为空时整块不渲染
- [ ] 5.2 实现条目点击行为：`postMessage(sendMessage.openOtherArtifact(changeName, entryId, scopeId))`，不改变 `activeTab`
- [ ] 5.3 目录型条目展示文件数徽标（如 "task-details · 6 files"）；单文件条目不展示计数
- [ ] 5.4 为该区域编写组件测试：空列表不渲染、点击触发正确消息、目录条目文件数展示正确

## 6. i18n 与收尾验证

- [ ] 6.1 在 `src/i18n/locales/en.json` 与 `zh-cn.json` 补充 Other Artifacts 标题及 tooltip 文案
- [ ] 6.2 运行 `pnpm test`，确认新增和现有测试全部通过
- [ ] 6.3 运行 `pnpm run build`，确认 extension 与 webview 均无编译错误
- [ ] 6.4 运行 `openspec validate add-complete-artifact-inventory --strict`
- [ ] 6.5 手工验证：打开本仓库自身的 `add-change-lifecycle-filtering-and-pagination` change 的 Change Detail，确认其 `task-details/` 子目录作为 Other Artifacts 正确出现，点击后能在 Explorer 中正确 reveal
