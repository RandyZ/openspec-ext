import { describe, expect, it, vi, beforeEach } from 'vitest';
import * as vscode from 'vscode';
import { workspaceHasOpenSpecRoot } from '@extension/services/openspecRootGate';

vi.mock('vscode', () => ({
  workspace: {
    workspaceFolders: [{ uri: { fsPath: '/tmp/ws-b-empty' } }],
    fs: { stat: vi.fn() },
  },
}));

vi.mock('@extension/utils/workspaceRoot', () => ({
  getOpenSpecProjectRoots: vi.fn(async () => []),
}));

describe('openspecRootGate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns false when workspace has no OpenSpec roots', async () => {
    await expect(workspaceHasOpenSpecRoot()).resolves.toBe(false);
  });
});
