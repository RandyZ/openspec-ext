# OpenSpec Studio for VS Code：Local-first UI/UX PRD

- 文档版本：v1.1
- 修订日期：2026-08-05
- 产品形态：VS Code Extension（Activity Bar / Primary Sidebar / Editor Webview / Quick Pick）
- 适配范围：兼容传统本地 OpenSpec 工程，并渐进支持 Store、Reference、Working Context、Workset 与 OPSX 工作流
- 文档状态：Updated after UI review · Ready for Design & Engineering Review
- 核心原则：**本地优先、项目为锚点、Store 注册与工程关联分离、工件完整可见、Workset 可管理、写入位置明确、旧行为零退化**

---

## 0. 本次修订摘要

本版本在 Local-first 产品模型的基础上，进一步根据高保真设计评审修正 Changes、Stores 与 Worksets 的信息架构和交互边界。

核心变化如下：

1. **Project 继续作为界面主对象，Local Only 继续作为默认模式**。工程未声明 Store、未配置 Reference 时，仍保持传统 OpenSpec 使用方式。
2. **本机 Store Registry 与当前工程的 Store 关联彻底分离**：
   - 一台主机可以注册 0..N 个 Store；
   - 单个工程最多关联 1 个主 Store（`store:` / Store Pointer）；
   - 单个工程仍可声明 0..N 个只读 Reference，Reference 不占用“主 Store 关联”名额。
3. **Sidebar 必须紧凑展示所有本机已注册 Store**，并清楚标记哪个 Store 与当前工程关联；点击 Store 只负责查看或进入 Store，不得静默改变工程关联。
4. **Changes Workspace 成为工程 Store 关联操作的主入口**。在 Changes 顶部提供紧凑的 `Add Operation`，用于关联、切换、断开 Store，以及打开当前 Store 详情。
5. **Store 关联操作使用居中 Modal，而不是长期占据右侧的大型操作区**。右侧区域仅用于按需打开当前 Store 的 Quick View。
6. **关联 Store 后可在 Changes Workspace 快速查看 Store 详情**，包括 Store ID、本地路径、健康状态、规格数、变更数、最近更新时间，以及进入完整 Store Workspace 的入口。
7. **Change 必须展示全部工件**：
   - Schema 已定义的工件按 Schema 顺序和依赖展示；
   - Change 目录中存在、但当前 Schema 未定义的文件或工件类型，单独归入 `Other Artifacts / 未定义工件`；
   - 不得因为 Schema 未声明而隐藏真实文件。
8. **Artifact 点击行为以文件定位为主**。点击单文件工件时，在 VS Code Explorer 中 Reveal 并打开；点击多文件工件时，在 Explorer 中展开并定位对应目录或首个文件。
9. **Worksets 升级为可见的一等入口**：Sidebar 同时提供 `Worksets` 管理入口和 `Enter Workset Workspace` 启动入口。
10. **新增完整 Worksets Workspace**，支持列表查看、搜索、创建、编辑、重命名、复制、删除、成员排序、必选/可选成员设置，以及在当前或新窗口打开。
11. **Store、Reference、Workset 三种关系仍保持严格区分**：
    - Store Pointer：0..1，可写规划位置；
    - References：0..N，只读上下文；
    - Workset：0..N，本机目录启动配置。
12. **Change 生命周期能力继续作为产品核心**。Store 与 Workset 的展示增强不能挤压创建、规划、实施、验证和归档 Change 的主路径。

## 1. 产品背景

现有插件建立在传统 OpenSpec 单仓库模型上：代码工程中存在 `openspec/`，其中保存 `specs/` 与 `changes/`，用户围绕 Change 生命周期完成规划和交付。

典型目录：

```text
aihelp-server-golang/
├── openspec/
│   ├── config.yaml
│   ├── specs/
│   └── changes/
└── ...
```

现有插件已经覆盖以下高频能力：

1. 浏览进行中、草稿、完成和归档 Change；
2. 查看 Proposal、Specs、Design、Tasks；
3. 展示任务完成度；
4. 进入 Apply、Verify、Archive 等动作；
5. 维护 Change 从规划到交付的完整生命周期。

OpenSpec 的跨仓库规划能力进一步引入了 Store、Reference、Working Context 与 Workset：

- Store 可独立保存 Specs 与 Changes；
- 代码工程可以通过 `store:` 将规划外置到 Store；
- 代码工程可以通过 `references:` 只读引用其他 Store 的规格；
- Workset 可以在本机一次打开 Store 与多个代码目录。

这些能力会扩大插件的适用范围，但不能改变默认用户的简单体验。

因此，新版产品不应从“管理多个 Store”出发，而应从用户真正进入 VS Code 时的心智出发：

> 我正在打开哪个代码工程？它现在把 Change 写在哪里？它引用了哪些外部规格？下一步应该对哪个 Change 做什么？

---

## 2. 产品定位

### 2.1 一句话定位

> **一个以本地 Change 生命周期为核心、可按需连接跨仓库规划上下文的 OpenSpec VS Code Studio。**

英文定位：

> **A local-first OpenSpec change studio with optional cross-repository planning context.**

### 2.2 产品不是什麽

本插件不是：

- Store 管理后台；
- Git 同步工具；
- Workset 项目管理系统；
- OpenSpec CLI 的替代实现；
- 将所有工程强制迁移到 Store 的升级向导。

### 2.3 产品价值优先级

从高到低排序：

1. 不丢失、不误写任何本地 Change；
2. 清晰维护 Change 生命周期；
3. 明确当前写入位置；
4. 读取并利用跨仓库 Reference；
5. 管理 Store；
6. 管理 Workset。

---

## 3. 官方概念与产品对象映射

### 3.1 Project

当前 VS Code 中打开的代码工程，是用户的主工作对象。

产品职责：

- 提供项目名称、路径、Git 状态和当前 OpenSpec 模式；
- 决定本地 Root 检测起点；
- 承载 `openspec/config.yaml`；
- 作为所有导航和提示语的主语。

### 3.2 Local Root

当前工程内真实存在的 OpenSpec 规划根，通常是 `./openspec`。

当本地存在真实规划内容时，它是默认可写位置。

产品表现：

```text
Planning: Local · ./openspec
```

### 3.3 Store

Store 是独立的规划仓库，具有自己的 `openspec/specs`、`openspec/changes` 与 Store identity。

必须区分两个层级：

1. **Machine Store Registry**：当前主机上注册的 Store 集合，数量为 0..N；
2. **Project Primary Store Association**：当前工程通过 `store:` 指向的主 Store，数量为 0..1。

一个 Store 可以被多个工程使用；一个工程在同一时间只能有一个主 Store Pointer。工程可以在主 Store 之外继续声明多个只读 References。

Store 可以扮演两种不同角色：

1. **Writable Planning Location**：当前 Project 的 Change 与 Specs 写入该 Store；
2. **Read-only Reference Source**：当前 Project 只读取该 Store 的 Specs。

产品中不得将两者都简化成模糊的“已连接”。推荐使用：

- `Linked as planning Store`；
- `Used as read-only Reference`；
- `Registered on this machine`。

Sidebar 展示所有已注册 Store，但只有一个 Store 可以显示 `Linked to current project`。点击其他 Store 不得自动切换关联。

