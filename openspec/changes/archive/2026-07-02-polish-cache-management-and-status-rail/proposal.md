<!-- Distilled from brainstorm.md saved at openspec/changes/<change>/brainstorm.md -->

## Why

当前 dashboard 的运行状态区域在多项目/cache 模式下不够清晰：缓存目录深且不可发现，状态栏视觉过重，且 target scope 缓存已经展示时仍显示 `Switching...`，造成状态不一致。现在需要把这块打磨成可靠、紧凑、可解释的 IDE 工具状态体验。

## What Changes

- 增加缓存管理入口：打开缓存目录、复制缓存路径、清理缓存、查看缓存详情。
- 在 dashboard 状态区显示轻量缓存摘要，例如 `Cache 12 KB · 4 files`，并提供可操作入口。
- 将现有 `Installed CLI / scope / Healthy / Switching` 大块状态卡重构为紧凑两行 status rail。
- 修正状态机：`Switching...` 只用于目标 scope 数据尚未展示前；目标 scope 的 stale cache 已显示后应切换为 `Showing cached data while refreshing...` 或等价文案。
- 失败路径保持一致：fresh 刷新失败时保留已显示缓存数据，结束误导性的 switching 状态，并展示 warning/error。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `extension-cache`: 增加缓存统计、缓存位置可发现性、打开/复制/清理/查看缓存详情等管理行为。
- `dashboard`: 调整 scope/runtime/status rail 的展示和 activity 状态语义，避免缓存刷新时的状态不一致。

## Impact

- Extension host:
  - `OpenSpecCacheService` 或相邻 service 增加 cache root、stats、clear/open/copy 操作。
  - `CommandManager` / `package.json` contributes 增加 cache 管理命令。
  - `DataManager` / webview message handler 增加 cache stats 查询与 cache action 消息。
- Webview:
  - `ScopeBar` 重构为 compact status rail。
  - `AppContext` loading/stale 状态增加更细 activity phase 或等价状态转换。
  - `Dashboard` 接收和展示 cache summary，并处理 cache action 入口。
- i18n:
  - 新增 cache action、cache stats、cached-refresh、status rail 文案的中英文翻译。
- Tests:
  - 增加 cache stats/clear/open/copy 的 extension tests。
  - 增加 status rail rendering 和 stale-cache activity transition 的 webview tests。
