# Improve CLI Activation Diagnostics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build actionable, privacy-preserving OpenSpec CLI activation diagnostics across Extension Host notifications and the Dashboard failure state.

**Architecture:** Keep `OpenSpecCliResolver` as the low-level path/attempt collector and add a focused diagnostic layer that classifies failures, sanitizes copyable details, and produces deterministic recovery actions. `OpenSpecCliService` owns diagnostic creation and notification dedupe; `DataManager` stores the latest diagnostic and must not let the existing filesystem fallback mask a CLI activation failure. Dashboard renders blocking or warning states from a dedicated webview message without adding a new file-system fallback data source.

**Tech Stack:** TypeScript, VS Code Extension API, React webview, Vitest, pnpm, OpenSpec CLI, i18n JSON resources.

---

## Scope Check

This plan implements one cross-cutting diagnostic feature across the extension host and dashboard. It does not change OpenSpec CLI path resolution order, does not install the CLI, does not modify shell config, and does not add a file-backed replacement for CLI dashboard data. The existing `resolve-cli-path-from-shell` Superpowers design remains the resolver boundary; this plan builds the user-facing diagnostic layer above it.

Important existing-behavior boundary: `DataManager.listChangesWithFallback()` currently falls back to `listChangesFromFilesystem()` when CLI is unavailable. For this change, CLI activation diagnostics take precedence over that fallback:

- No cached dashboard data + CLI activation diagnostic: throw/post a blocking diagnostic, do not return filesystem fallback data as normal dashboard data.
- Existing cached dashboard data + later CLI activation diagnostic: keep the cached data visible, set/post a warning diagnostic, and do not refresh it from filesystem fallback.
- Non-activation workspace errors such as workspace not initialized: keep the existing generic/workspace initialization error path and do not classify them as CLI activation diagnostics.

Primary source artifacts:

- `openspec/changes/improve-cli-activation-diagnostics/proposal.md`
- `openspec/changes/improve-cli-activation-diagnostics/design.md`
- `openspec/changes/improve-cli-activation-diagnostics/specs/cli-integration/spec.md`
- `openspec/changes/improve-cli-activation-diagnostics/specs/dashboard/spec.md`
- `openspec/changes/improve-cli-activation-diagnostics/tasks.md`
- `docs/superpowers/specs/2026-04-30-resolve-cli-path-from-shell-design.md`
- `docs/superpowers/plans/2026-04-30-resolve-cli-path-from-shell.md`

## File Structure

- Create `src/extension/services/cliActivationDiagnostic.ts`
  - Owns `CliActivationDiagnostic`, category/action types, category-to-action mapping, message normalization, diagnostic copy text generation, and helpers for classifying errors.
  - This file must not import React or webview code.

- Create `test/extension/services/cliActivationDiagnostic.test.ts`
  - Unit tests for category mapping, normalization, sanitization, and copy text.

- Modify `src/extension/services/openspecCli.ts`
  - Converts resolver/spawn/version failures into `CliActivationDiagnostic`.
  - Stores latest diagnostic and exposes `getCliActivationDiagnostic()`.
  - Clears diagnostic after successful availability check.
  - Adds minimum-version warning behavior.
  - Keeps existing CLI execution and resolver order intact.

- Modify `test/extension/services/openspecCli.test.ts`
  - Service-level tests for diagnostic creation, notification dedupe, minimum version warning, and non-diagnostic workspace initialization errors.

- Modify `src/extension/services/dataManager.ts`
  - Stores the latest service diagnostic after initialize/refresh failures.
  - Exposes `getCliDiagnostic()` only.
  - Does not own retry orchestration or cache clearing.

- Modify `test/extension/services/dataManager.test.ts`
  - Tests diagnostic storage/clearing and no file fallback.

- Modify `src/webview/types/messages.ts`
  - Adds extension-to-webview `cliActivationDiagnostic`.
  - Adds webview-to-extension messages: `retryCliDetection`, `openCliPathSettings`, `copyCliDiagnostic`, `openCliInstallDocs`.
  - Adds shared `CliActivationDiagnosticView` type.

- Modify `src/extension/providers/dashboardViewProvider.ts`
  - Posts `cliActivationDiagnostic` when initial dashboard data fails because of CLI activation.
  - Handles retry/settings/copy/docs messages.

- Modify `src/extension/providers/webviewMessageHandler.ts`
  - Handles diagnostic recovery actions for shared webview contexts when the provider routes them there.

- Modify `test/extension/providers/dashboardViewProvider.test.ts`
  - Tests posting diagnostic, retry success/failure, and settings/copy/docs actions.

- Modify `test/extension/providers/webviewMessageHandler.test.ts`
  - Tests recovery messages if implemented in the shared handler.

- Create `src/webview/components/CliActivationDiagnosticCard.tsx`
  - Renders blocking and warning variants from safe diagnostic fields.
  - Sends recovery action messages.

- Create `test/webview/components/cliActivationDiagnostic.test.tsx`
  - Static/server-render tests for sensitive data hiding and action button rendering.

- Modify `src/webview/components/Dashboard.tsx`
  - Stores diagnostic state separately from generic `error`.
  - Shows blocking failure when no dashboard data exists.
  - Shows warning when cached dashboard data exists.
  - Keeps generic workspace initialization errors separate.

- Create `test/webview/components/dashboard.test.tsx`
  - Tests blocking state, warning state, retry clearing behavior, and workspace-not-initialized separation.

- Modify `src/i18n/locales/en.json` and `src/i18n/locales/zh-cn.json`
  - Adds diagnostic titles, descriptions, action labels, stale warning, minimum version warning.

- Modify `test/i18n/i18n.test.ts`
  - Ensures new keys exist in both locales.

- Modify `README.md` and `README.zh-CN.md`
  - Adds troubleshooting for diagnostic card, retry, `openspec.cliPath`, Windows shim/spawn failures, and copy diagnostics.

## Task 1: Diagnostic Model and Sanitization Helper

**Files:**
- Create: `src/extension/services/cliActivationDiagnostic.ts`
- Create: `test/extension/services/cliActivationDiagnostic.test.ts`

- [ ] **Step 1: Write the failing tests**

