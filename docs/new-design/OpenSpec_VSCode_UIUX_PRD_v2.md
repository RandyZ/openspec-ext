# OpenSpec Studio for VS Code：Context-first UI/UX PRD

- 文档版本：v0.9
- 产品形态：VS Code Extension（Primary Sidebar + Editor Webview）
- 目标版本：兼容 OpenSpec `<1.5`，重点支持 `1.5+ / 1.6+` 的 Store、Reference、Working Context、Workset 与 OPSX 工作流
- 设计状态：Proposal
- 核心原则：**先明确写入上下文，再管理 Change 生命周期**

---

## 1. 背景

现有插件围绕单仓库、单 `openspec/` 根目录构建，核心任务是：

1. 浏览 Change；
2. 查看 Proposal、Specs、Design、Tasks；
3. 推进 Apply、Verify、Archive；
4. 展示任务完成度。

OpenSpec 新版本把“规划内容存放在哪里”“规划依赖哪些外部规格”“哪些目录需要一起打开”拆成了不同概念：

- **Project / Code Repo**：当前代码工程；
- **Planning Root**：本次 OpenSpec 命令最终写入的唯一根目录；
- **Local Root**：代码仓库内的 `openspec/`；
- **Store**：独立于代码仓库的规划 Git 仓库；
- **Reference**：只读的 Store 规格上下文；
- **Working Context**：当前 Planning Root 与 References 组成的动态上下文；
- **Workset**：个人本地保存的多目录打开方式；
- **Change**：某个 Planning Root 中处于运动状态的修改；
- **Spec**：描述系统当前真实行为的 source of truth。

如果继续沿用旧版“当前项目 = 当前 OpenSpec 根目录”“Proposal → Specs → Design → Tasks → Apply → Verify → Archive 是固定线性阶段”的界面，会产生三个根本问题：

1. 用户无法确定 New Change 最终写到本地仓库还是 Store；
2. Workset、Reference、Store 被误认为同一级的可写工作容器；
3. 固定 Stepper 与 OpenSpec 的 schema-driven、fluid workflow 冲突。

---

## 2. 产品目标

### 2.1 核心目标

1. 用户在 3 秒内识别：**当前代码工程、当前可写 Planning Root、引用上下文、健康状态**。
2. 所有写操作都明确显示目标 Root，杜绝 Change 写错位置。
3. 保留并优化既有 Change 生命周期能力，不因 Store / Workset 引入而退化。
4. Change 页面由 CLI 返回的 Schema、Artifact 依赖与 Next Step 动态驱动，不硬编码默认四类 Artifact。
5. Store、Reference、Workset 使用渐进披露，不挤占高频 Change 操作。
6. 在 OpenSpec `<1.5` 时自动退化为旧版单 Local Root 模式。

### 2.2 非目标

1. 不替代 Git，不自动 push/pull Store。
2. 不把 Workset 变成项目管理、任务分组或共享状态。
3. 不复制 Reference 的 Spec 内容到当前项目。
4. 不在插件内重新实现 OpenSpec 解析、校验或生命周期规则。
5. 不把 Webview 做成与 VS Code 完全割裂的独立后台系统。

---

## 3. 关键产品判断

### 3.1 顶层对象不是 Project，而是 Planning Context

当前 VS Code 文件夹只是用户所在的代码环境；真正决定 Change 与 Spec 从哪里读取、写到哪里的是 resolved Planning Root。

因此插件首屏必须同时展示：

- Current Project；
- Writable Planning Root；
- Root 来源：Local / Declared Store / Global Default / Explicit Selection；
- Read-only References；
- Health。

### 3.2 Store 与 Local Root 是“写入位置”的两种形态

它们应出现在同一个 Root Switcher 中，而不是分别成为两个顶级模块。

### 3.3 Reference 是上下文，不是工作区

Reference 只增强 AI Instructions 和上下文索引，不改变命令写入位置。UI 必须始终使用只读图标与“Reference”语义，禁止提供 New Change、Edit Spec 等写操作。

### 3.4 Workset 是 Launcher，不是 Planning Root