### 3.4 Store Pointer

代码工程在 `openspec/config.yaml` 中声明：

```yaml
store: team-plans
```

其语义是：当当前工程没有更高优先级的真实本地 Root、且没有显式指定 Store 时，把 `team-plans` 作为规划位置。

产品表现：

```text
Planning: team-plans
Store · Writable
Declared by project
```

### 3.5 Reference

代码工程通过 `references:` 声明只读 Store 上下文。

简写形式：

```yaml
references:
  - xxx-workspace
```

完整形式：

```yaml
references:
  - id: xxx-workspace
    remote: "https://xxxxx/yyyyy.git"
```

语义：

- 当前工程继续保留自己的 OpenSpec Root；
- Change 仍写入当前本地 Root；
- Reference 只提供 Specs 索引、读取与 AI 上下文；
- `remote` 用于在未注册 Store 时生成完整修复信息，不代表 OpenSpec 自动 clone、pull 或 push。

产品表现：

```text
References · 1
└─ xxx-workspace · Read-only · Healthy
```

### 3.6 Working Context

当前可写 Root 与 References 的组合视图。

它是系统推导结果，不要求普通用户先学习这个术语。普通模式下，UI 可以只显示“本地规划”和“引用”。

### 3.7 Workset

本机个人保存的多目录打开方式。

语义：

- 只记录哪些本地文件夹一起打开；
- 不拥有 Change；
- 不改变 Planning Location；
- 不写入项目配置；
- 删除 Workset 不删除成员目录。

### 3.8 Change / Spec / Artifact

- Spec：系统当前真实行为；
- Change：提议中的修改，独立存在直到归档；
- Artifact：由 Schema 定义的 Change 文档和依赖图。

默认 Artifact 可能是 Proposal、Specs、Design、Tasks，但 UI 不得将其永久硬编码为固定四阶段。

---

## 4. 核心产品原则

### 4.1 Local-first

只要工程拥有自己的本地 OpenSpec Root，默认界面就保持传统、简单、直接。

不得要求用户：

- 注册 Store 后才能创建 Change；
- 先选择 Planning Root；
- 先创建 Workset；
- 在每次创建 Change 时重复确认本地路径。

### 4.2 Project-anchored

Sidebar 和 Editor 的所有页面都以 Current Project 为主锚点。

Planning Location、Reference 和 Workset 是 Project 周围的关系，不反客为主。

### 4.3 Progressive Disclosure

普通工程默认只显示：

- Changes；
- Specs；
- New Change；
- Local planning 状态；
- 一个次级 `Connect Store…` 入口。

只有工程已配置 Store / Reference，或者用户主动进入连接流程时，才展开高级信息。

### 4.4 Explicit Write Target

所有写操作必须明确最终目标：

- New Change；
- Create / update Artifact；
- Apply；
- Sync Specs；
- Archive。

本地简单模式可通过上下文提示表达，不必每次弹窗；Store、全局默认或临时 override 场景必须清晰显示。

### 4.5 No Silent Migration

本地已有 `specs/`、`changes/` 或 archive 内容时，禁止通过单次配置写入把项目“切到 Store”。

### 4.6 OpenSpec as Source of Truth

CLI 和项目文件是业务真相。插件负责：

- 展示；
- 编排；
- 风险提示；
- 运行官方命令；
- 跳转文件。

插件不自行重新定义 Root Resolution、Artifact 状态或 Archive eligibility。

---

## 5. 用户角色与核心任务

### 5.1 普通单仓库开发者

目标：

- 打开工程立即看到 Changes；
- 创建本地 Change；
- 查看 Artifact 和任务；
- Apply、Verify、Archive。

产品要求：Store 相关 UI 不得增加主流程步骤。

### 5.2 使用共享规格的业务开发者

目标：

- Change 继续保存在业务工程；
- 只读查看平台 Store 的 Specs；
- Reference 不可用时能够自助修复。

### 5.3 多仓库功能负责人

目标：

- 将统一规划保存在 Store；
- 在一个 Change 中规划跨多个代码仓库的工作；
- 用 Workset 一次打开 Store 与代码目录。

### 5.4 Store 维护者

目标：

- 创建、注册、检查 Store；
- 查看 Store identity 和 Git 状态；
- 不被插件自动执行不可控的 Git 同步。

### 5.5 自定义 Schema 用户

目标：

- 查看动态 Artifact；
- 准确了解 Ready / Blocked / Done；
- 根据 Next Steps 执行动作，而不是被固定瀑布 Stepper 限制。

---

## 6. 工程模式与状态模型

插件必须首先识别工程所处模式，再决定界面复杂度。

### 6.1 Mode A：Local Only

判定：

- 当前工程存在真实 Local Root；
- 无 References；
- 有无注册 Store 都不影响此模式。

界面：

```text
aihelp-server-golang
Planning · Local ./openspec
● Healthy

[ + New Change ]

Changes
Specs

Connect Store…
```

行为：

- New Change 直接创建在本地；
- 不显示 Root Switcher；
- 主工作区不显示大型 Stores Dashboard；
- Sidebar 以紧凑列表展示本机已注册 Stores；
- Sidebar 提供 Worksets 管理和 Workset Workspace 入口，但不阻塞本地 Change 主流程；
- 维持原插件最低认知成本。

### 6.2 Mode B：Local + References

判定：

- 当前工程存在真实 Local Root；
- `references:` 至少包含一项。

界面：

```text
Planning · Local ./openspec
References · 2
● 1 Healthy  ● 1 Warning
```

行为：

- New Change 仍写入本地；
- Reference Specs 只读展示；
- Missing Reference 只产生 Warning，不阻塞本地工作；
- 搜索结果必须标记来源。

### 6.3 Mode C：Declared Store

判定：

- 当前工程为 config-only 指针工程；
- `openspec/config.yaml` 包含 `store: <id>`；
- Store 已在本机可解析；
- 当前工程没有优先级更高的真实本地规划 Root。

界面：

```text
aihelp-server-golang
Planning · team-plans
Store · Writable
Declared by project
```

行为：

- New Change 写入 Store；
- 页面始终显示 Store ID；
- Workset 仍只是打开辅助；
- Change 可跨代码工程规划，但代码仓库成员关系不由 OpenSpec 自动管理。

### 6.4 Mode D：Machine Default Fallback

判定：

- 没有显式 Store；
- 没有真实 Local Root；
- 没有项目 Store Pointer；
- 机器配置了 `defaultStore`。

界面：

```text
Planning · team-plans
Machine default · Not declared by this project
```

首次写操作保护：

```text
This project does not declare a planning location.
The new change will be created in your machine default Store: team-plans.

[Continue once]
[Set for this project]
[Initialize local planning]
```

目的：避免不同开发者机器上的默认 Store 不一致导致写入漂移。

### 6.5 Mode E：Uninitialized / No Root

判定：无法解析任何 Root。

空状态：

```text
OpenSpec is not initialized for this project.

[Initialize locally]  — recommended
[Use a registered Store]
[Create a Store]
```

默认突出 `Initialize locally`，不以 Store 为默认推荐。

### 6.6 Conflict：Local Root + Store Pointer

判定：

- 工程中存在真实本地规划内容；
- 同时配置 `store:`。

