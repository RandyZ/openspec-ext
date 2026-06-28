# Dashboard Change Detail UI Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 `polish-dashboard-change-detail-ui`，让 Dashboard 卡片展示 Created/Updated 与更清晰的信息层级，并把 ChangeDetail 的 header 工具动作与 workflow ActionBar 明确分离。

**Architecture:** Extension host 继续通过现有 `dashboardData` 消息下发 `ChangeInfo[]`，只扩展可选 `createdAt` 展示字段。Webview 层通过轻量 UI primitive 统一 icon button、日期显示、元信息行和动作分组；不迁移到新的组件库，只引入 Codicons 作为图标系统。Workflow routing、Verify/Archive terminal runner、artifact viewer 和 task toggle 业务语义保持不变。

**Tech Stack:** TypeScript, React 19, Tailwind CSS, Radix Tooltip, VS Code Webview API, Vitest, pnpm, OpenSpec CLI, `@vscode/codicons`。

---

## 规格与任务来源

- OpenSpec change: `openspec/changes/polish-dashboard-change-detail-ui/`
- Proposal: `openspec/changes/polish-dashboard-change-detail-ui/proposal.md`
- Design: `openspec/changes/polish-dashboard-change-detail-ui/design.md`
- Dashboard delta spec: `openspec/changes/polish-dashboard-change-detail-ui/specs/dashboard/spec.md`
- Workflow delta spec: `openspec/changes/polish-dashboard-change-detail-ui/specs/workflow-control/spec.md`
- OpenSpec tasks: `openspec/changes/polish-dashboard-change-detail-ui/tasks.md`
- Superpowers design: `../design/2026-06-10-polish-dashboard-change-detail-ui-design.md`

## File Structure

- Modify: `package.json`
  - 增加 `@vscode/codicons` dependency。
- Modify: `pnpm-lock.yaml`
  - 由 `pnpm add @vscode/codicons` 更新。
- Modify: `src/extension/services/types.ts`
  - `ChangeInfo` 增加 `createdAt?: string`。
- Modify: `src/webview/types/messages.ts`
  - webview `ChangeInfo` 增加 `createdAt?: string`。
- Modify: `src/extension/services/openspecCli.ts`
  - CLI list 返回中保留明确的 `createdAt`/`created` metadata。
- Modify: `src/extension/services/dataManager.ts`
  - filesystem fallback 填充 `createdAt`，并在 proposal why enrichment/search text 中保留 created metadata。
- Create: `src/webview/utils/dateLabels.ts`
  - 统一解析、格式化 Created/Updated。
- Create: `src/webview/components/ui/IconButton.tsx`
  - icon-only button primitive，统一 tooltip、aria-label、Codicons class、成功态基础。
- Modify: `src/webview/components/ui/index.ts`
  - 导出 `IconButton`。
- Modify: `src/webview/components/ChangeCard.tsx`
  - 重新组织卡片信息层级、Created/Updated、hover/focus actions 和动效。
- Modify: `src/webview/components/ActionBar.tsx`
  - 移除 Open/Refresh 等工具动作，只保留 workflow actions。
- Modify: `src/webview/components/ChangeDetail.tsx`
  - 新 header 双区布局、复制 change name、移除 Show in sidebar。
- Modify: `src/webview/index.css`
  - 引入 Codicons CSS，并加入 reduced motion 规则。
- Modify: `src/i18n/locales/en.json`
  - 新增 Created/Updated/copy 文案。
- Modify: `src/i18n/locales/zh-cn.json`
  - 新增中文 Created/Updated/copy 文案。
- Test: `test/extension/services/dataManager.test.ts`
  - 覆盖 `createdAt` 保留、filesystem fallback、失败降级。
- Test: `test/extension/services/openspecCli.test.ts`
  - 覆盖 CLI explicit created metadata。
- Test: `test/webview/utils/filterChanges.test.ts`
  - 覆盖 created metadata 进入搜索。
- Create: `test/webview/utils/dateLabels.test.ts`
  - 覆盖日期 label 格式化和无效输入。
- Create: `test/webview/components/changeCard.test.tsx`
  - 覆盖卡片层级、Created/Updated、hover/focus action 基础属性。
- Modify: `test/webview/components/actionBar.test.ts`
  - 覆盖 ActionBar 不再渲染 Open/Refresh。
