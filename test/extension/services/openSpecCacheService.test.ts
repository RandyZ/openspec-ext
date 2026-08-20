import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import type * as vscode from 'vscode';
import { describe, expect, it, vi } from 'vitest';
import type { DashboardData } from '../../../src/extension/services/dataManager';
import type { OpenSpecScope as ScopeInfo } from '../../../src/extension/services/openspecScope';
import { OpenSpecCacheService } from '../../../src/extension/services/openSpecCacheService';

async function makeTempRoot(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'openspec-cache-service-'));
}

function scope(id: string, rootPath: string): ScopeInfo {
  return {
    id,
    label: id,
    rootPath,
    source: id === 'local' ? 'local' : 'store',
    runtimeSource: 'installed',
  } as ScopeInfo;
}

function dashboard(label: string, scopeInfo: ScopeInfo): DashboardData {
  return {
    changes: [
      {
        name: label,
        completedTasks: 0,
        totalTasks: 0,
        lastModified: '2026-01-01T00:00:00.000Z',
        status: 'draft',
        lifecycleStatus: 'planning',
        artifacts: [],
      },
    ],
    specs: [],
    archivedChanges: [],
    changeStatusCounts: {
      all: 1,
      planning: 1,
      readyToApply: 0,
      applying: 0,
      readyToVerify: 0,
      archived: 0,
      needsAttention: 0,
    },
    lastRefresh: 1,
    scope: scopeInfo,
    scopes: [scopeInfo],
  };
}

function storageUri(fsPath: string): vscode.Uri {
  return { fsPath } as vscode.Uri;
}