行为：

- 按 CLI 实际解析结果使用 Local Root；
- 显示 Warning：Store Pointer 当前未生效；
- 提供：
  - Remove stale pointer；
  - Review local-to-store migration；
  - Open diagnostics。

禁止在 UI 上显示 Store 为 Active Root。

---

## 7. Root Resolution 与显示规则

Root Resolution 依次考虑：

1. 本次显式 Store 选择或命令参数；
2. 从当前目录向上找到的真实 `openspec/` Root；
3. 项目 `store:` Pointer；
4. 机器 `defaultStore`；
5. 无 Root，报错或引导初始化。

Reference 与 Workset 不参与可写 Root 解析。

插件内部建议抽象：

```ts
interface ResolvedPlanningContext {
  project: ProjectInfo;
  writableRoot?: {
    kind: 'local' | 'store';
    id?: string;
    path: string;
    source: 'explicit' | 'local' | 'project_pointer' | 'global_default';
  };
  references: ReferenceContext[];
  conflicts: ContextConflict[];
  health: 'healthy' | 'warning' | 'error';
}
```

写操作前必须重新解析，禁止使用打开页面时的过期缓存直接执行。

---

## 8. 信息架构

```text
OpenSpec Activity View
├── Current Project
│   ├── Project name / path
│   ├── Planning summary
│   └── Health
│
├── Primary Navigation
│   ├── Changes
│   ├── Specs
│   └── References（仅存在时显示数量；入口可常驻）
│
├── Stores（本机已注册，紧凑列表）
│   ├── Store A · Linked to current project
│   ├── Store B · Healthy
│   ├── Store C · Warning
│   └── View all / Register Store
│
├── Worksets
│   ├── Worksets（查看与管理）
│   └── Enter Workset Workspace（选择并打开）
│
└── Tools（低频，默认折叠）
    ├── CLI
    ├── Settings & Diagnostics
    ├── Cache
    └── Logs

Editor Area
├── Changes Workspace
│   ├── Change list / selected Change overview
│   ├── Complete Artifact Inventory
│   ├── Compact Store association summary
│   └── On-demand Store Quick View
├── Change Detail
├── Spec Detail
├── Reference Browser
├── Store Workspace
├── Worksets Workspace
├── Context & Diagnostics
└── Modal Layer
    ├── Add Operation / Store association
    ├── Add Reference
    ├── Create / Edit Workset
    └── High-risk confirmation
```

### 8.1 Sidebar 设计要求

Sidebar 负责：

- 当前项目定位；
- 高频导航；
- 当前工程规划位置摘要；
- 本机所有已注册 Store 的紧凑列表；
- 当前工程主 Store 的唯一关联状态；
- Worksets 管理入口；
- Workset Workspace 启动入口；
- 轻量健康状态和快速动作。

Sidebar 不负责：

- 展开完整 Store 详情；
- 承载 Store 关联表单；
- 展示完整 Workset 成员编辑器；
- 展示大段 Proposal 正文；
- 将点击 Store 直接解释为“切换当前工程 Store”。

### 8.2 Stores 列表

Sidebar 的 `Stores (Registered locally)` 列出当前主机所有已注册 Store。

每行至少显示：

- Store ID；
- 健康状态；
- `Linked` 标记（仅当前工程关联的 Store）；
- Hover actions：Quick View、Open Store Workspace、More。

列表规则：

1. 当前工程关联的 Store 固定置顶；
2. 其余 Store 按最近访问或名称排序；
3. 列表超过 5 项时默认展示前 5 项并提供 `View all`；
4. 选择 Store 只改变当前选中对象，不改变项目配置；
5. 关联、切换与断开必须通过显式操作和确认完成。

### 8.3 Worksets 入口

Sidebar 同时提供两个入口：

1. `Worksets`：打开 Worksets Workspace，进行查看和管理；
2. `Enter Workset Workspace`：打开 Quick Pick，选择最近或已保存 Workset，并按配置启动 VS Code 工作区。

两个入口不得合并成一个模糊按钮，因为“管理定义”和“进入工作区”是不同任务。

## 9. Changes Workspace

### 9.1 页面定位

Changes Workspace 是工程 Change 生命周期的主工作区，同时承担当前工程与主 Store 的轻量关联入口。

页面必须优先回答：

1. 当前有哪些 Change；
2. 选中 Change 有哪些真实工件；
3. 工件准备度和任务进度如何；
4. 当前工程是否关联主 Store；
5. 如何快速查看或调整 Store 关联。

### 9.2 Header

推荐布局：

```text
Changes
[In progress] [Draft] [Archived] [Merged]

                               [ + New Change ▾ ] [ Add Operation ▾ ]
```

`Add Operation` 是紧凑次级按钮，不设置大型永久操作区。可用操作根据上下文动态变化：

- Link Store；
- Switch linked Store；
- Disconnect Store；
- View linked Store details；
- Add Reference；
- Open / add to Workset；
- Refresh / Validate。

Store 关联类操作统一打开 Modal。

### 9.3 Change 列表与选中态

Change 列表字段：

- Name；
- Summary；
- Updated；
- Task progress；
- Validation state；
- Recommended next action；
- Root badge（仅混合 Root 场景）。

选中 Change 后，在同一工作区展示 Change Overview，而不是要求用户先打开独立页面才能看到工件。

### 9.4 Complete Artifact Inventory

选中 Change 的工件区必须显示 Change 目录中的全部工件。

#### Schema-defined Artifacts

根据当前 Schema 动态读取并按 Schema 顺序展示：

- Artifact type；
- 文件数量；
- Ready / Blocked / Done / Missing / Error；
- 依赖关系；
- 最近更新时间；
- 任务数量或 requirement 数量（适用时）。

Schema 定义了某个工件但文件尚未创建时，仍显示 Placeholder Card，并标记 `Missing` 或 `Ready`。

#### Other Artifacts（Not defined in schema）

Change 目录中存在、但未被当前 Schema 识别或声明的内容，必须单独列出：

```text
Other Artifacts · Not defined in schema
analysis        2 files
notes           4 files
runbook          1 file
```

识别范围至少包括：

- Schema 未声明的 Markdown / YAML / JSON 文件；
- 自定义子目录；
- 历史版本遗留工件；
- 插件未知但真实存在的工件类型。

规则：

1. 不得隐藏、丢弃或自动归类为某个已知 Artifact；
2. 不得因为“未定义”而阻止浏览；
3. Validation 可提示该工件未纳入 Schema，但不应默认视为错误；
4. 用户可以从 More 菜单执行 `Open file`、`Reveal in Explorer`、`Copy path`。

### 9.5 Artifact 点击与文件定位

Artifact Card 的主点击行为是定位真实文件：

- 单文件 Artifact：Reveal in Explorer，并在编辑器打开该文件；
- 多文件 Artifact：Reveal 对应目录并展开，默认选中最近更新文件；
- Missing Artifact：打开创建/继续规划动作，不定位不存在的文件；
- Other Artifact：Reveal 真实文件或目录，不经过 Schema 映射。

必须使用 VS Code 原生 `revealInExplorer` / Tree reveal 能力，避免在 Webview 中维护第二套虚拟文件树。

### 9.6 Store 关联摘要