- Modify: `test/webview/components/changeDetailRouting.test.ts`
  - 覆盖 Show in sidebar 移除、copy message、Header/ActionBar 分组源码约束。
- Create: `test/webview/components/iconButton.test.tsx`
  - 覆盖 icon button aria-label、tooltip、Codicons class。

## Task 1: `createdAt` 数据模型与 extension 数据链路

**Files:**
- Modify: `src/extension/services/types.ts`
- Modify: `src/webview/types/messages.ts`
- Modify: `src/extension/services/openspecCli.ts`
- Modify: `src/extension/services/dataManager.ts`
- Modify: `test/extension/services/openspecCli.test.ts`
- Modify: `test/extension/services/dataManager.test.ts`
- Modify: `test/webview/utils/filterChanges.test.ts`

- [ ] **Step 1: 写 CLI created metadata 的失败测试**

在 `test/extension/services/openspecCli.test.ts` 中新增测试，放在 `listChanges` 相关 describe 内。

```typescript
it('preserves explicit created metadata from openspec list output', async () => {
  const service = new OpenSpecCliService('/workspace');
  const exec = vi.spyOn(service as any, 'execOpenSpec');

  exec
    .mockResolvedValueOnce(JSON.stringify({
      changes: [
        {
          name: 'polish-ui',
          completedTasks: 1,
          totalTasks: 2,
          lastModified: '2026-06-10T12:00:00.000Z',
          createdAt: '2026-06-01T09:00:00.000Z',
        },
      ],
    }))
    .mockResolvedValueOnce(JSON.stringify({
      artifacts: [],
    }));

  await expect(service.listChanges()).resolves.toMatchObject([
    {
      name: 'polish-ui',
      lastModified: '2026-06-10T12:00:00.000Z',
      createdAt: '2026-06-01T09:00:00.000Z',
    },
  ]);
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
rtk zsh -c 'source ~/.zshrc && pnpm test -- test/extension/services/openspecCli.test.ts -t "preserves explicit created metadata"'
```

Expected: FAIL，错误应指向 `createdAt` 未出现在 `listChanges()` 返回结果中。

- [ ] **Step 3: 扩展 `ChangeInfo` 类型**

在 `src/extension/services/types.ts` 和 `src/webview/types/messages.ts` 的 `ChangeInfo` 中加入同一字段。

```typescript
export interface ChangeInfo {
  name: string;
  completedTasks: number;
  totalTasks: number;
  lastModified: string;
  createdAt?: string;
  status: 'draft' | 'in-progress' | 'complete';
  artifacts?: ArtifactStatus[];
  proposalWhySummary?: string;
  proposalWhyFullText?: string;
  searchText?: string;
}
```

- [ ] **Step 4: 在 CLI list 中保留 explicit created 值**

在 `src/extension/services/openspecCli.ts` 中加入 helper，并在两个返回分支中使用。

```typescript
function normalizeCreatedAt(change: Record<string, unknown>): string | undefined {
  const value = change.createdAt ?? change.created ?? change.metadataCreated;
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}
```

在 `listChanges()` 的 success 和 catch fallback return object 内加入：

```typescript
createdAt: normalizeCreatedAt(c),
```

- [ ] **Step 5: 运行 CLI metadata 测试确认通过**

Run:

```bash
rtk zsh -c 'source ~/.zshrc && pnpm test -- test/extension/services/openspecCli.test.ts -t "preserves explicit created metadata"'
```

Expected: PASS。

- [ ] **Step 6: 写 filesystem fallback 测试**

在 `test/extension/services/dataManager.test.ts` 中新增测试。这个测试直接调用私有 fallback，沿用该文件已有 `as any` 风格。

```typescript
it('uses filesystem birthtime as createdAt fallback without changing status', async () => {
  const { manager } = createManager();
  const birthtime = new Date('2026-06-01T09:00:00.000Z');
  const mtime = new Date('2026-06-10T12:00:00.000Z');

  const fs = await import('fs');
  vi.spyOn(fs.promises, 'readdir').mockResolvedValue([
    { name: 'polish-ui', isDirectory: () => true },
  ] as any);
  vi.spyOn(fs.promises, 'stat').mockResolvedValue({
    birthtime,
    ctime: birthtime,
    mtime,
  } as any);

  vi.spyOn(manager as any, 'countTaskProgress').mockResolvedValue([0, 2]);
  vi.spyOn(manager as any, 'getFilesystemArtifactStatuses').mockResolvedValue([]);

  const changes = await (manager as any).listChangesFromFilesystem();

  expect(changes).toEqual([
    expect.objectContaining({
      name: 'polish-ui',
      createdAt: '2026-06-01T09:00:00.000Z',
      lastModified: '2026-06-10T12:00:00.000Z',
      status: 'in-progress',
    }),
  ]);
});
```

