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

  it('does not fail initialization when CLI resolution fails and stores a configured-path-invalid diagnostic', async () => {
    const manager = new DataManager(tmpRoot);

    await expect(manager.initialize()).resolves.toBeUndefined();
    const diagnostic = manager.getCliDiagnostic();

    expect(diagnostic).not.toBeNull();
    expect(diagnostic?.category).toBe('configured-path-invalid');
    await expect(manager.getDashboardData()).rejects.toThrow(/Configured OpenSpec CLI path is invalid/);

    manager.dispose();
  }, 10000);

  it('filesystem fallback enriches conservative lifecycleStatus and changeStatusCounts', async () => {
    await fs.promises.mkdir(path.join(tmpRoot, 'openspec', 'changes', 'archive', '2026-01-01-archived'), {
      recursive: true,
    });

    const manager = new DataManager(tmpRoot);
    Object.assign(manager as any, {
      cliAvailable: false,
      cliDiagnostic: null,
    });
    (manager as any).cliService.getCliActivationDiagnostic = vi.fn().mockReturnValue(null);

    const data = await manager.refresh();

    expect(data.changes).toHaveLength(1);
    expect(data.changes[0].name).toBe('demo-change');
    expect(data.changes[0].lifecycleStatus).toBeDefined();
    expect(data.changes[0].lifecycleStatus).toBe('planning'); // incomplete known artifacts → conservative
    expect(data.changeStatusCounts.all).toBe(data.changes.length + data.archivedChanges.length);
    expect(data.changeStatusCounts.archived).toBe(1);
    expect(data.changeStatusCounts.planning).toBe(1);
    expect(data.archivedChanges.some((a) => a.name === 'archived')).toBe(true);

    manager.dispose();
  }, 10000);
});
