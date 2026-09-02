import { execFile } from 'child_process';
import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { promisify } from 'util';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createProjectContext,
  ProjectDataGateway,
} from '@extension/services/projectDataGateway';
import { deriveProjectDashboardSummary } from '../../../src/webview/components/ProjectDashboard';
import { OpenSpecCliService } from '@extension/services/openspecCli';
import type {
  OpenSpecContextResult,
  OpenSpecRootBinding,
  ProjectCanonicalSpecsData,
  ProjectChangesData,
  ProjectContext,
} from '@extension/services/types';
import { ProjectDataAccessError } from '@extension/services/types';

const execFileAsync = promisify(execFile);

describe('createProjectContext', () => {
  const temporaryDirectories: string[] = [];

  afterEach(async () => {
    await Promise.all(
      temporaryDirectories.splice(0).map((directory) => fs.rm(directory, { recursive: true, force: true }))
    );
  });

  it('uses the canonical path as stable identity across labels and symlink aliases', async () => {
    const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'openspec-project-'));
    temporaryDirectories.push(temporaryDirectory);
    const projectPath = path.join(temporaryDirectory, 'project');
    const aliasPath = path.join(temporaryDirectory, 'project-alias');
    await fs.mkdir(projectPath);
    await fs.symlink(projectPath, aliasPath, 'dir');

    const first = await createProjectContext('Project', projectPath);
    const relabeled = await createProjectContext('Renamed project', projectPath);
    const aliased = await createProjectContext('Alias', aliasPath);

    expect(first).toEqual({ id: first.projectPath, label: 'Project', projectPath: first.projectPath });
    expect(relabeled).toEqual({ id: first.id, label: 'Renamed project', projectPath: first.projectPath });
    expect(aliased).toEqual({ id: first.id, label: 'Alias', projectPath: first.projectPath });
  });

  it('keeps the four project data models purpose-specific and readonly-shaped', async () => {
    const project: ProjectContext = {
      id: '/project',
      label: 'Project',
      projectPath: '/project',
    };
    const binding: OpenSpecRootBinding = {
      projectId: project.id,
      commandCwd: project.projectPath,
      rootPath: '/planning-root',
      rootSource: 'global_default',
    };
    const changes: ProjectChangesData = { project, binding, changes: [] };
    const specs: ProjectCanonicalSpecsData = { project, binding, specs: [] };

    expect(changes).toEqual({ project, binding, changes: [] });
    expect(specs).toEqual({ project, binding, specs: [] });
  });
});

describe('ProjectDataGateway.resolveBinding', () => {
  const temporaryDirectories: string[] = [];

  afterEach(async () => {
    await Promise.all(
      temporaryDirectories.splice(0).map((directory) => fs.rm(directory, { recursive: true, force: true }))
    );
  });

  async function createFixture(name: string) {
    const base = await fs.mkdtemp(path.join(os.tmpdir(), `openspec-binding-${name}-`));
    temporaryDirectories.push(base);
    const projectPath = path.join(base, 'project');
    const externalRoot = path.join(base, 'planning-root');
    await fs.mkdir(path.join(projectPath, 'openspec'), { recursive: true });
    await fs.mkdir(path.join(externalRoot, 'openspec'), { recursive: true });
    return {
      base,
      project: await createProjectContext('Project', projectPath),
      localRoot: projectPath,
      externalRoot,
    };
  }

  function context(rootPath: string, rootSource: string, storeId?: string): OpenSpecContextResult {
    return {
      root: {
        path: rootPath,
        source: rootSource,
        ...(storeId ? { store_id: storeId } : {}),
      },
    };
  }

  it('resolves local, external, and global_default roots from the project cwd', async () => {
    const fixture = await createFixture('valid');
    const calls: Array<{ cwd: string; scope: unknown }> = [];
    const gateway = new ProjectDataGateway({
      createCli: (cwd) => ({
        getContext: async (scope) => {
          calls.push({ cwd, scope });
          const source = calls.length === 1 ? 'nearest' : calls.length === 2 ? 'store' : 'global_default';
          const rootPath = calls.length === 2 ? fixture.externalRoot : fixture.localRoot;
          return context(rootPath, source);
        },
      }),
    });

    const local = await gateway.resolveBinding(fixture.project);
    const external = await gateway.resolveBinding(fixture.project);
    const globalDefault = await gateway.resolveBinding(fixture.project);

    expect(calls).toEqual([
      { cwd: fixture.project.projectPath, scope: undefined },
      { cwd: fixture.project.projectPath, scope: undefined },
      { cwd: fixture.project.projectPath, scope: undefined },
    ]);
    expect(local).toEqual({
      projectId: fixture.project.id,
      commandCwd: fixture.project.projectPath,
      rootPath: await fs.realpath(fixture.localRoot),
      rootSource: 'nearest',
    });
    expect(external).toEqual({
      projectId: fixture.project.id,
      commandCwd: fixture.project.projectPath,
      rootPath: await fs.realpath(fixture.externalRoot),
      rootSource: 'store',
    });
    expect(globalDefault).toEqual({
      projectId: fixture.project.id,
      commandCwd: fixture.project.projectPath,
      rootPath: await fs.realpath(fixture.localRoot),
      rootSource: 'global_default',
    });
    expect(local.projectId).toBe(fixture.project.id);
    expect(external.projectId).toBe(fixture.project.id);
    expect(globalDefault.projectId).toBe(fixture.project.id);
    expect(globalDefault.storeId).toBeUndefined();
  });

  it('keeps an explicit Store selector request-local and leaves sibling requests selector-free', async () => {
    const fixture = await createFixture('store');
    const calls: Array<{ cwd: string; scope: unknown }> = [];
    const gateway = new ProjectDataGateway({
      createCli: (cwd) => ({
        getContext: async (scope) => {
          calls.push({ cwd, scope });
          return context(fixture.externalRoot, scope?.storeId ? 'store' : 'nearest');
        },
      }),
    });

    const explicit = await gateway.resolveBinding(fixture.project, 'store-a');
    const selectorFree = await gateway.resolveBinding(fixture.project);

    expect(calls).toEqual([
      { cwd: fixture.project.projectPath, scope: { storeId: 'store-a' } },
      { cwd: fixture.project.projectPath, scope: undefined },
    ]);
    expect(explicit.storeId).toBe('store-a');
    expect(selectorFree.storeId).toBeUndefined();
  });

  it('retains a CLI-declared Store identity for selector-free bindings', async () => {
    const fixture = await createFixture('declared-store');
    const calls: Array<{ cwd: string; scope: unknown }> = [];
    const gateway = new ProjectDataGateway({
      createCli: (cwd) => ({
        getContext: async (scope) => {
          calls.push({ cwd, scope });
          return context(fixture.externalRoot, 'store', 'declared-store');
        },
      }),
    });

    const binding = await gateway.resolveBinding(fixture.project);

    expect(calls).toEqual([{ cwd: fixture.project.projectPath, scope: undefined }]);
    expect(binding).toMatchObject({
      projectId: fixture.project.id,
      rootPath: await fs.realpath(fixture.externalRoot),
      rootSource: 'store',
      storeId: 'declared-store',
    });
  });

  it('accepts an explicit Store selector when the CLI declares the same identity', async () => {
    const fixture = await createFixture('declared-store-explicit');
    const gateway = new ProjectDataGateway({
      createCli: () => ({
        getContext: async (scope) => context(
          fixture.externalRoot,
          'store',
          scope?.storeId === 'declared-store' ? 'declared-store' : undefined
        ),
      }),
    });

    const binding = await gateway.resolveBinding(fixture.project, 'declared-store');

    expect(binding.storeId).toBe('declared-store');
  });

  it('fails closed when an explicit Store selector is not a string', async () => {
    const fixture = await createFixture('invalid-explicit-selector');
    const getContext = vi.fn();
    const gateway = new ProjectDataGateway({
      createCli: () => ({ getContext }),
    });

    const error = await gateway.resolveBinding(
      fixture.project,
      42 as unknown as string
    ).catch((cause) => cause);

    expect(error).toBeInstanceOf(ProjectDataAccessError);
    expect(error).toMatchObject({ projectId: fixture.project.id, phase: 'resolve' });
    expect((error as ProjectDataAccessError).message).toContain('Store selector');
    expect(getContext).not.toHaveBeenCalled();
  });

  it('fails closed when an explicit Store selector conflicts with CLI root.store_id', async () => {
    const fixture = await createFixture('declared-store-conflict');
    const gateway = new ProjectDataGateway({
      createCli: () => ({
        getContext: async () => context(fixture.externalRoot, 'store', 'declared-store'),
      }),
    });

    const error = await gateway.resolveBinding(fixture.project, 'selected-store').catch((cause) => cause);

    expect(error).toBeInstanceOf(ProjectDataAccessError);
    expect(error).toMatchObject({ projectId: fixture.project.id, phase: 'resolve' });
    expect((error as ProjectDataAccessError).message).toContain('conflicts');
  });

  it('fails closed when CLI root.store_id is present but malformed', async () => {
    const fixture = await createFixture('declared-store-invalid');
    const gateway = new ProjectDataGateway({
      createCli: () => ({
        getContext: async () => ({
          root: {
            path: fixture.externalRoot,
            source: 'store',
            store_id: 42,
          },
        } as unknown as OpenSpecContextResult),
      }),
    });

    const error = await gateway.resolveBinding(fixture.project).catch((cause) => cause);

    expect(error).toBeInstanceOf(ProjectDataAccessError);
    expect(error).toMatchObject({ projectId: fixture.project.id, phase: 'resolve' });
    expect((error as ProjectDataAccessError).message).toContain('root.store_id');
  });

  it('fail closed for invalid roots before calling the content factory', async () => {
    const fixture = await createFixture('invalid');
    const missingRoot = path.join(fixture.base, 'missing-root');
    const rootWithoutOpenSpec = path.join(fixture.base, 'root-without-openspec');
    await fs.mkdir(rootWithoutOpenSpec);

    const invalidContexts: Array<{ name: string; value: unknown }> = [
      { name: 'missing root', value: {} },
      { name: 'missing source', value: { root: { path: fixture.localRoot } } },
      { name: 'relative root', value: { root: { path: 'relative-root', source: 'nearest' } } },
      { name: 'unresolvable root', value: context(missingRoot, 'nearest') },
      { name: 'missing openspec', value: context(rootWithoutOpenSpec, 'nearest') },
    ];

    for (const invalidContext of invalidContexts) {
      let contentFactoryCalls = 0;
      const gateway = new ProjectDataGateway({
        createCli: () => ({
          getContext: async () => invalidContext.value as OpenSpecContextResult,
        }),
        createContentAccess: () => {
          contentFactoryCalls += 1;
          return { listArchivedChanges: async () => [] };
        },
      });

      const error = await gateway.resolveBinding(fixture.project).catch((cause) => cause);

      expect(error, invalidContext.name).toBeInstanceOf(ProjectDataAccessError);
      expect(error, invalidContext.name).toMatchObject({
        projectId: fixture.project.id,
        phase: 'resolve',
        binding: invalidContext.name === 'missing openspec'
          ? {
              projectId: fixture.project.id,
              commandCwd: fixture.project.projectPath,
              rootPath: await fs.realpath(rootWithoutOpenSpec),
              rootSource: 'nearest',
            }
          : undefined,
      });
      expect(contentFactoryCalls, invalidContext.name).toBe(0);
    }
  });

  it('fail closed when the probe itself fails and preserves the original cause', async () => {
    const fixture = await createFixture('probe-error');
    const cause = new Error('context probe failed');
    const gateway = new ProjectDataGateway({
      createCli: () => ({
        getContext: async () => {
          throw cause;
        },
      }),
    });

    const error = await gateway.resolveBinding(fixture.project).catch((value) => value);

    expect(error).toBeInstanceOf(ProjectDataAccessError);
    expect(error).toMatchObject({ projectId: fixture.project.id, phase: 'resolve', binding: undefined });
    expect((error as ProjectDataAccessError).cause).toBe(cause);
  });

  it('fail closed when root/openspec resolves through a symlink outside the root', async () => {
    const fixture = await createFixture('symlink');
    const escapedContent = path.join(fixture.base, 'escaped-content');
    await fs.mkdir(path.join(escapedContent, 'openspec'), { recursive: true });
    await fs.rm(path.join(fixture.externalRoot, 'openspec'), { recursive: true });
    await fs.symlink(path.join(escapedContent, 'openspec'), path.join(fixture.externalRoot, 'openspec'), 'dir');

    let contentFactoryCalls = 0;
    const gateway = new ProjectDataGateway({
      createCli: () => ({
        getContext: async () => context(fixture.externalRoot, 'nearest'),
      }),
      createContentAccess: () => {
        contentFactoryCalls += 1;
        return { listArchivedChanges: async () => [] };
      },
    });

    const error = await gateway.resolveBinding(fixture.project).catch((value) => value);

    expect(error).toBeInstanceOf(ProjectDataAccessError);
    expect(error).toMatchObject({
      projectId: fixture.project.id,
      phase: 'resolve',
      binding: {
        projectId: fixture.project.id,
        commandCwd: fixture.project.projectPath,
        rootPath: await fs.realpath(fixture.externalRoot),
        rootSource: 'nearest',
      },
    });
    expect(contentFactoryCalls).toBe(0);
  });

  it('keeps concurrent Project selectors, roots, and error identities isolated', async () => {
    const a = await createFixture('concurrent-a');
    const b = await createFixture('concurrent-b');
    const gates = new Map<string, Promise<void>>();
    const releases = new Map<string, () => void>();
    for (const project of [a.project, b.project]) {
      gates.set(project.projectPath, new Promise<void>((resolve) => releases.set(project.projectPath, resolve)));
    }

    const calls: Array<{ cwd: string; scope: unknown }> = [];
    const gateway = new ProjectDataGateway({
      createCli: (cwd) => ({
        getContext: async (scope) => {
          calls.push({ cwd, scope });
          await gates.get(cwd);
          if (cwd === a.project.projectPath) return context(a.externalRoot, 'store');
          return context(b.localRoot, 'nearest');
        },
      }),
    });

    const projectA = gateway.resolveBinding(a.project, 'store-a');
    const projectB = gateway.resolveBinding(b.project);
    await new Promise((resolve) => setImmediate(resolve));
    releases.get(b.project.projectPath)!();
    const bindingB = await projectB;
    releases.get(a.project.projectPath)!();
    const bindingA = await projectA;

    expect(calls).toEqual([
      { cwd: a.project.projectPath, scope: { storeId: 'store-a' } },
      { cwd: b.project.projectPath, scope: undefined },
    ]);
    expect(bindingA).toMatchObject({
      projectId: a.project.id,
      commandCwd: a.project.projectPath,
      rootPath: await fs.realpath(a.externalRoot),
      rootSource: 'store',
      storeId: 'store-a',
    });
    expect(bindingB).toMatchObject({
      projectId: b.project.id,
      commandCwd: b.project.projectPath,
      rootPath: await fs.realpath(b.localRoot),
      rootSource: 'nearest',
    });
    expect(bindingB.storeId).toBeUndefined();
  });

  it('does not observe a changed selected scope after a request starts', async () => {
    const fixture = await createFixture('selected-scope');
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let selectedScope: { storeId: string } | undefined = { storeId: 'store-a' };
    let observedScope: { storeId?: string } | undefined;
    const gateway = new ProjectDataGateway({
      createCli: () => ({
        getContext: async (scope) => {
          observedScope = scope;
          await gate;
          return context(fixture.externalRoot, 'store');
        },
      }),
    });

    const bindingPromise = gateway.resolveBinding(fixture.project, selectedScope.storeId);
    await new Promise((resolve) => setImmediate(resolve));
    selectedScope = { storeId: 'store-b' };
    release();

    const binding = await bindingPromise;
    expect(observedScope).toEqual({ storeId: 'store-a' });
    expect(binding.storeId).toBe('store-a');
  });
});

