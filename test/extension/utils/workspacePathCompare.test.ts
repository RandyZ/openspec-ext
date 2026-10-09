import { describe, expect, it, vi } from 'vitest';
import { mkdtemp, mkdir, symlink } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { isPathUnderWorkspaceFolder, normalizePathForComparison } from '@extension/utils/workspacePathCompare';
describe('workspacePathCompare', () => {
  it('treats symlinked workspace folder and realpath binding root as the same', async () => {
    const base = await mkdtemp(path.join(os.tmpdir(), 'openspec-ws-'));
    const realRoot = path.join(base, 'ws2');
    await mkdir(realRoot, { recursive: true });
    const linkRoot = path.join(base, 'ws2-link');
    await symlink(realRoot, linkRoot, 'dir');

    const bindingRoot = normalizePathForComparison(realRoot);
    expect(isPathUnderWorkspaceFolder(linkRoot, bindingRoot)).toBe(true);
    expect(isPathUnderWorkspaceFolder(linkRoot, path.join(bindingRoot, 'openspec'))).toBe(true);
  });

  it('normalizes /tmp vs /private/tmp style paths on the same volume', async () => {
    const base = await mkdtemp(path.join(os.tmpdir(), 'openspec-private-tmp-'));
    const nested = path.join(base, 'nested');
    await mkdir(nested, { recursive: true });
    expect(
      isPathUnderWorkspaceFolder(base, nested),
    ).toBe(true);
    expect(normalizePathForComparison(base)).toBe(normalizePathForComparison(base));
  });
});