Workset 只记录“我喜欢一起打开哪些文件夹”，是个人本地视图。它不拥有 Change、Spec 或生命周期，也不应改变当前 Root。

### 3.5 Artifact 是依赖图，不是固定阶段条

默认 Schema 可能包含 Proposal、Specs、Design、Tasks，但自定义 Schema 可以增删 Artifact、改变依赖。Artifact 应展示为：

- Done；
- Ready；
- Blocked；
- Missing；
- Error。

Apply / Update / Verify / Sync / Archive 是上下文动作，不应与 Artifact 混成同一条固定 Stepper。

---

## 4. 用户角色与核心场景

### 4.1 单仓库开发者

- 当前代码仓库内有 Local Root；
- 高频操作是创建 Change、查看 Artifact、Apply、Archive；
- 不希望 Store / Workset 增加认知成本。

### 4.2 多仓库功能负责人

- 一个功能同时涉及 API、Web、SDK；
- 使用 Store 保存统一 Proposal 与 Specs；
- 需要快速确认当前写入 Store，并打开相关代码仓库。

### 4.3 平台规格维护者

- 平台规格由独立 Store 管理；
- 业务仓库通过 Reference 消费；
- 需要检查 Reference 是否可用，但不能误改平台规格。

### 4.4 OpenSpec 高级用户

- 使用自定义 Schema；
- Artifact 不一定是默认四件套；
- 希望插件严格跟随 `status --json` 和 `instructions --json`。

---

## 5. 信息架构

```text
OpenSpec View Container
├── Planning Context
│   ├── Current Project
│   ├── Writable Root Switcher
│   ├── References Summary
│   └── Health / Refresh / Manage Context
│
├── Changes
│   ├── In Progress
│   ├── Draft / Planning
│   ├── Completed
│   └── Archived
│
├── Specs
│   └── Capability Tree
│
└── Worksets（默认折叠）
    ├── Saved Worksets
    └── Manage / Open

Editor Area
├── Root Overview
├── Change Detail
├── Spec Detail
└── Context & Diagnostics
```

### 5.1 Sidebar 职责

Sidebar 负责“定位与切换”：

- 当前上下文；
- Change / Spec 导航；
- 快速动作；
- Workset 启动。

Sidebar 不承载大段 Proposal 正文和复杂设置表单。

### 5.2 Editor Webview 职责

Editor 负责“理解与操作”：

- Root Dashboard；
- Change 详情；
- Markdown Artifact；
- 校验与健康详情；
- 高风险操作确认。

---

## 6. 全局布局设计

### 6.1 Planning Context Header

固定在 Sidebar 顶部，包含：

- Project：`aihelp-server-golang`；
- Active Root：`aihelp-workspace`；
- Root 类型：`Store · Writable`；
- Root 来源：`Declared by project`；
- 状态：Healthy / Warning / Error；
- References：`1 available`；
- 操作：Refresh、Doctor、More。

#### Root Switcher 选项

1. Local Root；
2. 已注册 Store；
3. “Register existing Store…”；
4. “Create Store…”；
5. “Manage Context…”；
6. “Set current selection for project”；
7. “Use only for this view”。

切换 Root 默认只改变插件当前浏览与命令目标，不立即修改 `openspec/config.yaml`。持久化必须通过明确动作完成。

### 6.2 New Change CTA

禁止只显示模糊的 `New Change`。

推荐：

- 主按钮：`New Change`；
- Tooltip / 副文案：`Create in aihelp-workspace`；
- 当 Root 来源存在歧义或不健康时，点击后先出现目标确认 Quick Pick。

### 6.3 全局 Context Bar

Editor 页面顶部始终显示：

```text
OpenSpec / aihelp-workspace   [Store · Writable] [1 Reference] [Healthy]
```

用户切换到 Change Detail 后仍保留 Root 语义，防止“只记得 Change 名，不知道它属于哪个 Root”。

---

## 7. Root Overview 页面

### 7.1 顶部

- Root 名称；
- Store / Local Root 类型；
- Project 关联方式；
- Health；
- `New Change`；
- `Manage Context`。

