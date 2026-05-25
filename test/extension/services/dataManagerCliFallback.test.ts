import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DataManager } from '@extension/services/dataManager';
import * as vscode from 'vscode';

let cliPath = '';
let tmpRoot = '';

vi.mock('vscode', () => {
  class Disposable {
    constructor(private fn?: () => void) {}
    dispose() {
      this.fn?.();
    }
  }
  return {
    Disposable,
    RelativePattern: class RelativePattern {
      constructor(public base: string, public pattern: string) {}
    },
    Uri: {
      parse: (value: string) => ({ toString: () => value }),
    },
    workspace: {
      getConfiguration: vi.fn(() => ({
        get: vi.fn((key: string) => (key === 'cliPath' ? cliPath : undefined)),
      })),
      createFileSystemWatcher: vi.fn(() => ({
        onDidCreate: vi.fn(),
        onDidChange: vi.fn(),
        onDidDelete: vi.fn(),
        dispose: vi.fn(),
      })),
    },
    window: {
      showErrorMessage: vi.fn(() => Promise.resolve(undefined)),
      showInformationMessage: vi.fn(() => Promise.resolve(undefined)),
    },
    env: {
      openExternal: vi.fn(),
    },
    commands: {
      executeCommand: vi.fn(),
    },
  };
});

vi.mock('@extension/utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('DataManager CLI fallback', () => {
  beforeEach(async () => {
    tmpRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'openspec-ext-'));
    cliPath = path.join(tmpRoot, 'missing-openspec');
    await fs.promises.mkdir(path.join(tmpRoot, 'openspec', 'changes', 'demo-change', 'specs', 'demo-spec'), {
      recursive: true,
    });
    await fs.promises.mkdir(path.join(tmpRoot, 'openspec', 'specs', 'dashboard'), {
      recursive: true,
    });
    await fs.promises.writeFile(
      path.join(tmpRoot, 'openspec', 'changes', 'demo-change', 'proposal.md'),
      '## Why\nFallback proposal\n',
      'utf8'
    );
    await fs.promises.writeFile(
      path.join(tmpRoot, 'openspec', 'changes', 'demo-change', 'tasks.md'),
      '- [x] Done\n- [ ] Todo\n',
      'utf8'
    );
    await fs.promises.writeFile(
      path.join(tmpRoot, 'openspec', 'changes', 'demo-change', 'specs', 'demo-spec', 'spec.md'),
      '### Requirement: Demo\n',
      'utf8'
    );
    await fs.promises.writeFile(
      path.join(tmpRoot, 'openspec', 'specs', 'dashboard', 'spec.md'),
      '### Requirement: Dashboard\n',
      'utf8'
    );
  });

  afterEach(async () => {
    if (tmpRoot) {
      await fs.promises.rm(tmpRoot, { recursive: true, force: true });
    }
  });

  it('does not fail initialization when CLI resolution fails and lists dashboard data from files', async () => {
    const manager = new DataManager(tmpRoot);

    await expect(manager.initialize()).resolves.toBeUndefined();
    const data = await manager.getDashboardData();

    expect(vscode.window.showErrorMessage).not.toHaveBeenCalled();
    expect(data.changes).toHaveLength(1);
    expect(data.changes[0]).toMatchObject({
      name: 'demo-change',
      completedTasks: 1,
      totalTasks: 2,
      status: 'in-progress',
    });
    expect(data.changes[0].artifacts?.map((artifact) => artifact.id).sort()).toEqual([
      'proposal',
      'specs',
      'tasks',
    ]);
    expect(data.specs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'dashboard', requirementCount: 1 }),
        expect.objectContaining({ id: 'demo-change / demo-spec', requirementCount: 1 }),
      ])
    );

    manager.dispose();
  }, 10000);
});
