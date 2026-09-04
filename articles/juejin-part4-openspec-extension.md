# OpenSpec 实战第四篇：从单仓到多仓，一个 Dashboard 看清所有变更

> 这是 OpenSpec 实战系列的第四篇。
> 上一篇聊了 OpenSpec 和 Superpowers 的分层关系，再往前两篇分别讲了「为什么 AI 编码缺的不是提示词而是规范」和一次完整的 `/opsx:new → /opsx:ff → /opsx:apply → /opsx:archive` 实战。
> 这一篇不讲理念了——最近 OpenSpec 推出了 stores/worksets beta，规划可以独立成库、跨仓协作。而我把整套流程（包括这套新机制）做成了一个 VS Code 扩展。

---

## 为什么要写这个扩展

说实话，前三篇讲的流程我自己每天都在跑。但跑得越多越发现，**最打断心流的不是流程本身，而是「确认状态」这件事**。

其实推进工作流本身很顺：在 Agent 会话里敲 `/opsx:continue`、`/opsx:apply` 就行。但**只要想知道「现在有哪些 change、进行到哪了」，就得切出会话、打开终端敲 CLI**。这种上下文切换单仓时代已经很频繁了：

- 查看进度要敲 `openspec list` / `openspec status`——终端输出看完就忘，过十分钟又得敲一遍
- 想看某个 change 的 proposal 或 tasks 原文，得去 `openspec/changes/` 目录里翻 markdown，在 Agent 会话、文件树和终端之间反复横跳
- tasks.md 里几十个复选框，完成度全靠肉眼数
- archive 之前心里没底：任务到底清完没有？产物齐不齐？

最近 stores beta 出来之后，这种「看不见」的痛直接翻倍：

- 查看 store 里的 change，每条 CLI 命令都得带上 `--store team-plans`，少打一次就查到错的 root 上
- `store:` 指针、`defaultStore`、`--store` 优先级层层覆盖——「这条命令到底作用在哪」全靠脑补
- references 声明的上游 store 没注册、没 clone，要跑到 `openspec doctor` 才发现

**AI 编码的可视化工具不少，但 spec-driven 这条链路上，一直缺一个「控制台」。** 自己的需求自己最懂——于是我写了一个，顺手开源。

【对比图位置：左边终端连敲 N 条命令的输出 vs 右边侧边栏一屏看全，图你自己做】

## 30 秒认识 OpenSpec（老读者可跳过）

OpenSpec 是一个 spec-driven 的 AI 编码工作流：让 AI 写代码之前，先把「要做什么」落成一份份 markdown 产物，AI 按产物执行，全程可追溯。

每个需求是一个 change，包含 proposal（为什么做）、specs（做成什么样）、design（怎么做）、tasks（做哪些事）。在 Agent 会话里用 `/opsx:new → /opsx:ff → /opsx:apply → /opsx:archive` 推进整个生命周期，产物全部存在仓库的 `openspec/` 目录里，跟着 git 走。

想深入了解的话，强烈推荐按顺序读前三篇：

