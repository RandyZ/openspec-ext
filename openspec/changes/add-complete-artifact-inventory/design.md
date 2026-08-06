## Context

当前实现分两条平行的路径,都没有做到"按 Schema 动态"和"暴露未声明文件":

```
CLI 可用时（DataManager -> OpenSpecCliService）
  openspec show <change> --json
    -> data.artifacts（已经是 Schema 真实返回的数组）
    -> normalizeArtifactInfos() 只做字段清洗，不丢字段
  这条路径本身已经是"动态"的，问题出在下游 Webview 把它硬套进固定 Tab

CLI 不可用时（DataManager.listChangesFromFilesystem 的 fallback）
  getFilesystemArtifactStatuses()
    -> 硬编码 for (const artifactType of ['proposal', 'design', 'tasks'])
    -> specs 靠 listDeltaSpecIds() 单独判断
  这条路径确实是硬编码，但原因是没有 CLI 就没有 Schema 来源，
  不是"选择"硬编码，是没有更好的数据源

Webview 侧（ChangeDetail.tsx）
  const ALL_TABS = [
    { id: 'proposal', label: 'Proposal' },
    { id: 'specs', label: 'Specs' },
    { id: 'design', label: 'Design' },
    { id: 'tasks', label: 'Tasks' },
  ]
  ChangeDetailTabId 是这四个字面量 + 'verifyArchive' 的固定联合类型
  -> 这是真正需要改的地方：不管 Host 侧数据多动态，Tab 本身是死的

打开文件的行为也不一致：
  openChange handler   -> openTextDocument + showTextDocument + revealInExplorer
  openArtifact handler -> 只有 openTextDocument + showTextDocument，没有 reveal
  openDeltaSpec handler -> 同样没有 reveal
  且 openArtifact 的路径拼接是硬编码的 `${artifactType}.md`（webviewMessageHandler.ts:443），
  无法表示目录型 artifact（如 specs/）或非 .md 文件

已有的 `artifact-viewing` spec 里已经写了一条
"Explorer reveal is best effort for external store roots" 的 scenario，
说明规范层面本就预期"打开 artifact 应该 reveal"，只是实现没跟上。
```

具体动机见 `proposal.md` - Why；本设计只处理"怎么做"。

## Goals / Non-Goals

**Goals:**

- Change Detail 的 Tab 列表由 `ChangeDetails.artifacts`（Schema 顺序）动态生成，不再是模块级常量。
- 扫描 Change 目录，把 Schema/fallback 已知列表之外的真实文件或子目录识别为 `Other Artifacts`，用一条独立、始终可见（非空时）的条目展示，不并入任何 Tab 内容区。
- 统一"打开"行为：单文件 reveal + open；目录型（现有的 `specs`，以及未来任何目录型 artifact 或 Other Artifact 子目录）reveal 并展开目录、默认聚焦最近更新的文件。
- 让 `openArtifact` 具备处理目录型输出路径的能力，消除它和 `openChange` 之间的 reveal 行为差异。

**Non-Goals:**

- 不重新设计 Other Artifacts 的视觉布局去匹配 v4 高保真图里的"卡片行"样式；这次先做成一条可点击的紧凑条目列表，视觉打磨留给后续。
- 不让 filesystem fallback 路径（CLI 不可用时）具备真正的 Schema 感知能力——没有 CLI 就没有可靠的 Schema 来源，fallback 继续使用它现有的固定已知列表作为"已知 artifact"基准，Other Artifacts 的检测逻辑只是复用这个基准做目录 diff，而不是让 fallback 本身变聪明。
- 不把"specs 是多文件、需要子选择器"这个特判泛化成"任意 Schema 声明的多文件 artifact 都自动获得同款 UI"；仍然只对字面量 `specs` 保留现有子选择器行为，Other Artifacts 里的目录条目走更简单的"reveal 并选中最近文件"，不做子选择器。
- 不改动 Store/Workset/Root 解析逻辑，不新增 OpenSpec CLI 调用参数。

## Decisions

### 1. 新增一个共享的 Artifact Inventory 构建函数，而不是在两条路径里各自加 diff 逻辑

```
新增：src/extension/services/artifactInventory.ts

buildOtherArtifacts(
  changeDir: string,
  knownOutputPaths: string[],   // 来自 CLI schema 或 fallback 固定列表，统一按相对路径传入
): Promise<OtherArtifactEntry[]>

interface OtherArtifactEntry {
  id: string;            // 由相对路径 slug 化得到，用于消息协议里的定位 key
  relativePath: string;  // 相对 change 目录的路径，如 "task-details" 或 "analysis.md"
  isDirectory: boolean;
  fileCount: number;     // 目录时统计文件数；单文件固定为 1
}
```

