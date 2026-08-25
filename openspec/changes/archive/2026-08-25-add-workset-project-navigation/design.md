## Context

现有 Project-first Sidebar 由 `DashboardViewProvider` 持有一个 `ProjectContext`，通过 `ProjectDataGateway` 解析 `OpenSpecRootBinding`，而 React `Dashboard` 只消费 Sidebar/Explorer/Detail 的既有 payload。旧的 `WorksetsPage` 属于 legacy Stores & Worksets 管理路径，不能直接复用为 Project 选择器。现有 `DataManager` 的 watcher 绑定激活 workspace root，需要增加“只跟随当前 Project”的能力。

CLI 事实源已经确认：`openspec workset list --json` 返回 `{ worksets: [{ name, tool, members: [{ name, path }] }] }`；`openspec store list --json` 返回 `{ stores: [{ id, root }] }`。两者都是 machine-global 查询，不携带当前 Project 的 Store selector。Workset member path 可能是同一仓库的 Git worktree，也可能是 registered Store root。

## Goals / Non-Goals

**Goals:**

- 在 Host 侧解析、canonicalize 并分类 Workset members，形成只读导航 payload。
- 通过 fresh CLI membership + fresh Project binding 验证每次 Project 切换。
- 让单一 watcher 只跟随当前 Project，并在失败时保持旧目标。
- 在同一个 React Dashboard 内提供 Workset picker scene 与 Project content scene，复用现有内容入口。
- 保持 Project/Store/Change/Spec binding 隔离，并支持 best-effort Git repo/branch 展示。

**Non-Goals:**

- 不实现 Workset create/open/remove、Store register/setup 或管理面板的新交互。
- 不引入 React Router、全局 Project Registry、Store/Workset 镜像数据库或持久 membership index。
- 不改变 Workflow Delivery/Adapter、Change Detail 协议或 referenced Store 的展示边界。
- 不同时 watch Workset 全部成员，也不让 Store member 成为可切换 Project。

## Decisions

### 1. Host owns topology, Webview owns scene only

`ProjectDataGateway` 增加只读的 Workset navigation 查询和 fresh member resolution。它使用同一 `OpenSpecCliService` 的 CLI resolver，但 Workset/Store list 命令始终 selector-free；所有 member path 先 `realpath`，再与 Store roots 比较。对非 Store member 创建 ProjectContext，并可 best-effort 采集 Git root/branch。

```text
Dashboard (webview)
  ├─ project scene: existing Header + ChangesSection + Explorer buttons
  └─ workset scene: WorksetProjectPicker (selection only)
          │ selectWorksetProject(worksetName, memberPath)
          ▼
DashboardViewProvider
  ├─ gateway.resolveWorksetProject(currentProject, request)
  ├─ gateway.resolveBinding(nextProject)
  ├─ dataManager.setWatchedProjectRoot(nextProject.projectPath)
  └─ postProjectSidebarData(nextProject, binding)
```

Webview payload carries canonical display data and immutable binding for the current Project, but a selection message is only a hint. Host never accepts a webview-provided root/binding as authority.

### 2. Fresh validation before state replacement

`DashboardViewProvider` retains the original activation Project as `currentProjectOrigin` and mutably tracks the selected Project. A select or return request first reloads official worksets/stores, verifies the requested canonical path belongs to an eligible Workset (or equals the origin Project for return), and then resolves a binding from the target Project command cwd. Only after all checks pass does it replace `projectContext`, `currentProjectBinding`, watcher target, cache identity, and Sidebar payload. A rejected request leaves every previous field unchanged.

The current Project Sidebar data includes `worksetNavigation` only when the gateway confirms one or more memberships. The navigation object is reloaded after every successful switch, so stale membership cannot become an authority.

### 3. Single watcher with retarget operation

`FileWatcherService` retains one callback and adds a `retarget(rootPath)` operation that disposes its three existing patterns before creating the same patterns under the new root. `DataManager` tracks `watchedProjectRoot` separately from its legacy activation `workspaceRoot`; watcher-relative parsing, artifact invalidation root, and refresh invalidation use the tracked root. Legacy dashboard scope behavior continues to start at the activation root.

The watcher callback remains the existing refresh/invalidation callback. Project-first refresh events are already routed by `DashboardViewProvider` through `reloadProjectSidebarData`, while legacy callers continue to use `DataManager.refresh()`.

### 4. One content surface, explicit scene boundary

`Dashboard` adds a local `projectFirstView` state. It renders a new small `WorksetProjectPicker` only for the picker scene; when a member is selected, the Host posts the normal Sidebar context and the component returns to the Project scene. Header receives optional `onOpenWorksets` and `onBackToCurrentProject` actions and keeps the existing vertical project identity/navigation layout. No second Changes/Specs renderer is introduced.

Workset picker rows expose: Workset name/tool, current Project marker, selectable Project member button, Planning Store non-action row, and Git metadata when available. All controls use native buttons, `aria-label`, `title`, visible focus styles, and truncation suited to narrow VS Code sidebars.

### 5. Binding and content isolation

The existing full binding equality check remains the gate for Explorer/Detail requests. After navigation, Project actions use the current Host-created binding through the existing Project-bound scope path. Existing open panels retain their own binding and panel key; opening the same Change/Spec in the newly selected Project creates a distinct key. No webview-side root reconstruction is added.

### 6. Compatibility and fail-soft behavior

Workset probing is optional. Unsupported commands, malformed members, missing paths, or Git inspection failures do not blank the current Project view. Invalid individual members are omitted or shown as non-actionable diagnostics; valid Project members remain usable. The legacy `DashboardData.worksets` and management messages remain unchanged for non-Project-first callers.

## Risks / Trade-offs

- [Global CLI metadata can change while the picker is open] → Re-query and validate membership on every selection; never trust picker payload as authority.
- [Git command may be slow or unavailable] → Bound each best-effort identity probe to a small timeout and omit metadata on failure; do not block Project selection.
- [Changing watcher roots can race with pending events] → dispose old watcher before creating the new one, clear pending events, and only refresh after the new binding has been accepted.
- [A Project may resolve through a Store root] → preserve CLI-declared Store identity in the binding and keep Store member classification separate from the Project selection rule.
- [Narrow sidebar can truncate names] → use bounded flex rows, title/aria text, native focusable buttons, and real narrow-width Extension Host smoke evidence.

## Migration Plan

1. Add contracts and gateway/CLI parser tests with RED assertions first.
2. Implement gateway, provider switching, watcher retargeting, and Webview scene behind optional payload fields; legacy callers remain unchanged.
3. Run focused tests, full unit suite, lint, build, strict OpenSpec validation, and diff checks.
4. Create isolated XDG CLI fixture with two Worksets, two Project members, a same-repo worktree, and a registered Store member; run CLI JSON assertions and Extension Host GUI smoke.
5. If rollback is required, revert the Change commit; no machine-global registry/workset data is modified by the extension.

## Open Questions

无。Git repo/branch metadata 是 best-effort 展示，不能改变可选 Project 或 binding 语义。

## Spec Amendments

无。设计细节均由 `workset-project-navigation` 新能力及 dashboard/scope-management delta 覆盖。