Add `test/extension/services/cliActivationDiagnostic.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  buildCliActivationDiagnostic,
  getRecoveryActionsForCategory,
  normalizeDiagnosticMessage,
  sanitizeDiagnosticDetails,
  type CliActivationDiagnosticCategory,
} from '@extension/services/cliActivationDiagnostic';

describe('cliActivationDiagnostic', () => {
  it.each([
    ['configured-path-invalid', ['open-settings', 'copy-diagnostics', 'open-docs']],
    ['cli-not-found', ['open-docs', 'open-settings', 'retry', 'copy-diagnostics']],
    ['permission-denied', ['open-docs', 'copy-diagnostics', 'retry']],
    ['spawn-failed', ['open-settings', 'copy-diagnostics', 'retry', 'open-docs']],
    ['shell-resolution-failed', ['open-settings', 'open-docs', 'copy-diagnostics', 'retry']],
    ['version-check-failed', ['open-docs', 'copy-diagnostics', 'retry']],
    ['unknown', ['copy-diagnostics', 'retry', 'open-docs']],
  ] as Array<[CliActivationDiagnosticCategory, string[]]>)(
    'maps %s to deterministic recovery actions',
    (category, actions) => {
      expect(getRecoveryActionsForCategory(category)).toEqual(actions);
    }
  );

  it('normalizes volatile paths while preserving stable error codes', () => {
    expect(
      normalizeDiagnosticMessage(
        'Failed to spawn openspec: spawn /Users/randy/.npm/bin/openspec.cmd ENOENT after 403ms'
      )
    ).toBe('failed to spawn openspec: spawn <path>/openspec.cmd enoent after <duration>');
  });

  it('sanitizes user paths and sensitive environment details', () => {
    const details = sanitizeDiagnosticDetails([
      'process.env.PATH=/Users/randy/.npm/bin:/opt/homebrew/bin',
      'process.env.API_TOKEN=secret',
      'configured path: /Users/randy/bin/openspec',
      'extension host PATH: failed ENOENT',
    ]);

    expect(details.join('\n')).not.toContain('/Users/randy');
    expect(details.join('\n')).not.toContain('secret');
    expect(details).toContain('process.env.PATH=<redacted path list>');
    expect(details).toContain('configured path: <path>/openspec');
    expect(details).toContain('extension host PATH: failed ENOENT');
  });

  it('builds copy text from safe fields only', () => {
    const diagnostic = buildCliActivationDiagnostic({
      category: 'spawn-failed',
      message: 'Failed to spawn openspec: spawn /Users/randy/bin/openspec.cmd ENOENT',
      rawDetails: [
        'process.env.PATH=/Users/randy/bin:/usr/bin',
        'process.env.SECRET_KEY=abc',
        'known path /usr/local/bin/openspec: failed ENOENT',
      ],
      platform: 'win32',
      arch: 'arm64',
      workspaceName: 'openspec-ext',
      configuredCliPath: '/Users/randy/bin/openspec.cmd',
    });

    expect(diagnostic.category).toBe('spawn-failed');
    expect(diagnostic.recoveryActions).toEqual([
      'open-settings',
      'copy-diagnostics',
      'retry',
      'open-docs',
    ]);
    expect(diagnostic.copyText).toContain('category=spawn-failed');
    expect(diagnostic.copyText).toContain('platform=win32');
    expect(diagnostic.copyText).toContain('workspace=openspec-ext');
    expect(diagnostic.copyText).toContain('configuredCliPath=<path>/openspec.cmd');
    expect(diagnostic.copyText).not.toContain('/Users/randy');
    expect(diagnostic.copyText).not.toContain('SECRET_KEY');
    expect(diagnostic.copyText).not.toContain('abc');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
rtk zsh -c 'source ~/.zshrc && pnpm vitest run test/extension/services/cliActivationDiagnostic.test.ts'
```

Expected: FAIL with import errors for `@extension/services/cliActivationDiagnostic`.

- [ ] **Step 3: Implement the helper**

Create `src/extension/services/cliActivationDiagnostic.ts`:

```ts
export type CliActivationDiagnosticCategory =
  | 'configured-path-invalid'
  | 'cli-not-found'
  | 'permission-denied'
  | 'spawn-failed'
  | 'shell-resolution-failed'
  | 'version-check-failed'
  | 'unknown';

export type CliActivationRecoveryAction =
  | 'open-settings'
  | 'retry'
  | 'copy-diagnostics'
  | 'open-docs';

export interface BuildCliActivationDiagnosticInput {
  category: CliActivationDiagnosticCategory;
  message: string;
  rawDetails: string[];
  platform: NodeJS.Platform | string;
  arch: string;
  workspaceName: string;
  configuredCliPath?: string;
}

export interface CliActivationDiagnostic {
  category: CliActivationDiagnosticCategory;
  message: string;
  recoveryActions: CliActivationRecoveryAction[];
  safeDetails: string[];
  copyText: string;
  canRetry: boolean;
  normalizedMessage: string;
}

const RECOVERY_ACTIONS: Record<CliActivationDiagnosticCategory, CliActivationRecoveryAction[]> = {
  'configured-path-invalid': ['open-settings', 'copy-diagnostics', 'open-docs'],
  'cli-not-found': ['open-docs', 'open-settings', 'retry', 'copy-diagnostics'],
  'permission-denied': ['open-docs', 'copy-diagnostics', 'retry'],
  'spawn-failed': ['open-settings', 'copy-diagnostics', 'retry', 'open-docs'],
  'shell-resolution-failed': ['open-settings', 'open-docs', 'copy-diagnostics', 'retry'],
  'version-check-failed': ['open-docs', 'copy-diagnostics', 'retry'],
  unknown: ['copy-diagnostics', 'retry', 'open-docs'],
};

export function getRecoveryActionsForCategory(
  category: CliActivationDiagnosticCategory
): CliActivationRecoveryAction[] {
  return [...RECOVERY_ACTIONS[category]];
}

export function normalizeDiagnosticMessage(message: string): string {
  return message
    .replace(/[A-Za-z]:\\(?:[^\\\s]+\\)+([^\\\s]+)/g, '<path>/$1')
    .replace(/\/(?:Users|home)\/[^/\s]+(?:\/[^/\s]+)*\/([^/\s]+)/g, '<path>/$1')
    .replace(/\b\d+(?:\.\d+)?\s*ms\b/gi, '<duration>')
    .replace(/\battempt\s+\d+(?:\/\d+)?\b/gi, 'attempt <n>')
    .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z/g, '<timestamp>')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .slice(0, 160);
}

export function sanitizeDiagnosticDetails(details: string[]): string[] {
  return details
    .filter((detail) => !/(token|key|secret|password)/i.test(detail))
    .map((detail) => {
      if (/process\.env\.PATH=/.test(detail)) {
        return 'process.env.PATH=<redacted path list>';
      }
      return detail
        .replace(/[A-Za-z]:\\(?:[^\\\s]+\\)+([^\\\s]+)/g, '<path>/$1')
        .replace(/\/(?:Users|home)\/[^/\s]+(?:\/[^/\s]+)*\/([^/\s]+)/g, '<path>/$1');
    });
}

export function buildCliActivationDiagnostic(
  input: BuildCliActivationDiagnosticInput
): CliActivationDiagnostic {
  const recoveryActions = getRecoveryActionsForCategory(input.category);
  const normalizedMessage = normalizeDiagnosticMessage(input.message);
  const configuredCliPath = input.configuredCliPath
    ? input.configuredCliPath
        .replace(/[A-Za-z]:\\(?:[^\\\s]+\\)+([^\\\s]+)/g, '<path>/$1')
        .replace(/\/(?:Users|home)\/[^/\s]+(?:\/[^/\s]+)*\/([^/\s]+)/g, '<path>/$1')
    : '<empty>';
  const safeDetails = sanitizeDiagnosticDetails(input.rawDetails);
  const copyLines = [
    'OpenSpec CLI activation diagnostic',
    `category=${input.category}`,
    `message=${normalizedMessage}`,
    `platform=${input.platform}`,
    `arch=${input.arch}`,
    `workspace=${input.workspaceName}`,
    `configuredCliPath=${configuredCliPath}`,
    `recoveryActions=${recoveryActions.join(',')}`,
    ...safeDetails.map((detail) => `detail=${detail}`),
  ];

  return {
    category: input.category,
    message: input.message,
    recoveryActions,
    safeDetails,
    copyText: copyLines.join('\n'),
    canRetry: recoveryActions.includes('retry'),
    normalizedMessage,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
rtk zsh -c 'source ~/.zshrc && pnpm vitest run test/extension/services/cliActivationDiagnostic.test.ts'
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
rtk git add src/extension/services/cliActivationDiagnostic.ts test/extension/services/cliActivationDiagnostic.test.ts
rtk git commit -m "feat: add cli activation diagnostic model"
```

