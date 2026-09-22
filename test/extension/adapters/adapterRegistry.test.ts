import { describe, expect, it, vi, beforeEach } from 'vitest';
import * as vscode from 'vscode';
import { listExecutorAdapterOptions } from '@extension/adapters/adapterRegistry';

vi.mock('vscode', () => ({
  env: { appName: 'Visual Studio Code' },
  extensions: { getExtension: vi.fn(() => undefined) },
}));

describe('adapterRegistry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('always includes VS Code Chat and Clipboard on VS Code hosts', async () => {
    const options = await listExecutorAdapterOptions();
    expect(options.map((option) => option.id)).toEqual(
      expect.arrayContaining(['vscode-chat', 'clipboard']),
    );
    expect(options.some((option) => option.id === 'vscode-chat')).toBe(true);
    expect(options[options.length - 1]?.id).toBe('clipboard');
  });
});