### 7.2 Tabs

1. Overview；
2. Changes；
3. Specs；
4. Context。

### 7.3 Overview 内容

#### Changes 区域

表格字段：

- Change；
- Workflow / Schema；
- Plan Readiness；
- Tasks；
- Updated；
- Next Action。

推荐状态：

- Planning；
- Ready to Apply；
- Implementing；
- Ready to Verify；
- Ready to Sync；
- Ready to Archive；
- Blocked；
- Archived。

这些状态由 CLI Status 与 Next Steps 推导，不写死为某个固定阶段编号。

#### Specs 区域

- Capability 名称；
- Requirement 数；
- 来源：Current Root / Reference；
- 只读 Reference 使用不同图标并展示 Store 名。

#### Context Health 卡片

只展示摘要：

- Writable Root；
- References 可用数；
- 未解决警告；
- Last refreshed；
- `Open diagnostics`。

不在首页永久展开 CLI、Cache、Store Registry 等低频技术信息。

---

## 8. Change Detail 页面

### 8.1 Header

- Change 名称；
- Root；
- Schema；
- 当前执行状态；
- Task Progress；
- Last updated。

### 8.2 Action Bar

Primary CTA 必须动态来源于 Next Steps：

- Continue planning；
- Fast-forward plan；
- Open Chat: Apply；
- Update plan；
- Verify；
- Sync specs；
- Archive。

Secondary Actions：

- Validate；
- Open folder；
- Open artifact files；
- Copy command；
- More。

`Update plan` 在 Artifact 已存在后始终可见，因为规划可能在 Apply 中途修订。

### 8.3 Plan Readiness

使用 Artifact Card / Dependency List，而不是固定 Stepper。

每个 Artifact 显示：

- 名称；
- 状态：Done / Ready / Blocked；
- 依赖；
- 更新时间；
- 点击打开对应 Tab / 文件。

在卡片区注明：

> Planning artifacts remain editable throughout implementation.

### 8.4 Execution Progress

单独展示：

- Task 完成数；
- 当前建议动作；
- Validation 状态；
- Sync 状态；
- Archive eligibility。

Artifact 完成与代码实施完成必须分离，避免“4 个文件都绿了 = Change 已完成”的误解。

### 8.5 Artifact Tabs

Tabs 根据当前 Schema 动态生成。

默认可能为：

- Proposal；
- Specs；
- Design；
- Tasks。

自定义 Schema 则按 `status --json` 的顺序渲染。

### 8.6 Markdown View

- 默认 Rendered；
- 可切换 Source；
- 支持 Open File；
- Requirement、Scenario、Task Checkbox 提供稳定锚点；
- 不在 Webview 内直接实现复杂 Markdown 编辑器，编辑回到 VS Code 原生文本编辑器。

---

## 9. Store 交互

### 9.1 Create Store

流程：

1. Store ID；
2. Local Path；
3. Optional Remote；
4. Init Git 开关；
5. 创建结果与 Next Steps。

创建完成后不自动设为当前项目 Store，提供：

- `Use now`；
- `Set for this project`；
- `Done`。

### 9.2 Register Store

- 选择本地目录；
- 读取 identity；
- 若 ID 冲突，展示现有路径与解决方案；
- 注册成功后可选择临时切换或持久化到项目。

### 9.3 Unregister 与 Remove

必须区分：

- Unregister：仅移除本机注册，不删除文件；
- Remove：删除注册且删除本地文件夹，高风险二次确认。

Remove 确认中展示完整路径，不使用仅靠颜色表达危险。

### 9.4 Git 语义

插件可展示：

- Branch；
- Clean / Dirty；
- Ahead / Behind（若可获取）。

但不使用 `Sync` 描述 Store Git 操作，避免与 OpenSpec Spec Sync 混淆。按钮使用 `Open Source Control`、`Pull with Git` 等明确文案。

---

## 10. Reference 交互

Reference 列表字段：

- Store ID；
- Availability；
- Local Path；
- Remote；
- Spec Count；
- Last indexed。