- [ ] **Step 7: 写 fallback 失败降级测试**

继续在 `test/extension/services/dataManager.test.ts` 中新增测试。

```typescript
it('omits createdAt when filesystem fallback time is not available', async () => {
  const { manager } = createManager();
  const fs = await import('fs');

  vi.spyOn(fs.promises, 'readdir').mockResolvedValue([
    { name: 'missing-time', isDirectory: () => true },
  ] as any);
  vi.spyOn(fs.promises, 'stat').mockRejectedValue(new Error('stat failed'));
  vi.spyOn(manager as any, 'countTaskProgress').mockResolvedValue([0, 0]);
  vi.spyOn(manager as any, 'getFilesystemArtifactStatuses').mockResolvedValue([]);

  const changes = await (manager as any).listChangesFromFilesystem();

  expect(changes[0]).toMatchObject({
    name: 'missing-time',
    status: 'draft',
    lastModified: expect.any(String),
  });
  expect(changes[0].createdAt).toBeUndefined();
});
```

- [ ] **Step 8: 实现 filesystem fallback**

在 `src/extension/services/dataManager.ts` 中加入 helper。

```typescript
function statCreatedAt(stat: fs.Stats): string | undefined {
  const time = stat.birthtimeMs > 0 ? stat.birthtime : stat.ctime;
  const ms = time.getTime();
  return Number.isFinite(ms) && ms > 0 ? time.toISOString() : undefined;
}
```

在 `listChangesFromFilesystem()` 的 stat 成功分支中设置：

```typescript
let createdAt: string | undefined;
try {
  const stat = await fs.promises.stat(changeDir);
  lastModified = stat.mtime.toISOString();
  createdAt = statCreatedAt(stat);
} catch {
  // Keep current timestamp when stat fails; the entry still exists.
}
```

在 return object 中加入：

```typescript
createdAt,
```

- [ ] **Step 9: 把 created metadata 纳入搜索文本测试**

在 `test/webview/utils/filterChanges.test.ts` 的 `changes` fixture 中给第一条加入：

```typescript
createdAt: '2026-06-01T09:00:00.000Z',
searchText: 'find changes quickly from the sidebar and inspect context proposal done created 2026-06-01',
```

并在测试中加入断言：

```typescript
expect(filterChanges(changes, '2026-06-01')).toEqual([changes[0]]);
```

- [ ] **Step 10: 运行 Task 1 targeted tests**

Run:

```bash
rtk zsh -c 'source ~/.zshrc && pnpm test -- test/extension/services/openspecCli.test.ts test/extension/services/dataManager.test.ts test/webview/utils/filterChanges.test.ts'
```

Expected: PASS。

- [ ] **Step 11: Commit Task 1**

```bash
rtk git add src/extension/services/types.ts src/webview/types/messages.ts src/extension/services/openspecCli.ts src/extension/services/dataManager.ts test/extension/services/openspecCli.test.ts test/extension/services/dataManager.test.ts test/webview/utils/filterChanges.test.ts
rtk git commit -m "Add createdAt dashboard data model"
```

## Task 2: 日期 label、Codicons 和 `IconButton`

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Create: `src/webview/utils/dateLabels.ts`
- Create: `src/webview/components/ui/IconButton.tsx`
- Modify: `src/webview/components/ui/index.ts`
- Modify: `src/webview/index.css`
- Modify: `src/i18n/locales/en.json`
- Modify: `src/i18n/locales/zh-cn.json`
- Create: `test/webview/utils/dateLabels.test.ts`
- Create: `test/webview/components/iconButton.test.tsx`

- [ ] **Step 1: 安装 Codicons**

Run:

```bash
rtk zsh -c 'source ~/.zshrc && pnpm add @vscode/codicons'
```