## Task 2: OpenSpecCliService Diagnostic Integration

**Files:**
- Modify: `src/extension/services/openspecCli.ts`
- Modify: `test/extension/services/openspecCli.test.ts`
- Uses: `src/extension/services/cliActivationDiagnostic.ts`

- [ ] **Step 1: Add failing service tests**

Append this `describe` block to `test/extension/services/openspecCli.test.ts`:

```ts
describe('CLI activation diagnostics', () => {
  it('stores cli-not-found diagnostic when resolver cannot resolve openspec', async () => {
    vi.mocked(spawn).mockImplementation(() => ({
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
      on: (event: string, cb: (error: Error) => void) => {
        if (event === 'error') setImmediate(() => cb(new Error('spawn openspec ENOENT')));
      },
      kill: vi.fn(),
    }) as any);

    const service = new OpenSpecCliService(workspaceRoot);
    await expect(service.checkAvailability(false)).resolves.toBe(false);

    expect(service.getCliActivationDiagnostic()).toMatchObject({
      category: 'cli-not-found',
      recoveryActions: ['open-docs', 'open-settings', 'retry', 'copy-diagnostics'],
    });
  });

  it('stores configured-path-invalid diagnostic without falling through to auto discovery', async () => {
    const vscode = await import('vscode');
    vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
      get: vi.fn((key: string) => (key === 'cliPath' ? '/bad/openspec' : false)),
    } as any);
    vi.mocked(spawn).mockImplementation(() => ({
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
      on: (event: string, cb: (error: Error) => void) => {
        if (event === 'error') setImmediate(() => cb(new Error('spawn /bad/openspec ENOENT')));
      },
      kill: vi.fn(),
    }) as any);

    const service = new OpenSpecCliService(workspaceRoot);
    await expect(service.checkAvailability(false)).resolves.toBe(false);

    expect(service.getCliActivationDiagnostic()?.category).toBe('configured-path-invalid');
    expect(vi.mocked(spawn).mock.calls.map((call) => call[0])).toEqual(['/bad/openspec']);
  });

  it('warns for unsupported minimum version but still reports availability', async () => {
    mockSpawnSuccess('0.9.0');
    const vscode = await import('vscode');
    const service = new OpenSpecCliService(workspaceRoot);

    await expect(service.checkAvailability()).resolves.toBe(true);

    expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
      expect.stringContaining('OpenSpec CLI'),
      expect.any(String)
    );
    expect(service.getCliActivationDiagnostic()).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
rtk zsh -c 'source ~/.zshrc && pnpm vitest run test/extension/services/openspecCli.test.ts'
```

Expected: FAIL because `getCliActivationDiagnostic()` and minimum-version warning are not implemented.

- [ ] **Step 3: Implement service diagnostic state**

Modify `src/extension/services/openspecCli.ts` imports and class fields:

```ts
import {
  buildCliActivationDiagnostic,
  type CliActivationDiagnostic,
  type CliActivationDiagnosticCategory,
} from './cliActivationDiagnostic';

const MINIMUM_OPENSPEC_VERSION = '1.0.0';
```

Inside `OpenSpecCliService`:

```ts
private cliActivationDiagnostic: CliActivationDiagnostic | null = null;
private shownCliDiagnosticKeys = new Set<string>();

getCliActivationDiagnostic(): CliActivationDiagnostic | null {
  return this.cliActivationDiagnostic;
}

clearCliActivationDiagnostic(): void {
  this.cliActivationDiagnostic = null;
}

private setCliActivationDiagnostic(
  category: CliActivationDiagnosticCategory,
  error: Error,
  rawDetails: string[] = []
): CliActivationDiagnostic {
  const diagnostic = buildCliActivationDiagnostic({
    category,
    message: error.message,
    rawDetails,
    platform: process.platform,
    arch: process.arch,
    workspaceName: this.workspaceRoot.split(/[\\/]/).filter(Boolean).pop() ?? '<workspace>',
    configuredCliPath: vscode.workspace.getConfiguration('openspec').get<string>('cliPath') ?? '',
  });
  this.cliActivationDiagnostic = diagnostic;
  return diagnostic;
}
```

- [ ] **Step 4: Classify failures in `execOpenSpec` catch branches**

In `execOpenSpec`, when catching `OpenSpecCliResolutionError`, call:

```ts
const category = this.classifyResolutionError(error);
const diagnostic = this.setCliActivationDiagnostic(category, error, error.diagnostics);
if (notifyCliNotFound) this.showCliActivationDiagnosticError(diagnostic);
throw error;
```

Add methods:

```ts
private classifyResolutionError(error: OpenSpecCliResolutionError): CliActivationDiagnosticCategory {
  const details = error.diagnostics.join('\n').toLowerCase();
  if (error.message.toLowerCase().includes('configured openspec cli path is invalid')) {
    return 'configured-path-invalid';
  }
  if (details.includes('permission denied') || details.includes('eacces') || details.includes('eperm')) {
    return 'permission-denied';
  }
  if (details.includes('login shell path: failed') || details.includes('login shell path: skipped')) {
    return 'shell-resolution-failed';
  }
  if (details.includes('--version') && details.includes('failed')) {
    return 'version-check-failed';
  }
  return 'cli-not-found';
}

private classifySpawnError(error: Error): CliActivationDiagnosticCategory {
  const message = error.message.toLowerCase();
  if (message.includes('eacces') || message.includes('eperm') || message.includes('permission denied')) {
    return 'permission-denied';
  }
  if (message.includes('spawn')) {
    return 'spawn-failed';
  }
  return 'unknown';
}
```

- [ ] **Step 5: Add minimum-version warning**

After a successful `--version` in `checkAvailability`, compare versions:

```ts
async checkAvailability(notifyCliNotFound = true): Promise<boolean> {
  try {
    const version = (await this.execOpenSpec(['--version'], 1, { notifyCliNotFound })).trim();
    this.clearCliActivationDiagnostic();
    this.warnIfVersionUnsupported(version);
    return true;
  } catch (error) {
    logger.error('OpenSpec CLI not available', error as Error);
    return false;
  }
}

private warnIfVersionUnsupported(version: string): void {
  if (this.compareSemver(version, MINIMUM_OPENSPEC_VERSION) >= 0) return;
  void vscode.window.showWarningMessage(
    t('cli.versionUnsupported', { version, minimum: MINIMUM_OPENSPEC_VERSION }),
    t('cli.installInstructions')
  ).then((selection) => {
    if (selection === t('cli.installInstructions')) {
      vscode.env.openExternal(vscode.Uri.parse('https://github.com/Fission-AI/OpenSpec#quick-start'));
    }
  });
}

private compareSemver(actual: string, minimum: string): number {
  const parse = (value: string) => value.match(/\d+(?:\.\d+){0,2}/)?.[0]
    .split('.')
    .map((part) => Number(part)) ?? [0];
  const a = parse(actual);
  const b = parse(minimum);
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    if (av !== bv) return av > bv ? 1 : -1;
  }
  return 0;
}
```