动作：

- Browse specs；
- Open folder；
- Copy fix command；
- Remove declaration；
- Clone & register（可选增强，必须明确由插件执行 Git）。

Reference 的 Spec 在所有列表中显示：

- `Read-only`；
- 来源 Store；
- 禁止直接修改与创建 Change。

---

## 11. Workset 交互

### 11.1 定位

Workset 放在 Sidebar 底部并默认折叠，定位为：

> Reopen related folders together.

不得与 Store 放在同一张“数据管理”卡片中。

### 11.2 列表

每个 Workset 显示：

- 名称；
- Member 数；
- Opener：VS Code / Cursor / Other；
- Primary Member；
- Open 按钮。

### 11.3 Open 行为

默认在新窗口打开，避免悄悄替换当前 VS Code Workspace。

操作前提示：

- `Open in new window`；
- `Replace current window`。

打开 Workset 不得自动切换当前 Planning Root；新窗口启动后由该窗口重新执行 Root Resolution。

### 11.4 Manage Worksets

使用 Quick Pick 或独立轻量页面完成：

- Create；
- Rename；
- Reorder members；
- Change primary；
- Change opener；
- Delete。

删除 Workset 不触碰成员文件夹。

---

## 12. Root Resolution 与 UI 规则

Root 解析优先级：

1. 本次显式选择 / CLI `--store`；
2. 当前目录存在真实 Local Root；
3. Project 配置中的 Store Pointer；
4. Global Default Store；
5. No Root。

UI 必须展示 Root Source：

- Explicit；
- Local；
- Declared；
- Global Default。

特殊规则：

- Local Root 与 `store:` pointer 同时存在时，Local Root 生效并显示 Warning；
- 未注册 Store 不静默回退到其他 Root；
- Reference 不参与写 Root 解析；
- Workset 不参与写 Root 解析。

---

## 13. 状态与异常设计

### 13.1 No Root

空状态：

- `Initialize Local Root`；
- `Use Registered Store`；
- `Create Store`；
- `Learn how planning roots work`。

### 13.2 CLI Missing / Unsupported

展示：

- 检测到的 CLI 状态；
- 当前版本；
- 插件可用模式；
- 安装 / 升级命令；
- Copy command。

### 13.3 Store Missing

- 显示 Store ID；
- Remote（若已声明）；
- `Clone & register` 或 Copy fix command；
- 禁止创建 Change。

### 13.4 Reference Missing

降级为 Warning，不阻塞当前 Root 的 Change 浏览与创建。

### 13.5 Validation Error

Change Header 展示 Error Badge；点击进入 Diagnostics，定位到具体 Artifact 与行号。

### 13.6 Stale Data

- 文件监听触发局部刷新；
- 失焦后恢复时检查 mtime；
- 显示 Last refreshed；
- 手动 Refresh 始终可用。

---

## 14. 版本兼容策略

### 14.1 Legacy Mode：OpenSpec `<1.5`

- 仅支持 Local Root；
- 隐藏 Store、Reference、Workset；
- 保留既有 Change 生命周期；
- 在 About / Diagnostics 显示 Legacy Mode。

### 14.2 Store Mode：`1.5+`

- 启用 Store Registry 与 Root Switcher；
- Beta 标签；
- 失败时不影响 Local Root 浏览。

### 14.3 Update-aware Mode：`1.6+`

- 启用 `Update plan`；
- 支持 fresh Store；
- 使用增强的 validation / archive error handling。

### 14.4 能力检测优先于纯 SemVer

启动时建立 Capability Matrix：

- CLI Version；
- Command availability；
- JSON fields；
- Schema support；
- Store / Workset support。

插件应忽略未知字段，缺失字段使用兼容默认值。

---

## 15. CLI 数据源与技术约束

原则：**CLI 是唯一业务真相，插件只做呈现、编排和安全确认。**

优先使用：