Expected: `package.json` dependencies 包含 `@vscode/codicons`，`pnpm-lock.yaml` 更新。

- [ ] **Step 2: 写 date label 测试**

创建 `test/webview/utils/dateLabels.test.ts`。

```typescript
import { describe, expect, it, vi } from 'vitest';
import { formatDateLabel, formatRelativeDateLabel } from '../../../src/webview/utils/dateLabels';

describe('dateLabels', () => {
  it('formats absolute date labels for created metadata', () => {
    expect(formatDateLabel('2026-06-10T02:00:00.000Z')).toMatch(/2026|6|06|10/);
  });

  it('formats relative labels for updated metadata', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-10T12:00:00.000Z'));
    expect(formatRelativeDateLabel('2026-06-10T02:00:00.000Z')).toBe('Today');
    expect(formatRelativeDateLabel('2026-06-09T02:00:00.000Z')).toBe('Yesterday');
    vi.useRealTimers();
  });

  it('returns an empty string for invalid values', () => {
    expect(formatDateLabel('not-a-date')).toBe('');
    expect(formatRelativeDateLabel('not-a-date')).toBe('');
  });
});
```

- [ ] **Step 3: 实现 date label 工具**

创建 `src/webview/utils/dateLabels.ts`。

```typescript
import { t } from '../../i18n';

function parseDate(iso: string): Date | null {
  const date = new Date(iso);
  return Number.isFinite(date.getTime()) ? date : null;
}

export function formatDateLabel(iso: string): string {
  const date = parseDate(iso);
  if (!date) return '';
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatRelativeDateLabel(iso: string): string {
  const date = parseDate(iso);
  if (!date) return '';
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  if (diffDays === 0) return t('time.today');
  if (diffDays === 1) return t('time.yesterday');
  if (diffDays < 7) return t('time.daysAgo', { days: diffDays });
  if (diffDays < 30) return t('time.weeksAgo', { weeks: Math.floor(diffDays / 7) });
  return formatDateLabel(iso);
}
```

- [ ] **Step 4: 写 IconButton 测试**

创建 `test/webview/components/iconButton.test.tsx`。

```tsx
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { IconButton } from '../../../src/webview/components/ui/IconButton';

describe('IconButton', () => {
  it('renders an accessible codicon button', () => {
    const html = renderToStaticMarkup(
      <IconButton icon="copy" label="Copy change name" onClick={vi.fn()} />
    );

    expect(html).toContain('aria-label="Copy change name"');
    expect(html).toContain('codicon');
    expect(html).toContain('codicon-copy');
  });
});
```

- [ ] **Step 5: 实现 IconButton**

创建 `src/webview/components/ui/IconButton.tsx`。

```tsx
import React from 'react';
import { Tooltip } from './Tooltip';

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: string;
  label: string;
}

export const IconButton: React.FC<IconButtonProps> = ({
  icon,
  label,
  className = '',
  ...props
}) => (
  <Tooltip content={label}>
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`inline-flex h-7 w-7 items-center justify-center rounded border border-transparent bg-transparent text-[var(--vscode-foreground)] transition-colors hover:bg-[var(--vscode-toolbar-hoverBackground)] focus:outline-none focus:ring-1 focus:ring-[var(--vscode-focusBorder)] ${className}`}
      {...props}
    >
      <span className={`codicon codicon-${icon}`} aria-hidden="true" />
    </button>
  </Tooltip>
);
```

- [ ] **Step 6: 导出 IconButton 并引入 Codicons CSS**

在 `src/webview/components/ui/index.ts` 增加：

```typescript
export { IconButton } from './IconButton';
export type { IconButtonProps } from './IconButton';
```

在 `src/webview/index.css` 顶部增加：

```css
@import "@vscode/codicons/dist/codicon.css";
```

在同文件底部增加 reduced motion 规则：

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    scroll-behavior: auto !important;
    transition-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 7: 增加 i18n keys**

在 `src/i18n/locales/en.json` 加入：

```json
"change.created": "Created {date}",
"change.updated": "Updated {date}",
"action.copyChangeName": "Copy change name",
"action.copiedChangeName": "Copied change name"
```

在 `src/i18n/locales/zh-cn.json` 加入：

```json
"change.created": "创建于 {date}",
"change.updated": "更新于 {date}",
"action.copyChangeName": "复制 change 名称",
"action.copiedChangeName": "已复制 change 名称"
```

