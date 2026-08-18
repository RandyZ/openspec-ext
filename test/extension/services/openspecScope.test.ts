import { describe, expect, it, vi } from 'vitest';
import {
  createLocalScope,
  createStoreScope,
  createDeclaredScope,
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

  it('creates a declared project-root scope with a distinguishing label', () => {
    expect(
      createDeclaredScope('/work/fastgpt', 'FastGPT', defaultCapabilities),
    ).toMatchObject({
      id: 'declared:/work/fastgpt',
      label: 'FastGPT',
      rootPath: '/work/fastgpt',
      source: 'declared',
      runtimeSource: 'installed',
      capabilities: defaultCapabilities,
      diagnostics: [],
    });
    // No storeId: declared scopes are local project roots, not store-backed.
    expect(createDeclaredScope('/work/fastgpt', 'FastGPT', defaultCapabilities).storeId).toBeUndefined();
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

  it('seeds a declared scope for each additional discovered project root, keeping the activation root local', async () => {
    const cli = { runJson: vi.fn().mockResolvedValue({ stores: [], status: [] }) };
    // Activation root is the first discovered project root; the rest become declared scopes.
    const projectRoots = [
      { path: '/workspace', label: 'Main' },
      { path: '/work/fastgpt', label: 'FastGPT' },
      { path: '/work/server', label: 'Server_DotNetCore' },
    ];
    const manager = new OpenSpecScopeManager('/workspace', cli, capabilities, undefined, projectRoots);

    const scopes = await manager.loadScopeOptions();

    // The activation root stays 'local'; the two additional roots are 'declared'.
    expect(scopes.map((s) => ({ source: s.source, rootPath: s.rootPath }))).toEqual([
      { source: 'local', rootPath: '/workspace' },
      { source: 'declared', rootPath: '/work/fastgpt' },
      { source: 'declared', rootPath: '/work/server' },
    ]);
    // Declared scopes carry their distinguishing labels.
    expect(scopes[1].label).toBe('FastGPT');
    expect(scopes[2].label).toBe('Server_DotNetCore');
    // The default selected scope remains the activation (local) root.
    expect(manager.getSelectedScope().id).toBe('local:/workspace');
  });
});

describe('Root-scoped archived isolation', () => {
  const capabilities = {
    stores: true,
    context: true,
    doctor: true,
    worksets: true,
    diagnostics: [],
  };

  it('keeps local and store scope identities distinct for per-root archived queries', async () => {
    const cli = {
      runJson: vi.fn().mockResolvedValue({
        stores: [{ id: 'team-plans', root: '/stores/team-plans' }],
        status: [],
      }),
    };
    const manager = new OpenSpecScopeManager('/workspace', cli, capabilities);

    await manager.loadScopeOptions();
    const localScope = manager.getSelectedScope();
    expect(localScope).toMatchObject({
      id: 'local:/workspace',
      rootPath: '/workspace',
      source: 'local',
    });

    manager.selectScope('store:team-plans');
    const storeScope = manager.getSelectedScope();
    expect(storeScope).toMatchObject({
      id: 'store:team-plans',
      rootPath: '/stores/team-plans',
      source: 'store',
      storeId: 'team-plans',
    });
    expect(storeScope.id).not.toBe(localScope.id);
    expect(storeScope.rootPath).not.toBe(localScope.rootPath);
  });

  it('returns the newly selected scope after switching between local and store roots', async () => {
    const cli = {
      runJson: vi.fn().mockResolvedValue({
        stores: [{ id: 'team-plans', root: '/stores/team-plans' }],
        status: [],
      }),
    };
    const manager = new OpenSpecScopeManager('/workspace', cli, capabilities);
    await manager.loadScopeOptions();

    manager.selectScope('store:team-plans');
    expect(manager.getSelectedScope().id).toBe('store:team-plans');

    manager.selectScope('local:/workspace');
    expect(manager.getSelectedScope()).toMatchObject({
      id: 'local:/workspace',
      rootPath: '/workspace',
      source: 'local',
    });
  });
});
