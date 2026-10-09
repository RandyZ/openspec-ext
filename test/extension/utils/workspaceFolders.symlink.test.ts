import { describe, expect, it, vi } from 'vitest';
import { mkdtemp, mkdir, symlink } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

vi.mock('vscode', () => ({
  workspace: {
    get workspaceFolders() {
      return (globalThis as { __testWorkspaceFolders?: unknown[] }).__testWorkspaceFolders ?? [];
    },
  },
}));

import { isPathInWorkspaceFolders } from '@extension/utils/workspaceFolders';

describe('isPathInWorkspaceFolders (symlink integration)', () => {
  it('accepts binding realpath when workspace folder is a symlink', async () => {
    const base = await mkdtemp(path.join(os.tmpdir(), 'openspec-wsf-'));
    const realRoot = path.join(base, 'ws2');
    await mkdir(realRoot, { recursive: true });
    const linkRoot = path.join(base, 'ws2-link');
    await symlink(realRoot, linkRoot, 'dir');

    (globalThis as { __testWorkspaceFolders?: unknown[] }).__testWorkspaceFolders = [
      { uri: { fsPath: linkRoot }, name: 'ws2-link', index: 0 },
    ];

    expect(isPathInWorkspaceFolders(realRoot)).toBe(true);
    expect(isPathInWorkspaceFolders(path.join(realRoot, 'openspec'))).toBe(true);
  });
});