- [ ] **Step 8: 运行 Task 2 targeted tests**

Run:

```bash
rtk zsh -c 'source ~/.zshrc && pnpm test -- test/webview/utils/dateLabels.test.ts test/webview/components/iconButton.test.tsx test/i18n/i18n.test.ts'
```

Expected: PASS。

- [ ] **Step 9: Commit Task 2**

```bash
rtk git add package.json pnpm-lock.yaml src/webview/utils/dateLabels.ts src/webview/components/ui/IconButton.tsx src/webview/components/ui/index.ts src/webview/index.css src/i18n/locales/en.json src/i18n/locales/zh-cn.json test/webview/utils/dateLabels.test.ts test/webview/components/iconButton.test.tsx
rtk git commit -m "Add UI icon and date primitives"
```

## Task 3: Dashboard `ChangeCard` 信息层级与 hover/focus actions

**Files:**
- Modify: `src/webview/components/ChangeCard.tsx`
- Create: `test/webview/components/changeCard.test.tsx`
- Modify: `src/webview/index.css`

- [ ] **Step 1: 写 ChangeCard Created/Updated 渲染测试**

创建 `test/webview/components/changeCard.test.tsx`。

```tsx
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ChangeCard } from '../../../src/webview/components/ChangeCard';
import type { ChangeInfo } from '../../../src/webview/types/messages';

const change: ChangeInfo = {
  name: 'polish-dashboard-change-detail-ui',
  completedTasks: 3,
  totalTasks: 5,
  lastModified: '2026-06-10T12:00:00.000Z',
  createdAt: '2026-06-01T09:00:00.000Z',
  status: 'in-progress',
  artifacts: [
    { id: 'proposal', outputPath: 'proposal.md', status: 'done' },
    { id: 'design', outputPath: 'design.md', status: 'done' },
  ],
  proposalWhySummary: 'Improve dashboard readability.',
  proposalWhyFullText: 'Improve dashboard readability for active changes.',
};

describe('ChangeCard', () => {
  it('renders identity, summary, artifacts, time metadata, and progress', () => {
    const html = renderToStaticMarkup(
      <ChangeCard change={change} onClick={vi.fn()} onLaunchWorkflow={vi.fn()} />
    );

    expect(html).toContain('polish-dashboard-change-detail-ui');
    expect(html).toContain('Improve dashboard readability.');
    expect(html).toContain('proposal');
    expect(html).toContain('design');
    expect(html).toContain('Created');
    expect(html).toContain('Updated');
    expect(html).toContain('3 / 5 tasks');
    expect(html).toContain('60%');
  });

  it('hides Created when createdAt is missing', () => {
    const html = renderToStaticMarkup(
      <ChangeCard change={{ ...change, createdAt: undefined }} onClick={vi.fn()} />
    );

    expect(html).not.toContain('Created');
    expect(html).toContain('Updated');
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
rtk zsh -c 'source ~/.zshrc && pnpm test -- test/webview/components/changeCard.test.tsx'
```

Expected: FAIL，至少 `Created`/`Updated` 文案断言失败。

- [ ] **Step 3: 重构 ChangeCard 日期和层级**

在 `src/webview/components/ChangeCard.tsx` 中使用 `formatDateLabel` 和 `formatRelativeDateLabel`，替换原本本地 `formatLastModified`。

```tsx
import { formatDateLabel, formatRelativeDateLabel } from '../utils/dateLabels';
```

在组件内计算：

```tsx
const createdLabel = change.createdAt ? formatDateLabel(change.createdAt) : '';
const updatedLabel = change.lastModified ? formatRelativeDateLabel(change.lastModified) : '';
const progressPercent = change.totalTasks > 0
  ? Math.round((change.completedTasks / change.totalTasks) * 100)
  : 0;
```

渲染时间行：

```tsx
<div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs" style={{ color: 'var(--vscode-descriptionForeground)' }}>
  {createdLabel && <span>{t('change.created', { date: createdLabel })}</span>}
  {createdLabel && updatedLabel && <span aria-hidden="true">·</span>}
  {updatedLabel && <span>{t('change.updated', { date: updatedLabel })}</span>}
</div>
```

渲染进度行：