- [ ] **Step 6: Replace CLI not found toast with diagnostic-aware toast**

Add:

```ts
private showCliActivationDiagnosticError(diagnostic: CliActivationDiagnostic): void {
  const key = `${diagnostic.category}:${diagnostic.normalizedMessage}`;
  if (this.shownCliDiagnosticKeys.has(key)) return;
  this.shownCliDiagnosticKeys.add(key);

  const labels = diagnostic.recoveryActions.slice(0, 3).map((action) => this.getRecoveryActionLabel(action));
  vscode.window.showErrorMessage(diagnostic.message, ...labels).then((selection) => {
    void this.handleRecoveryActionSelection(selection, diagnostic);
  });
}

private getRecoveryActionLabel(action: string): string {
  switch (action) {
    case 'open-settings': return t('cli.openSettings');
    case 'retry': return t('cli.retry');
    case 'copy-diagnostics': return t('cli.copyDiagnostics');
    case 'open-docs': return t('cli.installInstructions');
    default: return action;
  }
}

private async handleRecoveryActionSelection(
  selection: string | undefined,
  diagnostic: CliActivationDiagnostic
): Promise<void> {
  if (selection === t('cli.openSettings')) {
    await vscode.commands.executeCommand('workbench.action.openSettings', 'openspec.cliPath');
  } else if (selection === t('cli.retry')) {
    await vscode.commands.executeCommand('workbench.action.reloadWindow');
  } else if (selection === t('cli.copyDiagnostics')) {
    await vscode.env.clipboard.writeText(diagnostic.copyText);
  } else if (selection === t('cli.installInstructions')) {
    await vscode.env.openExternal(vscode.Uri.parse('https://github.com/Fission-AI/OpenSpec#quick-start'));
  }
}
```

Update the `vscode` test mock to include `env.clipboard.writeText` if needed:

```ts
env: {
  openExternal: vi.fn(() => Promise.resolve()),
  clipboard: { writeText: vi.fn(() => Promise.resolve()) },
},
```

- [ ] **Step 7: Run focused tests**

Run:

```bash
rtk zsh -c 'source ~/.zshrc && pnpm vitest run test/extension/services/cliActivationDiagnostic.test.ts test/extension/services/openspecCli.test.ts'
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
rtk git add src/extension/services/cliActivationDiagnostic.ts src/extension/services/openspecCli.ts test/extension/services/cliActivationDiagnostic.test.ts test/extension/services/openspecCli.test.ts
rtk git commit -m "feat: classify openspec cli activation failures"
```

## Task 3: DataManager and Webview Message Protocol

**Files:**
- Modify: `src/extension/services/dataManager.ts`
- Modify: `src/webview/types/messages.ts`
- Modify: `src/extension/providers/dashboardViewProvider.ts`
- Modify: `src/extension/providers/webviewMessageHandler.ts`
- Modify: `test/extension/services/dataManager.test.ts`
- Modify: `test/extension/providers/dashboardViewProvider.test.ts`
- Modify: `test/extension/providers/webviewMessageHandler.test.ts`

- [ ] **Step 1: Write failing DataManager tests**

Add tests to `test/extension/services/dataManager.test.ts`:

```ts
it('stores cli activation diagnostic when initialization detects unavailable CLI', async () => {
  const manager = new DataManager('/workspace');
  const diagnostic = {
    category: 'cli-not-found',
    message: 'OpenSpec CLI executable could not be resolved',
    recoveryActions: ['open-docs', 'open-settings', 'retry', 'copy-diagnostics'],
    safeDetails: ['extension host PATH: failed ENOENT'],
    copyText: 'category=cli-not-found',
    canRetry: true,
    normalizedMessage: 'openspec cli executable could not be resolved',
  };

  vi.spyOn((manager as any).cliService, 'checkAvailability').mockResolvedValue(false);
  vi.spyOn((manager as any).cliService, 'getCliActivationDiagnostic').mockReturnValue(diagnostic);
  vi.spyOn(manager as any, 'migrateExecutionStateFromGlobalFile').mockResolvedValue(undefined);
  vi.spyOn(manager as any, 'warmDashboardData').mockImplementation(() => undefined);

  await manager.initialize();

  expect(manager.getCliDiagnostic()).toEqual(diagnostic);
});

it('clears cli activation diagnostic after successful refresh', async () => {
  const manager = new DataManager('/workspace');
  (manager as any).cliDiagnostic = {
    category: 'cli-not-found',
    message: 'missing',
    recoveryActions: [],
    safeDetails: [],
    copyText: 'missing',
    canRetry: true,
    normalizedMessage: 'missing',
  };
  vi.spyOn(manager as any, 'listChangesWithFallback').mockResolvedValue([]);
  vi.spyOn((manager as any).stateReader, 'listSpecs').mockResolvedValue([]);

  await manager.refresh();

  expect(manager.getCliDiagnostic()).toBeNull();
});

it('throws blocking cli diagnostic instead of returning filesystem fallback when there is no cached data', async () => {
  const manager = new DataManager('/workspace');
  const diagnostic = {
    category: 'cli-not-found',
    message: 'missing',
    recoveryActions: ['open-docs', 'open-settings', 'retry', 'copy-diagnostics'],
    safeDetails: ['extension host PATH: failed ENOENT'],
    copyText: 'category=cli-not-found',
    canRetry: true,
    normalizedMessage: 'missing',
  };

  vi.spyOn((manager as any).stateReader, 'listChanges').mockRejectedValue(new Error('missing cli'));
  vi.spyOn((manager as any).stateReader, 'listSpecs').mockResolvedValue([]);
  vi.spyOn((manager as any).cliService, 'getCliActivationDiagnostic').mockReturnValue(diagnostic);
  vi.spyOn(manager as any, 'listChangesFromFilesystem').mockResolvedValue([
    { name: 'from-files', completedTasks: 0, totalTasks: 0, lastModified: 'now', status: 'draft' },
  ]);
  (manager as any).cliAvailable = true;

  await expect(manager.refresh()).rejects.toThrow('missing cli');
  expect(manager.getCliDiagnostic()).toEqual(diagnostic);
  expect((manager as any).listChangesFromFilesystem).not.toHaveBeenCalled();
});

it('keeps cached data and records warning diagnostic when refresh fails later', async () => {
  const manager = new DataManager('/workspace');
  const cached = { changes: [], specs: [], lastRefresh: 123 };
  const diagnostic = {
    category: 'cli-not-found',
    message: 'missing',
    recoveryActions: ['open-docs', 'open-settings', 'retry', 'copy-diagnostics'],
    safeDetails: ['extension host PATH: failed ENOENT'],
    copyText: 'category=cli-not-found',
    canRetry: true,
    normalizedMessage: 'missing',
  };
  (manager as any).cachedData = cached;
  vi.spyOn((manager as any).stateReader, 'listChanges').mockRejectedValue(new Error('missing cli'));
  vi.spyOn((manager as any).stateReader, 'listSpecs').mockResolvedValue([]);
  vi.spyOn((manager as any).cliService, 'getCliActivationDiagnostic').mockReturnValue(diagnostic);
  vi.spyOn(manager as any, 'listChangesFromFilesystem').mockResolvedValue([]);
  (manager as any).cliAvailable = true;

  await expect(manager.refresh()).resolves.toBe(cached);
  expect(manager.getCliDiagnostic()).toEqual(diagnostic);
  expect((manager as any).listChangesFromFilesystem).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
rtk zsh -c 'source ~/.zshrc && pnpm vitest run test/extension/services/dataManager.test.ts'
```

