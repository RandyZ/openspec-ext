import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as vscode from 'vscode';
import { FileWatcherService } from '@extension/services/fileWatcher';

const createdWatchers: Array<{ pattern: { base: string; pattern: string } }> = [];

vi.mock('vscode', () => ({
  workspace: {
    createFileSystemWatcher: vi.fn((pattern: { base: string; pattern: string }) => {
      createdWatchers.push({ pattern });
      return {
        onDidCreate: vi.fn(),
        onDidChange: vi.fn(),
        onDidDelete: vi.fn(),
        dispose: vi.fn(),
      };
    }),
  },
  RelativePattern: class {
    constructor(
      public readonly base: string,
      public readonly pattern: string
    ) {}
  },
}));

vi.mock('@extension/utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('FileWatcherService', () => {
  beforeEach(() => {
    createdWatchers.length = 0;
    vi.mocked(vscode.workspace.createFileSystemWatcher).mockClear();
  });

  it('watches the changes tree so archive directory moves refresh cached dashboard data', () => {
    const watcher = new FileWatcherService('/workspace');

    watcher.start(vi.fn());

    expect(createdWatchers.map(({ pattern }) => pattern.pattern)).toEqual([
      'openspec/**/*.md',
      'openspec/**/*.yaml',
      'openspec/changes/**',
    ]);
  });

  it('retargets the single watcher set to the selected Project root', () => {
    const watcher = new FileWatcherService('/workspace');
    const callback = vi.fn();

    watcher.start(callback);
    watcher.retarget('/other-project');

    expect(createdWatchers).toHaveLength(6);
    expect(createdWatchers.slice(3).map(({ pattern }) => pattern.base)).toEqual([
      '/other-project',
      '/other-project',
      '/other-project',
    ]);
  });
});