describe('ProjectDataGateway bound readers', () => {
  const temporaryDirectories: string[] = [];

  afterEach(async () => {
    await Promise.all(
      temporaryDirectories.splice(0).map((directory) => fs.rm(directory, { recursive: true, force: true }))
    );
  });

  async function createFixture(name: string) {
    const base = await fs.mkdtemp(path.join(os.tmpdir(), `openspec-bound-${name}-`));
    temporaryDirectories.push(base);
    const projectPath = path.join(base, 'project');
    const externalRoot = path.join(base, 'planning-root');
    await fs.mkdir(path.join(projectPath, 'openspec'), { recursive: true });
    await fs.mkdir(path.join(externalRoot, 'openspec'), { recursive: true });
    return {
      project: await createProjectContext('Project', projectPath),
      localRoot: projectPath,
      externalRoot,
    };
  }

  function context(rootPath: string, rootSource: string, extra: Record<string, unknown> = {}): OpenSpecContextResult {
    return { root: { path: rootPath, source: rootSource }, ...extra };
  }

  it('creates bound readers for local and external roots', async () => {
    const fixture = await createFixture('same-binding');
    const cliCalls: Array<{ cwd: string; scope: unknown }> = [];
    const contentRoots: string[] = [];
    const gateway = new ProjectDataGateway({
      createCli: (cwd) => ({
        getContext: async (scope) => context(
          scope?.storeId ? fixture.externalRoot : fixture.localRoot,
          scope?.storeId ? 'store' : 'nearest'
        ),
        listChanges: async (scope) => {
          cliCalls.push({ cwd, scope });
          return [];
        },
        listSpecs: async () => [],
      }),
      createContentAccess: (openspecPath) => {
        contentRoots.push(openspecPath);
        return { listArchivedChanges: async () => [] };
      },
    });

    await gateway.loadChanges(fixture.project);
    await gateway.loadChanges(fixture.project, 'store-a');

    expect(cliCalls).toEqual([
      { cwd: fixture.project.projectPath, scope: undefined },
      { cwd: fixture.project.projectPath, scope: { storeId: 'store-a' } },
    ]);
    expect(contentRoots).toEqual([
      path.join(await fs.realpath(fixture.localRoot), 'openspec'),
      path.join(await fs.realpath(fixture.externalRoot), 'openspec'),
    ]);
  });

  it('enriches each Change with binding-scoped Proposal Why and search text fail-soft', async () => {
    const fixture = await createFixture('proposal-why');
    const gateway = new ProjectDataGateway({
      createCli: () => ({
        getContext: async () => context(fixture.localRoot, 'nearest'),
        listChanges: async () => [
          {
            name: 'with-why',
            status: 'in-progress',
            completedTasks: 1,
            totalTasks: 2,
            lastModified: '2026-08-20T00:00:00.000Z',
            lifecycleStatus: 'applying',
          },
          {
            name: 'unreadable-why',
            status: 'draft',
            completedTasks: 0,
            totalTasks: 0,
            lastModified: '2026-08-19T00:00:00.000Z',
            lifecycleStatus: 'planning',
          },
        ] as any,
      }),
      createContentAccess: (openspecPath) => ({
        listArchivedChanges: async () => [],
        readArtifact: async (changeName: string, artifactType: string) => {
          expect(openspecPath).toBe(path.join(await fs.realpath(fixture.localRoot), 'openspec'));
          expect(artifactType).toBe('proposal');
          if (changeName === 'unreadable-why') throw new Error('permission denied');
          return '## Why\n\n**Keep** the project-bound summary searchable.';
        },
      }),
    });

    const result = await gateway.loadChanges(fixture.project);

    expect(result.changes[0]).toMatchObject({
      name: 'with-why',
      proposalWhySummary: 'Keep the project-bound summary searchable.',
      proposalWhyFullText: 'Keep the project-bound summary searchable.',
      searchText: expect.stringContaining('project-bound summary searchable'),
    });
    expect(result.changes[1]).toMatchObject({
      name: 'unreadable-why',
      searchText: expect.stringContaining('unreadable-why'),
    });
    expect(result.changes[1].proposalWhySummary).toBeUndefined();
  });

  describe('archived changes', () => {
    it('loads archives from the resolved local and external roots', async () => {
      const fixture = await createFixture('archived-roots');
      const localArchives = [{
        directoryName: '2026-08-18-same-change',
        name: 'same-change',
        archiveDate: '2026-08-18',
      }];
      const externalArchives = [{
        directoryName: '2026-08-19-same-change',
        name: 'same-change',
        archiveDate: '2026-08-19',
      }];
      const contentRoots: string[] = [];
      const gateway = new ProjectDataGateway({
        createCli: () => ({
          getContext: async (scope) => context(
            scope?.storeId ? fixture.externalRoot : fixture.localRoot,
            scope?.storeId ? 'store' : 'nearest'
          ),
          listChanges: async () => [],
          listSpecs: async () => [],
        }),
        createContentAccess: (openspecPath) => {
          contentRoots.push(openspecPath);
          return {
            listArchivedChanges: async () => openspecPath.includes('planning-root')
              ? externalArchives
              : localArchives,
          };
        },
      });

      const local = await gateway.loadArchivedChanges(fixture.project);
      const external = await gateway.loadArchivedChanges(fixture.project, 'team-store');

      expect(local).toEqual({
        project: fixture.project,
        binding: expect.objectContaining({ rootPath: await fs.realpath(fixture.localRoot) }),
        archivedChanges: localArchives,
      });
      expect(external).toEqual({
        project: fixture.project,
        binding: expect.objectContaining({
          rootPath: await fs.realpath(fixture.externalRoot),
          storeId: 'team-store',
        }),
        archivedChanges: externalArchives,
      });
      expect(contentRoots).toEqual([
        path.join(await fs.realpath(fixture.localRoot), 'openspec'),
        path.join(await fs.realpath(fixture.externalRoot), 'openspec'),
      ]);
    });

    it('returns an empty archive as valid data', async () => {
      const fixture = await createFixture('archived-empty');
      const gateway = new ProjectDataGateway({
        createCli: () => ({
          getContext: async () => context(fixture.localRoot, 'nearest'),
          listChanges: async () => [],
          listSpecs: async () => [],
        }),
        createContentAccess: () => ({ listArchivedChanges: async () => [] }),
      });

      await expect(gateway.loadArchivedChanges(fixture.project)).resolves.toMatchObject({
        project: fixture.project,
        archivedChanges: [],
      });
    });

    it('wraps archive read failures with the resolved project binding', async () => {
      const fixture = await createFixture('archived-failure');
      const cause = new Error('archive read failed');
      const gateway = new ProjectDataGateway({
        createCli: () => ({
          getContext: async () => context(fixture.localRoot, 'nearest'),
          listChanges: async () => [],
          listSpecs: async () => [],
        }),
        createContentAccess: () => ({
          listArchivedChanges: async () => {
            throw cause;
          },
        }),
      });

      const error = await gateway.loadArchivedChanges(fixture.project).catch((value) => value);

      expect(error).toBeInstanceOf(ProjectDataAccessError);
      expect(error).toMatchObject({
        projectId: fixture.project.id,
        phase: 'archived-changes',
        binding: {
          projectId: fixture.project.id,
          rootPath: await fs.realpath(fixture.localRoot),
        },
      });
      expect((error as ProjectDataAccessError).cause).toBe(cause);
    });

    it('keeps same-named archives isolated by their project binding', async () => {
      const a = await createFixture('archived-a');
      const b = await createFixture('archived-b');
      const archive = {
        directoryName: '2026-08-19-same-change',
        name: 'same-change',
        archiveDate: '2026-08-19',
      };
      const gateway = new ProjectDataGateway({
        createCli: (cwd) => ({
          getContext: async () => context(cwd === a.project.projectPath ? a.externalRoot : b.localRoot, 'nearest'),
          listChanges: async () => [],
          listSpecs: async () => [],
        }),
        createContentAccess: () => ({ listArchivedChanges: async () => [archive] }),
      });

      const [resultA, resultB] = await Promise.all([
        gateway.loadArchivedChanges(a.project),
        gateway.loadArchivedChanges(b.project),
      ]);

      expect(resultA.archivedChanges).toEqual([archive]);
      expect(resultB.archivedChanges).toEqual([archive]);
      expect(resultA.binding.projectId).toBe(a.project.id);
      expect(resultB.binding.projectId).toBe(b.project.id);
      expect(resultA.binding.rootPath).toBe(await fs.realpath(a.externalRoot));
      expect(resultB.binding.rootPath).toBe(await fs.realpath(b.localRoot));
    });
  });

  describe('referenced Store Specs', () => {
    it('uses official context members to load only referenced Store Specs', async () => {
      const fixture = await createFixture('official-members');
      const storeRoot = fixture.externalRoot;
      const gateway = new ProjectDataGateway({
        createCli: () => ({
          getContext: async (scope) => context(
            scope?.storeId ? storeRoot : fixture.localRoot,
            scope?.storeId ? 'store' : 'nearest',
            scope?.storeId
              ? {}
              : {
                members: [
                  { role: 'referenced_store', id: 'referenced-store', path: storeRoot },
                  { role: 'registered_store', id: 'unreferenced-store' },
                ],
              }
          ),
          listChanges: async () => [],
          listSpecs: async (scope) => scope?.storeId
            ? [{ id: 'shared', requirementCount: 1 }]
            : [],
        }),
      });

      await expect(gateway.loadReferencedStoreSpecs(fixture.project)).resolves.toMatchObject({
        groups: [{
          storeId: 'referenced-store',
          binding: expect.objectContaining({ storeId: 'referenced-store' }),
          specs: [{ id: 'shared', requirementCount: 1 }],
        }],
      });
    });

    it('returns the host-resolved binding for every referenced Store group', async () => {
      const fixture = await createFixture('referenced-store-binding');
      const storeRoot = fixture.externalRoot;
      const gateway = new ProjectDataGateway({
        createCli: () => ({
          getContext: async (scope) => context(
            scope?.storeId ? storeRoot : fixture.localRoot,
            scope?.storeId ? 'store' : 'nearest',
            { references: [{ store_id: 'referenced-store' }] }
          ),
          listChanges: async () => [],
          listSpecs: async (scope) => scope?.storeId
            ? [{ id: 'shared', requirementCount: 2 }]
            : [],
        }),
      });

      const result = await gateway.loadReferencedStoreSpecs(fixture.project);

      expect(result.groups).toEqual([{
        storeId: 'referenced-store',
        binding: {
          projectId: fixture.project.id,
          commandCwd: fixture.project.projectPath,
          rootPath: await fs.realpath(storeRoot),
          rootSource: 'store',
          storeId: 'referenced-store',
        },
        specs: [{ id: 'shared', requirementCount: 2 }],
      }]);
    });

    it('loads only CLI-confirmed referenced Stores and keeps each group separate', async () => {
      const fixture = await createFixture('referenced-store');
      const listSpecsCalls: unknown[] = [];
      const gateway = new ProjectDataGateway({
        createCli: () => ({
          getContext: async () => context(fixture.localRoot, 'nearest', {
            references: [{ store_id: 'referenced-store' }],
            installedStores: [{ id: 'installed-only' }],
          }),
          listChanges: async () => [],
          listSpecs: async (scope) => {
            listSpecsCalls.push(scope);
            if (scope?.storeId === 'referenced-store') {
              return [{ id: 'store-spec', requirementCount: 2 }];
            }
            throw new Error('Project canonical Specs must use loadCanonicalSpecs');
          },
        }),
      });

      const result = await gateway.loadReferencedStoreSpecs(fixture.project);

      expect(result).toEqual({
        project: fixture.project,
        binding: expect.objectContaining({ rootPath: await fs.realpath(fixture.localRoot) }),
        groups: [{
          storeId: 'referenced-store',
          binding: expect.objectContaining({
            projectId: fixture.project.id,
            rootPath: await fs.realpath(fixture.localRoot),
            storeId: 'referenced-store',
          }),
          specs: [{ id: 'store-spec', requirementCount: 2 }],
        }],
      });
      expect(listSpecsCalls).toEqual([{ storeId: 'referenced-store' }]);
    });

    it('keeps duplicate Project and Store Spec ids in separate sources', async () => {
      const fixture = await createFixture('duplicate-spec-ids');
      const gateway = new ProjectDataGateway({
        createCli: () => ({
          getContext: async () => context(fixture.localRoot, 'nearest', {
            references: [{ store_id: 'referenced-store' }],
          }),
          listChanges: async () => [],
          listSpecs: async (scope) => scope?.storeId
            ? [{ id: 'shared', requirementCount: 2 }]
            : [{ id: 'shared', requirementCount: 1 }],
        }),
      });

      const projectSpecs = await gateway.loadCanonicalSpecs(fixture.project);
      const referencedSpecs = await gateway.loadReferencedStoreSpecs(fixture.project);

      expect(projectSpecs.specs).toEqual([{ id: 'shared', requirementCount: 1 }]);
      expect(referencedSpecs.groups).toEqual([{
        storeId: 'referenced-store',
        binding: expect.any(Object),
        specs: [{ id: 'shared', requirementCount: 2 }],
      }]);
    });

    it('keeps Project Specs and healthy Store groups when another referenced Store fails', async () => {
      const fixture = await createFixture('referenced-partial-failure');
      const rawFailure = new Error(
        'command=openspec list --specs --json cwd=/Users/private/project token=secret-token'
      );
      const gateway = new ProjectDataGateway({
        createCli: () => ({
          getContext: async () => context(fixture.localRoot, 'nearest', {
            references: [{ store_id: 'store-a' }, { store_id: 'store-b' }],
          }),
          listChanges: async () => [],
          listSpecs: async (scope) => {
            if (!scope?.storeId) return [{ id: 'project-spec', requirementCount: 1 }];
            if (scope.storeId === 'store-a') return [{ id: 'store-a-spec', requirementCount: 2 }];
            throw rawFailure;
          },
        }),
      });

      const [projectSpecs, referencedStoreSpecs] = await Promise.all([
        gateway.loadCanonicalSpecs(fixture.project),
        gateway.loadReferencedStoreSpecs(fixture.project),
      ]);

      expect(projectSpecs.specs).toEqual([{ id: 'project-spec', requirementCount: 1 }]);
      expect(referencedStoreSpecs.groups).toEqual([
        { storeId: 'store-a', binding: expect.any(Object), specs: [{ id: 'store-a-spec', requirementCount: 2 }] },
        { storeId: 'store-b', binding: expect.any(Object), specs: [], error: expect.any(String) },
      ]);
      expect(referencedStoreSpecs.groups[1].error).toContain('store-b');
      expect(referencedStoreSpecs.groups[1].error).not.toContain('openspec list');
      expect(referencedStoreSpecs.groups[1].error).not.toContain('/Users/private/project');
      expect(referencedStoreSpecs.groups[1].error).not.toContain('secret-token');
    });

    it('returns an explicit empty group for a referenced Store with no Specs', async () => {
      const fixture = await createFixture('referenced-empty');
      const gateway = new ProjectDataGateway({
        createCli: () => ({
          getContext: async () => context(fixture.localRoot, 'nearest', {
            references: [{ store_id: 'empty-store' }],
          }),
          listChanges: async () => [],
          listSpecs: async () => [],
        }),
      });

      await expect(gateway.loadReferencedStoreSpecs(fixture.project)).resolves.toMatchObject({
        groups: [{ storeId: 'empty-store', binding: expect.any(Object), specs: [] }],
      });
    });

    it('fails closed for malformed CLI reference entries', async () => {
      const fixture = await createFixture('referenced-malformed');
      let listSpecsCalls = 0;
      const gateway = new ProjectDataGateway({
        createCli: () => ({
          getContext: async () => context(fixture.localRoot, 'nearest', {
            references: [{ id: 'not-a-store-id' }],
          }),
          listChanges: async () => [],
          listSpecs: async () => {
            listSpecsCalls += 1;
            return [];
          },
        }),
      });

      const error = await gateway.loadReferencedStoreSpecs(fixture.project).catch((value) => value);

      expect(error).toBeInstanceOf(ProjectDataAccessError);
      expect(error).toMatchObject({
        projectId: fixture.project.id,
        phase: 'referenced-store-specs',
        binding: { projectId: fixture.project.id },
      });
      expect(listSpecsCalls).toBe(0);
    });

    it('returns a safe error group for a referenced Store CLI failure', async () => {
      const fixture = await createFixture('referenced-failure');
      const cause = new Error('referenced Store listSpecs failed');
      const gateway = new ProjectDataGateway({
        createCli: () => ({
          getContext: async () => context(fixture.localRoot, 'nearest', {
            references: [{ store_id: 'broken-store' }],
          }),
          listChanges: async () => [],
          listSpecs: async () => {
            throw cause;
          },
        }),
      });

      const result = await gateway.loadReferencedStoreSpecs(fixture.project);

      expect(result.groups).toEqual([{
        storeId: 'broken-store',
        binding: expect.any(Object),
        specs: [],
        error: 'Unable to load Specs for referenced Store "broken-store".',
      }]);
      expect(result.groups[0].error).not.toContain(cause.message);
    });

  it('keeps a Store capability failure isolated to its referenced group', async () => {
      const fixture = await createFixture('referenced-cli-capability-failure');
      const gateway = new ProjectDataGateway({
        createCli: () => ({
          getContext: async () => context(fixture.localRoot, 'nearest', {
            references: [{ store_id: 'referenced-store' }],
          }),
          listChanges: async () => [],
        }),
      });

    await expect(gateway.loadReferencedStoreSpecs(fixture.project)).resolves.toMatchObject({
      groups: [{
        storeId: 'referenced-store',
        binding: expect.any(Object),
        specs: [],
        error: expect.stringContaining('referenced-store'),
      }],
    });
  });
  });

  it('fails before constructing bound readers for an invalid root', async () => {
    const fixture = await createFixture('invalid-binding');
    const missingRoot = path.join(path.dirname(fixture.externalRoot), 'missing-root');
    let cliFactoryCalls = 0;
    let contentFactoryCalls = 0;
    const gateway = new ProjectDataGateway({
      createCli: () => {
        cliFactoryCalls += 1;
        return {
          getContext: async () => context(missingRoot, 'nearest'),
          listChanges: async () => [],
          listSpecs: async () => [],
        };
      },
      createContentAccess: () => {
        contentFactoryCalls += 1;
        return { listArchivedChanges: async () => [] };
      },
    });

    const error = await gateway.loadChanges(fixture.project).catch((cause) => cause);

    expect(error).toBeInstanceOf(ProjectDataAccessError);
    expect(error).toMatchObject({ projectId: fixture.project.id, phase: 'changes' });
    expect(cliFactoryCalls).toBe(1);
    expect(contentFactoryCalls).toBe(0);
  });

  it('returns enriched changes in a purpose-specific DTO', async () => {
    const fixture = await createFixture('changes-success');
    const changes = [{ name: 'change-a', attention: { required: false } }] as any;
    const binding = {
      projectId: fixture.project.id,
      commandCwd: fixture.project.projectPath,
      rootPath: await fs.realpath(fixture.localRoot),
      rootSource: 'nearest',
    };
    const gateway = new ProjectDataGateway({
      createCli: () => ({
        getContext: async () => context(fixture.localRoot, 'nearest'),
        listChanges: async () => changes,
        listSpecs: async () => [],
      }),
    });

    const result = await gateway.loadChanges(fixture.project);

    expect(result).toEqual({
      project: fixture.project,
      binding,
      changes: [{ ...changes[0], searchText: 'change-a' }],
    });
    expect(Object.keys(result)).toEqual(['project', 'binding', 'changes']);
  });

  it('wraps an overall list failure with the project binding', async () => {
    const fixture = await createFixture('changes-failure');
    const cause = new Error('list changes failed');
    const gateway = new ProjectDataGateway({
      createCli: () => ({
        getContext: async () => context(fixture.localRoot, 'nearest'),
        listChanges: async () => {
          throw cause;
        },
        listSpecs: async () => [],
      }),
    });

    const error = await gateway.loadChanges(fixture.project).catch((value) => value);

    expect(error).toBeInstanceOf(ProjectDataAccessError);
    expect(error).toMatchObject({
      projectId: fixture.project.id,
      phase: 'changes',
      binding: {
        projectId: fixture.project.id,
        rootPath: await fs.realpath(fixture.localRoot),
      },
    });
    expect((error as ProjectDataAccessError).cause).toBe(cause);
  });

  it('keeps concurrent Project change reads isolated', async () => {
    const a = await createFixture('changes-a');
    const b = await createFixture('changes-b');
    const calls: Array<{ cwd: string; scope: unknown }> = [];
    const gateway = new ProjectDataGateway({
      createCli: (cwd) => ({
        getContext: async () => context(cwd === a.project.projectPath ? a.externalRoot : b.localRoot, 'nearest'),
        listChanges: async (scope) => {
          calls.push({ cwd, scope });
          return [{ name: cwd === a.project.projectPath ? 'change-a' : 'change-b' }] as any;
        },
        listSpecs: async () => [],
      }),
    });

    const [resultA, resultB] = await Promise.all([
      gateway.loadChanges(a.project, 'store-a'),
      gateway.loadChanges(b.project),
    ]);

    expect(resultA.changes).toEqual([{ name: 'change-a', searchText: 'change-a' }]);
    expect(resultB.changes).toEqual([{ name: 'change-b', searchText: 'change-b' }]);
    expect(calls).toHaveLength(2);
    expect(calls).toEqual(expect.arrayContaining([
      { cwd: a.project.projectPath, scope: { storeId: 'store-a' } },
      { cwd: b.project.projectPath, scope: undefined },
    ]));
    expect(resultA.binding.rootPath).toBe(await fs.realpath(a.externalRoot));
    expect(resultB.binding.rootPath).toBe(await fs.realpath(b.localRoot));
  });

  it('returns only canonical Specs reported by the CLI', async () => {
    const fixture = await createFixture('canonical-only');
    const canonicalSpecs = [{ id: 'canonical', requirementCount: 2, path: 'specs/canonical/spec.md' }];
    let fileSpecReads = 0;
    const gateway = new ProjectDataGateway({
      createCli: () => ({
        getContext: async () => context(fixture.localRoot, 'nearest', {
          references: [{ store_id: 'referenced-store' }],
        }),
        listChanges: async () => [],
        listSpecs: async () => canonicalSpecs,
      }),
      createContentAccess: () => ({
        listArchivedChanges: async () => [],
        listMainSpecs: async () => {
          fileSpecReads += 1;
          return [{ id: 'delta-or-file', requirementCount: 99 }];
        },
        listSpecsFromChanges: async () => {
          fileSpecReads += 1;
          return [{ id: 'delta', requirementCount: 1 }];
        },
      }),
    });

    const result = await gateway.loadCanonicalSpecs(fixture.project);

    expect(result.specs).toEqual(canonicalSpecs);
    expect(fileSpecReads).toBe(0);
  });

  it('keeps an empty canonical result empty when delta Specs exist', async () => {
    const fixture = await createFixture('canonical-empty');
    let deltaReads = 0;
    const gateway = new ProjectDataGateway({
      createCli: () => ({
        getContext: async () => context(fixture.localRoot, 'nearest', {
          activeChanges: [{ name: 'active-change', deltaSpecs: ['delta'] }],
        }),
        listChanges: async () => [],
        listSpecs: async () => [],
      }),
      createContentAccess: () => ({
        listArchivedChanges: async () => [],
        listSpecsFromChanges: async () => {
          deltaReads += 1;
          return [{ id: 'delta', requirementCount: 1 }];
        },
      }),
    });

    const result = await gateway.loadCanonicalSpecs(fixture.project);

    expect(result.specs).toEqual([]);
    expect(deltaReads).toBe(0);
  });

  it('wraps canonical Specs CLI failures and distinguishes them from empty results', async () => {
    const fixture = await createFixture('canonical-failure');
    const cause = new Error('list specs failed');
    const gateway = new ProjectDataGateway({
      createCli: () => ({
        getContext: async () => context(fixture.localRoot, 'nearest'),
        listChanges: async () => [],
        listSpecs: async () => {
          throw cause;
        },
      }),
    });

    const error = await gateway.loadCanonicalSpecs(fixture.project).catch((value) => value);

    expect(error).toBeInstanceOf(ProjectDataAccessError);
    expect(error).toMatchObject({ projectId: fixture.project.id, phase: 'specs' });
    expect((error as ProjectDataAccessError).cause).toBe(cause);
  });

  it('re-resolves root and readers for every request without cache', async () => {
    const fixture = await createFixture('root-rotation');
    const roots = [fixture.localRoot, fixture.externalRoot];
    let probeCalls = 0;
    let nextBoundRoot: string | undefined;
    const contentRoots: string[] = [];
    const gateway = new ProjectDataGateway({
      createCli: () => {
        const boundRoot = nextBoundRoot;
        return {
          getContext: async () => {
            nextBoundRoot = roots[probeCalls];
            probeCalls += 1;
            return context(nextBoundRoot!, 'nearest');
          },
          listChanges: async () => [{ name: boundRoot === fixture.localRoot ? 'root-a' : 'root-b' }] as any,
          listSpecs: async () => [{
            id: boundRoot === fixture.localRoot ? 'spec-a' : 'spec-b',
            requirementCount: 1,
          }] as any,
        };
      },
      createContentAccess: (openspecPath) => {
        contentRoots.push(openspecPath);
        return { listArchivedChanges: async () => [] };
      },
    });

    const changes = await gateway.loadChanges(fixture.project);
    const specs = await gateway.loadCanonicalSpecs(fixture.project);

    expect(probeCalls).toBe(2);
    expect(changes.changes).toEqual([{ name: 'root-a', searchText: 'root-a' }]);
    expect(specs.specs).toEqual([{ id: 'spec-b', requirementCount: 1 }]);
    expect(changes.binding.rootPath).toBe(await fs.realpath(fixture.localRoot));
    expect(specs.binding.rootPath).toBe(await fs.realpath(fixture.externalRoot));
    expect(contentRoots).toEqual([
      path.join(await fs.realpath(fixture.localRoot), 'openspec'),
      path.join(await fs.realpath(fixture.externalRoot), 'openspec'),
    ]);
  });
});