Expected: FAIL because `getCliDiagnostic()` does not exist.

- [ ] **Step 3: Implement DataManager diagnostic storage**

In `src/extension/services/dataManager.ts` import the type:

```ts
import type { CliActivationDiagnostic } from './cliActivationDiagnostic';
```

Add a field and getter:

```ts
private cliDiagnostic: CliActivationDiagnostic | null = null;

getCliDiagnostic(): CliActivationDiagnostic | null {
  return this.cliDiagnostic;
}
```

Update `initialize()`:

```ts
this.cliAvailable = await this.cliService.checkAvailability(false);
this.cliDiagnostic = this.cliService.getCliActivationDiagnostic();
```

Update `runRefresh()` success path before returning data:

```ts
this.cliDiagnostic = null;
```

Update `runRefresh()` catch path so CLI activation diagnostics are not masked by filesystem fallback:

```ts
const diagnostic = this.cliService.getCliActivationDiagnostic();
if (diagnostic) {
  this.cliDiagnostic = diagnostic;
  if (this.cachedData) {
    this.notifyRefresh(this.cachedData);
    return this.cachedData;
  }
}
throw error;
```

Update `listChangesWithFallback()` so activation diagnostics bypass filesystem fallback:

```ts
private async listChangesWithFallback(): Promise<ChangeInfo[]> {
  if (!this.cliAvailable) {
    const diagnostic = this.cliService.getCliActivationDiagnostic();
    if (diagnostic) {
      this.cliDiagnostic = diagnostic;
      throw new Error(diagnostic.message);
    }
    return await this.listChangesFromFilesystem();
  }

  try {
    return await this.stateReader.listChanges();
  } catch (error) {
    const diagnostic = this.cliService.getCliActivationDiagnostic();
    if (diagnostic) {
      this.cliDiagnostic = diagnostic;
      throw error;
    }
    logger.warn('CLI change listing failed; falling back to filesystem scan', error as Error);
    this.cliAvailable = false;
    return await this.listChangesFromFilesystem();
  }
}
```

- [ ] **Step 4: Extend message types**

In `src/webview/types/messages.ts`, add:

```ts
export interface CliActivationDiagnosticView {
  category: string;
  message: string;
  recoveryActions: string[];
  safeDetails: string[];
  copyText: string;
  canRetry: boolean;
  normalizedMessage: string;
}
```

Add to `ExtensionMessage`:

```ts
| { type: 'cliActivationDiagnostic'; diagnostic: CliActivationDiagnosticView; mode: 'blocking' | 'warning' }
```

Add to `WebviewMessage`:

```ts
| { type: 'retryCliDetection' }
| { type: 'openCliPathSettings' }
| { type: 'copyCliDiagnostic' }
| { type: 'openCliInstallDocs' }
```

Add send helpers:

```ts
retryCliDetection: (): WebviewMessage => ({ type: 'retryCliDetection' }),
openCliPathSettings: (): WebviewMessage => ({ type: 'openCliPathSettings' }),
copyCliDiagnostic: (): WebviewMessage => ({ type: 'copyCliDiagnostic' }),
openCliInstallDocs: (): WebviewMessage => ({ type: 'openCliInstallDocs' }),
```

- [ ] **Step 5: Write failing provider tests**

Add to `test/extension/providers/dashboardViewProvider.test.ts`:

```ts
it('posts cli activation diagnostic when initial data fails without cached data', async () => {
  vi.useFakeTimers();
  const diagnostic = {
    category: 'cli-not-found',
    message: 'OpenSpec CLI unavailable',
    recoveryActions: ['open-docs', 'open-settings', 'retry', 'copy-diagnostics'],
    safeDetails: ['extension host PATH: failed ENOENT'],
    copyText: 'category=cli-not-found',
    canRetry: true,
    normalizedMessage: 'openspec cli unavailable',
  };
  const dataManager = {
    onRefresh: vi.fn(() => ({ dispose: vi.fn() })),
    getDashboardData: vi.fn().mockRejectedValue(new Error('OpenSpec CLI unavailable')),
    getCliDiagnostic: vi.fn().mockReturnValue(diagnostic),
  };
  const webview = {
    options: undefined,
    html: '',
    cspSource: 'vscode-resource',
    asWebviewUri: vi.fn((uri) => `vscode-resource:${uri.fsPath}`),
    postMessage: vi.fn(),
    onDidReceiveMessage: vi.fn(),
  };
  const webviewView = { webview, onDidDispose: vi.fn(), show: vi.fn() };

  const provider = new DashboardViewProvider(dataManager as any, '/ext');
  provider.resolveWebviewView(webviewView as any, {} as any, {} as any);
  await vi.runAllTimersAsync();

  expect(webview.postMessage).toHaveBeenCalledWith({
    type: 'cliActivationDiagnostic',
    diagnostic,
    mode: 'blocking',
  });
});
```

- [ ] **Step 6: Implement provider posting and recovery handlers**

In `DashboardViewProvider.postInitialDashboardData()` catch block:

```ts
const diagnostic = this.dataManager.getCliDiagnostic?.();
if (diagnostic) {
  targetWebview.postMessage({
    type: 'cliActivationDiagnostic',
    diagnostic,
    mode: 'blocking',
  });
  return;
}
targetWebview.postMessage({
  type: 'error',
  message: (err as Error).message || 'Failed to load dashboard data',
});
```

In `postDashboardData()`, after posting data:

```ts
const diagnostic = this.dataManager.getCliDiagnostic?.();
if (diagnostic) {
  this._view.webview.postMessage({
    type: 'cliActivationDiagnostic',
    diagnostic,
    mode: 'warning',
  });
}
```

In `handleMessage()` add cases:

```ts
if (message.type === 'openCliPathSettings') {
  await vscode.commands.executeCommand('workbench.action.openSettings', 'openspec.cliPath');
  return;
}
if (message.type === 'openCliInstallDocs') {
  await vscode.env.openExternal(vscode.Uri.parse('https://github.com/Fission-AI/OpenSpec#quick-start'));
  return;
}
if (message.type === 'copyCliDiagnostic') {
  const diagnostic = this.dataManager.getCliDiagnostic?.();
  if (diagnostic) await vscode.env.clipboard.writeText(diagnostic.copyText);
  return;
}
if (message.type === 'retryCliDetection') {
  const data = await this.dataManager.refresh();
  webview.postMessage({ type: 'dashboardData', data });
  return;
}
```

If TypeScript complains about `vscode.env.clipboard`, add it to test mocks and rely on VS Code API runtime support already used elsewhere.

- [ ] **Step 7: Run focused tests**