两条现有路径（CLI 路径 `DataManager` 拿到 `ChangeDetails.artifacts` 之后、fallback 路径 `getFilesystemArtifactStatuses` 之后）都调用这同一个函数，只是传入的 `knownOutputPaths` 不同来源。这样 Other Artifacts 的识别规则只有一份，不会两条路径各写一套、逐渐分叉。

排除规则：跳过 `.openspec.yaml`（change 级元数据文件，不是用户可见 artifact）以及点文件/隐藏目录。

### 2. `openArtifact` 改为基于 Inventory 里记录的真实路径和类型，而不是拼接 `${artifactType}.md`

现状 `webviewMessageHandler.ts` 里 `openArtifact` 自己拼路径：

```ts
const artifactPath = path.normalize(path.join(changesBase, `${message.artifactType}.md`));
```

改为：先查已经随 dashboard/change 数据一起发给 Webview 的 Artifact Inventory（`ArtifactInfo.outputPath` 现在就是 CLI 返回的真实相对路径，不需要重新拼接），再判断：

```
outputPath 指向单个文件  -> openTextDocument + showTextDocument + revealInExplorer（补齐现有 openChange 已有的模式）
outputPath 指向目录      -> 用 fs.readdir + stat 找目录内最近修改的文件
                          -> openTextDocument + showTextDocument 该文件
                          -> revealInExplorer 该文件（VS Code 会在 Explorer 树里展开其父目录）
```

`isPathUnderRoot` 的安全校验保持不变，只是校验对象从"拼出来的路径"变成"Inventory 里已经记录、且在构建时就已经做过一次同样校验的路径"，双重校验不冲突。

### 3. Other Artifacts 走一条独立的新消息，不复用 `openArtifact`

```ts
// 新增 webview -> host 消息
{ type: 'openOtherArtifact'; changeName: string; entryId: string; scopeId?: string }
```

Host 收到后重新执行一次 `buildOtherArtifacts`（成本很低，一次目录扫描），按 `entryId` 找到对应条目的真实路径，做同样的"文件 reveal+open / 目录 reveal+聚焦最近文件"逻辑，而不是让 Webview 直接把路径传回来。原因：

- 和项目里"写操作前必须重新解析 Root/路径"的既有安全惯例一致（`resolveScopeRoot` + `isPathUnderRoot` 已经在其他 handler 里这么做）；
- 避免 Webview 缓存的旧路径在文件被重命名/删除后仍被信任；
- `entryId` 是扫描时生成的稳定 slug，不是绝对路径，天然避免 Webview 把任意路径回传给 Host 执行文件操作。

### 4. Webview 的 `ChangeDetailTabId` 从固定联合类型改为"已知特殊 tab + 动态 schema id"

```ts
// 现状
type ChangeDetailTabId = 'proposal' | 'specs' | 'design' | 'tasks' | 'verifyArchive';

// 改为
type ChangeDetailTabId = string; // 实际取值来自 ChangeDetails.artifacts[].id，加上字面量 'verifyArchive'
```

`ALL_TABS` 不再是模块级常量，改为一个纯函数：

```ts
function buildTabs(artifacts: ArtifactInfo[], showVerifyArchiveTab: boolean): TabDef[]
```

按 `artifacts` 数组顺序（即 Schema 顺序）生成 Tab，label 优先查一个小的 id → 展示名映射表（覆盖 `proposal/specs/design/tasks` 这四个已知 id 的现有翻译），未命中时用 id 本身做 title-case 兜底,保证任意自定义 Schema 的新 artifact id 都能显示,不会白屏。

对 `activeTab === 'specs'` 这类字面量特判（多文件 delta spec 子选择器）保持不变——见 Non-Goals,这次不泛化。

### 5. Other Artifacts 渲染为 Tab 栏下方的常驻条目区，不作为一个 Tab

```
┌───────────────────────────────────────────────┐
│ [Proposal] [Specs] [Design] [Tasks]            │  ← 动态 Tab（Decision 4）
├───────────────────────────────────────────────┤
│ Other Artifacts (2)                             │  ← 新增，非空时才渲染
│  [task-details · 6 files]  [notes.md]          │  ← 点击各自触发 openOtherArtifact
├───────────────────────────────────────────────┤
│                                                 │
│              (当前 Tab 的内容区，不变)            │
│                                                 │
└───────────────────────────────────────────────┘
```

选择"常驻条目区"而不是"再加一个 Other Tab"的原因：Other Artifacts 里的内容通常不是这个 Change 的规划文档主线（可能是分析笔记、历史遗留文件），用户更可能是"顺手看一眼/跳转过去"，不需要占用主 Tab 导航的心智位置；同时避免触碰 Decision 4 里刚刚泛化的 Tab 类型,把"已知 Schema Tab"和"未知文件列表"两个概念在代码里也分开,互不影响。