```tsx
{change.totalTasks > 0 && (
  <div className="mt-2">
    <div className="flex items-center justify-between gap-2 text-xs" style={{ color: 'var(--vscode-descriptionForeground)' }}>
      <span>{change.completedTasks} / {change.totalTasks} tasks</span>
      <span>{progressPercent}%</span>
    </div>
    <div className="mt-1 h-1 rounded-full overflow-hidden" style={{ background: 'var(--vscode-input-border)' }}>
      <div
        className="h-full transition-[width] duration-150 ease-out"
        style={{
          width: `${progressPercent}%`,
          background: 'var(--vscode-progressBar-background)',
        }}
      />
    </div>
  </div>
)}
```

- [ ] **Step 4: 支持 keyboard focus 显示 actions**

在 `ChangeCard` 中新增 focus state。

```tsx
const [focusWithin, setFocusWithin] = React.useState(false);
const showActions = hover || focusWithin;
```

根节点增加：

```tsx
onFocus={() => setFocusWithin(true)}
onBlur={(e) => {
  if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
    setFocusWithin(false);
  }
}}
```

把原来的 hover-only 条件渲染改为：

```tsx
{showActions && (onLaunchWorkflow || onCopyFf || onCopyApply || onArchive) && (
  <div className="mt-2 flex flex-wrap gap-1 border-t pt-2 transition-opacity duration-150" style={{ borderColor: 'var(--vscode-panel-border)' }} data-action>
    {onLaunchWorkflow && getSmartActions(change).map((action) => (
      <button
        key={action.label}
        type="button"
        data-action
        className="px-2 py-0.5 text-xs rounded cursor-pointer border-none"
        title={
          action.action === 'verify' || action.action === 'archive'
            ? action.label
            : getWorkflowActionTitle(action.label, workflowLaunchConfig)
        }
        aria-label={
          action.action === 'verify' || action.action === 'archive'
            ? action.label
            : getWorkflowActionTitle(action.label, workflowLaunchConfig)
        }
        style={{
          background: 'var(--vscode-button-background)',
          color: 'var(--vscode-button-foreground)',
        }}
        onClick={(e) => {
          e.stopPropagation();
          onLaunchWorkflow(action.action, change.name);
        }}
      >
        {action.action === 'verify' || action.action === 'archive'
          ? action.label
          : getWorkflowActionButtonLabel(action.label, workflowLaunchConfig)}
      </button>
    ))}
  </div>
)}
```

- [ ] **Step 5: 运行 ChangeCard 测试确认通过**

Run:

```bash
rtk zsh -c 'source ~/.zshrc && pnpm test -- test/webview/components/changeCard.test.tsx'
```

Expected: PASS。

- [ ] **Step 6: Commit Task 3**

```bash
rtk git add src/webview/components/ChangeCard.tsx test/webview/components/changeCard.test.tsx src/webview/index.css
rtk git commit -m "Polish dashboard change cards"
```

## Task 4: ChangeDetail header 与 workflow-only ActionBar

**Files:**
- Modify: `src/webview/components/ChangeDetail.tsx`
- Modify: `src/webview/components/ActionBar.tsx`
- Modify: `test/webview/components/actionBar.test.ts`
- Modify: `test/webview/components/changeDetailRouting.test.ts`

- [ ] **Step 1: 写 ActionBar 分组测试**

在 `test/webview/components/actionBar.test.ts` 新增测试。

```typescript
it('does not render workspace utilities in the workflow action bar', () => {
  const tree = ActionBar({
    changeName: 'demo-change',
    isArchived: false,
    workflowState: {
      steps: [],
      currentStep: 'apply',
      nextAction: {
        label: 'Apply',
        action: 'apply',
        command: '/opsx:apply demo-change',
        variant: 'primary',
      },
      secondaryActions: [],
    },
    workflowLaunchConfig: launchConfig,
    onAction: vi.fn(),
    onCopyFf: vi.fn(),
    onCopyApply: vi.fn(),
    onOpenInEditor: vi.fn(),
    onArchive: vi.fn(),
    onRefresh: vi.fn(),
  });

  expect(() => findButtonByText(tree, 'Open in Editor')).toThrow();
  expect(() => findButtonByText(tree, 'Refresh')).toThrow();
  expect(findButtonByText(tree, 'Apply')).toBeTruthy();
});
```

