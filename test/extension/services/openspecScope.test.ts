import { describe, expect, it, vi } from 'vitest';
import {
  createLocalScope,
  createStoreScope,
  OpenSpecScopeManager,
} from '@extension/services/openspecScope';

const defaultCapabilities = { stores: false, context: false, doctor: false, worksets: false, diagnostics: [] };

describe('OpenSpec scope factories', () => {
  it('creates a local root scope with default runtimeSource', () => {
    expect(createLocalScope('/workspace', defaultCapabilities)).toMatchObject({
      id: 'local:/workspace',
      label: 'Local Root',
      rootPath: '/workspace',
      source: 'local',
      runtimeSource: 'installed',
    });
  });

  it('creates a local root scope with the provided runtimeSource', () => {
    expect(createLocalScope('/workspace', defaultCapabilities, 'localSource')).toMatchObject({
      runtimeSource: 'localSource',
    });
  });

  it('creates a store scope', () => {
    expect(
      createStoreScope(
        { id: 'team-plans', root: '/stores/team-plans' },
        { stores: true, context: true, doctor: true, worksets: true, diagnostics: [] },
      ),
    ).toMatchObject({
      id: 'store:team-plans',
      label: 'team-plans',
      rootPath: '/stores/team-plans',
      source: 'store',
      storeId: 'team-plans',
      runtimeSource: 'installed',
    });
  });
});

describe('OpenSpecScopeManager', () => {
  const capabilities = {
    stores: true,
    context: true,
    doctor: true,
    worksets: true,
    diagnostics: [],
  };

  it('defaults to local root scope', () => {
    const manager = new OpenSpecScopeManager(
      '/workspace',
      { runJson: vi.fn() },
      capabilities,
    );
    const scope = manager.getSelectedScope();
    expect(scope.id).toBe('local:/workspace');
    expect(scope.source).toBe('local');
  });

  it('loads local and store scope options', async () => {
    const cli = {
      runJson: vi.fn().mockResolvedValue({
        stores: [{ id: 'team-plans', root: '/stores/team-plans' }],
        status: [],
      }),
    };
    const manager = new OpenSpecScopeManager('/workspace', cli, capabilities);

    await expect(manager.loadScopeOptions()).resolves.toEqual([
      expect.objectContaining({ id: 'local:/workspace' }),
      expect.objectContaining({ id: 'store:team-plans' }),
    ]);
  });

  it('selectScope notifies listeners', () => {
    const manager = new OpenSpecScopeManager(
      '/workspace',
      { runJson: vi.fn() },
      capabilities,
    );
    const listener = vi.fn();
    manager.onDidChangeScope(listener);

    manager.selectScope('store:team-plans');
    expect(listener).toHaveBeenCalledTimes(1);

    // Selecting the same scope does not fire again
    manager.selectScope('store:team-plans');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('getSelectedScope returns the selected scope after loading options', async () => {
    const cli = {
      runJson: vi.fn().mockResolvedValue({
        stores: [{ id: 'team-plans', root: '/stores/team-plans' }],
        status: [],
      }),
    };
    const manager = new OpenSpecScopeManager('/workspace', cli, capabilities);

    await manager.loadScopeOptions();
    manager.selectScope('store:team-plans');

    const scope = manager.getSelectedScope();
    expect(scope.id).toBe('store:team-plans');
    expect(scope.rootPath).toBe('/stores/team-plans');
  });

  it('passes the resolved runtime source to scope options', async () => {
    const cli = {
      runJson: vi.fn().mockResolvedValue({
        stores: [{ id: 'team-plans', root: '/stores/team-plans' }],
        status: [],
      }),
    };
    const runtime = { resolveRuntime: vi.fn().mockResolvedValue({ source: 'localSource' }) };
    const manager = new OpenSpecScopeManager('/workspace', cli, capabilities, runtime);

    const scopes = await manager.loadScopeOptions();

    expect(scopes.every((s) => s.runtimeSource === 'localSource')).toBe(true);
    const selected = manager.getSelectedScope();
    expect(selected.runtimeSource).toBe('localSource');
  });

  it('keeps installed runtimeSource when resolver is unavailable', async () => {
    const cli = { runJson: vi.fn().mockResolvedValue({ stores: [], status: [] }) };
    // No runtime injected (4th arg) — should default to 'installed'.
    const manager = new OpenSpecScopeManager('/workspace', cli, capabilities);

    await manager.loadScopeOptions();

    expect(manager.getSelectedScope().runtimeSource).toBe('installed');
  });
});