## Message / Data Flow

```
DataManager.getChangeDetails(changeName)
  -> CLI: openspec show --json（已有）
  -> 新增: buildOtherArtifacts(changeDir, artifacts.map(a => a.outputPath))
  -> ChangeDetails 新增字段 otherArtifacts: OtherArtifactEntry[]
  -> 经既有 IPC 通道随 change detail 数据一起发给 Webview

Webview ChangeDetail.tsx
  -> buildTabs(changeDetails.artifacts, showVerifyArchiveTab) 生成 Tab
  -> otherArtifacts.length > 0 时渲染条目区
  -> 用户点击 Other Artifacts 条目
       -> postMessage({ type: 'openOtherArtifact', changeName, entryId, scopeId })
  -> 用户点击 Schema Tab 后点 "Open in Editor"（现有交互不变）
       -> postMessage(sendMessage.openArtifact(changeName, activeTab, scopeId))

webviewMessageHandler.ts
  case 'openArtifact'      -> 查 Inventory 里的 outputPath -> 文件: reveal+open / 目录: reveal+open最近文件
  case 'openOtherArtifact' -> 重新 buildOtherArtifacts -> 按 entryId 命中 -> 同上开一套逻辑
```

## Risks / Trade-offs

- [Risk] 目录扫描（`buildOtherArtifacts`）在超大 Change 目录下可能变慢。
  → 只扫描 Change 目录的直接子项（不递归深入已知 artifact 目录内部,如 `specs/` 内部不再二次扫描),文件数统计只对被识别为"其他"的子目录做一层 `readdir`,不递归整棵树。

- [Risk] `ChangeDetailTabId` 从字面量联合类型放宽为 `string` 后,原本靠 TypeScript 字面量类型帮忙检查的 `activeTab === 'specs'` 之类比较,编译期检查会变弱,容易手滑打错字符串。
  → 把已知特殊值(`'specs'`、`'verifyArchive'`)提成命名常量,比较时用常量而不是裸字符串,减少手误风险。

- [Risk] 自定义 Schema（比如本仓库自己声明过、当前分支缺失定义文件的 `aihelp-dev`）产出的 artifact id 如果和某个内部保留字冲突(例如某个 Schema 真的定义了一个叫 `verifyArchive` 的 artifact),会和现有 Verify & Archive 特殊 Tab 冲突。
  → 在 `buildTabs` 里加一条防御:Schema artifact id 命中 `verifyArchive` 时记录 warning 并跳过該条(不覆盖内置特殊 Tab),不阻塞渲染。

- [Risk] `openOtherArtifact` 每次点击都重新扫描目录,如果用户在同一个 Change 里连续点开多个 Other Artifact 条目,会有重复扫描开销。
  → 扫描本身很轻(单层 readdir),且只在用户主动点击时触发,不在渲染/轮询路径上,可接受;后续如有需要可以加短期内存缓存,这次不做。

## Migration Plan

1. Extension Host:新增 `artifactInventory.ts`,`DataManager`/CLI 路径和 filesystem fallback 路径分别接入,先只新增 `otherArtifacts` 字段,不改动现有 `artifacts` 字段行为(纯增量,不破坏现有消费者)。
2. 扩展 message types:新增 `openOtherArtifact`,`webviewMessageHandler.ts` 新增对应 case;改造 `openArtifact` 使用 Inventory 里的真实 outputPath 并补上 `revealInExplorer`。
3. Webview:`ChangeDetailTabId` 放宽为 `string` + 命名常量;`ALL_TABS` 改为 `buildTabs()`;新增 Other Artifacts 条目区组件。
4. i18n:补充 `Other Artifacts`、空态、tooltip 文案(中英)。
5. 测试:Host 侧 `buildOtherArtifacts` 的单元测试(已知列表之外的文件/目录识别、排除 `.openspec.yaml`、目录文件计数);`openArtifact`/`openOtherArtifact` handler 的路径解析和 reveal 调用测试;Webview `buildTabs` 的单元测试(自定义 Schema id、`verifyArchive` 冲突防御);组件测试确认 Other Artifacts 为空时整块不渲染。
6. 构建验证:`pnpm test`、`pnpm run build`、`openspec validate add-complete-artifact-inventory --strict`。

回滚:所有改动都是增量字段/新 case,没有破坏性删除旧字段或旧消息类型;如需回滚,Webview 可以退回读取旧的固定 `ALL_TABS` 常量,Host 侧新字段留着不用即可,不需要数据迁移。