- [ ] **Step 2: 写 ChangeDetail 源码约束测试**

在 `test/webview/components/changeDetailRouting.test.ts` 新增断言。

```typescript
it('renders copy change name and removes show in sidebar from the detail header', () => {
  expect(source).not.toContain('handleShowInSidebar');
  expect(source).not.toContain("t('action.showInSidebar')");
  expect(source).toContain("t('action.copyChangeName')");
  expect(source).toContain('sendMessage.copyToClipboard(changeName)');
});

it('keeps Open in Editor and Refresh in the detail header instead of ActionBar props', () => {
  expect(source).toContain('handleOpenInEditor');
  expect(source).toContain('handleRefresh');
  expect(source).not.toContain('onOpenInEditor={handleOpenInEditor}');
  expect(source).not.toContain('onRefresh={handleRefresh}');
});
```

- [ ] **Step 3: 运行测试确认失败**

Run:

```bash
rtk zsh -c 'source ~/.zshrc && pnpm test -- test/webview/components/actionBar.test.ts test/webview/components/changeDetailRouting.test.ts'
```

Expected: FAIL，当前 ActionBar 仍渲染 Open/Refresh，ChangeDetail 仍包含 Show in sidebar。

- [ ] **Step 4: 修改 ActionBar props 和渲染**

在 `src/webview/components/ActionBar.tsx` 中删除这些 props：

```typescript
onOpenInEditor: () => void;
onArchive: (changeName: string) => void;
onRefresh: () => void;
```

删除 main ActionBar 中 Open/Refresh button 渲染。保留 workflow primary/secondary buttons。

Legacy fallback 保留 copy FF/apply；如果仍需要 legacy Open/Refresh，移到 ChangeDetail header，不在 ActionBar 内渲染。

- [ ] **Step 5: 修改 ChangeDetail header**

在 `src/webview/components/ChangeDetail.tsx` 中删除 `handleShowInSidebar`，引入 `IconButton`。

```tsx
import { IconButton } from './ui/IconButton';
```

新增 copy state：

```tsx
const [copiedName, setCopiedName] = useState(false);

const handleCopyChangeName = () => {
  postMessage(sendMessage.copyToClipboard(changeName));
  setCopiedName(true);
  window.setTimeout(() => setCopiedName(false), 1200);
};
```

替换 header 左区：

```tsx
<div className="min-w-0 flex-1">
  <div className="flex min-w-0 items-center gap-2">
    <div className="text-lg font-semibold break-all">
      {changeName.startsWith('archive:') ? `${changeName.slice(8)} (archived)` : changeName}
    </div>
    <IconButton
      icon={copiedName ? 'check' : 'copy'}
      label={copiedName ? t('action.copiedChangeName') : t('action.copyChangeName')}
      onClick={handleCopyChangeName}
    />
  </div>
  <div className="inline-flex items-center gap-2 mt-2 px-2.5 py-1 rounded text-xs" style={{ background: 'var(--vscode-editor-inactiveSelectionBackground)', color: 'var(--vscode-descriptionForeground)' }}>
    {getStatusSummary(existingArtifactIds, completedTasks, totalTasks, isArchived)}
  </div>
</div>
```

替换 header 右区：

```tsx
<div className="flex flex-wrap gap-1">
  <IconButton icon="go-to-file" label={t('action.openInEditor')} onClick={handleOpenInEditor} />
  <IconButton icon="refresh" label={t('action.refresh')} onClick={handleRefresh} />
</div>
```

更新 `ActionBar` 调用，删除 `onOpenInEditor`、`onArchive`、`onRefresh` props。

- [ ] **Step 6: 运行分组测试确认通过**

Run:

```bash
rtk zsh -c 'source ~/.zshrc && pnpm test -- test/webview/components/actionBar.test.ts test/webview/components/changeDetailRouting.test.ts'
```

Expected: PASS。

- [ ] **Step 7: Commit Task 4**

```bash
rtk git add src/webview/components/ChangeDetail.tsx src/webview/components/ActionBar.tsx test/webview/components/actionBar.test.ts test/webview/components/changeDetailRouting.test.ts
rtk git commit -m "Separate change detail header actions"
```

## Task 5: 最终验证与 OpenSpec task 收口

**Files:**
- Modify: `openspec/changes/polish-dashboard-change-detail-ui/tasks.md`

