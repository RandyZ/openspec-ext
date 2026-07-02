import { describe, expect, it, vi } from 'vitest';
import { DataManager } from '@extension/services/dataManager';
import type { ArchivedChangeInfo, ChangeInfo } from '@extension/services/types';

vi.mock('vscode', () => ({
  Disposable: class {
    constructor(private readonly disposeFn: () => void) {}
    dispose(): void {
      this.disposeFn();
    }
  },
  workspace: {
    getConfiguration: vi.fn(() => ({
      get: vi.fn(() => false),
    })),
    createFileSystemWatcher: vi.fn(() => ({
      onDidCreate: vi.fn(),
      onDidChange: vi.fn(),
      onDidDelete: vi.fn(),
      dispose: vi.fn(),
    })),
  },
  window: {
    createOutputChannel: () => ({
      appendLine: vi.fn(),
      show: vi.fn(),
      dispose: vi.fn(),
    }),
    showErrorMessage: vi.fn(() => Promise.resolve()),
    showInformationMessage: vi.fn(() => Promise.resolve()),
  },
  env: {
    openExternal: vi.fn(() => Promise.resolve()),
  },
  commands: {
    executeCommand: vi.fn(() => Promise.resolve()),
  },
  Uri: {
    file: (fsPath: string) => ({ fsPath }),
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

describe('DataManager refresh cache', () => {
  it('includes archived changes in refreshed dashboard snapshots', async () => {
    const changes: ChangeInfo[] = [
      {
        name: 'active-change',
        completedTasks: 0,
        totalTasks: 1,
        lastModified: '2026-07-02T00:00:00.000Z',
        status: 'in-progress',
        artifacts: [],
      },
    ];
    const archivedChanges: ArchivedChangeInfo[] = [
      {
        directoryName: '2026-07-02-archived-change',
        name: 'archived-change',
        archiveDate: '2026-07-02',
      },
    ];

    const manager = new DataManager('/workspace') as any;
    manager.stateReader = {
      listChanges: vi.fn().mockResolvedValue(changes),
      listSpecs: vi.fn().mockResolvedValue([]),
      listArchivedChanges: vi.fn().mockResolvedValue(archivedChanges),
    };
    manager.contentAccess = {
      readArtifact: vi.fn().mockResolvedValue('# Proposal\n\n## Why\nKeep the dashboard fresh.'),
    };

    const onRefresh = vi.fn();
    manager.onRefresh(onRefresh);

    const data = await manager.refresh();

    expect(data.archivedChanges).toEqual(archivedChanges);
    expect(onRefresh).toHaveBeenCalledWith(
      expect.objectContaining({
        archivedChanges,
      })
    );
  });
});