Changes Workspace 只保留紧凑摘要，不展示大型关联表单。

未关联时：

```text
Store: Not linked        [Link]
```

已关联时：

```text
Store: aihelp-workspace  Healthy  [Quick View] [More]
```

摘要可以位于 Header 下方、右侧窄栏或信息条，但不得挤占 Change 与 Artifact 的主体空间。

### 9.7 Store Quick View

点击 Store 名称或 `Quick View` 后，打开可折叠的右侧 Quick View，而不是操作表单。

Quick View 建议宽度为 280–360 px，展示：

- Store ID；
- Health；
- Local path；
- Canonical remote（如有）；
- Specs count；
- Changes count；
- Last updated / last checked；
- Git branch / clean state（能力允许时）；
- `Open Store Workspace`；
- `Open in Explorer`；
- `Manage association`。

Quick View 关闭后不影响 Change 选中状态。

### 9.8 New Change

主按钮：`New Change`。

辅助文字根据模式变化：

- Local Only：`Creates in this project`；
- Declared Store：`Creates in <store-id>`；
- Machine Default：`Creates in machine default <store-id>`；
- Explicit Override：`Creates in selected Store for this session`。

下拉菜单：

- New Change；
- Propose from prompt；
- Open Chat: Propose；
- Advanced target selection（仅高级模式）。

## 10. Change Detail

### 10.1 页面目标

帮助用户回答：

1. 这个 Change 在哪里？
2. 当前 Schema 定义了哪些工件？
3. Change 目录中还存在什么未定义工件？
4. 规划准备到什么程度？
5. 实施完成到什么程度？
6. 下一步最合理的动作是什么？

### 10.2 Header

字段：

- Change name；
- Writable Root；
- Schema；
- Updated time；
- Health / validation；
- Task progress；
- Linked Store summary（如存在）。

### 10.3 不使用固定生命周期 Stepper

禁止将以下内容设计成不可逆固定阶段：

```text
Proposal → Specs → Design → Tasks → Apply → Verify → Archive
```

原因：

- Artifact 由 Schema 定义；
- 依赖是 enabler，不是 phase gate；
- Apply 中可以继续修订 Artifact；
- Apply、Verify、Sync、Archive 是动作，不是 Artifact。

### 10.4 Plan Readiness

动态读取 Artifact DAG，显示：

- Done；
- Ready；
- Blocked；
- Missing；
- Error。

每个 Artifact Card 包含：

- 名称；
- 文件数量；
- 状态；
- 依赖；
- 最近更新时间；
- Open / Reveal；
- Continue / Update 动作。

### 10.5 Complete Artifact Inventory

Change Detail 与 Changes Workspace 使用同一份 Artifact Inventory 数据源，保证列表和详情一致。

分为：

1. `Schema Artifacts`：由 Schema 声明；
2. `Other Artifacts`：Change 目录真实存在，但 Schema 未声明。

Other Artifacts 必须保留真实目录结构、文件数量与路径。插件未知文件不允许被静默过滤。

### 10.6 Execution Progress

独立区域展示：

- Tasks completed / total；
- Current implementation state；
- Validation status；
- Spec sync state；
- Archive eligibility。

### 10.7 Primary Action

主按钮根据 CLI Next Steps 动态生成，例如：

- Continue planning；
- Fast-forward plan；
- Open Chat: Apply；
- Update plan；
- Verify implementation；
- Sync specs；
- Archive change。

`Update plan` 在实施过程中可继续出现。

### 10.8 Artifact Content View

Artifact Tabs 按当前 Schema 动态生成；`Other` 作为额外分组出现，不硬编码 Proposal / Specs / Design / Tasks。

Markdown 默认 Rendered，支持：

- View source；
- Open file；
- Reveal in Explorer；
- Copy path；
- Jump to requirement / scenario / task；
- Validation marker。

复杂编辑回到 VS Code 原生文本编辑器。

## 11. Add Operation 与 Store 关联 Modal

### 11.1 入口定位

Store 关联操作位于 Changes Workspace 的 `Add Operation` 中。

该入口只负责打开操作选择，不长期占据页面右侧。Modal 使用居中覆盖层，完成后关闭并刷新 Changes Workspace。

### 11.2 Modal 结构

推荐结构：

```text
Add Operation
Manage the current project's Store relationship

( ) Link Store
( ) Switch linked Store
( ) Disconnect Store
( ) View Store details

Registered Stores
[ aihelp-workspace   Linked / Healthy ]
[ platform-specs              Healthy ]
[ sdk-6-1-store               Warning ]

[Cancel] [Confirm]
```

Modal 建议宽度 640–760 px，不使用占满编辑区的全屏页面，也不使用永久右侧大型表单。

### 11.3 关联基数

- 当前主机可注册多个 Store；
- 当前工程最多关联一个主 Store；
- 关联第二个 Store 时必须进入 `Switch`，不能同时保留两个主 Store Pointer；
- References 不受此限制，可以有多个。

### 11.4 Link Store

适用于当前工程没有主 Store Pointer 的情况。

流程：

1. 从本机已注册 Store 中选择；
2. 检查 Store 健康状态；
3. 检查本地规划内容和 Root 冲突；
4. 展示实际影响；
5. 用户确认；
6. 写入 `store: <id>` 或进入迁移流程；
7. 重新解析 Planning Context；
8. 更新 Sidebar `Linked` 标记和 Changes Store 摘要。

### 11.5 Switch linked Store

流程：

1. 显示当前 Store 与目标 Store；
2. 检查未完成 Change、未同步 Specs、Git dirty 和本地 Root 冲突；
3. 显示切换后写入位置；
4. 用户确认；
5. 更新 Store Pointer；
6. 重新加载 Change / Spec 数据。

不得通过点击 Sidebar 中另一个 Store直接切换。

### 11.6 Disconnect Store

断开前必须显示：

- 当前关联 Store；
- 移除后实际 Planning Location；
- 是否会进入 Local Only、Machine Default 或 No Root；
- 是否存在尚未处理的 Store Change。

断开仅移除工程关联，不 Unregister Store，不删除 Store 文件。

### 11.7 View Store details

该操作不修改配置，直接打开 Store Quick View；用户可以进一步进入完整 Store Workspace。

### 11.8 Add Reference 与 Workset

`Add Operation` 可以同时提供：

- Add read-only Reference；
- Add current project / Store to Workset。

但必须使用不同图标与权限说明，避免与主 Store 关联混淆。

## 12. Add Reference 详细流程

### 12.1 方式一：选择本机已注册 Store

表单：

```text
Add read-only reference

Registered Store
[ xxx-workspace ▾ ]

☑ Include canonical remote for teammate onboarding

[Cancel] [Add Reference]
```

写入策略：

- 未勾选 remote：写 Store ID 简写；
- 勾选 remote 且可获得 canonical remote：写对象形式；
- 已存在同 ID 时不重复写入。

### 12.2 方式二：通过 Remote 声明

表单：

```text
Store ID
[ xxx-workspace ]

Git Remote
[ https://xxxxx/yyyyy.git ]

Local checkout
[ ~/openspec/xxx-workspace ]

☑ Clone and register on this machine now
```

#### 勾选 Clone and Register

插件行为：