- 第一篇：《为什么 AI 编码真正缺的不是提示词，而是规范》【链接待补】
- 第二篇：[一次完整的 OpenSpec 实战：需求实现与知识传递](https://juejin.cn/post/7614057963394547727)
- 第三篇：[OpenSpec vs Superpowers：别再把它们当竞品了](https://juejin.cn/post/7615801634949890082)

## 功能巡礼

### 侧边栏 Dashboard：下一步该做什么，直接告诉你

打开侧边栏，Changes / Specs / Worksets / Dashboard 四个固定入口一字排开，激活、聚焦、不可用状态一目了然。

但我最喜欢的是 **Recommended Actions**：扩展会根据所有 change 的状态，自动算出最多 3 条「下一步」，按优先级排好——有问题的（Needs Attention）排最前，该验证的（Ready to Verify）其次，然后是常规推荐。以前这些信息要靠 `openspec status` 一条条看输出、在脑子里排优先级，现在打开面板就在那了。

整个面板用的是 VS Code 主题 token 和 Codicons，深浅色主题下都不违和，窄栏布局也能用——看起来就像编辑器自带的功能。

【截图：项目 Dashboard 侧边栏（openspec-dashboard.png）】

### 变更详情：从 Proposal 到 Tasks，一页看全

点开任何一个 change，Proposal / Specs / Design / Tasks / 验证与归档五个 Tab 全在一页里，markdown 直接渲染，不用再去 `openspec/changes/` 里翻文件。

Tasks Tab 解决了我最大的痛点：**进度可视化**。多少个任务、完成几个、卡在哪个，一眼看清。而且它不是简单显示复选框——默认开启「先完成前置任务」策略，前置任务没做完会拦住你（可以在设置里改成 warn 放行）；每个任务还标着「上次执行成功 / 失败」，哪些任务翻过车一目了然。

【截图：变更详情与任务操作（openspec-change-detail.png）】

### 一键把命令发给 Agent

看到任务是一回事，让 Agent 干活是另一回事。点任务旁边的执行按钮，扩展会按优先级选择执行者：**Copilot Chat > Cursor Agent CLI > 剪贴板**。装了 Copilot Chat 就直接预填进 Chat 输入框，没装就退到剪贴板，自己粘贴给任何 Agent。

这里有个设计取舍值得说一下：发出去的只是 `/opsx:apply <change-name>` 这样的简洁命令，**不是一大段冗长的 prompt**。因为 OpenSpec 的 skills 会自己加载上下文——工具该做的只是把「意图」准确送达，而不是越俎代庖。

【GIF 位置：点执行按钮 → 命令预填进 Copilot Chat → Agent 开始干活】

### Verify & Archive：高危操作必须走安全通道

完成度高了，就该验证了。扩展里的 `/opsx:verify` 会检查三个维度：**完整性**（所有 tasks 完成、所有需求有代码对应）、**正确性**（实现匹配 spec 意图、边界已处理）、**一致性**（设计决策反映在代码里）。

Verify 和 Archive 都不是静默执行的——它们在 VS Code 官方**交互式终端**里跑，Agent 中途反问时你可以直接继续输入，对话不会断。

归档操作做了明确的分层：「审查并归档」是主操作，打开交互式会话走完整流程；「立即归档」是次要操作，有确认弹窗保护，而且**只有当所有必需产物和任务都完成时才可用**。归档之后 change 变只读，防止误操作。

## 多仓时代：Stores & Worksets 可视化

[To be written：本篇重点节，呼应 OpenSpec stores beta]
- store 注册与状态一览
- References 面板：上游需求只读引用
- Worksets：一键把规划库 + 代码仓拉进同一个工作区
- 当前作用域（scope）始终可见，不再脑补 root 解析

## 快速上手

[To be written：安装 + 前置要求]
- Marketplace / Open VSX 安装
- 前置：OpenSpec CLI、`openspec/config.yaml`
- 找不到 CLI 时用 `openspec.cliPath` 兜底

<!-- ═══════════════════════════════════════════════════
     【可选节 · 技术彩蛋】整节可删除，不影响上下文
     如删除，连同本注释块一起移除即可
     ═══════════════════════════════════════════════════ -->

## 给同类开发者的技术彩蛋（可选）

[To be written：一段带过]
- React 19 + Tailwind + Radix UI 的 webview 技术栈
- 中英双语 i18n（跟随编辑器语言）
- VS Code 主题 token 自适应，深浅色不违和

<!-- ═══════════════════ 可选节结束 ═══════════════════ -->

## 结尾

[To be written：路线图（跟进 stores beta 演进）+ 求 Star / 反馈 / PR]

**项目地址**：
- GitHub：https://github.com/RandyZ/openspec-ext （欢迎 Star / Issue / PR）
- VS Code Marketplace：[链接待补]
- Open VSX：[链接待补]
