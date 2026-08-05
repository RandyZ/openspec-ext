# OpenSpec Studio for VS Code：Local-first UI/UX PRD

- 文档版本：v1.0
- 修订日期：2026-08-05
- 产品形态：VS Code Extension（Activity Bar / Primary Sidebar / Editor Webview / Quick Pick）
- 适配范围：兼容传统本地 OpenSpec 工程，并渐进支持 Store、Reference、Working Context、Workset 与 OPSX 工作流
- 文档状态：Ready for Design & Engineering Review
- 核心原则：**本地优先、项目为锚点、按需连接、写入位置明确、旧行为零退化**

---

## 0. 本次修订摘要

本版本修正上一版 PRD 过度以 Store / Planning Root 为中心的问题。

核心变化如下：

1. **Project 恢复为界面主对象**。Planning Context 是由当前 Project 的本地目录、配置声明、机器注册信息和显式选择推导出的状态，不是用户必须先理解的顶层产品对象。
2. **Local Only 是默认且最简单的模式**。工程未声明 Store、未配置 Reference 时，插件保持传统 OpenSpec 使用方式，不暴露无关的 Store 与 Workset 复杂度。
3. **Store 是可选增强能力，不是前置条件**。用户可以把 Store 用作可写规划位置，也可以只将其作为只读 Reference，或仅通过 Workset 与代码工程一起打开。
4. **新增统一入口 `Connect Store…`**，但入口内必须明确分流三种不同意图：
   - Use as Planning Location；
   - Add as Read-only Reference；
   - Open Together as Workset。
5. **支持两种 Reference 声明方式**：

   ```yaml
   references:
     - xxx-workspace
   ```

   ```yaml
   references:
     - { id: xxx-workspace, remote: "https://xxxxx/yyyyy.git" }
   ```

6. **本地已有规划内容时禁止直接切换到 Store**。必须进入迁移检查与确认流程，避免仅写入 `store:` 后产生“看似切换、实际仍使用本地 Root”的错误状态。
7. **Change 生命周期能力继续作为产品核心**。Store、Reference、Workset 都采用渐进披露，不能挤压用户创建、规划、实施、验证和归档 Change 的主路径。

---

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

独立的规划仓库，具有自己的 `openspec/specs`、`openspec/changes` 与 Store identity。

Store 可以扮演两种完全不同的角色：

1. **Writable Planning Location**：当前 Project 的 Change 与 Specs 写入该 Store；
2. **Read-only Reference Source**：当前 Project 只读取该 Store 的 Specs。

产品中不得将两者混为“已连接 Store”。

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
- 不显示 Stores Dashboard；
- Worksets 默认隐藏或折叠；
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
│   └── References（仅存在时显示）
│
├── Connection
│   └── Connect Store…
│
└── Tools（低频，默认折叠）
    ├── CLI
    ├── Settings & Diagnostics
    ├── Cache
    ├── Logs
    └── Worksets

Editor Area
├── Changes Overview
├── Change Detail
├── Spec Detail
├── Reference Browser
├── Connect Store Drawer / Wizard
├── Context & Diagnostics
└── Store / Workset Management（低频）
```

### 8.1 Sidebar 设计要求

Sidebar 负责：

- 当前项目定位；
- 高频导航；
- 轻量状态；
- 快速动作。

Sidebar 不应长期展示：

- 所有注册 Store；
- Workset 详细列表；
- Cache 文件数；
- 完整 Diagnostics；
- 大段 Proposal 正文。

这些内容放到 Editor 或 Quick Pick。

---

## 9. 首页：Changes Overview

### 9.1 Local Only 首页

标题区：

```text
Changes                         [ + New Change ▾ ]
Local planning · ./openspec     Healthy
```

主内容：

- In progress；
- Draft；
- Completed；
- Archived；
- Specs summary；
- Reference summary（仅存在时）。

不显示：

- Store 卡片；
- Workset 卡片；
- Planning Root 管理大面板。

### 9.2 New Change

主按钮：`New Change`

辅助文字根据模式变化：

- Local Only：`Creates in this project`；
- Declared Store：`Creates in team-plans`；
- Machine Default：`Creates in machine default team-plans`；
- Explicit Override：`Creates in selected Store for this session`。

下拉菜单：

- New Change；
- Propose from prompt；
- Open Chat: Propose；
- Advanced target selection（仅高级模式）。

### 9.3 Change 列表字段

- Name；
- Summary；
- Artifact readiness；
- Task progress；
- Updated；
- Recommended next action；
- Root badge（仅当页面可能混合展示多个 Root 时）。

---

## 10. Change Detail

### 10.1 页面目标

帮助用户回答：

1. 这个 Change 在哪里？
2. 规划准备到什么程度？
3. 实施完成到什么程度？
4. 下一步最合理的动作是什么？
5. 哪些内容需要修改或验证？

### 10.2 Header

字段：

- Change name；
- Writable Root；
- Schema；
- Updated time；
- Health / validation；
- Task progress。

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
- 状态；
- 依赖；
- 最近更新时间；
- Open file；
- Continue / Update 动作。

### 10.5 Execution Progress

独立区域展示：

- Tasks completed / total；
- Current implementation state；
- Validation status；
- Spec sync state；
- Archive eligibility。

### 10.6 Primary Action

主按钮根据 CLI Next Steps 动态生成，例如：

- Continue planning；
- Fast-forward plan；
- Open Chat: Apply；
- Update plan；
- Verify implementation；
- Sync specs；
- Archive change。

`Update plan` 在实施过程中可继续出现。

### 10.7 Artifact Tabs

Tabs 按当前 Schema 动态生成，不硬编码四项。

Markdown 默认 Rendered，支持：

- View source；
- Open file；
- Copy path；
- Jump to requirement / scenario / task；
- Validation marker。

复杂编辑回到 VS Code 原生文本编辑器。

---

## 11. `Connect Store…` 统一入口

### 11.1 入口定位

在 Local Only 模式中，这是一个次级操作：

```text
Connect Store…
```

点击后必须首先选择“为什么连接”，不得直接进入 Store 注册表单。

### 11.2 三种连接意图

#### A. Use as Planning Location

说明：

> Store becomes the writable location for this project's changes and specs.

配置结果：

```yaml
store: xxx-workspace
```

前置检查：

- Store 是否已注册；
- Store 是否健康；
- 当前工程是否存在本地规划内容；
- 是否只是 config-only 项目；
- 当前是否存在未归档 Change。

#### B. Add as Read-only Reference

说明：

> Keep this project's planning local and use Store specs as read-only context.

配置结果：

```yaml
references:
  - xxx-workspace