describe('ProjectDataGateway Workset navigation', () => {
  const temporaryDirectories: string[] = [];

  afterEach(async () => {
    await Promise.all(
      temporaryDirectories.splice(0).map((directory) => fs.rm(directory, { recursive: true, force: true }))
    );
  });

  it('loads canonical Project and Planning Store members from selector-free CLI payloads', async () => {
    const base = await fs.mkdtemp(path.join(os.tmpdir(), 'openspec-workset-navigation-'));
    temporaryDirectories.push(base);
    const currentPath = path.join(base, 'current-project');
    const currentAlias = path.join(base, 'current-alias');
    const otherPath = path.join(base, 'other-project');
    const worktreePath = path.join(base, 'repo-worktree');
    const storePath = path.join(base, 'planning-store');
    const storeAlias = path.join(base, 'planning-store-alias');
    await Promise.all([
      fs.mkdir(path.join(currentPath, 'openspec'), { recursive: true }),
      fs.mkdir(path.join(otherPath, 'openspec'), { recursive: true }),
      fs.mkdir(path.join(worktreePath, 'openspec'), { recursive: true }),
      fs.mkdir(path.join(storePath, 'openspec'), { recursive: true }),
    ]);
    await fs.symlink(currentPath, currentAlias, 'dir');
    await fs.symlink(storePath, storeAlias, 'dir');

    const currentProject = await createProjectContext('Current Project', currentPath);
    const canonicalOtherPath = await fs.realpath(otherPath);
    const canonicalWorktreePath = await fs.realpath(worktreePath);
    const canonicalStorePath = await fs.realpath(storePath);
    const repositoryRoot = path.join(base, 'shared-repository');
    const listCalls: string[] = [];
    const readGitMetadata = vi.fn(async (memberPath: string) => (
      memberPath === canonicalWorktreePath
        ? { repository: repositoryRoot, branch: 'feature/worktree' }
        : {}
    ));

    const gateway = new ProjectDataGateway({
      createCli: () => ({
        getContext: async () => context(currentPath, 'nearest'),
        listWorksets: async () => {
          listCalls.push('worksets');
          return {
            worksets: [
              {
                name: 'primary-workset',
                tool: 'cursor',
                members: [
                  { name: 'current', path: currentAlias },
                  { name: 'other', path: otherPath },
                  { name: 'planning-store', path: storeAlias },
                  { name: 'missing', path: path.join(base, 'missing-project') },
                ],
              },
              {
                name: 'secondary-workset',
                members: [
                  { name: 'current', path: currentPath },
                  { name: 'worktree', path: worktreePath },
                ],
              },
            ],
          };
        },
        listStores: async () => {
          listCalls.push('stores');
          return { stores: [{ id: 'planning-store', root: storePath }] };
        },
      }) as any,
      readGitMetadata,
    } as any);

    const data = await (gateway as any).loadWorksetNavigation(currentProject);

    expect(listCalls).toEqual(['worksets', 'stores']);
    expect(data.worksets).toHaveLength(2);
    expect(data.worksets[0].members.find((member: any) => member.role === 'store')).toMatchObject({
      path: canonicalStorePath,
      role: 'store',
      selectable: false,
      storeId: 'planning-store',
    });
    expect(data.worksets[0].members.some((member: any) => member.name === 'missing')).toBe(false);
    expect(data.worksets[0].members.find((member: any) => member.name === 'other')).toMatchObject({
      path: canonicalOtherPath,
      role: 'project',
      selectable: true,
      project: { id: canonicalOtherPath, projectPath: canonicalOtherPath },
    });
    expect(data.worksets[1].members.find((member: any) => member.name === 'worktree')).toMatchObject({
      path: canonicalWorktreePath,
      role: 'project',
      selectable: true,
      project: { id: canonicalWorktreePath, projectPath: canonicalWorktreePath },
      git: { repository: repositoryRoot, branch: 'feature/worktree' },
    });
    expect(readGitMetadata).toHaveBeenCalledWith(canonicalWorktreePath);
  });

  it('canonicalizes the navigation project path so a symlinked project root dedups with picked members', async () => {
    const base = await fs.mkdtemp(path.join(os.tmpdir(), 'openspec-workset-canonical-project-'));
    temporaryDirectories.push(base);
    const realPath = path.join(base, 'current-project');
    const aliasPath = path.join(base, 'current-alias');
    await fs.mkdir(path.join(realPath, 'openspec'), { recursive: true });
    await fs.symlink(realPath, aliasPath, 'dir');
    const canonicalRealPath = await fs.realpath(realPath);

    // The Project context arrives through a symlinked root: without gateway
    // canonicalization its navigation.project.projectPath would not match the
    // canonical member paths (or Host folder-picker results), showing two
    // rows for one folder in the creation form.
    const aliasedProject: ProjectContext = {
      id: aliasPath,
      label: 'Current Project',
      projectPath: aliasPath,
    };
    const gateway = new ProjectDataGateway({
      createCli: () => ({
        // Inlined CLI context payload (no `context` helper is in scope in this
        // describe block, so referencing one would only add tsc debt).
        getContext: async () => ({ root: { path: realPath, source: 'nearest' } }) as OpenSpecContextResult,
        listWorksets: async () => ({
          worksets: [{
            name: 'planning',
            members: [{ name: 'current', path: realPath }],
          }],
        }),
        listStores: async () => ({ stores: [] }),
      }) as any,
      readGitMetadata: async () => ({}),
    } as any);

    const data = await gateway.loadWorksetNavigation(aliasedProject);

    expect(data.project.projectPath).toBe(canonicalRealPath);
    expect(data.project.id).toBe(canonicalRealPath);
    // The current member dedups against the navigation project path: the
    // locked create-form member and the canonical member are one row.
    expect(data.worksets).toHaveLength(1);
    const member = data.worksets[0]?.members.find((m) => m.path === canonicalRealPath);
    expect(member).toMatchObject({ role: 'project', selectable: true });
    expect(member?.path).toBe(data.project.projectPath);
  });

  it('uses the canonical Git common directory for linked Worktree identity', async () => {
    const base = await fs.mkdtemp(path.join(os.tmpdir(), 'openspec-workset-git-identity-'));
    temporaryDirectories.push(base);
    const repositoryPath = path.join(base, 'repository');
    const worktreePath = path.join(base, 'linked-worktree');
    await fs.mkdir(repositoryPath, { recursive: true });
    const runGit = async (args: string[]) => {
      await execFileAsync('git', args, { cwd: repositoryPath });
    };
    await runGit(['init', '-q', '-b', 'main']);
    await fs.writeFile(path.join(repositoryPath, 'README.md'), 'fixture\n');
    await runGit(['add', 'README.md']);
    await runGit(['-c', 'user.name=OpenSpec Test', '-c', 'user.email=test@example.com', 'commit', '-qm', 'initial']);
    await runGit(['worktree', 'add', '-q', '-b', 'feature/linked', worktreePath, 'HEAD']);

    const currentProject = await createProjectContext('Current Project', repositoryPath);
    const canonicalWorktreePath = await fs.realpath(worktreePath);
    const gateway = new ProjectDataGateway({
      createCli: () => ({
        getContext: async () => context(repositoryPath, 'nearest'),
        listWorksets: async () => ({
          worksets: [{
            name: 'planning',
            members: [
              { name: 'main', path: repositoryPath },
              { name: 'linked', path: worktreePath },
            ],
          }],
        }),
        listStores: async () => ({ stores: [] }),
      }) as any,
    });

    const data = await gateway.loadWorksetNavigation(currentProject);
    const members = data.worksets[0]?.members ?? [];
    const mainMember = members.find((member) => member.path === currentProject.projectPath);
    const linkedMember = members.find((member) => member.path === canonicalWorktreePath);

    expect(mainMember?.role).toBe('project');
    expect(linkedMember?.role).toBe('project');
    expect(mainMember?.path).not.toBe(linkedMember?.path);
    expect(mainMember?.git?.repository).toBeTruthy();
    expect(mainMember?.git?.repository).toBe(linkedMember?.git?.repository);
    expect(mainMember?.git?.branch).toBe('main');
    expect(linkedMember?.git?.branch).toBe('feature/linked');
  });

  it('fails closed when registered Store identity cannot be confirmed', async () => {
    const base = await fs.mkdtemp(path.join(os.tmpdir(), 'openspec-workset-store-probe-'));
    temporaryDirectories.push(base);
    const currentPath = path.join(base, 'current-project');
    const possibleStorePath = path.join(base, 'possible-store');
    await Promise.all([
      fs.mkdir(path.join(currentPath, 'openspec'), { recursive: true }),
      fs.mkdir(path.join(possibleStorePath, 'openspec'), { recursive: true }),
    ]);
    const currentProject = await createProjectContext('Current Project', currentPath);
    const cli = new OpenSpecCliService(currentPath);
    vi.spyOn(cli, 'runJson').mockImplementation(async (args) => {
      if (args[0] === 'workset') {
        return {
          worksets: [{
            name: 'planning',
            members: [
              { name: 'current', path: currentPath },
              { name: 'possible-store', path: possibleStorePath },
            ],
          }],
        };
      }
      throw new Error('store list unavailable');
    });
    const gateway = new ProjectDataGateway({
      createCli: () => cli,
      readGitMetadata: async () => ({}),
    });

    await expect(gateway.loadWorksetNavigation(currentProject)).resolves.toEqual({
      project: currentProject,
      worksets: [],
    });
  });

  it('fails closed when Store inventory contains a malformed entry', async () => {
    const base = await fs.mkdtemp(path.join(os.tmpdir(), 'openspec-workset-malformed-store-'));
    temporaryDirectories.push(base);
    const currentPath = path.join(base, 'current-project');
    const possibleStorePath = path.join(base, 'possible-store');
    await Promise.all([
      fs.mkdir(path.join(currentPath, 'openspec'), { recursive: true }),
      fs.mkdir(path.join(possibleStorePath, 'openspec'), { recursive: true }),
    ]);
    const currentProject = await createProjectContext('Current Project', currentPath);
    const gateway = new ProjectDataGateway({
      createCli: () => ({
        getContext: async () => context(currentPath, 'nearest'),
        listWorksets: async () => ({
          worksets: [{
            name: 'planning',
            members: [
              { name: 'current', path: currentPath },
              { name: 'possible-store', path: possibleStorePath },
            ],
          }],
        }),
        listStores: async () => ({ stores: [{ id: 'possible-store' }] }),
      }) as any,
      readGitMetadata: async () => ({}),
    } as any);

    await expect(gateway.loadWorksetNavigation(currentProject)).resolves.toEqual({
      project: currentProject,
      worksets: [],
    });
  });

  it('fails closed when a registered Store root cannot be resolved', async () => {
    const base = await fs.mkdtemp(path.join(os.tmpdir(), 'openspec-workset-unresolved-store-'));
    temporaryDirectories.push(base);
    const currentPath = path.join(base, 'current-project');
    const possibleStorePath = path.join(base, 'possible-store');
    await fs.mkdir(path.join(currentPath, 'openspec'), { recursive: true });
    const currentProject = await createProjectContext('Current Project', currentPath);
    const gateway = new ProjectDataGateway({
      createCli: () => ({
        getContext: async () => ({ root: { path: currentPath, source: 'nearest' } }) as OpenSpecContextResult,
        listWorksets: async () => ({
          worksets: [{
            name: 'planning',
            members: [
              { name: 'current', path: currentPath },
              { name: 'possible-store', path: possibleStorePath },
            ],
          }],
        }),
        listStores: async () => ({ stores: [{ id: 'possible-store', root: possibleStorePath }] }),
      }) as any,
      readGitMetadata: async () => ({}),
    } as any);

    await expect(gateway.loadWorksetNavigation(currentProject)).resolves.toEqual({
      project: currentProject,
      worksets: [],
    });
  });
});

