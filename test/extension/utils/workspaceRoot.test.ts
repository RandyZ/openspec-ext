import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@extension/utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

// vscode mock is configured per-test via vscode.workspace.workspaceFolders / fs.stat below.
vi.mock('vscode', () => ({
  workspace: {
    workspaceFolders: [] as any,
    fs: {
      stat: vi.fn(),
    },
    getConfiguration: vi.fn(() => ({ get: vi.fn(() => false) })),
  },
  Uri: {
    joinPath: (base: { fsPath: string }, rel: string) => ({ fsPath: `${base.fsPath}/${rel}` }),
  },
}));

describe('getOpenSpecProjectRoots', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('discovers all workspace folders containing openspec/config.yaml and excludes folders without config', async () => {
    const { workspace } = await import('vscode');
    const { getOpenSpecProjectRoots } = await import('@extension/utils/workspaceRoot');

    // Three folders: FastGPT and Server_DotNetCore have config; Notes does not.
    workspace.workspaceFolders = [
      { uri: { fsPath: '/work/fastgpt' }, name: 'FastGPT', index: 0 },
      { uri: { fsPath: '/work/notes' }, name: 'Notes', index: 1 },
      { uri: { fsPath: '/work/server' }, name: 'Server_DotNetCore', index: 2 },
    ];
    (workspace.fs.stat as any).mockImplementation((uri: { fsPath: string }) => {
      if (uri.fsPath === '/work/fastgpt/openspec/config.yaml' || uri.fsPath === '/work/server/openspec/config.yaml') {
        return Promise.resolve({ type: 1 });
      }
      return Promise.reject(new Error('ENOENT'));
    });

    const roots = await getOpenSpecProjectRoots();

    expect(roots).toEqual([
      { path: '/work/fastgpt', label: 'FastGPT' },
      { path: '/work/server', label: 'Server_DotNetCore' },
    ]);
  });

  it('distinguishes two folders sharing the same basename via their distinct paths/labels', async () => {
    const { workspace } = await import('vscode');
    const { getOpenSpecProjectRoots } = await import('@extension/utils/workspaceRoot');

    // Two folders with the same basename under different parents — both have config.
    workspace.workspaceFolders = [
      { uri: { fsPath: '/a/app' }, name: 'app', index: 0 },
      { uri: { fsPath: '/b/app' }, name: 'app', index: 1 },
    ];
    (workspace.fs.stat as any).mockResolvedValue({ type: 1 });

    const roots = await getOpenSpecProjectRoots();

    expect(roots).toEqual([
      { path: '/a/app', label: 'app' },
      { path: '/b/app', label: 'app' },
    ]);
    // Distinct paths ensure the labels are unambiguous when rendered with path context.
    expect(new Set(roots.map((r) => r.path)).size).toBe(2);
  });

  it('returns an empty array when no workspace folder contains openspec/config.yaml', async () => {
    const { workspace } = await import('vscode');
    const { getOpenSpecProjectRoots } = await import('@extension/utils/workspaceRoot');

    workspace.workspaceFolders = [
      { uri: { fsPath: '/work/empty-a' }, name: 'empty-a', index: 0 },
      { uri: { fsPath: '/work/empty-b' }, name: 'empty-b', index: 1 },
    ];
    (workspace.fs.stat as any).mockRejectedValue(new Error('ENOENT'));

    const roots = await getOpenSpecProjectRoots();

    expect(roots).toEqual([]);
  });

  it('returns an empty array when there are no workspace folders', async () => {
    const { workspace } = await import('vscode');
    const { getOpenSpecProjectRoots } = await import('@extension/utils/workspaceRoot');

    workspace.workspaceFolders = [];

    const roots = await getOpenSpecProjectRoots();

    expect(roots).toEqual([]);
  });
});

describe('getOpenSpecWorkspaceRoot', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null for undefined or empty workspace folders', async () => {
    const { workspace } = await import('vscode');
    const { getOpenSpecWorkspaceRoot } = await import('@extension/utils/workspaceRoot');

    workspace.workspaceFolders = undefined;
    await expect(getOpenSpecWorkspaceRoot()).resolves.toBeNull();

    workspace.workspaceFolders = [];
    await expect(getOpenSpecWorkspaceRoot()).resolves.toBeNull();
  });

  it('selects the configured folder in a multi-folder workspace', async () => {
    const { workspace } = await import('vscode');
    const { getOpenSpecWorkspaceRoot } = await import('@extension/utils/workspaceRoot');
    workspace.workspaceFolders = [
      { uri: { fsPath: '/work/notes' }, name: 'Notes', index: 0 },
      { uri: { fsPath: '/work/app' }, name: 'App', index: 1 },
    ];
    (workspace.fs.stat as any).mockImplementation((uri: { fsPath: string }) =>
      uri.fsPath.startsWith('/work/app/')
        ? Promise.resolve({ type: 1 })
        : Promise.reject(new Error('ENOENT'))
    );

    await expect(getOpenSpecWorkspaceRoot()).resolves.toBe('/work/app');
  });

  it('preserves the first-folder fallback when no config exists', async () => {
    const { workspace } = await import('vscode');
    const { getOpenSpecWorkspaceRoot } = await import('@extension/utils/workspaceRoot');
    workspace.workspaceFolders = [
      { uri: { fsPath: '/work/app' }, name: 'App', index: 0 },
    ];
    (workspace.fs.stat as any).mockRejectedValue(new Error('ENOENT'));

    await expect(getOpenSpecWorkspaceRoot()).resolves.toBe('/work/app');
  });
});