1. 明确展示将执行的 Git clone；
2. 用户确认；
3. clone 到用户可见路径；
4. 调用 Store register；
5. 写入 `references:`；
6. 重新运行 doctor/context；
7. 展示成功或可恢复错误。

说明：这是插件主动执行 Git，不是 OpenSpec 自带自动同步。

#### 不勾选

插件只写配置：

```yaml
references:
  - { id: xxx-workspace, remote: "https://xxxxx/yyyyy.git" }
```

状态显示：

```text
xxx-workspace · Not available on this machine
[Clone & Register]
```

### 12.3 Reference 权限保护

所有 Reference Spec 必须同时显示：

- Read-only icon；
- Source Store；
- Fetch / open action；
- 禁止 Edit in place；
- 禁止 New Change here；
- 禁止 Archive / Sync 到 Reference。

若用户希望向该 Store 提交修改，应明确执行：

- Open Store as planning location；
- 或创建新的 VS Code 窗口 / session；
- 不在当前 Reference 浏览上下文中静默切换权限。

---

## 13. Use Store as Planning Location 详细流程

### 13.1 无本地规划内容

如果当前项目未初始化，或只有 config-only `openspec/config.yaml`：

1. 选择已注册 Store或创建 Store；
2. 显示影响摘要；
3. 写入 `store: <id>`；
4. 重新解析 Root；
5. 显示 `Declared by project`；
6. New Change 开始写入 Store。

### 13.2 已有本地规划内容

检测内容：

- Specs 数；
- Active Changes 数；
- Archived Changes 数；
- Custom Schemas；
- Config / rules / context；
- Git dirty state。

警告文案：

```text
This project already contains local OpenSpec planning content.
Adding a Store pointer will not move it, and the local root will continue to win.
```

提供动作：

1. `Add Store as Reference instead`；
2. `Review migration`；
3. `Cancel`。

### 13.3 Migration Review

迁移向导至少包含：

1. Source：当前本地 Root；
2. Destination：目标 Store；
3. 冲突检查：同名 Spec / Change；
4. 迁移策略：复制、合并或跳过；
5. Git 状态；
6. Dry-run summary；
7. 备份建议；
8. 最终确认。

MVP 阶段若无法保证安全迁移，只提供说明与手动步骤，不做伪“一键迁移”。

### 13.4 Store Pointer 移除

移除 `store:` 后：

- 如果存在 Local Root，恢复 Local Only；
- 如果无 Local Root，进入 No Root 或 machine default；
- 执行前显示 New Change 后续将写入哪里。

---

## 14. Store 浏览与管理

### 14.1 定位

Store 管理不是默认首页，但 Store 列表必须在 Sidebar 可见。完整 Store Workspace 用于浏览和管理单个 Store，Sidebar 只承担列表与快速入口。

### 14.2 Store Workspace

点击 Sidebar Store 或 Quick View 中的 `Open Store Workspace` 后，在 Editor 打开 Store Workspace。

至少展示：

- Store ID、路径、remote、health；
- Specs；
- Changes；
- Schema / config；
- Git branch / dirty / ahead / behind（能力允许时）；
- 被哪些当前已打开 Project 用作主 Store 或 Reference；
- Open in Explorer；
- Open Source Control；
- Register / Unregister 相关操作。

Store Workspace 的选择态不能自动改变 Current Project 或 Planning Location。

### 14.3 Create / Setup Store

字段：

- Store ID；
- Local Path；
- Canonical Remote；
- Init Git；
- Initial commit。

创建成功后提供：

- Link to current Project；
- Add as Reference；
- Add to Workset；
- Open Store Workspace；
- Done。

不得默认绑定当前项目。

### 14.4 Register Store

- 选择已有本地目录；
- 读取 identity；
- 检查 ID 冲突；
- 检查 config-only pointer repo；
- 注册成功后加入 Sidebar Store 列表；
- 不自动切换当前工程关联。

### 14.5 Unregister / Remove

- Unregister：只移除本机注册，不删除文件；
- Remove：移除注册并删除本地目录。

若 Store 当前与某个已打开工程关联：

- Unregister 前显示依赖警告；
- 不允许在未处理 Store Pointer 时静默删除；
- 提供先断开 / 修复关联的路径。

Remove 必须展示完整路径和高风险确认。

### 14.6 Git 边界

插件可以展示：

- Branch；
- Clean / Dirty；
- Remote；
- Ahead / Behind（若可可靠获取）。

插件不得：

- 自动 pull；
- 自动 push；
- 用“OpenSpec Sync”代指 Git 同步。

Git 动作明确命名为：

- Open Source Control；
- Pull with Git；
- Push with Git。

## 15. Worksets 与 Workset Workspace

### 15.1 定位

Workset 是本机 Launcher 和可复用的多目录工作区定义，不是 Planning Root，也不拥有 Change。

新版 Sidebar 必须提供：

- `Worksets`：查看与管理；
- `Enter Workset Workspace`：选择并启动。

### 15.2 Worksets Workspace

Worksets Workspace 在 Editor 中打开，推荐采用“列表 + 详情”布局。

左/中区域：

- All；
- Recently opened；
- Manage；
- Search；
- Sort；
- Saved Worksets list。

每个 Workset Card 至少显示：

- Name；
- Description；
- Member summary（Project / Store / Reference 数量）；
- Last opened；
- Last updated；
- Health / missing members；
- More menu。

右侧 Detail 至少显示：

- Name / description；
- Open in Workset Workspace；
- Open Workset definition；
- Edit；
- Rename；
- Duplicate；
- Delete；
- Members；
- Workspace preview。

### 15.3 Workset 成员模型

成员类型：

- Project；
- Store；
- Reference / ordinary folder。

每个成员字段：

- Type；
- Display name；
- Local path；
- Required / Optional；
- Availability；
- Order；
- Open behavior。

Workset 可以同时包含多个 Store，但这不表示当前 Project 同时关联多个主 Store。Workset 只是把目录一起打开。

### 15.4 创建与编辑

字段：

- Name；
- Description；
- Members；
- Primary member；
- Required / optional；
- Member order；
- Open in new window / current window；
- Preserve existing workspace folders。

当前 Project 自动作为候选 Member，但不强制。

编辑支持：

- Add folder / Store；
- Remove member；
- Drag reorder；
- Mark required / optional；
- Validate paths；
- Preview final VS Code workspace。

### 15.5 Enter Workset Workspace

点击 Sidebar `Enter Workset Workspace`：

1. 打开 Quick Pick；
2. 显示最近打开和全部 Worksets；
3. 显示缺失成员警告；
4. 选择在新窗口或当前窗口打开；
5. 默认新窗口；
6. 新窗口启动后重新解析 Current Project 与 Planning Context。

不得继承旧窗口临时选择的 Root。

### 15.6 打开策略

- Required 成员缺失：默认阻止打开，并提供 Locate / Remove / Open available members；
- Optional 成员缺失：允许打开并显示 Warning；
- 当前窗口有未保存文件：使用 VS Code 原生确认；
- 打开 Workset 不修改任何项目 `config.yaml`。

### 15.7 删除

删除 Workset 只删除 Workset 定义，不触碰：

- 成员文件夹；
- Store Registry；
- Project Store Pointer；
- References；
- Change / Spec 文件。