```

或：

```yaml
references:
  - id: xxx-workspace
    remote: "https://xxxxx/yyyyy.git"
```

#### C. Open Together as Workset

说明：

> Open the current project and selected Store folders together. Planning configuration is unchanged.

结果：

- 创建或更新本机 Workset；
- 不修改项目 `config.yaml`；
- 不改变写入 Root；
- 默认在新窗口打开。

---

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

## 14. Store 管理

Store 管理是低频能力，应进入 `Settings & Diagnostics` 或单独页面，而不是占据默认首页。

### 14.1 Create / Setup Store

字段：

- Store ID；
- Local Path；
- Canonical Remote；
- Init Git；
- Initial commit。

创建成功后提供：

- Use as Planning Location；
- Add as Reference；
- Add to Workset；
- Done。

不得默认绑定当前项目。

### 14.2 Register Store

- 选择已有本地目录；
- 读取 identity；
- 检查 ID 冲突；
- 检查 config-only pointer repo；
- 注册成功后不自动切换当前 Root。

### 14.3 Unregister / Remove

- Unregister：只移除本机注册，不删除文件；
- Remove：移除注册并删除本地目录。

Remove 必须展示完整路径和高风险确认。

### 14.4 Git 边界

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

---

## 15. Workset

### 15.1 定位

Workset 是 Launcher，而不是 Planning 模型。

默认放在 Tools 下方折叠，或者作为 `Connect Store…` 第三分支出现。

### 15.2 创建

字段：

- Name；
- Members；
- Primary member；
- Opener；
- Open in new window / current window。

当前 Project 自动作为候选 Member，但不强制。

### 15.3 打开行为

默认：Open in new window。

新窗口启动后重新解析自己的 Current Project 和 Planning Context，不能继承旧窗口临时选择的 Root。

### 15.4 删除

只删除 Workset 定义，不触碰成员文件夹和任何 Store 注册。

---

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
2. 复杂详情使用 Editor Webview；
3. 使用 VS Code Theme Tokens；
4. 使用 Codicons；
5. 支持 Light / Dark / High Contrast；
6. 不仅靠颜色表达状态；
7. Hover actions 不超过 3 个；
8. 支持键盘导航与 Focus Ring；
9. 所有 Form 有明确 Label 与错误说明；
10. 高风险操作显示完整路径和影响范围。

### 21.1 推荐高保真布局

Sidebar：

```text
CURRENT PROJECT
aihelp-server-golang
~/projects/aihelp-server-golang
Planning · Local ./openspec · Healthy

PRIMARY
Changes                      1
Specs                       13
References (Read-only)       0

CONNECTION
Connect Store…

TOOLS
CLI                    Available
Settings & Diagnostics
Cache                    9.4 KB
Logs                  No issues
```

Editor：

```text
Changes                                      + New Change
Local planning · ./openspec · Healthy

[In Progress] [Draft] [Completed] [Archived]

Change cards / table

Specs summary

References empty state
```

右侧连接 Drawer：

```text
Connect Store

How would you like to use it?

[Use as Planning Location]
[Add as Read-only Reference]
[Open Together as Workset]

根据选择展示 registered store / remote / YAML 三种方式。
```

---

## 22. 数据模型建议

```ts
interface ProjectContext {
  name: string;
  path: string;
  configPath?: string;
  localRoot?: LocalRootInfo;
  declaredStoreId?: string;
  declaredReferences: ReferenceDeclaration[];
  resolved: ResolvedPlanningContext;
}