Run:

```bash
rtk zsh -c 'source ~/.zshrc && pnpm vitest run test/extension/services/dataManager.test.ts test/extension/providers/dashboardViewProvider.test.ts test/extension/providers/webviewMessageHandler.test.ts'
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
rtk git add src/extension/services/dataManager.ts src/webview/types/messages.ts src/extension/providers/dashboardViewProvider.ts src/extension/providers/webviewMessageHandler.ts test/extension/services/dataManager.test.ts test/extension/providers/dashboardViewProvider.test.ts test/extension/providers/webviewMessageHandler.test.ts
rtk git commit -m "feat: route cli diagnostics to dashboard webview"
```

## Task 4: Dashboard Diagnostic UI

**Files:**
- Create: `src/webview/components/CliActivationDiagnosticCard.tsx`
- Create: `test/webview/components/cliActivationDiagnostic.test.tsx`
- Create: `test/webview/components/dashboard.test.tsx`
- Modify: `src/webview/components/Dashboard.tsx`
- Modify: `src/webview/context/AppContext.tsx`

- [ ] **Step 1: Write failing diagnostic card tests**

Create `test/webview/components/cliActivationDiagnostic.test.tsx`:

```tsx
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { CliActivationDiagnosticCard } from '../../../src/webview/components/CliActivationDiagnosticCard';

const diagnostic = {
  category: 'cli-not-found',
  message: 'OpenSpec CLI unavailable',
  recoveryActions: ['open-docs', 'open-settings', 'retry', 'copy-diagnostics'],
  safeDetails: [
    'process.env.PATH=<redacted path list>',
    'extension host PATH: failed ENOENT',
  ],
  copyText: 'category=cli-not-found',
  canRetry: true,
  normalizedMessage: 'openspec cli unavailable',
};

describe('CliActivationDiagnosticCard', () => {
  it('renders safe details and recovery actions without raw secrets', () => {
    const html = renderToStaticMarkup(
      <CliActivationDiagnosticCard
        diagnostic={diagnostic}
        mode="blocking"
        onAction={vi.fn()}
      />
    );

    expect(html).toContain('OpenSpec CLI unavailable');
    expect(html).toContain('extension host PATH: failed ENOENT');
    expect(html).toContain('Open Docs');
    expect(html).toContain('Open Settings');
    expect(html).toContain('Retry');
    expect(html).toContain('Copy Diagnostics');
    expect(html).not.toContain('/Users/');
    expect(html).not.toContain('SECRET');
  });

  it('marks warning mode as stale data', () => {
    const html = renderToStaticMarkup(
      <CliActivationDiagnosticCard
        diagnostic={diagnostic}
        mode="warning"
        onAction={vi.fn()}
      />
    );

    expect(html).toContain('stale');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
rtk zsh -c 'source ~/.zshrc && pnpm vitest run test/webview/components/cliActivationDiagnostic.test.tsx'
```

Expected: FAIL because `CliActivationDiagnosticCard` does not exist.

- [ ] **Step 3: Implement the diagnostic card**

Create `src/webview/components/CliActivationDiagnosticCard.tsx`:

```tsx
import React from 'react';
import type { CliActivationDiagnosticView } from '../types/messages';
import { t } from '../../i18n';

type Mode = 'blocking' | 'warning';

interface Props {
  diagnostic: CliActivationDiagnosticView;
  mode: Mode;
  onAction: (action: string) => void;
}

const ACTION_LABELS: Record<string, string> = {
  'open-settings': 'cliDiagnostic.actionOpenSettings',
  retry: 'cliDiagnostic.actionRetry',
  'copy-diagnostics': 'cliDiagnostic.actionCopyDiagnostics',
  'open-docs': 'cliDiagnostic.actionOpenDocs',
};

export const CliActivationDiagnosticCard: React.FC<Props> = ({ diagnostic, mode, onAction }) => {
  const isWarning = mode === 'warning';
  return (
    <section
      className="mb-4 rounded border p-3 text-xs"
      style={{
        borderColor: isWarning
          ? 'var(--vscode-inputValidation-warningBorder, var(--vscode-panel-border))'
          : 'var(--vscode-inputValidation-errorBorder, var(--vscode-panel-border))',
        background: isWarning
          ? 'var(--vscode-inputValidation-warningBackground)'
          : 'var(--vscode-inputValidation-errorBackground)',
        color: isWarning
          ? 'var(--vscode-foreground)'
          : 'var(--vscode-errorForeground)',
      }}
    >
      <div className="font-semibold mb-1">{diagnostic.message}</div>
      {isWarning && (
        <div className="mb-2" style={{ color: 'var(--vscode-descriptionForeground)' }}>
          {t('cliDiagnostic.staleWarning')}
        </div>
      )}
      {diagnostic.safeDetails.length > 0 && (
        <ul className="m-0 mb-3 pl-4">
          {diagnostic.safeDetails.map((detail) => (
            <li key={detail}>{detail}</li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap gap-2">
        {diagnostic.recoveryActions.map((action) => (
          <button
            key={action}
            type="button"
            className="px-2 py-1 rounded text-xs cursor-pointer"
            style={{
              background: 'var(--vscode-button-secondaryBackground)',
              color: 'var(--vscode-button-secondaryForeground)',
              border: 'none',
            }}
            onClick={() => onAction(action)}
          >
            {t(ACTION_LABELS[action] ?? action)}
          </button>
        ))}
      </div>
    </section>
  );
};
```

- [ ] **Step 4: Add Dashboard state and message handling**

Modify `src/webview/context/AppContext.tsx`:

```ts
import type { CliActivationDiagnosticView } from '../types/messages';

export interface AppState {
  data: DashboardData | null;
  loading: boolean;
  error: string | null;
  selectedChange: string | null;
  debug: boolean;
  cliDiagnostic: { diagnostic: CliActivationDiagnosticView; mode: 'blocking' | 'warning' } | null;
}
```

Add initial state:

```ts
cliDiagnostic: null,
```

Add action:

```ts
| { type: 'SET_CLI_DIAGNOSTIC'; payload: { diagnostic: CliActivationDiagnosticView; mode: 'blocking' | 'warning' } | null }
```

Add reducer case:

```ts
case 'SET_CLI_DIAGNOSTIC':
  return { ...state, cliDiagnostic: action.payload, loading: false };
```

In `SET_DATA`, clear diagnostic:

```ts
cliDiagnostic: null,
```

Modify `src/webview/components/Dashboard.tsx` imports:

```ts
import { CliActivationDiagnosticCard } from './CliActivationDiagnosticCard';
```

In message listener:

```ts
} else if (message.type === 'cliActivationDiagnostic') {
  dispatch({
    type: 'SET_CLI_DIAGNOSTIC',
    payload: { diagnostic: message.diagnostic, mode: message.mode },
  });
}
```

Add action handler:

```ts
const handleCliDiagnosticAction = (action: string) => {
  if (action === 'open-settings') postMessage(sendMessage.openCliPathSettings());
  if (action === 'retry') postMessage(sendMessage.retryCliDetection());
  if (action === 'copy-diagnostics') postMessage(sendMessage.copyCliDiagnostic());
  if (action === 'open-docs') postMessage(sendMessage.openCliInstallDocs());
};
```