## 16. Reference / Store / Workset 关系表达

UI 中统一采用以下颜色和文案组合，但不只依赖颜色：

| 关系 | 图标 | 文案 | 权限 |
|---|---|---|---|
| Local Planning | folder / project | Local · Writable | 可写 |
| Store Planning | database | Store · Writable | 可写 |
| Reference | book / eye | Reference · Read-only | 只读 |
| Workset | layers / folders | Workset · Launcher | 无规划权限 |
| Machine Default | device / fallback | Machine default | 取决于 Store |

不使用“Project belongs to Store”作为主文案，避免形成不存在的所有权关系。

推荐表达：

- Planning in `<store-id>`；
- References `<store-id>`；
- Opened with Workset `<name>`。

---

## 17. 状态与异常

### 17.1 Store Missing

如果 `store:` 指向未注册 Store：

- 阻止写操作；
- 显示 Store ID；
- 显示 remote（若可获得）；
- 提供 Register / Clone & Register / Remove pointer；
- 不静默回退到其他 Store。

### 17.2 Reference Missing

- 当前本地 Change 继续可用；
- 显示 Warning；
- instructions / context 仍可展示缺失提示；
- 提供完整修复命令或插件向导。

### 17.3 Stale Store Pointer

Local Root 优先时提示：

```text
The project declares Store `team-plans`, but local planning content is active.
```

动作：

- Remove pointer；
- Review migration；
- Ignore for now。

### 17.4 Invalid Reference Declaration

定位到 `config.yaml` 具体字段，提供：

- Open file；
- Apply safe fix；
- Copy diagnostic details。

### 17.5 CLI Missing / Unsupported

展示：

- CLI 状态；
- 检测版本；
- 插件当前能力模式；
- 安装 / 升级命令；
- Copy command。

### 17.6 Stale UI Data

- 文件 watcher 局部刷新；
- VS Code 恢复焦点后检查 mtime；
- Last refreshed；
- 手动 Refresh；
- 写操作前强制重新解析。

---

## 18. 版本与能力兼容

Store 相关能力仍属于 Beta，插件不得只按固定 UI 假定长期不变。

启动时建立 Capability Matrix：

```ts
interface OpenSpecCapabilities {
  version: string;
  hasStore: boolean;
  hasReferences: boolean;
  hasContext: boolean;
  hasWorkset: boolean;
  hasUpdatePlan: boolean;
  supportsJsonRootBlock: boolean;
  supportedJsonCommands: string[];
}
```

兼容原则：

1. 能力检测优先于纯版本判断；
2. 忽略未知 JSON 字段；
3. 缺少高级命令时只隐藏对应功能；
4. 不影响 Local Root Change 浏览；
5. 旧版本自动进入 Local Legacy Mode。

### 18.1 Legacy / Local Mode

- 仅显示本地工程；
- 保留旧 Change 生命周期；
- 隐藏 Connect Store；
- 不出现错误占位。

### 18.2 Store-capable Mode

- 启用 Connect Store；
- 启用 Reference Browser；
- 启用 Context / Doctor；
- 启用 Workset Launcher。

---

## 19. CLI 与数据源策略

原则：优先调用 CLI JSON，避免解析彩色文本；但命令和字段必须按运行时能力检测。

可能使用的数据面：

- version；
- list / show / status；
- instructions；
- validate；
- schema list / show；
- store list / setup / register / doctor；
- context；
- workset list / create / open；
- doctor。

写操作安全规则：

1. 执行前重新读取 Project config；
2. 重新解析 active Root；
3. 重新读取 Change 状态；
4. 显示实际目标；
5. 调用 CLI；
6. 读取结果中的 root 信息；
7. 若实际 Root 与预期不一致，停止后续动作并提示。

---

## 20. 关键交互文案

### 20.1 Local Only

```text
Planning locally in this project
Changes and specs are stored in ./openspec.
```

### 20.2 Add Reference

```text
Add Store as read-only context
Your changes will continue to be created locally.
```

### 20.3 Use Store

```text
Use Store as planning location
New changes and specs will be written to team-plans.
```

### 20.4 Workset

```text
Open folders together
This does not change where OpenSpec writes planning content.
```

### 20.5 Migration Guard

```text
Local planning content already exists.
A Store pointer alone will not move it.
```

---

## 21. 视觉与 VS Code 原生体验

1. Sidebar 优先使用原生 Tree View；
2. Changes、Store、Worksets 等复杂详情使用 Editor Webview；
3. Store 关联表单使用居中 Modal，不使用永久大型右侧操作区；
4. Store Quick View 使用可折叠窄侧栏，按需出现；
5. 使用 VS Code Theme Tokens；
6. 使用 Codicons；
7. 支持 Light / Dark / High Contrast；
8. 不仅靠颜色表达状态；
9. Hover actions 不超过 3 个；
10. 支持键盘导航与 Focus Ring；
11. 所有 Form 有明确 Label 与错误说明；
12. 高风险操作显示完整路径和影响范围。

### 21.1 Sidebar 推荐布局

```text
CURRENT PROJECT
aihelp-server-golang
~/projects/aihelp-server-golang
Planning · Local ./openspec · Healthy

PRIMARY
Changes                         1
Specs                          13
References (Read-only)          0

STORES (REGISTERED LOCALLY)
aihelp-workspace       Linked · Healthy
platform-specs                  Healthy
sdk-6-1-store                   Warning
View all Stores

WORKSETS
Worksets
Enter Workset Workspace

TOOLS
CLI                       Available
Settings & Diagnostics
Cache                       9.4 KB
Logs                     No issues
```

### 21.2 Changes Workspace 推荐布局

```text
Changes                          [ + New Change ▾ ] [ Add Operation ▾ ]
[In progress] [Draft] [Archived] [Merged]

Search / Sort / Filter

Selected Change
fix-memory-overuse-and-hangs                 0 / 17 tasks

Schema Artifacts
[proposal] [specs] [design] [tasks] [custom artifact ...]

Other Artifacts · Not defined in schema
[analysis · 2] [notes · 4] [runbook · 1]

Specs summary

Store: aihelp-workspace · Healthy       [Quick View] [More]
```

### 21.3 Add Operation Modal

```text
                 Add Operation
      Manage the current project's Store relationship

[Link Store] [Switch Store] [Disconnect] [View details]

Registered Stores
○ aihelp-workspace     Linked · Healthy
○ platform-specs                Healthy
○ sdk-6-1-store                 Warning

                         [Cancel] [Confirm]
```

Modal 是 Changes Workspace 中点击 `Add Operation` 后出现的覆盖层。

### 21.4 Store Quick View

```text
Store Quick View
aihelp-workspace · Healthy

ID / Path / Remote
Specs 26 · Changes 18
Last checked 2h ago

[Open Store Workspace]
[Open in Explorer]
[Manage association]
```

### 21.5 Worksets Workspace 推荐布局

```text
Worksets                                      [ + New Workset ]
[All] [Recently opened] [Manage]        Search / Sort

Saved Worksets
- sdk-6-1-help-center
- ai-self-serve-builder
- platform-readonly-review

Selected Workset Detail
Name / Description
[Enter Workset Workspace] [Open definition]
[Edit] [Rename] [Duplicate] [Delete]

Members
Project    aihelp-server-golang      Required
Store      aihelp-workspace          Required
Reference  docs/help-center          Optional

Workspace Preview
Project + Store + Reference
```

