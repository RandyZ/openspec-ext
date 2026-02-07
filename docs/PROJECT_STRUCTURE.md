# 项目文件结构

```
openspce-ui/
│
├── README.md                      # 项目概览和快速开始
├── docs/                          # 项目文档
│   ├── ARCHITECTURE.md            # 详细架构设计文档
│   ├── EXPLORATION_SUMMARY.md     # 探索过程总结
│   └── PROJECT_STRUCTURE.md       # 本文件：项目文件结构说明
│
├── openspec/                      # OpenSpec 配置和变更
│   ├── config.yaml                # 项目配置（技术栈、规则）
│   └── changes/
│       └── vscode-extension-mvp/  # 当前变更
│           ├── proposal.md        # ✅ 提案（问题、解决方案、范围）
│           ├── design.md          # ✅ 设计（架构、组件、数据流）
│           ├── tasks.md           # ✅ 任务清单（269个任务）
│           └── specs/             # ✅ 功能规范
│               ├── dashboard/
│               │   └── spec.md    # Dashboard 需求和场景
│               ├── task-management/
│               │   └── spec.md    # 任务管理需求
│               ├── artifact-viewing/
│               │   └── spec.md    # Artifact 查看需求
│               └── cli-integration/
│                   └── spec.md    # CLI 集成需求
│
├── .cursor/                       # Cursor IDE 集成
│   ├── commands/                  # OpenSpec 命令
│   │   ├── opsx-new.md
│   │   ├── opsx-ff.md
│   │   ├── opsx-apply.md
│   │   ├── opsx-archive.md
│   │   ├── opsx-explore.md
│   │   └── ...
│   └── skills/                    # OpenSpec Skills
│       ├── openspec-new-change/
│       ├── openspec-ff-change/
│       └── ...
│
└── .opencode/                     # OpenCode IDE 集成（与 .cursor 类似）
    ├── command/
    └── skills/

## 即将创建的文件（实施阶段）

当开始实施时，将创建以下结构：

```
openspce-ui/
│
├── package.json                   # 项目依赖和脚本
├── tsconfig.json                  # TypeScript 配置
├── esbuild.config.js              # Extension 构建配置
├── vite.config.ts                 # Webview 构建配置
├── .vscodeignore                  # VSCode 打包忽略文件
├── .gitignore
│
├── src/
│   ├── extension/                 # Extension Host 代码（Node.js）
│   │   ├── extension.ts           # 入口点
│   │   ├── commands.ts            # 命令注册
│   │   ├── services/
│   │   │   ├── openspecCli.ts     # CLI 包装器
│   │   │   ├── fileManager.ts     # 文件操作
│   │   │   ├── dataCache.ts       # 缓存服务
│   │   │   └── types.ts           # 数据模型
│   │   ├── providers/
│   │   │   ├── dashboardProvider.ts  # Webview 提供者
│   │   │   └── sidebarProvider.ts    # 树视图提供者
│   │   └── utils/
│   │       ├── markdown.ts        # Markdown 解析
│   │       └── logger.ts          # 日志
│   │
│   └── webview/                   # Webview UI（React）
│       ├── index.tsx              # React 入口
│       ├── App.tsx                # 主应用组件
│       ├── hooks/
│       │   ├── useVscode.ts       # VSCode API Hook
│       │   └── useData.ts         # 数据获取 Hook
│       ├── views/
│       │   ├── Dashboard.tsx      # Dashboard 视图
│       │   ├── ChangeDetail.tsx   # Change 详情视图
│       │   └── SpecViewer.tsx     # Spec 查看器
│       ├── components/
│       │   ├── ui/                # Shadcn/Radix 组件
│       │   ├── TaskCheckbox.tsx   # 任务复选框
│       │   ├── DiffViewer.tsx     # Diff 查看器
│       │   └── MarkdownRenderer.tsx  # Markdown 渲染
│       ├── styles/
│       │   └── globals.css        # Tailwind 基础样式
│       └── lib/
│           └── utils.ts           # 工具函数
│
├── assets/
│   ├── icon.png                   # 扩展图标
│   └── icons/
│       └── activity-bar-icon.svg  # 活动栏图标
│
├── dist/                          # 构建输出（不提交）
│   ├── extension.js
│   └── webview/
│       ├── index.js
│       └── index.css
│
└── test/                          # 测试
    ├── suite/
    │   ├── extension.test.ts
    │   ├── cliService.test.ts
    │   └── fileManager.test.ts
    └── runTest.ts
```

## 文档说明

### 核心规划文档（已完成）✅

1. **README.md**（项目根目录）- 项目概览
   - 项目目标和功能
   - 架构决策
   - 开发阶段规划
   - 快速开始指南

2. **docs/ARCHITECTURE.md** - 架构设计
   - 完整的架构图（ASCII）
   - 项目结构
   - 开发阶段详细说明
   - 技术栈清单
   - 数据流机制

3. **docs/EXPLORATION_SUMMARY.md** - 探索总结
   - 探索过程回顾
   - 核心决策及原因
   - 关键洞察
   - 下一步行动指南
   - 技术亮点

4. **docs/PROJECT_STRUCTURE.md** - 本文件
   - 项目文件结构树
   - 文档索引与说明

5. **openspec/changes/vscode-extension-mvp/** - OpenSpec 变更
   - **proposal.md** - 提案（3000+ 字）
     - 问题陈述
     - 解决方案
     - 范围（MVP vs Phase 2/3）
     - 成功标准
     - 风险和开放问题
   
   - **design.md** - 设计文档（7000+ 字）
     - 高层架构
     - 组件设计（6 个核心组件）
     - 数据流图
     - 代码示例
     - 构建配置
     - 测试策略
   
   - **tasks.md** - 任务清单（269 个任务）
     - 12 个开发阶段
     - 每个任务可独立完成
     - 预估时间线（4 周 MVP）
   
   - **specs/** - 功能规范（4 个规范）
     - dashboard/spec.md - Dashboard 需求
     - task-management/spec.md - 任务管理需求
     - artifact-viewing/spec.md - Artifact 查看需求
     - cli-integration/spec.md - CLI 集成需求

### 实施文档（待创建）

这些文档将在实施过程中创建：

- **CHANGELOG.md** - 版本变更日志
- **CONTRIBUTING.md** - 贡献指南
- **API.md** - API 文档（如果需要）
- **TESTING.md** - 测试文档

## 总计

### 已完成
- ✅ 3 个文档（docs/ 目录：ARCHITECTURE、EXPLORATION_SUMMARY、PROJECT_STRUCTURE）
- ✅ 1 个提案（proposal.md）
- ✅ 4 个规范（specs/）
- ✅ 1 个设计文档（design.md）
- ✅ 1 个任务清单（tasks.md，269 个任务）

**总字数：约 20,000+ 字**
**总文件：11 个核心文档**

### 待创建（实施阶段）
- 代码文件：~30-40 个
- 测试文件：~10-15 个
- 配置文件：~5-8 个

---

**规划阶段完成！** 🎉

现在可以开始实施了，按照 `tasks.md` 中的顺序逐步推进。