Render before normal content:

```tsx
{state.cliDiagnostic && (
  <CliActivationDiagnosticCard
    diagnostic={state.cliDiagnostic.diagnostic}
    mode={state.cliDiagnostic.mode}
    onAction={handleCliDiagnosticAction}
  />
)}
```

Update the no-data branch so blocking diagnostic wins over `dashboard.loadFailed`.

- [ ] **Step 5: Write Dashboard tests for blocking and warning states**

Create `test/webview/components/dashboard.test.tsx`. Vitest currently runs in `node`, so use `renderToStaticMarkup` and a test-only `initialState` prop on `AppProvider` instead of browser DOM click simulation:

```tsx
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { AppProvider } from '../../../src/webview/context/AppContext';
import { Dashboard } from '../../../src/webview/components/Dashboard';

vi.mock('../../../src/webview/hooks/useVscode', () => ({
  useVscode: () => ({
    postMessage: vi.fn(),
    onMessage: vi.fn(() => vi.fn()),
  }),
}));

const diagnostic = {
  category: 'cli-not-found',
  message: 'OpenSpec CLI unavailable',
  recoveryActions: ['open-docs', 'open-settings', 'retry', 'copy-diagnostics'],
  safeDetails: ['extension host PATH: failed ENOENT'],
  copyText: 'category=cli-not-found',
  canRetry: true,
  normalizedMessage: 'openspec cli unavailable',
};

describe('Dashboard CLI diagnostic states', () => {
  it('renders a blocking diagnostic instead of the generic load failure when no data exists', () => {
    const html = renderToStaticMarkup(
      <AppProvider
        initialState={{
          data: null,
          loading: false,
          error: null,
          selectedChange: null,
          debug: false,
          cliDiagnostic: { diagnostic, mode: 'blocking' },
        }}
      >
        <Dashboard />
      </AppProvider>
    );

    expect(html).toContain('OpenSpec CLI unavailable');
    expect(html).toContain('extension host PATH: failed ENOENT');
    expect(html).toContain('Open Settings');
    expect(html).toContain('Copy Diagnostics');
    expect(html).not.toContain('Failed to load dashboard data');
    expect(html).not.toContain('No changes');
  });

  it('renders cached dashboard data with a stale warning diagnostic', () => {
    const html = renderToStaticMarkup(
      <AppProvider
        initialState={{
          data: {
            changes: [
              {
                name: 'cached-change',
                completedTasks: 0,
                totalTasks: 0,
                lastModified: '2026-06-14T00:00:00.000Z',
                status: 'draft',
                artifacts: [],
              },
            ],
            specs: [],
            lastRefresh: 1,
          },
          loading: false,
          error: null,
          selectedChange: null,
          debug: false,
          cliDiagnostic: { diagnostic, mode: 'warning' },
        }}
      >
        <Dashboard />
      </AppProvider>
    );

    expect(html).toContain('cached-change');
    expect(html).toContain('stale');
    expect(html).toContain('OpenSpec CLI unavailable');
  });

  it('keeps workspace initialization errors separate from CLI diagnostics', () => {
    const html = renderToStaticMarkup(
      <AppProvider
        initialState={{
          data: null,
          loading: false,
          error: 'Workspace is not initialized. Run openspec init.',
          selectedChange: null,
          debug: false,
          cliDiagnostic: null,
        }}
      >
        <Dashboard />
      </AppProvider>
    );

    expect(html).toContain('openspec init');
    expect(html).not.toContain('Copy Diagnostics');
    expect(html).not.toContain('Open Settings');
  });
});
```

To support this test, update `AppProvider` in `src/webview/context/AppContext.tsx` to accept an optional `initialState` for tests:

```tsx
export function AppProvider({
  children,
  initialState: overrideInitialState,
}: {
  children: ReactNode;
  initialState?: AppState;
}) {
  const [state, dispatch] = useReducer(appReducer, overrideInitialState ?? initialState);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}
```

- [ ] **Step 6: Run webview tests**

Run:

```bash
rtk zsh -c 'source ~/.zshrc && pnpm vitest run test/webview/components/cliActivationDiagnostic.test.tsx test/webview/components/dashboard.test.tsx'
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
rtk git add src/webview/components/CliActivationDiagnosticCard.tsx src/webview/components/Dashboard.tsx src/webview/context/AppContext.tsx test/webview/components/cliActivationDiagnostic.test.tsx test/webview/components/dashboard.test.tsx
rtk git commit -m "feat: show cli activation diagnostics in dashboard"
```

## Task 5: I18n and Documentation

**Files:**
- Modify: `src/i18n/locales/en.json`
- Modify: `src/i18n/locales/zh-cn.json`
- Modify: `test/i18n/i18n.test.ts`
- Modify: `README.md`
- Modify: `README.zh-CN.md`

- [ ] **Step 1: Add failing i18n test**

In `test/i18n/i18n.test.ts`, add required keys to the existing key coverage list or add:

```ts
it('contains cli activation diagnostic strings in all locales', async () => {
  const en = await import('../../src/i18n/locales/en.json');
  const zh = await import('../../src/i18n/locales/zh-cn.json');
  const keys = [
    'cliDiagnostic.actionOpenSettings',
    'cliDiagnostic.actionRetry',
    'cliDiagnostic.actionCopyDiagnostics',
    'cliDiagnostic.actionOpenDocs',
    'cliDiagnostic.staleWarning',
    'cli.versionUnsupported',
    'cli.copyDiagnostics',
  ];

  for (const key of keys) {
    const path = key.split('.');
    expect(path.reduce((obj: any, part) => obj?.[part], en.default)).toBeTruthy();
    expect(path.reduce((obj: any, part) => obj?.[part], zh.default)).toBeTruthy();
  }
});
```

- [ ] **Step 2: Run i18n test to verify it fails**

Run:

```bash
rtk zsh -c 'source ~/.zshrc && pnpm vitest run test/i18n/i18n.test.ts'
```

Expected: FAIL because keys are missing.

- [ ] **Step 3: Add locale keys**

In `src/i18n/locales/en.json`, add:

```json
{
  "cliDiagnostic": {
    "actionOpenSettings": "Open Settings",
    "actionRetry": "Retry",
    "actionCopyDiagnostics": "Copy Diagnostics",
    "actionOpenDocs": "Open Docs",
    "staleWarning": "Displayed data may be stale until OpenSpec CLI is available again."
  },
  "cli": {
    "copyDiagnostics": "Copy Diagnostics",
    "versionUnsupported": "OpenSpec CLI {version} is older than the supported minimum {minimum}. Please upgrade; the extension will still try to continue."
  }
}
```

Merge these keys into the existing `cli` object rather than replacing it.

In `src/i18n/locales/zh-cn.json`, add:

```json
{
  "cliDiagnostic": {
    "actionOpenSettings": "打开设置",
    "actionRetry": "重试",
    "actionCopyDiagnostics": "复制诊断",
    "actionOpenDocs": "打开文档",
    "staleWarning": "在 OpenSpec CLI 恢复可用前，当前展示的数据可能已经过期。"
  },
  "cli": {
    "copyDiagnostics": "复制诊断",
    "versionUnsupported": "OpenSpec CLI {version} 低于支持的最低版本 {minimum}。请升级；扩展仍会尝试继续运行。"
  }
}
```