### 21.6 响应式规则

- Editor 宽度不足 1100 px 时，Store Quick View 覆盖显示或切换为 Tab；
- Artifact Cards 自动换行，不横向溢出；
- Sidebar Store 列表超过可用高度时折叠为 `View all`；
- Workset Detail 在窄屏下切换为独立详情页；
- Modal 在小窗口中保留至少 24 px 安全边距。

## 22. 数据模型建议

```ts
interface ProjectContext {
  name: string;
  path: string;
  configPath?: string;
  localRoot?: LocalRootInfo;
  declaredStoreId?: string; // 0..1 primary Store pointer
  declaredReferences: ReferenceDeclaration[]; // 0..N
  resolved: ResolvedPlanningContext;
}

interface RegisteredStore {
  id: string;
  localPath: string;
  canonicalRemote?: string;
  health: 'healthy' | 'warning' | 'error' | 'unknown';
  isLinkedToCurrentProject: boolean;
  specCount?: number;
  changeCount?: number;
  lastCheckedAt?: string;
  git?: {
    branch?: string;
    dirty?: boolean;
    ahead?: number;
    behind?: number;
  };
}

interface ProjectStoreAssociation {
  projectPath: string;
  storeId?: string; // 0..1
  source?: 'project_pointer' | 'explicit_session' | 'machine_default';
  effective: boolean;
  conflict?: ContextConflict;
}

interface ReferenceDeclaration {
  id: string;
  remote?: string;
  availability: 'available' | 'missing' | 'invalid';
  localPath?: string;
  specCount?: number;
}

interface ArtifactInventory {
  changeId: string;
  schemaId: string;
  defined: ArtifactInventoryItem[];
  other: ArtifactInventoryItem[];
}

interface ArtifactInventoryItem {
  key: string;
  displayName: string;
  source: 'schema' | 'filesystem';
  schemaDefined: boolean;
  status?: 'done' | 'ready' | 'blocked' | 'missing' | 'error' | 'unknown';
  paths: string[];
  fileCount: number;
  dependencies?: string[];
  updatedAt?: string;
}

interface WorksetDefinition {
  id: string;
  name: string;
  description?: string;
  members: WorksetMember[];
  primaryMemberId?: string;
  openMode: 'new_window' | 'current_window';
  lastOpenedAt?: string;
  updatedAt?: string;
}

interface WorksetMember {
  id: string;
  type: 'project' | 'store' | 'reference' | 'folder';
  name: string;
  path: string;
  required: boolean;
  available: boolean;
  order: number;
}

interface StoreOperationIntent {
  type:
    | 'link'
    | 'switch'
    | 'disconnect'
    | 'view_details'
    | 'add_reference'
    | 'add_to_workset';
  currentStoreId?: string;
  targetStoreId?: string;
}
```

避免使用单一 `currentStore` 字段表示 Registry、主 Store Pointer、Reference 和 Workset 成员等不同关系。

## 23. 验收标准

### P0：Local-first 基础体验

- [ ] 无 Store、无 Reference 的普通工程打开后仍保持原始简单 Change 主流程；
- [ ] Local Only 模式下 New Change 一步创建到本地；
- [ ] Current Project 是界面主锚点；
- [ ] 所有写操作能确定实际 Root；
- [ ] Local Root 与旧 Change 生命周期能力不退化；
- [ ] Change Detail 不硬编码固定阶段；
- [ ] Artifact 与执行进度分开展示。

### P0：Store 列表与唯一关联

- [ ] Sidebar 展示当前主机所有已注册 Store；
- [ ] 当前工程关联 Store 置顶并显示 `Linked`；
- [ ] 一个工程不能同时关联两个主 Store；
- [ ] 点击未关联 Store 不会静默切换关联；
- [ ] Link / Switch / Disconnect 均通过显式 Modal；
- [ ] Disconnect 不 Unregister、不删除 Store；
- [ ] 关联后可从 Changes Workspace 打开 Store Quick View；
- [ ] Quick View 可进入完整 Store Workspace。

### P0：完整工件展示

- [ ] 选中 Change 后展示全部 Schema-defined Artifacts；
- [ ] Artifact 顺序和依赖来自当前 Schema；
- [ ] Schema 未定义但真实存在的工件单独列入 Other Artifacts；
- [ ] 未知文件不会被静默隐藏；
- [ ] 单击单文件 Artifact 可 Reveal 并打开；
- [ ] 多文件 Artifact 可 Reveal 并展开目录；
- [ ] Missing Artifact 不尝试定位不存在的文件。

### P0：连接模型正确性

- [ ] `store:`、`references:`、Workset 三种关系在 UI 中明确区分；
- [ ] Reference 不改变写入位置；
- [ ] Workset 不改变写入位置；
- [ ] 支持选择已注册 Store 添加 Reference；
- [ ] 支持以 `{ id, remote }` 形式声明 Reference；
- [ ] Missing Reference 不阻塞本地 Change；
- [ ] Missing writable Store 阻止写操作且提供修复；
- [ ] Local Root + Store Pointer 冲突时显示 Local 为实际 Root。

### P1：Worksets

- [ ] Sidebar 有独立 `Worksets` 管理入口；
- [ ] Sidebar 有独立 `Enter Workset Workspace` 入口；
- [ ] Worksets Workspace 支持搜索、排序、创建、编辑、重命名、复制和删除；
- [ ] Workset Detail 展示成员及 Required / Optional；
- [ ] Workset 可同时包含 Project、Store、Reference / folder；
- [ ] 打开 Workset 默认使用新窗口；
- [ ] 打开后重新解析 Planning Context；
- [ ] 删除 Workset 不触碰成员目录、Store 或项目配置。

### P1：Store 使用与迁移保护

- [ ] 无本地规划内容时可将 Store 设为 Planning Location；
- [ ] 有本地内容时禁止直接伪切换；
- [ ] 提供 Reference 替代建议；
- [ ] 提供 Migration Review；
- [ ] Store 创建成功后不自动绑定当前项目；
- [ ] Unregister 与 Remove 明确区分；
- [ ] 插件不自动 pull / push。

### P1：Reference 体验

- [ ] Reference Specs 全局只读；
- [ ] 所有结果标记来源；
- [ ] 支持 Clone & Register 可选流程；
- [ ] 清楚说明该 Git 操作为插件行为；
- [ ] 支持 Remove declaration；
- [ ] Doctor / Context 状态可视化。

### P2：高级体验

- [ ] Machine Default 首次写入确认；
- [ ] 自定义 Schema Artifact DAG；
- [ ] Validation 定位；
- [ ] Store Git 状态摘要；
- [ ] 高对比度与辅助技术验收；
- [ ] 多 VS Code Workspace Folder 场景。

## 24. 推荐迭代计划

### Milestone 1：Changes Workspace 与 Artifact Inventory

- 抽象 ProjectContext 与 ResolvedPlanningContext；
- 保留旧 Local Root 页面；
- 新增 Changes Workspace Header 和 Add Operation；
- 动态读取 Schema Artifacts；
- 扫描并展示 Other Artifacts；
- Artifact Reveal in Explorer；
- 写操作前 Root 校验。