- `openspec --version`；
- `openspec list --json`；
- `openspec status --change <id> --json`；
- `openspec instructions ... --json`；
- `openspec show ... --json`；
- `openspec schemas --json`；
- `openspec validate --json`；
- `openspec store list --json`；
- `openspec store doctor --json`；
- `openspec context --json`；
- `openspec workset list --json`；
- `openspec doctor --json`。

禁止：

- 在 JSON 可用时解析彩色终端文本；
- 假设 Artifact 固定为四类；
- 通过目录存在与否自行推导 Archive eligibility；
- 将缓存结果当成写操作前的最终依据。

写操作前必须重新获取 Root 与 Change 状态。

---

## 16. VS Code 原生体验要求

1. Sidebar 优先使用 Tree View / Native View；复杂内容再进入 Editor Webview。
2. 使用 VS Code Theme Tokens，不自建固定黑色主题。
3. 图标优先 Codicons。
4. 支持键盘导航、Focus Ring、ARIA Label。
5. 不依赖颜色表达状态，图标与文字必须同时存在。
6. Sidebar Item Hover Actions 不超过 3 个。
7. 在窄 Sidebar 下隐藏描述，只保留关键标签与进度。
8. Webview 支持 100%–200% 缩放与高对比度主题。

---

## 17. 关键埋点与验证方式

开源插件默认不启用隐式遥测。产品验证通过：

- 可选匿名 Usage Telemetry；
- GitHub Issue 模板；
- 可用性测试；
- 本地 Debug Log。

核心指标：

1. 用户识别 Active Root 的正确率；
2. New Change 写错 Root 的次数；
3. 从打开插件到进入目标 Change 的时间；
4. 从 Change Detail 到执行 Next Action 的点击数；
5. Store Missing / Reference Missing 的自助修复成功率；
6. 自定义 Schema 页面渲染成功率。

---

## 18. 验收标准

### P0：Context-first 基础改造

- [ ] Sidebar 始终展示 Current Project 与 Writable Root；
- [ ] New Change 明确目标 Root；
- [ ] Root Overview 与 Change Detail 使用统一 Context Bar；
- [ ] Change Detail 不再使用固定 Artifact + Action Stepper；
- [ ] Artifact Tabs 与状态由 CLI Schema 动态生成；
- [ ] Primary CTA 来自 CLI Next Steps；
- [ ] `<1.5` 自动退化且不报错；
- [ ] Local Root 原有生命周期功能全部保留。

### P1：Store / Reference / Workset

- [ ] Store Create、Register、Unregister、Remove 语义清晰；
- [ ] Reference 全局只读；
- [ ] Missing Reference 不阻塞本地 Change；
- [ ] Workset 独立为 Launcher，打开不改变当前 Root；
- [ ] Doctor / Context 结果可视化；
- [ ] 所有危险动作二次确认。

### P2：高级体验

- [ ] 多 Workspace Folder Context；
- [ ] Artifact Dependency Graph；
- [ ] Validation 定位与文件跳转；
- [ ] Store Git 状态摘要；
- [ ] 自定义 Schema 专项测试；
- [ ] 高对比度与屏幕阅读器验收。

---

## 19. 推荐迭代计划

### Milestone 1：模型纠偏

- 抽象 `ProjectContext`、`ResolvedRoot`、`ReferenceContext`、`WorksetView`；
- 建立 Capability Matrix；
- 迁移 Change 数据源到动态 Schema Status。

### Milestone 2：导航与详情重构

- 新 Sidebar；
- Root Overview；
- Change Detail；
- Dynamic CTA；
- Legacy Fallback。

### Milestone 3：Store / Reference 管理

- Store Switcher；
- Context & Diagnostics；
- Missing Store 修复流程；
- Reference Browser。

### Milestone 4：Workset 与打磨

- Workset Launcher；
- Accessibility；
- Responsive Layout；
- Empty / Loading / Error States；
- Usability Test。

---

## 20. 最终产品定位

旧版插件是：

> Change Lifecycle Viewer

新版插件应升级为：

> **OpenSpec Planning Context & Change Lifecycle Studio**

它首先回答“我正在对哪个规划根工作、依赖哪些上下文”，然后才回答“这个 Change 下一步做什么”。