describe('ProjectDataGateway Workset Planning Store resolution', () => {
  const temporaryDirectories: string[] = [];

  afterEach(async () => {
    await Promise.all(
      temporaryDirectories.splice(0).map((directory) => fs.rm(directory, { recursive: true, force: true }))
    );
  });

  function context(rootPath: string, rootSource: string, extra: Record<string, unknown> = {}): OpenSpecContextResult {
    return { root: { path: rootPath, source: rootSource }, ...extra };
  }

  async function createStoreFixture() {
    const base = await fs.mkdtemp(path.join(os.tmpdir(), 'openspec-store-selection-'));
    temporaryDirectories.push(base);
    const projectPath = path.join(base, 'current-project');
    const storePath = path.join(base, 'planning-store');
    const otherProjectPath = path.join(base, 'other-project');
    const forgedPath = path.join(base, 'forged-directory');
    await Promise.all([
      fs.mkdir(path.join(projectPath, 'openspec'), { recursive: true }),
      fs.mkdir(path.join(storePath, 'openspec'), { recursive: true }),
      fs.mkdir(path.join(otherProjectPath, 'openspec'), { recursive: true }),
      fs.mkdir(forgedPath, { recursive: true }),
    ]);
    const storeAlias = path.join(base, 'planning-store-alias');
    await fs.symlink(storePath, storeAlias, 'dir');
    return {
      base,
      project: await createProjectContext('Current Project', projectPath),
      projectPath,
      storePath,
      storeAlias,
      otherProjectPath,
      forgedPath,
      canonicalStorePath: await fs.realpath(storePath),
    };
  }

  it('returns the official Store id from fresh inventories after canonicalizing the member path', async () => {
    const fixture = await createStoreFixture();
    const inventoryCalls: string[] = [];
    const getContext = vi.fn();
    const gateway = new ProjectDataGateway({
      createCli: () => ({
        getContext,
        listWorksets: async () => {
          inventoryCalls.push('worksets');
          return {
            worksets: [{
              name: 'team',
              members: [
                { name: 'current', path: fixture.projectPath },
                { name: 'planning', path: fixture.storeAlias },
              ],
            }],
          };
        },
        listStores: async () => {
          inventoryCalls.push('stores');
          return { stores: [{ id: 'team-store', root: fixture.storePath }] };
        },
      }) as any,
      readGitMetadata: async () => ({}),
    });

    const resolution = await gateway.resolveWorksetStore(fixture.project, 'team', fixture.storeAlias);

    expect(resolution).toEqual({
      storeId: 'team-store',
      canonicalRoot: fixture.canonicalStorePath,
    });
    expect(inventoryCalls).toEqual(['stores', 'worksets']);
    expect(getContext).not.toHaveBeenCalled();
  });

  it('rejects a member path that no fresh Store inventory registers', async () => {
    const fixture = await createStoreFixture();
    const gateway = new ProjectDataGateway({
      createCli: () => ({
        getContext: async () => context(fixture.projectPath, 'nearest'),
        listWorksets: async () => ({
          worksets: [{
            name: 'team',
            members: [
              { name: 'current', path: fixture.projectPath },
              { name: 'forged', path: fixture.forgedPath },
            ],
          }],
        }),
        listStores: async () => ({ stores: [{ id: 'team-store', root: fixture.storePath }] }),
      }) as any,
    });

    const error = await gateway.resolveWorksetStore(fixture.project, 'team', fixture.forgedPath).catch((value) => value);

    expect(error).toBeInstanceOf(ProjectDataAccessError);
    expect(error).toMatchObject({ projectId: fixture.project.id, phase: 'resolve' });
  });

  it('rejects a registered Store root that the named Workset no longer lists', async () => {
    const fixture = await createStoreFixture();
    const gateway = new ProjectDataGateway({
      createCli: () => ({
        getContext: async () => context(fixture.projectPath, 'nearest'),
        listWorksets: async () => ({
          worksets: [{
            name: 'team',
            members: [{ name: 'current', path: fixture.projectPath }],
          }],
        }),
        listStores: async () => ({ stores: [{ id: 'team-store', root: fixture.storePath }] }),
      }) as any,
    });

    const staleError = await gateway.resolveWorksetStore(fixture.project, 'team', fixture.storePath).catch((value) => value);
    const unknownWorksetError = await gateway
      .resolveWorksetStore(fixture.project, 'renamed-workset', fixture.storePath)
      .catch((value) => value);

    expect(staleError).toBeInstanceOf(ProjectDataAccessError);
    expect(staleError).toMatchObject({ projectId: fixture.project.id, phase: 'resolve' });
    expect(unknownWorksetError).toBeInstanceOf(ProjectDataAccessError);
    expect(unknownWorksetError).toMatchObject({ projectId: fixture.project.id, phase: 'resolve' });
  });

  it('rejects a Workset member that has the Project role instead of a Store role', async () => {
    const fixture = await createStoreFixture();
    const gateway = new ProjectDataGateway({
      createCli: () => ({
        getContext: async () => context(fixture.projectPath, 'nearest'),
        listWorksets: async () => ({
          worksets: [{
            name: 'team',
            members: [
              { name: 'current', path: fixture.projectPath },
              { name: 'other', path: fixture.otherProjectPath },
            ],
          }],
        }),
        listStores: async () => ({ stores: [{ id: 'team-store', root: fixture.storePath }] }),
      }) as any,
    });

    const error = await gateway.resolveWorksetStore(fixture.project, 'team', fixture.otherProjectPath).catch((value) => value);

    expect(error).toBeInstanceOf(ProjectDataAccessError);
    expect(error).toMatchObject({ projectId: fixture.project.id, phase: 'resolve' });
  });

  it('rejects a member path that cannot be canonicalized before any inventory read', async () => {
    const fixture = await createStoreFixture();
    const inventoryCalls: string[] = [];
    const gateway = new ProjectDataGateway({
      createCli: () => ({
        getContext: async () => context(fixture.projectPath, 'nearest'),
        listWorksets: async () => {
          inventoryCalls.push('worksets');
          return { worksets: [] };
        },
        listStores: async () => {
          inventoryCalls.push('stores');
          return { stores: [{ id: 'team-store', root: fixture.storePath }] };
        },
      }) as any,
    });

    const error = await gateway
      .resolveWorksetStore(fixture.project, 'team', path.join(fixture.base, 'missing-member'))
      .catch((value) => value);

    expect(error).toBeInstanceOf(ProjectDataAccessError);
    expect(error).toMatchObject({ projectId: fixture.project.id, phase: 'resolve' });
    expect(inventoryCalls).toEqual([]);
  });

  it('fails closed when the Store or Workset inventory probe fails or is malformed', async () => {
    const fixture = await createStoreFixture();

    const failingCases: Array<{ name: string; cli: Record<string, unknown> }> = [
      {
        name: 'listStores throws',
        cli: {
          getContext: async () => context(fixture.projectPath, 'nearest'),
          listWorksets: async () => ({ worksets: [{ name: 'team', members: [{ path: fixture.storePath }] }] }),
          listStores: async () => {
            throw new Error('store list unavailable');
          },
        },
      },
      {
        name: 'Store inventory malformed',
        cli: {
          getContext: async () => context(fixture.projectPath, 'nearest'),
          listWorksets: async () => ({ worksets: [{ name: 'team', members: [{ path: fixture.storePath }] }] }),
          listStores: async () => ({ stores: [{ id: 'team-store' }] }),
        },
      },
      {
        name: 'listWorksets throws',
        cli: {
          getContext: async () => context(fixture.projectPath, 'nearest'),
          listWorksets: async () => {
            throw new Error('workset list unavailable');
          },
          listStores: async () => ({ stores: [{ id: 'team-store', root: fixture.storePath }] }),
        },
      },
      {
        name: 'worksets capability missing',
        cli: {
          getContext: async () => context(fixture.projectPath, 'nearest'),
          listStores: async () => ({ stores: [{ id: 'team-store', root: fixture.storePath }] }),
        },
      },
    ];

    for (const failingCase of failingCases) {
      const cause = new Error('probe failed');
      const gateway = new ProjectDataGateway({
        createCli: () => failingCase.cli as any,
        readGitMetadata: async () => { throw cause; },
      });

      const error = await gateway
        .resolveWorksetStore(fixture.project, 'team', fixture.storePath)
        .catch((value) => value);

      expect(error, failingCase.name).toBeInstanceOf(ProjectDataAccessError);
      expect(error, failingCase.name).toMatchObject({ projectId: fixture.project.id, phase: 'resolve' });
    }
  });

  it('rejects non-string Workset names and member paths without probing', async () => {
    const fixture = await createStoreFixture();
    const gateway = new ProjectDataGateway({ createCli: () => ({ getContext: async () => context(fixture.projectPath, 'nearest') }) as any });

    const blankName = await gateway.resolveWorksetStore(fixture.project, '   ', fixture.storePath).catch((value) => value);
    const nonStringPath = await gateway.resolveWorksetStore(fixture.project, 'team', 42 as unknown as string).catch((value) => value);

    expect(blankName).toBeInstanceOf(ProjectDataAccessError);
    expect(nonStringPath).toBeInstanceOf(ProjectDataAccessError);
  });
});