### Milestone 2：Store Registry、关联 Modal 与 Quick View

- Sidebar Store Registry list；
- 当前工程 0..1 Store association；
- Link / Switch / Disconnect Modal；
- Store Quick View；
- 完整 Store Workspace；
- Conflict detection；
- Migration Review。

### Milestone 3：References

- `references:` 解析；
- Reference Browser；
- Registered Store Selector；
- Remote Declaration；
- Missing Reference 修复；
- 全局只读保护。

### Milestone 4：Worksets

- Sidebar 两个 Workset 入口；
- Worksets Workspace；
- Create / Edit / Rename / Duplicate / Delete；
- Member required / optional；
- Workspace preview；
- Enter Workset Workspace；
- 缺失成员恢复流程。

### Milestone 5：高级体验

- Machine default guard；
- Store Git status；
- Accessibility；
- Responsive / loading / error states；
- Multi-root VS Code Workspace。

## 25. 测试矩阵

至少覆盖：

| 场景 | Local Root | store: | registered stores | references | 预期 |
|---|---:|---:|---:|---:|---|
| 普通旧工程 | 有 | 无 | 0 | 无 | Local Only，Change 主流程不变 |
| 主机多 Store、工程未关联 | 有 | 无 | 3 | 无 | Sidebar 显示 3 个 Store，均不标 Linked |
| 主机多 Store、工程关联一个 | 无真实内容 | A | 3 | 无 | A 置顶并标 Linked，B/C 不可直接切换 |
| 尝试关联第二个主 Store | 无真实内容 | A | 3 | 无 | 进入 Switch，不允许双主 Store |
| 本地 + 共享规格 | 有 | 无 | 2 | 有 | Local + References，主 Store 仍为空 |
| 外置规划 | 无真实内容 | A | 3 | 可有 | Declared Store A |
| 本地与 Pointer 冲突 | 有 | A | 3 | 任意 | Local 生效 + Warning |
| 机器默认 | 无 | 无 | 2 | 无 | Machine Default + 首次写确认 |
| 未初始化 | 无 | 无 | 0 | 无 | Initialize local 为主 CTA |
| Store 未注册 | 无 | A | 0 | 任意 | Error + Register / Clone |
| Reference 未注册 | 有 | 无 | 任意 | 有 | Warning，不阻塞本地 |
| Schema 定义 5 个工件 | 任意 | 任意 | 任意 | 任意 | 5 个 Schema Artifact 全部显示 |
| 目录额外存在 analysis/notes | 任意 | 任意 | 任意 | 任意 | 单列 Other Artifacts，不隐藏 |
| 单文件 Artifact 点击 | 任意 | 任意 | 任意 | 任意 | Reveal in Explorer + Open file |
| 多文件 Artifact 点击 | 任意 | 任意 | 任意 | 任意 | 展开目录并定位 |
| Add Operation | 任意 | 任意 | 3 | 任意 | 居中 Modal，不出现永久大型操作区 |
| Store Quick View | 任意 | A | 3 | 任意 | 按需打开窄侧栏，不修改关联 |
| Workset 管理 | 任意 | 任意 | 任意 | 任意 | Worksets Workspace 完整 CRUD |
| Workset 打开 | 任意 | 任意 | 任意 | 任意 | 不改变 Root，新窗口重新解析 |
| Workset Required 成员缺失 | 任意 | 任意 | 任意 | 任意 | 阻止或提供修复选择 |
| Workset Optional 成员缺失 | 任意 | 任意 | 任意 | 任意 | Warning 后允许打开 |

## 26. 风险与开放问题

### 26.1 Beta API 变化

Store / Workset 仍可能调整命令名、字段和配置格式。必须通过 capability adapter 隔离。

### 26.2 迁移复杂度

Local → Store 不只是写配置，可能涉及 Spec / Change 冲突、历史、Git 和团队协作。MVP 不应承诺无损自动迁移。

### 26.3 多根目录 VS Code Workspace

一个窗口可能打开多个代码目录，每个目录都有自己的 OpenSpec Context。后续需要提供 Current Project Selector，不能仅绑定第一个 Workspace Folder。

### 26.4 Reference 内容发现

Reference 当前核心价值是 AI instructions 中的索引。插件浏览体验应尊重 CLI 提供的数据，不自行复制或缓存成第二份 source of truth。

### 26.5 权限错觉

用户可能在 Reference Detail 中产生“既然能打开就能编辑”的错觉。只读标记与操作限制必须贯穿列表、详情、搜索和命令入口。

### 26.6 未定义工件识别

Change 目录中的辅助文件、历史文件和自定义目录可能无法稳定映射为“工件类型”。实现需要保留路径事实，并允许 Schema Adapter 提供识别器；无法识别时归入 Other Artifacts，而不是猜测。

### 26.7 Store 关联与 Reference 混淆

同一个 Store 可能既被本机注册，又被某个工程用作主 Store，或被另一个工程作为 Reference。数据层和 UI 文案必须分别建模，不能用单一 `connected` 布尔值。

### 26.8 Workset 与 VS Code Workspace 边界

Workset 最终如何映射到 `.code-workspace`、multi-root window 或 OpenSpec 自身的定义，需要以实际 CLI 能力为准。插件不得在 CLI 不支持时伪造可共享语义。

---

## 27. 最终产品判断

新版插件的正确升级路径不是：

> 从 Change Viewer 升级为 Store Dashboard。

而是：

> **保留本地 Change Studio 的简单性，同时让已注册 Store、完整工件与 Workset 在正确位置可见；只有关联、迁移和写入动作才进入显式操作流程。**

默认用户看到的仍然是自己熟悉的 Project、Changes 与 Specs；高级用户则能够清晰、安全地回答：

- 当前 Change 写在哪里；
- 这个 Project 是否声明了 Store；
- 哪些 Store 只是只读 Reference；
- Workset 只负责打开哪些目录；
- 将本地规划迁移到 Store 会影响什么。

---

## 28. 高保真视觉稿对应关系

本 PRD 对应三张独立视觉稿：

1. [Changes Workspace](./OpenSpec_UI_v4_ChangesWorkspace.png)：包含全部 Artifact、Other Artifacts、Sidebar Store Registry、Workset 入口和 Store Quick View；
2. [Add Operation Modal](./OpenSpec_UI_v4_AddOperationModal.png)：从 Changes Workspace 的 `Add Operation` 打开，用于 Link / Switch / Disconnect / View Store；
3. [Worksets Workspace](./OpenSpec_UI_v4_WorksetsWorkspace.png)：用于 Workset 列表、详情、成员管理和进入工作区。

视觉稿仅表达布局和交互层级，最终组件应使用 VS Code Theme Tokens、Codicons 和原生焦点行为。

## 29. 依据的 OpenSpec 官方文档

本 PRD 的产品模型以 OpenSpec 官方仓库当前文档为依据，重点参考：

- `docs/stores-beta/user-guide.md`
- `docs/glossary.md`
- `docs/cli.md`
- `docs/concepts.md`

实现阶段应以项目实际安装的 CLI 输出与能力检测结果为最终真相，避免仅依赖本文档中记录的 Beta 接口形态。