- [ ] **Step 1: 运行全量测试**

Run:

```bash
rtk zsh -c 'source ~/.zshrc && pnpm test'
```

Expected: PASS。若失败，只修本 change 引入的失败，不改无关功能。

- [ ] **Step 2: 运行构建**

Run:

```bash
rtk zsh -c 'source ~/.zshrc && pnpm run build'
```

Expected: extension esbuild 和 webview Vite build 均成功。

- [ ] **Step 3: 运行 OpenSpec strict validate**

Run:

```bash
rtk zsh -c 'source ~/.zshrc && openspec validate polish-dashboard-change-detail-ui --strict'
```

Expected:

```text
Change 'polish-dashboard-change-detail-ui' is valid
```

- [ ] **Step 4: 做 VS Code Extension Development Host smoke**

Run:

```bash
rtk zsh -c 'source ~/.zshrc && pnpm run build'
rtk zsh -c 'source ~/.zshrc && code --extensionDevelopmentPath=/Users/randy/workspace/projects/github/openspec-ext /Users/randy/workspace/projects/github/openspec-ext'
```

Expected manual checks:

- Dashboard 卡片显示 change name、Proposal Why、artifact badges、Created/Updated、任务进度。
- 缺失 Created 的 change 不显示错误占位。
- hover/focus 卡片时 workflow actions 可见且可点击。
- ChangeDetail header 显示 copy/Open/Refresh。
- 点击 copy 只复制当前 change name。
- ActionBar 只显示 workflow actions。
- `Show in sidebar` 不再作为顶部按钮出现。
- 深色/浅色主题下文字和按钮可读。

- [ ] **Step 5: 做 Cursor smoke**

Run:

```bash
rtk zsh -c 'source ~/.zshrc && cursor --extensionDevelopmentPath=/Users/randy/workspace/projects/github/openspec-ext /Users/randy/workspace/projects/github/openspec-ext'
```

Expected manual checks:

- extension 激活。
- Dashboard webview 可打开。
- Codicons 显示 copy/open/refresh 图标。
- copy/Open/Refresh/workflow buttons 可操作。
- 窄宽度下 header 不遮挡 change name。

如果 Cursor CLI 不可用，记录为未执行，并用 VS Code smoke 结果作为主验证证据。

- [ ] **Step 6: 勾选 OpenSpec tasks**

按实际完成情况更新 `openspec/changes/polish-dashboard-change-detail-ui/tasks.md`。完成后运行：

```bash
rtk zsh -c 'source ~/.zshrc && openspec status --change "polish-dashboard-change-detail-ui"'
```

Expected: completed task count 与勾选项一致。

- [ ] **Step 7: Commit final verification**

```bash
rtk git add openspec/changes/polish-dashboard-change-detail-ui/tasks.md
rtk git commit -m "Mark dashboard UI polish tasks complete"
```

## Self-Review

Spec coverage:

- Dashboard `Change List Display`: Task 1、Task 3、Task 5 覆盖 Created/Updated、信息层级、fallback 和测试。
- Dashboard `Change Navigation`: Task 3 覆盖 hover/focus actions、keyboard focus 和 click bubbling。
- Dashboard `Performance`: Task 2、Task 3、Task 5 覆盖 reduced motion、progress transition 和 build/smoke。
- Workflow `动态 ActionBar`: Task 4 覆盖 Header/ActionBar 分组、只读工具留在 Header、Show in sidebar 移除。
- Workflow `Dashboard ChangeCard 智能操作`: Task 3 覆盖 quick action 推荐语义。
- Workflow `Change Detail Header Utilities`: Task 2、Task 4 覆盖 IconButton、copy change name、aria/tooltip、窄宽度布局。

Placeholder scan:

- 本计划不含占位符、延后实现语句或未定义函数名。
- 示例 change name 使用真实 change `polish-dashboard-change-detail-ui`。
- 每个修改任务都给出目标文件、测试命令和预期结果。

Type consistency:

- `createdAt?: string` 在 extension/webview 两侧 `ChangeInfo` 中一致。
- `IconButton` props 固定为 `icon` 和 `label`。
- Copy 使用现有 `sendMessage.copyToClipboard(changeName)`。
- Workflow action 继续使用现有 `onAction(action, changeName)` 和 `launchWorkflowAction`。