describe('ProjectDataGateway unified Project Sidebar data', () => {
  const temporaryDirectories: string[] = [];

  function context(rootPath: string, rootSource: string, extra: Record<string, unknown> = {}): OpenSpecContextResult {
    return { root: { path: rootPath, source: rootSource }, ...extra };
  }

  afterEach(async () => {
    await Promise.all(
      temporaryDirectories.splice(0).map((directory) => fs.rm(directory, { recursive: true, force: true }))
    );
  });

  it('loads all Sidebar groups through one Project binding and a Store binding', async () => {
    const base = await fs.mkdtemp(path.join(os.tmpdir(), 'openspec-sidebar-payload-'));
    temporaryDirectories.push(base);
    const projectRoot = path.join(base, 'project-root');
    const storeRoot = path.join(base, 'store-root');
    await fs.mkdir(path.join(projectRoot, 'openspec'), { recursive: true });
    await fs.mkdir(path.join(storeRoot, 'openspec'), { recursive: true });
    const project = await createProjectContext('Project', projectRoot);
    const contexts: unknown[] = [];
    const gateway = new ProjectDataGateway({
      createCli: () => ({
        getContext: async (scope) => {
          contexts.push(scope);
          return context(
            scope?.storeId ? storeRoot : projectRoot,
            scope?.storeId ? 'store' : 'nearest',
            scope?.storeId
              ? {}
              : { references: [{ store_id: 'referenced-store' }] },
          );
        },
        listChanges: async () => [{
          name: 'project-change',
          completedTasks: 0,
          totalTasks: 1,
          lastModified: '2026-08-20T00:00:00.000Z',
          status: 'draft',
          lifecycleStatus: 'planning',
        }] as any,
        listSpecs: async (scope) => scope?.storeId
          ? [{ id: 'shared-spec', requirementCount: 2 }]
          : [{ id: 'shared-spec', requirementCount: 1 }],
        listWorksets: async () => ({ worksets: [] }),
        listStores: async () => ({ stores: [] }),
      }),
      createContentAccess: () => ({
        listArchivedChanges: async () => [{
          directoryName: '2026-08-19-archived-change',
          name: 'archived-change',
          archiveDate: '2026-08-19',
        }],
        readArtifact: async () => '## Why\n\nUnified sidebar payload.',
      }),
    });

    const data = await gateway.loadProjectSidebarData(project);

    expect(data.project).toEqual(project);
    expect(data.binding.rootPath).toBe(await fs.realpath(projectRoot));
    expect(data.changes).toHaveLength(1);
    expect(data.archivedChanges).toHaveLength(1);
    expect(data.projectSpecs).toEqual([{ id: 'shared-spec', requirementCount: 1 }]);
    expect(data.referencedStoreSpecs).toEqual([{
      storeId: 'referenced-store',
      binding: expect.objectContaining({
        rootPath: await fs.realpath(storeRoot),
        storeId: 'referenced-store',
      }),
      specs: [{ id: 'shared-spec', requirementCount: 2 }],
    }]);
    expect(contexts).toEqual([undefined, { storeId: 'referenced-store' }]);
  });

  it('resolves every Sidebar reader through an explicit validated Store selector', async () => {
    const base = await fs.mkdtemp(path.join(os.tmpdir(), 'openspec-sidebar-explicit-store-'));
    temporaryDirectories.push(base);
    const projectRoot = path.join(base, 'project-root');
    const storeRoot = path.join(base, 'store-root');
    await fs.mkdir(path.join(projectRoot, 'openspec'), { recursive: true });
    await fs.mkdir(path.join(storeRoot, 'openspec'), { recursive: true });
    const project = await createProjectContext('Project', projectRoot);
    const canonicalStoreRoot = await fs.realpath(storeRoot);
    const contexts: unknown[] = [];
    const listScopes: unknown[] = [];
    const contentRoots: string[] = [];
    const gateway = new ProjectDataGateway({
      createCli: () => ({
        getContext: async (scope) => {
          contexts.push(scope);
          return scope?.storeId
            ? { root: { path: storeRoot, source: 'store', store_id: scope.storeId } }
            : context(projectRoot, 'nearest');
        },
        listChanges: async (scope) => {
          listScopes.push(scope);
          return scope?.storeId
            ? [{ name: 'store-change', lifecycleStatus: 'planning' }] as any
            : [{ name: 'project-change', lifecycleStatus: 'planning' }] as any;
        },
        listSpecs: async (scope) => {
          listScopes.push(scope);
          return scope?.storeId
            ? [{ id: 'store-spec', requirementCount: 2 }]
            : [{ id: 'project-spec', requirementCount: 1 }];
        },
        listWorksets: async () => ({
          worksets: [{
            name: 'team',
            members: [{ name: 'current', path: projectRoot }],
          }],
        }),
        listStores: async () => ({ stores: [{ id: 'team-store', root: storeRoot }] }),
      }),
      createContentAccess: (openspecPath) => {
        contentRoots.push(openspecPath);
        return { listArchivedChanges: async () => [] };
      },
      readGitMetadata: async () => ({}),
    });

    const storeBound = await gateway.loadProjectSidebarData(project, 'team-store');
    const selectorFree = await gateway.loadProjectSidebarData(project);

    expect(storeBound.binding).toEqual({
      projectId: project.id,
      commandCwd: project.projectPath,
      rootPath: canonicalStoreRoot,
      rootSource: 'store',
      storeId: 'team-store',
    });
    expect(storeBound.changes.map((change) => change.name)).toEqual(['store-change']);
    expect(storeBound.projectSpecs).toEqual([{ id: 'store-spec', requirementCount: 2 }]);
    expect(storeBound.worksetNavigation).toEqual({ project, worksets: expect.any(Array) });
    expect(contexts[0]).toEqual({ storeId: 'team-store' });
    expect(listScopes[0]).toEqual({ storeId: 'team-store' });
    expect(listScopes[1]).toEqual({ storeId: 'team-store' });
    expect(contentRoots[0]).toBe(path.join(canonicalStoreRoot, 'openspec'));

    expect(selectorFree.binding).toMatchObject({
      rootPath: await fs.realpath(projectRoot),
      rootSource: 'nearest',
    });
    expect(selectorFree.binding.storeId).toBeUndefined();
    expect(selectorFree.changes.map((change) => change.name)).toEqual(['project-change']);
    expect(contexts[1]).toBeUndefined();
    expect(listScopes[2]).toBeUndefined();
    expect(listScopes[3]).toBeUndefined();
  });

  it('reports whether an explicit Store selector drove the Sidebar binding', async () => {
    const base = await fs.mkdtemp(path.join(os.tmpdir(), 'openspec-sidebar-explicit-flag-'));
    temporaryDirectories.push(base);
    const projectRoot = path.join(base, 'project-root');
    const declaredStoreRoot = path.join(base, 'declared-store-root');
    const selectedStoreRoot = path.join(base, 'selected-store-root');
    await fs.mkdir(path.join(projectRoot, 'openspec'), { recursive: true });
    await fs.mkdir(path.join(declaredStoreRoot, 'openspec'), { recursive: true });
    await fs.mkdir(path.join(selectedStoreRoot, 'openspec'), { recursive: true });
    const project = await createProjectContext('Project', projectRoot);
    const gateway = new ProjectDataGateway({
      createCli: () => ({
        // The selector-free root IS a Store root (CLI root.store_id is set):
        // its binding carries a storeId without any explicit selector.
        getContext: async (scope) => (scope?.storeId
          ? { root: { path: selectedStoreRoot, source: 'store', store_id: scope.storeId } }
          : { root: { path: declaredStoreRoot, source: 'store', store_id: 'declared-store' } }),
        listChanges: async () => [],
        listSpecs: async () => [],
        listWorksets: async () => ({ worksets: [] }),
        listStores: async () => ({ stores: [] }),
      }),
      createContentAccess: () => ({ listArchivedChanges: async () => [] }),
    });

    const selectorFree = await gateway.loadProjectSidebarData(project);
    const explicit = await gateway.loadProjectSidebarData(project, 'team-store');

    expect(selectorFree.binding.storeId).toBe('declared-store');
    expect(selectorFree.explicitStoreSelector).toBe(false);
    expect(explicit.binding.storeId).toBe('team-store');
    expect(explicit.explicitStoreSelector).toBe(true);
  });

  it('accepts official context members and keeps Store Specs out of Project metrics', async () => {
    const base = await fs.mkdtemp(path.join(os.tmpdir(), 'openspec-sidebar-official-shape-'));
    temporaryDirectories.push(base);
    const projectRoot = path.join(base, 'project-root');
    const storeRoot = path.join(base, 'store-root');
    await fs.mkdir(path.join(projectRoot, 'openspec'), { recursive: true });
    await fs.mkdir(path.join(storeRoot, 'openspec'), { recursive: true });
    const project = await createProjectContext('Project', projectRoot);
    const contexts: unknown[] = [];
    const gateway = new ProjectDataGateway({
      createCli: () => ({
        getContext: async (scope) => {
          contexts.push(scope);
          return scope?.storeId
            ? {
                root: { path: storeRoot, source: 'store', store_id: 'aihelp-workspace' },
              }
            : {
                root: { path: projectRoot, source: 'nearest' },
                members: [
                  { role: 'referenced_store', id: 'aihelp-workspace', path: storeRoot },
                  { role: 'registered_store', id: 'unreferenced-store', path: path.join(base, 'other-store') },
                ],
              };
        },
        listChanges: async () => [{
          name: 'project-change',
          completedTasks: 1,
          totalTasks: 2,
          lastModified: '2026-08-23T00:00:00.000Z',
          status: 'draft',
          lifecycleStatus: 'planning',
        }] as any,
        listSpecs: async (scope) => scope?.storeId
          ? [{ id: 'shared-spec', requirementCount: 99 }]
          : [{ id: 'shared-spec', requirementCount: 1 }],
        listWorksets: async () => ({ worksets: [] }),
        listStores: async () => ({ stores: [] }),
      }),
      createContentAccess: () => ({ listArchivedChanges: async () => [] }),
    });

    const data = await gateway.loadProjectSidebarData(project);

    expect(data.binding).toMatchObject({
      projectId: project.id,
      rootPath: await fs.realpath(projectRoot),
      rootSource: 'nearest',
    });
    expect(data.projectSpecs).toEqual([{ id: 'shared-spec', requirementCount: 1 }]);
    expect(data.referencedStoreSpecs).toEqual([{
      storeId: 'aihelp-workspace',
      binding: expect.objectContaining({
        rootPath: await fs.realpath(storeRoot),
        rootSource: 'store',
        storeId: 'aihelp-workspace',
      }),
      specs: [{ id: 'shared-spec', requirementCount: 99 }],
    }]);
    expect(contexts).toEqual([undefined, { storeId: 'aihelp-workspace' }]);

    const summary = deriveProjectDashboardSummary(data);
    expect(summary).toMatchObject({
      totalChanges: 1,
      activeChanges: 1,
      activeTasks: 2,
      lifecycle: { planning: 1, archived: 0 },
    });
    expect(summary.activeTaskCompletionRate).toBe(0.5);
    expect(summary.artifactReadiness).toEqual([]);
  });

  it('keeps Project Specs usable when one referenced Store cannot load Specs', async () => {
    const base = await fs.mkdtemp(path.join(os.tmpdir(), 'openspec-sidebar-store-error-'));
    temporaryDirectories.push(base);
    const projectRoot = path.join(base, 'project-root');
    const storeRoot = path.join(base, 'store-root');
    await fs.mkdir(path.join(projectRoot, 'openspec'), { recursive: true });
    await fs.mkdir(path.join(storeRoot, 'openspec'), { recursive: true });
    const project = await createProjectContext('Project', projectRoot);

    const gateway = new ProjectDataGateway({
      createCli: () => ({
        getContext: async (scope) => context(
          scope?.storeId ? storeRoot : projectRoot,
          scope?.storeId ? 'store' : 'nearest',
          scope?.storeId ? {} : { references: [{ store_id: 'broken-store' }] },
        ),
        listChanges: async () => [],
        listSpecs: async (scope) => {
          if (scope?.storeId) throw new Error('Store Specs unavailable');
          return [{ id: 'project-spec', requirementCount: 1 }];
        },
        listWorksets: async () => ({ worksets: [] }),
        listStores: async () => ({ stores: [] }),
      }),
      createContentAccess: () => ({
        listArchivedChanges: async () => [],
      }),
    });

    const data = await gateway.loadProjectSidebarData(project);

    expect(data.projectSpecs).toEqual([{ id: 'project-spec', requirementCount: 1 }]);
    expect(data.referencedStoreSpecs).toEqual([{
      storeId: 'broken-store',
      binding: expect.objectContaining({ storeId: 'broken-store' }),
      specs: [],
      error: expect.stringContaining('broken-store'),
    }]);
  });

  it('reuses one bound Project CLI for the unified snapshot and Workset navigation', async () => {
    const base = await fs.mkdtemp(path.join(os.tmpdir(), 'openspec-sidebar-single-binding-'));
    temporaryDirectories.push(base);
    const projectRoot = path.join(base, 'project-root');
    await fs.mkdir(path.join(projectRoot, 'openspec'), { recursive: true });
    const project = await createProjectContext('Project', projectRoot);
    const cli = {
      getContext: vi.fn(async () => context(projectRoot, 'nearest')),
      listChanges: vi.fn(async () => []),
      listSpecs: vi.fn(async () => []),
      listWorksets: vi.fn(async () => ({ worksets: [] })),
      listStores: vi.fn(async () => ({ stores: [] })),
    };
    const createCli = vi.fn(() => cli);
    const gateway = new ProjectDataGateway({
      createCli,
      createContentAccess: () => ({ listArchivedChanges: async () => [] }),
      readGitMetadata: async () => ({}),
    });

    const data = await gateway.loadProjectSidebarData(project);

    expect(data.worksetNavigation).toEqual({ project, worksets: [] });
    expect(createCli).toHaveBeenCalledTimes(2);
    expect(cli.getContext).toHaveBeenCalledTimes(1);
  });

  it('fails closed when the Project context contains a malformed Store reference', async () => {
    const base = await fs.mkdtemp(path.join(os.tmpdir(), 'openspec-sidebar-malformed-reference-'));
    temporaryDirectories.push(base);
    const projectRoot = path.join(base, 'project-root');
    await fs.mkdir(path.join(projectRoot, 'openspec'), { recursive: true });
    const project = await createProjectContext('Project', projectRoot);
    const gateway = new ProjectDataGateway({
      createCli: () => ({
        getContext: async () => context(projectRoot, 'nearest', { references: [{}] }),
        listChanges: async () => [],
        listSpecs: async () => [],
      }),
      createContentAccess: () => ({ listArchivedChanges: async () => [] }),
    });

    await expect(gateway.loadProjectSidebarData(project)).rejects.toMatchObject({
      name: 'ProjectDataAccessError',
      phase: 'sidebar',
    });
  });

  it('rejects stale-root snapshots without prefetching instructions', async () => {
    const base = await fs.mkdtemp(path.join(os.tmpdir(), 'openspec-sidebar-snapshot-'));
    temporaryDirectories.push(base);
    const projectRoot = path.join(base, 'project-root');
    await fs.mkdir(path.join(projectRoot, 'openspec'), { recursive: true });
    const project = await createProjectContext('Project', projectRoot);
    let instructionsCalls = 0;
    const workflowSnapshot = {
      changeName: 'project-change',
      schema: 'custom-schema',
      bindingKey: 'stale-cli-binding',
      artifacts: [{
        id: 'first',
        status: 'ready',
        requires: [],
        missingDeps: [],
        outputPath: 'openspec/changes/project-change/first.md',
        existingOutputPaths: [],
      }],
    };
    const gateway = new ProjectDataGateway({
      createCli: () => ({
        getContext: async () => context(projectRoot, 'nearest'),
        listChanges: async () => [{
          name: 'project-change',
          completedTasks: 0,
          totalTasks: 1,
          lastModified: '2026-08-24T00:00:00.000Z',
          workflowSnapshot,
        }] as any,
        listSpecs: async () => [],
        listWorksets: async () => ({ worksets: [] }),
        listStores: async () => ({ stores: [] }),
        getInstructions: async () => {
          instructionsCalls += 1;
          return 'must not be called during list refresh';
        },
      } as any),
    });

    const data = await gateway.loadProjectSidebarData(project);

    expect(data.changes[0].workflowSnapshot).toBeUndefined();
    expect(data.changes[0].attention).toMatchObject({
      required: true,
      reasons: ['invalid-artifact-status'],
    });
    expect(instructionsCalls).toBe(0);
  });

  it('drops malformed workflow snapshots while keeping the Change non-actionable', async () => {
    const base = await fs.mkdtemp(path.join(os.tmpdir(), 'openspec-sidebar-malformed-snapshot-'));
    temporaryDirectories.push(base);
    const projectRoot = path.join(base, 'project-root');
    await fs.mkdir(path.join(projectRoot, 'openspec'), { recursive: true });
    const project = await createProjectContext('Project', projectRoot);
    const gateway = new ProjectDataGateway({
      createCli: () => ({
        getContext: async () => context(projectRoot, 'nearest'),
        listChanges: async () => [{
          name: 'malformed-change',
          completedTasks: 0,
          totalTasks: 0,
          lastModified: '2026-08-24',
          workflowSnapshot: {
            changeName: 'malformed-change',
            schema: 'custom-schema',
            bindingKey: 'missing-artifacts',
            artifacts: [{ id: 'missing-status' }],
          },
        }] as any,
        listSpecs: async () => [],
        listWorksets: async () => ({ worksets: [] }),
        listStores: async () => ({ stores: [] }),
      }),
    });

    const data = await gateway.loadProjectSidebarData(project);

    expect(data.changes[0].workflowSnapshot).toBeUndefined();
  });
});