interface ReferenceDeclaration {
  id: string;
  remote?: string;
  availability: 'available' | 'missing' | 'invalid';
  localPath?: string;
  specCount?: number;
}

interface StoreConnectionIntent {
  type: 'planning_location' | 'reference' | 'workset';
  storeId?: string;
  remote?: string;
  localPath?: string;
}
```

避免使用单一 `currentStore` 字段表示全部关系。

---

## 23. 验收标准

### P0：Local-first 基础体验

- [ ] 无 Store、无 Reference 的普通工程打开后仍保持原始简单界面；
- [ ] Local Only 模式下 New Change 一步创建到本地；
- [ ] Store / Workset 不占据默认首页主空间；
- [ ] Current Project 是界面主锚点；
- [ ] 所有写操作能确定实际 Root；
- [ ] Local Root 与旧 Change 生命周期能力不退化；
- [ ] Change Detail 不硬编码固定阶段；
- [ ] Artifact 与执行进度分开展示。

### P0：连接模型正确性

- [ ] `store:`、`references:`、Workset 三种关系在 UI 中明确区分；
- [ ] Reference 不改变写入位置；
- [ ] Workset 不改变写入位置；
- [ ] 支持选择已注册 Store 添加 Reference；
- [ ] 支持以 `{ id, remote }` 形式声明 Reference；
- [ ] Missing Reference 不阻塞本地 Change；
- [ ] Missing writable Store 阻止写操作且提供修复；
- [ ] Local Root + Store Pointer 冲突时显示 Local 为实际 Root。

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

- [ ] Workset Launcher；
- [ ] Machine Default 首次写入确认；
- [ ] 自定义 Schema Artifact DAG；
- [ ] Validation 定位；
- [ ] Store Git 状态摘要；
- [ ] 高对比度与辅助技术验收；
- [ ] 多 VS Code Workspace Folder 场景。

---

## 24. 推荐迭代计划

### Milestone 1：Local-first 模型重构

- 抽象 ProjectContext 与 ResolvedPlanningContext；
- 保留旧 Local Root 页面；
- 移除默认 Store Dashboard；
- 写操作前 Root 校验；
- 动态 Artifact 状态。

### Milestone 2：References

- `references:` 解析；
- Reference Browser；
- Registered Store Selector；
- Remote Declaration；
- Missing Reference 修复；
- 全局只读保护。

### Milestone 3：Store Planning Location

- Connect Store 三分流；
- Store setup / register；
- config-only pointer 支持；
- Conflict detection；
- Migration Review。

### Milestone 4：Workset 与高级体验

- Workset Launcher；
- Machine default guard；
- Store Git status；
- Accessibility；
- Responsive / loading / error states。

---

## 25. 测试矩阵

至少覆盖：

| 场景 | Local Root | store: | references | defaultStore | 预期 |
|---|---:|---:|---:|---:|---|
| 普通旧工程 | 有 | 无 | 无 | 任意 | Local Only |
| 本地 + 共享规格 | 有 | 无 | 有 | 任意 | Local + References |
| 外置规划 | 无真实内容 | 有 | 可有 | 任意 | Declared Store |
| 本地与 Pointer 冲突 | 有 | 有 | 任意 | 任意 | Local 生效 + Warning |
| 机器默认 | 无 | 无 | 无 | 有 | Machine Default + 首次写确认 |
| 未初始化 | 无 | 无 | 无 | 无 | Initialize local 为主 CTA |
| Store 未注册 | 无 | 有 | 任意 | 任意 | Error + Register / Clone |
| Reference 未注册 | 有 | 无 | 有 | 任意 | Warning，不阻塞本地 |
| Workset 打开 | 任意 | 任意 | 任意 | 任意 | 不改变 Root |

---

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

---

## 27. 最终产品判断

新版插件的正确升级路径不是：

> 从 Change Viewer 升级为 Store Dashboard。

而是：

> **保留本地 Change Studio 的简单性，在用户真正需要时，再逐步加入 Store 规划、只读 Reference 和 Workset 启动能力。**

默认用户看到的仍然是自己熟悉的 Project、Changes 与 Specs；高级用户则能够清晰、安全地回答：

- 当前 Change 写在哪里；
- 这个 Project 是否声明了 Store；
- 哪些 Store 只是只读 Reference；
- Workset 只负责打开哪些目录；
- 将本地规划迁移到 Store 会影响什么。

---

## 28. 依据的 OpenSpec 官方文档

本 PRD 的产品模型以 OpenSpec 官方仓库当前文档为依据，重点参考：

- `docs/stores-beta/user-guide.md`
- `docs/glossary.md`
- `docs/cli.md`
- `docs/concepts.md`

实现阶段应以项目实际安装的 CLI 输出与能力检测结果为最终真相，避免仅依赖本文档中记录的 Beta 接口形态。