- [ ] **Step 4: Update README troubleshooting**

In `README.md`, add under Troubleshooting:

```md
- **CLI diagnostics shown in Dashboard**: When OpenSpec CLI cannot be launched from the VS Code/Cursor Extension Host, the dashboard shows a diagnostic card with safe details and actions. Use **Retry** after fixing PATH or `openspec.cliPath`, **Open Settings** to set the CLI path, and **Copy Diagnostics** when reporting an issue. The copied diagnostic omits full PATH values, home directory paths, and secrets.
- **Windows `.cmd` or shim launch failures**: If the diagnostic mentions `spawn-failed` or `ENOENT`, set `openspec.cliPath` to the absolute OpenSpec executable or shim path, then click **Retry**.
```

In `README.zh-CN.md`, add:

```md
- **Dashboard 显示 CLI 诊断**：当 VS Code/Cursor Extension Host 无法启动 OpenSpec CLI 时，Dashboard 会显示诊断卡片和恢复动作。修复 PATH 或 `openspec.cliPath` 后点击 **重试**；需要手动指定路径时点击 **打开设置**；反馈问题时使用 **复制诊断**。复制内容会隐藏完整 PATH、用户目录和密钥信息。
- **Windows `.cmd` 或 shim 启动失败**：如果诊断中出现 `spawn-failed` 或 `ENOENT`，请把 `openspec.cliPath` 设置为 OpenSpec 可执行文件或 shim 的绝对路径，然后点击 **重试**。
```

- [ ] **Step 5: Run i18n and markdown smoke**

Run:

```bash
rtk zsh -c 'source ~/.zshrc && pnpm vitest run test/i18n/i18n.test.ts'
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
rtk git add src/i18n/locales/en.json src/i18n/locales/zh-cn.json test/i18n/i18n.test.ts README.md README.zh-CN.md
rtk git commit -m "docs: explain cli activation diagnostics"
```

## Task 6: Verification and OpenSpec Task Sync

**Files:**
- Modify: `openspec/changes/improve-cli-activation-diagnostics/tasks.md`
- Run-only: tests and build commands

- [ ] **Step 1: Run CLI/service focused tests**

Run:

```bash
rtk zsh -c 'source ~/.zshrc && pnpm vitest run test/extension/services/cliActivationDiagnostic.test.ts test/extension/services/openspecCliResolver.test.ts test/extension/services/openspecCli.test.ts'
```

Expected: PASS.

- [ ] **Step 2: Run DataManager/provider focused tests**

Run:

```bash
rtk zsh -c 'source ~/.zshrc && pnpm vitest run test/extension/services/dataManager.test.ts test/extension/providers/dashboardViewProvider.test.ts test/extension/providers/webviewMessageHandler.test.ts'
```

Expected: PASS.

- [ ] **Step 3: Run webview focused tests**

Run:

```bash
rtk zsh -c 'source ~/.zshrc && pnpm vitest run test/webview/components/cliActivationDiagnostic.test.tsx test/webview/components/dashboard.test.tsx'
```

Expected: PASS.

- [ ] **Step 4: Run i18n focused tests**

Run:

```bash
rtk zsh -c 'source ~/.zshrc && pnpm vitest run test/i18n/i18n.test.ts'
```

Expected: PASS.

- [ ] **Step 5: Run full test suite**

Run:

```bash
rtk zsh -c 'source ~/.zshrc && pnpm test'
```

Expected: PASS.

- [ ] **Step 6: Run build**

Run:

```bash
rtk zsh -c 'source ~/.zshrc && pnpm run build'
```

Expected: PASS for esbuild extension bundle and Vite webview bundle.

- [ ] **Step 7: Run OpenSpec strict validation**

Run:

```bash
rtk zsh -c 'source ~/.zshrc && openspec validate improve-cli-activation-diagnostics --strict'
```

Expected:

```text
Change 'improve-cli-activation-diagnostics' is valid
```

- [ ] **Step 8: Manual VS Code/Cursor smoke**

Use Extension Development Host and verify:

```text
1. Configure an invalid openspec.cliPath.
2. Open OpenSpec Dashboard.
3. Confirm blocking diagnostic card appears.
4. Confirm Open Settings opens openspec.cliPath.
5. Confirm Copy Diagnostics does not include full PATH or home directory.
6. Fix openspec.cliPath.
7. Click Retry.
8. Confirm dashboard data loads and diagnostic clears.
9. Reproduce workspace-not-initialized separately and confirm it does not show the CLI diagnostic card.
```

- [ ] **Step 9: Update OpenSpec tasks checkboxes**

After implementation and verification, update `openspec/changes/improve-cli-activation-diagnostics/tasks.md` by marking completed implementation tasks `[x]`. Do not mark manual smoke tasks done unless actually performed.

- [ ] **Step 10: Request code review subagent**

Use the available multi-agent role `openspec-apply-code-reviewer` via the subagent tool. The reviewer must not edit files. Send this exact scope:

```text
Review implementation for improve-cli-activation-diagnostics. Focus on CLI diagnostic classification, privacy of copied diagnostics, notification dedupe, Dashboard blocking/warning states, no file-system fallback, and no changes to resolver order. Report P0/P1/P2 findings with file/line references.
```

If the dedicated role is unavailable in a future session, use the repository's existing code review skill or a default subagent with the same scope, and record that fallback in the implementation notes.

- [ ] **Step 11: Commit verification updates**

```bash
rtk git add openspec/changes/improve-cli-activation-diagnostics/tasks.md
rtk git commit -m "chore: mark cli diagnostic implementation tasks"
```

## Self-Review

Spec coverage:

- `cli-not-found`, `configured-path-invalid`, `spawn-failed`, `shell-resolution-failed`, `version-check-failed`, `permission-denied`, `unknown`: covered by Tasks 1 and 2.
- Deterministic recovery actions: covered by Task 1.
- Sanitized copy diagnostics and normalized notification keys: covered by Task 1 and Task 2.
- Minimum version warning while continuing operation: covered by Task 2.
- Notification dedupe for CLI activation diagnostics only: covered by Task 2.
- DataManager latest diagnostic and no retry orchestration: covered by Task 3.
- Dedicated webview messages and recovery actions: covered by Task 3.
- Dashboard blocking failure without cached data: covered by Task 4.
- Dashboard warning with cached data and no file fallback: covered by Task 4.
- Workspace not initialized is not a CLI activation diagnostic: covered by Task 4 and Task 6 smoke.
- i18n/docs: covered by Task 5.

Placeholder scan:

- No placeholder markers or vague deferred-work phrases remain.
- Every code-changing task includes concrete file paths, code snippets, commands, and expected results.

Type consistency:

- `CliActivationDiagnostic`, `CliActivationDiagnosticCategory`, `CliActivationRecoveryAction`, and `CliActivationDiagnosticView` names are consistent across service, messages, provider, and webview tasks.
- Recovery action ids are consistently `open-settings`, `retry`, `copy-diagnostics`, and `open-docs`.
- Webview message names are consistently `cliActivationDiagnostic`, `retryCliDetection`, `openCliPathSettings`, `copyCliDiagnostic`, and `openCliInstallDocs`.
