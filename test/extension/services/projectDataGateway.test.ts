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