describe('OpenSpecCacheService', () => {
  it('Project cache keys isolate page, project, root, source, and Store identity', async () => {
    const tempRoot = await makeTempRoot();
    const service = new OpenSpecCacheService(storageUri(path.join(tempRoot, 'global-storage')), {
      workspaceRoot: path.join(tempRoot, 'workspace'),
      extensionVersion: '0.0.0-test',
    });

    const keys = [
      { pageKind: 'sidebar', projectId: '/projects/project-a', rootPath: '/roots/project-a', rootSource: 'nearest' },
      { pageKind: 'sidebar', projectId: '/projects/project-b', rootPath: '/roots/project-b', rootSource: 'nearest' },
      { pageKind: 'sidebar', projectId: '/projects/project-a', rootPath: '/roots/shared', rootSource: 'nearest' },
      { pageKind: 'sidebar', projectId: '/projects/project-a', rootPath: '/roots/shared', rootSource: 'store', storeId: 'team-plans' },
      { pageKind: 'sidebar', projectId: '/projects/project-a', rootPath: '/roots/shared', rootSource: 'store', storeId: 'other-store' },
      { pageKind: 'changesExplorer', projectId: '/projects/project-a', rootPath: '/roots/project-a', rootSource: 'nearest' },
    ];
    const cache = service as unknown as {
      writeProjectPage: (key: typeof keys[number], payload: string) => Promise<void>;
      readProjectPage: (key: typeof keys[number]) => Promise<{ payload: string; filePath: string } | undefined>;
    };

    await Promise.all(keys.map((key, index) => cache.writeProjectPage(key, `payload-${index}`)));
    const values = await Promise.all(keys.map((key) => cache.readProjectPage(key)));

    expect(values.map((value) => value?.payload)).toEqual(keys.map((_, index) => `payload-${index}`));
    expect(new Set(values.map((value) => value?.filePath)).size).toBe(keys.length);
  });

  it('Project cache rejects an envelope whose binding metadata does not match the key', async () => {
    const tempRoot = await makeTempRoot();
    const service = new OpenSpecCacheService(storageUri(path.join(tempRoot, 'global-storage')), {
      workspaceRoot: path.join(tempRoot, 'workspace'),
      extensionVersion: '0.0.0-test',
    });
    const key = {
      pageKind: 'sidebar' as const,
      projectId: '/projects/project-a',
      rootPath: '/roots/project-a',
      rootSource: 'nearest',
    };
    const cache = service as unknown as {
      writeProjectPage: (key: typeof key, payload: string) => Promise<void>;
      readProjectPage: (key: typeof key) => Promise<{ payload: string; filePath: string } | undefined>;
    };

    await cache.writeProjectPage(key, 'payload');
    const cached = await cache.readProjectPage(key);
    const envelope = JSON.parse(await fs.readFile(cached!.filePath, 'utf8')) as Record<string, unknown>;
    envelope.rootSource = 'store';
    await fs.writeFile(cached!.filePath, JSON.stringify(envelope), 'utf8');

    await expect(cache.readProjectPage(key)).resolves.toBeUndefined();
  });

  it('reports the workspace cache root inside extension storage', async () => {
    const tempRoot = await makeTempRoot();
    const workspaceRoot = path.join(tempRoot, 'workspace');
    const storageRoot = path.join(tempRoot, 'global-storage');
    const service = new OpenSpecCacheService(storageUri(storageRoot), {
      workspaceRoot,
      extensionVersion: '0.0.0-test',
    });

    const cacheRoot = service.getCacheRootPath();

    expect(cacheRoot.startsWith(storageRoot)).toBe(true);
    expect(path.dirname(cacheRoot)).toBe(path.join(storageRoot, 'openspec-cache', 'v1'));
    expect(cacheRoot.includes(workspaceRoot)).toBe(false);
  });

  it('stores dashboard cache under extension storage instead of the workspace root', async () => {
    const tempRoot = await makeTempRoot();
    const workspaceRoot = path.join(tempRoot, 'workspace');
    const storageRoot = path.join(tempRoot, 'global-storage');
    await fs.mkdir(workspaceRoot, { recursive: true });

    const service = new OpenSpecCacheService(storageUri(storageRoot), {
      workspaceRoot,
      extensionVersion: '0.0.0-test',
    });
    const local = scope('local', workspaceRoot);

    await service.writeDashboard(local, dashboard('cached-local', local));

    await expect(fs.stat(path.join(storageRoot, 'openspec-cache'))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(workspaceRoot, '.openspec-ext-cache'))).rejects.toThrow();
  });

  it('keeps same-named dashboard data isolated by scope', async () => {
    const tempRoot = await makeTempRoot();
    const workspaceRoot = path.join(tempRoot, 'workspace');
    const storageRoot = path.join(tempRoot, 'global-storage');
    const local = scope('local', path.join(workspaceRoot, 'root'));
    const store = scope('store:aihelp', path.join(workspaceRoot, 'store-aihelp'));
    const service = new OpenSpecCacheService(storageUri(storageRoot), {
      workspaceRoot,
      extensionVersion: '0.0.0-test',
    });

    await service.writeDashboard(local, dashboard('same-name', local));
    await service.writeDashboard(store, dashboard('same-name', store));

    const localCached = await service.readDashboard(local);
    const storeCached = await service.readDashboard(store);

    expect(localCached?.payload.scope?.rootPath).toBe(local.rootPath);
    expect(storeCached?.payload.scope?.rootPath).toBe(store.rootPath);
    expect(localCached?.metadata.scopeId).toBe('local');
    expect(storeCached?.metadata.scopeId).toBe('store:aihelp');
  });

  it('keeps artifact content isolated by scope and artifact key', async () => {
    const tempRoot = await makeTempRoot();
    const workspaceRoot = path.join(tempRoot, 'workspace');
    const storageRoot = path.join(tempRoot, 'global-storage');
    const local = scope('local', path.join(workspaceRoot, 'root'));
    const store = scope('store:aihelp', path.join(workspaceRoot, 'store-aihelp'));
    const service = new OpenSpecCacheService(storageUri(storageRoot), {
      workspaceRoot,
      extensionVersion: '0.0.0-test',
    });

    await service.writeArtifactContent({ scope: local, changeName: 'same', artifactType: 'tasks' }, 'local tasks');
    await service.writeArtifactContent({ scope: store, changeName: 'same', artifactType: 'tasks' }, 'store tasks');

    await expect(service.readArtifactContent({ scope: local, changeName: 'same', artifactType: 'tasks' }))
      .resolves.toMatchObject({ payload: 'local tasks' });
    await expect(service.readArtifactContent({ scope: store, changeName: 'same', artifactType: 'tasks' }))
      .resolves.toMatchObject({ payload: 'store tasks' });
  });

  it('ignores incompatible cache envelopes', async () => {
    const tempRoot = await makeTempRoot();
    const workspaceRoot = path.join(tempRoot, 'workspace');
    const storageRoot = path.join(tempRoot, 'global-storage');
    const service = new OpenSpecCacheService(storageUri(storageRoot), {
      workspaceRoot,
      extensionVersion: '0.0.0-test',
    });
    const local = scope('local', workspaceRoot);

    await service.writeDashboard(local, dashboard('valid', local));
    const cached = await service.readDashboard(local);
    expect(cached).toBeDefined();

    await fs.writeFile(cached!.filePath, JSON.stringify({ schemaVersion: 999 }), 'utf8');

    await expect(service.readDashboard(local)).resolves.toBeUndefined();
  });

  it('reports stats after dashboard and artifact cache writes', async () => {
    const tempRoot = await makeTempRoot();
    const workspaceRoot = path.join(tempRoot, 'workspace');
    const storageRoot = path.join(tempRoot, 'global-storage');
    const local = scope('local', workspaceRoot);
    const service = new OpenSpecCacheService(storageUri(storageRoot), {
      workspaceRoot,
      extensionVersion: '0.0.0-test',
    });

    await service.writeDashboard(local, dashboard('cached-local', local));
    await service.writeArtifactContent({ scope: local, changeName: 'change-a', artifactType: 'tasks' }, 'tasks');

    const stats = await service.getCacheStats({ force: true });

    expect(stats).toMatchObject({
      rootPath: service.getCacheRootPath(),
      fileCount: 2,
      isCalculating: false,
    });
    expect(stats.totalBytes).toBeGreaterThan(0);
    expect(stats.calculatedAt).toEqual(expect.any(Number));
  });

  it('clears only the extension cache and preserves workspace OpenSpec config', async () => {
    const tempRoot = await makeTempRoot();
    const workspaceRoot = path.join(tempRoot, 'workspace');
    const storageRoot = path.join(tempRoot, 'global-storage');
    const configPath = path.join(workspaceRoot, 'openspec', 'config.yaml');
    const local = scope('local', workspaceRoot);
    const service = new OpenSpecCacheService(storageUri(storageRoot), {
      workspaceRoot,
      extensionVersion: '0.0.0-test',
    });
    await fs.mkdir(path.dirname(configPath), { recursive: true });
    await fs.writeFile(configPath, 'version: 1\n', 'utf8');
    await service.writeDashboard(local, dashboard('cached-local', local));

    await service.clearAll();

    await expect(fs.readFile(configPath, 'utf8')).resolves.toBe('version: 1\n');
    await expect(fs.stat(path.join(workspaceRoot, 'openspec'))).resolves.toBeTruthy();
    await expect(service.getCacheStats({ force: true })).resolves.toMatchObject({
      rootPath: service.getCacheRootPath(),
      fileCount: 0,
      totalBytes: 0,
      isCalculating: false,
    });
  });

  it('reuses fresh stats until cache mutations mark them dirty', async () => {
    const tempRoot = await makeTempRoot();
    const workspaceRoot = path.join(tempRoot, 'workspace');
    const storageRoot = path.join(tempRoot, 'global-storage');
    const local = scope('local', workspaceRoot);
    const service = new OpenSpecCacheService(storageUri(storageRoot), {
      workspaceRoot,
      extensionVersion: '0.0.0-test',
    });

    await service.writeDashboard(local, dashboard('cached-local', local));

    const first = await service.getCacheStats();
    const second = await service.getCacheStats();

    expect(second).toBe(first);

    await service.writeArtifactContent({ scope: local, changeName: 'change-a', artifactType: 'tasks' }, 'tasks');

    const afterDirty = await service.getCacheStats();

    expect(afterDirty).not.toBe(first);
    expect(afterDirty.fileCount).toBe(first.fileCount + 1);
  });

  it('does not let an old in-flight stats scan overwrite stats after clear', async () => {
    const tempRoot = await makeTempRoot();
    const workspaceRoot = path.join(tempRoot, 'workspace');
    const storageRoot = path.join(tempRoot, 'global-storage');
    const local = scope('local', workspaceRoot);
    const service = new OpenSpecCacheService(storageUri(storageRoot), {
      workspaceRoot,
      extensionVersion: '0.0.0-test',
    });
    await service.writeDashboard(local, dashboard('cached-local', local));

    let resolveScan: (stats: Awaited<ReturnType<OpenSpecCacheService['getCacheStats']>>) => void;
    vi.spyOn(service as any, 'calculateCacheStats').mockImplementation(() => new Promise((resolve) => {
      resolveScan = resolve;
    }));

    const inFlight = service.getCacheStats({ force: true });
    await service.clearAll();

    resolveScan!({
      rootPath: service.getCacheRootPath(),
      totalBytes: 4096,
      fileCount: 1,
      calculatedAt: Date.now(),
      isCalculating: false,
    });
    await inFlight;

    await expect(service.getCacheStats()).resolves.toMatchObject({
      rootPath: service.getCacheRootPath(),
      totalBytes: 0,
      fileCount: 0,
      isCalculating: false,
    });
  });
});
