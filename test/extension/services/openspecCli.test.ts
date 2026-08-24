import { describe, it, expect, vi, beforeEach } from 'vitest';
import { spawn } from 'child_process';
import { OpenSpecCliService } from '@extension/services/openspecCli';

vi.mock('vscode', () => ({
  workspace: {
    getConfiguration: vi.fn(() => ({
      get: vi.fn(() => ''),
    })),
  },
  window: {
    createOutputChannel: () => ({
      appendLine: vi.fn(),
      show: vi.fn(),
      dispose: vi.fn(),
    }),
    showErrorMessage: vi.fn(() => Promise.resolve()),
    showWarningMessage: vi.fn(() => Promise.resolve()),
    showInformationMessage: vi.fn(() => Promise.resolve()),
  },
  env: {
    openExternal: vi.fn(() => Promise.resolve()),
    clipboard: { writeText: vi.fn(() => Promise.resolve()) },
  },
  commands: {
    executeCommand: vi.fn(() => Promise.resolve()),
  },
}));

vi.mock('@extension/utils/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('child_process', () => ({
  spawn: vi.fn(),
}));

// Helper functions at module level so all describe blocks can use them
function mockSpawnSuccess(stdout: string) {
  vi.mocked(spawn).mockImplementation(() => {
    const proc = {
      stdout: {
        on: (_e: string, fn: (d: Buffer) => void) => {
          setImmediate(() => fn(Buffer.from(stdout)));
        },
      },
      stderr: { on: vi.fn() },
      on: (_e: string, fn: (...args: any[]) => void) => {
        if (_e === 'close') setImmediate(() => fn(0));
      },
      kill: vi.fn(),
    };
    return proc as any;
  });
}

function mockSpawnExit(code: number, stderrOut = '') {
  vi.mocked(spawn).mockImplementation(() => {
    const proc = {
      stdout: { on: vi.fn() },
      stderr: {
        on: (_e: string, fn: (d: Buffer) => void) => {
          if (stderrOut) setImmediate(() => fn(Buffer.from(stderrOut)));
        },
      },
      on: (_e: string, fn: (...args: any[]) => void) => {
        if (_e === 'close') setImmediate(() => fn(code));
      },
      kill: vi.fn(),
    };
    return proc as any;
  });
}

function mockVersionThenExit(code: number, stderrOut = '') {
  vi.mocked(spawn).mockImplementation((_cmd, args: readonly string[]) => {
    if (args[0] === '--version') {
      return {
        stdout: {
          on: (_e: string, fn: (d: Buffer) => void) => {
            setImmediate(() => fn(Buffer.from('1.3.1')));
          },
        },
        stderr: { on: vi.fn() },
        on: (_e: string, fn: (...args: any[]) => void) => {
          if (_e === 'close') setImmediate(() => fn(0));
        },
        kill: vi.fn(),
      } as any;
    }
    return {
      stdout: { on: vi.fn() },
      stderr: {
        on: (_e: string, fn: (d: Buffer) => void) => {
          if (stderrOut) setImmediate(() => fn(Buffer.from(stderrOut)));
        },
      },
      on: (_e: string, fn: (...args: any[]) => void) => {
        if (_e === 'close') setImmediate(() => fn(code));
      },
      kill: vi.fn(),
    } as any;
  });
}

function createSpawnErrorProcess(message = 'spawn openspec ENOENT') {
  return {
    stdout: { on: vi.fn() },
    stderr: { on: vi.fn() },
    on: (event: string, cb: (error: Error) => void) => {
      if (event === 'error') setImmediate(() => cb(new Error(message)));
    },
    kill: vi.fn(),
  };
}

function createSpawnSuccessProcess(stdout: string) {
  return {
    stdout: {
      on: (event: string, cb: (chunk: Buffer) => void) => {
        if (event === 'data' && stdout) setImmediate(() => cb(Buffer.from(stdout)));
      },
    },
    stderr: { on: vi.fn() },
    on: (event: string, cb: (...args: unknown[]) => void) => {
      if (event === 'close') setImmediate(() => cb(0));
    },
    kill: vi.fn(),
  };
}

describe('OpenSpecCliService', () => {
  const workspaceRoot = '/fake/workspace';

  beforeEach(() => {
    vi.mocked(spawn).mockReset();
  });

  it('checkAvailability returns true when --version succeeds', async () => {
    mockSpawnSuccess('1.0.0');
    const service = new OpenSpecCliService(workspaceRoot);
    const result = await service.checkAvailability();
    expect(result).toBe(true);
  });

  it('checkAvailability returns false when CLI fails', async () => {
    mockSpawnExit(1);
    const service = new OpenSpecCliService(workspaceRoot);
    const result = await service.checkAvailability();
    expect(result).toBe(false);
  });

  it('listSpecs returns empty array for "No specs found." output', async () => {
    mockSpawnSuccess('No specs found.\n');
    const service = new OpenSpecCliService(workspaceRoot);
    const result = await service.listSpecs();
    expect(result).toEqual([]);
  });

  it('listSpecs parses valid JSON and returns specs', async () => {
    mockSpawnSuccess(
      JSON.stringify({
        specs: [
          { id: 'auth', requirementCount: 3, path: 'specs/auth/spec.md' },
        ],
      })
    );
    const service = new OpenSpecCliService(workspaceRoot);
    const result = await service.listSpecs();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('auth');
    expect(result[0].requirementCount).toBe(3);
  });

  it('listSpecs returns empty array for malformed JSON', async () => {
    mockSpawnSuccess('not json');
    const service = new OpenSpecCliService(workspaceRoot);
    const result = await service.listSpecs();
    expect(result).toEqual([]);
  });

  it('listSpecs propagates CLI process failures instead of treating them as empty', async () => {
    const service = new OpenSpecCliService(workspaceRoot);
    vi.spyOn(service as any, 'execOpenSpec').mockRejectedValue(new Error('Command failed with code 1'));
    await expect(service.listSpecs()).rejects.toThrow('Command failed with code 1');
  });

  it('listSpecs returns empty array for human-readable "Specs: ..." output', async () => {
    mockSpawnSuccess('Specs: chat-bi-table-pagination requirement-spec some-other\n');
    const service = new OpenSpecCliService(workspaceRoot);
    const result = await service.listSpecs();
    expect(result).toEqual([]);
  });

  describe('getContext', () => {
    it('reads selector-free context without appending a store flag', async () => {
      const service = new OpenSpecCliService(workspaceRoot);
      const runJson = vi.spyOn(service, 'runJson').mockResolvedValue({
        root: { path: '/resolved/root', source: 'nearest' },
        ignored: true,
      });

      await expect(service.getContext()).resolves.toEqual({
        root: { path: '/resolved/root', source: 'nearest' },
        ignored: true,
      });
      expect(runJson).toHaveBeenCalledOnce();
      expect(runJson).toHaveBeenCalledWith(['context', '--json']);
    });

    it('appends exactly one explicit store selector', async () => {
      const service = new OpenSpecCliService(workspaceRoot);
      const runJson = vi.spyOn(service, 'runJson').mockResolvedValue({
        root: { path: '/store/root', source: 'store' },
      });

      await expect(service.getContext({ storeId: 'team-store' })).resolves.toEqual({
        root: { path: '/store/root', source: 'store' },
      });
      expect(runJson).toHaveBeenCalledWith(['context', '--json', '--store', 'team-store']);
    });

    it('preserves CLI-confirmed referenced Store Specs entries', async () => {
      const service = new OpenSpecCliService(workspaceRoot);
      const context = {
        root: { path: '/resolved/root', source: 'nearest' },
        references: [{ store_id: 'team-store' }],
      };
      vi.spyOn(service, 'runJson').mockResolvedValue(context);

      await expect(service.getContext()).resolves.toEqual(context);
    });

    it('propagates malformed JSON errors from runJson', async () => {
      const service = new OpenSpecCliService(workspaceRoot);
      vi.spyOn(service, 'runJson').mockRejectedValue(new SyntaxError('Unexpected token'));

      await expect(service.getContext()).rejects.toThrow('Unexpected token');
    });
  });

  describe('Workset navigation lists', () => {
    it('runs Workset open through the ordinary-output path without JSON parsing', async () => {
      const service = new OpenSpecCliService(workspaceRoot);
      const exec = vi.spyOn(service as any, 'execOpenSpec').mockResolvedValue('Opened planning\n');

      await expect((service as any).runCommand(['workset', 'open', 'planning']))
        .resolves.toBe('Opened planning\n');
      expect(exec).toHaveBeenCalledWith(['workset', 'open', 'planning']);
    });

    it('propagates ordinary Workset open failures', async () => {
      const service = new OpenSpecCliService(workspaceRoot);
      vi.spyOn(service as any, 'execOpenSpec').mockRejectedValue(new Error('workset open failed'));

      await expect((service as any).runCommand(['workset', 'open', 'planning']))
        .rejects.toThrow('workset open failed');
    });

    it('loads Worksets with a selector-free machine-global command', async () => {
      const service = new OpenSpecCliService(workspaceRoot);
      const runJson = vi.spyOn(service, 'runJson').mockResolvedValue({
        worksets: [{
          name: 'platform',
          tool: 'cursor',
          members: [{ name: 'project', path: '/projects/project' }],
        }],
      });

      const result = await (service as any).listWorksets();

      expect(result).toEqual({
        worksets: [{
          name: 'platform',
          tool: 'cursor',
          members: [{ name: 'project', path: '/projects/project' }],
        }],
      });
      expect(runJson).toHaveBeenCalledWith(['workset', 'list', '--json']);
    });

    it('loads registered Stores with a selector-free machine-global command', async () => {
      const service = new OpenSpecCliService(workspaceRoot);
      const runJson = vi.spyOn(service, 'runJson').mockResolvedValue({
        stores: [{ id: 'planning-store', root: '/stores/planning-store' }],
      });

      const result = await (service as any).listStores();

      expect(result).toEqual({
        stores: [{ id: 'planning-store', root: '/stores/planning-store' }],
      });
      expect(runJson).toHaveBeenCalledWith(['store', 'list', '--json']);
    });

    it('propagates Store inventory failures instead of returning an empty inventory', async () => {
      const service = new OpenSpecCliService(workspaceRoot);
      vi.spyOn(service, 'runJson').mockRejectedValue(new Error('store probe unavailable'));

      await expect(service.listStores()).rejects.toThrow('store probe unavailable');
    });

    it.each([
      ['missing stores', {}],
      ['non-array stores', { stores: 'not-an-array' }],
    ])('rejects malformed Store inventory payloads (%s)', async (_label, payload) => {
      const service = new OpenSpecCliService(workspaceRoot);
      vi.spyOn(service, 'runJson').mockResolvedValue(payload);

      await expect(service.listStores()).rejects.toThrow('Invalid Store inventory payload');
    });
  });

  describe('listChanges', () => {
    it('returns empty array when CLI returns non-JSON (human-readable)', async () => {
      mockSpawnSuccess('Active changes:\n  add-foo  Some change\n');
      const service = new OpenSpecCliService(workspaceRoot);
      const result = await service.listChanges();
      expect(result).toEqual([]);
    });

    it('returns empty array when CLI returns empty or missing changes', async () => {
      mockSpawnSuccess('{}');
      const service = new OpenSpecCliService(workspaceRoot);
      const result = await service.listChanges();
      expect(result).toEqual([]);
    });

    it('propagates overall list process failures instead of returning empty changes', async () => {
      const service = new OpenSpecCliService(workspaceRoot);
      vi.spyOn(service as any, 'execOpenSpec').mockRejectedValue(new Error('Command failed with code 1'));
      await expect(service.listChanges()).rejects.toThrow('Command failed with code 1');
    });

    it('returns enriched changes when CLI returns valid JSON with changes', async () => {
      const listOutput = JSON.stringify({
        changes: [{ name: 'add-dark-mode', completedTasks: 0, totalTasks: 2, lastModified: '2025-01-01' }],
      });
      const statusOutput = JSON.stringify({
        change: 'add-dark-mode',
        artifacts: [{ id: 'proposal', status: 'complete' }],
      });
      let callIndex = 0;
      vi.mocked(spawn).mockImplementation((_cmd, args: readonly string[]) => {
        const stdout = args[0] === 'list' ? listOutput : statusOutput;
        const proc = {
          stdout: {
            on: (_e: string, fn: (d: Buffer) => void) => {
              setImmediate(() => fn(Buffer.from(stdout)));
            },
          },
          stderr: { on: vi.fn() },
          on: (_e: string, fn: (...args: unknown[]) => void) => {
            if (_e === 'close') setImmediate(() => fn(0));
          },
          kill: vi.fn(),
        };
        callIndex += 1;
        return proc as unknown as ReturnType<typeof spawn>;
      });
      const service = new OpenSpecCliService(workspaceRoot);
      const result = await service.listChanges();
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('add-dark-mode');
      expect(result[0].artifacts).toEqual([{ id: 'proposal', outputPath: '', status: 'done' }]);
    });

    it('preserves a custom ordered artifact graph and status-owned outputs', async () => {
      const service = new OpenSpecCliService('/workspace');
      const exec = vi.spyOn(service as any, 'execOpenSpec');

      exec
        .mockResolvedValueOnce(JSON.stringify({
          changes: [{
            name: 'custom-schema-change',
            completedTasks: 0,
            totalTasks: 2,
            lastModified: '2026-08-24T00:00:00.000Z',
          }],
        }))
        .mockResolvedValueOnce(JSON.stringify({
          change: 'custom-schema-change',
          schema: 'custom-schema',
          artifacts: [
            { id: 'overview', status: 'complete', requires: [] },
            { id: 'design-a', status: 'ready', requires: ['overview'], missingDeps: [] },
            { id: 'design-b', status: 'ready', requires: ['overview'], missingDeps: [] },
            { id: 'optional', status: 'skipped', requires: ['overview'], missingDeps: [] },
          ],
          artifactPaths: {
            overview: {
              outputPath: 'openspec/changes/custom-schema-change/overview.md',
              existingOutputPaths: ['openspec/changes/custom-schema-change/overview.md'],
            },
            'design-a': {
              outputPath: 'openspec/changes/custom-schema-change/design-a.md',
              existingOutputPaths: ['openspec/changes/custom-schema-change/design-a.md'],
            },
            'design-b': {
              outputPath: 'openspec/changes/custom-schema-change/design-b.md',
              existingOutputPaths: [
                'openspec/changes/custom-schema-change/design-b.md',
                'openspec/changes/custom-schema-change/design-b.generated.md',
              ],
            },
            optional: {
              outputPath: 'openspec/changes/custom-schema-change/optional.md',
              existingOutputPaths: [],
            },
          },
        }));

      const [change] = await service.listChanges();

      expect(change.workflowSnapshot).toMatchObject({
        changeName: 'custom-schema-change',
        schema: 'custom-schema',
        artifacts: [
          {
            id: 'overview',
            status: 'done',
            requires: [],
            missingDeps: [],
            outputPath: 'openspec/changes/custom-schema-change/overview.md',
            existingOutputPaths: ['openspec/changes/custom-schema-change/overview.md'],
          },
          {
            id: 'design-a',
            status: 'ready',
            requires: ['overview'],
            missingDeps: [],
            outputPath: 'openspec/changes/custom-schema-change/design-a.md',
            existingOutputPaths: ['openspec/changes/custom-schema-change/design-a.md'],
          },
          {
            id: 'design-b',
            status: 'ready',
            requires: ['overview'],
            missingDeps: [],
            outputPath: 'openspec/changes/custom-schema-change/design-b.md',
            existingOutputPaths: [
              'openspec/changes/custom-schema-change/design-b.md',
              'openspec/changes/custom-schema-change/design-b.generated.md',
            ],
          },
          {
            id: 'optional',
            status: 'skipped',
            requires: ['overview'],
            missingDeps: [],
            outputPath: 'openspec/changes/custom-schema-change/optional.md',
            existingOutputPaths: [],
          },
        ],
      });
      expect(change.workflowSnapshot?.artifacts.map((artifact) => artifact.id)).toEqual([
        'overview',
        'design-a',
        'design-b',
        'optional',
      ]);
      expect(change.artifacts?.find((artifact) => artifact.id === 'optional')).toMatchObject({
        id: 'optional',
        status: 'skipped',
      });
    });

    it('fails closed for unknown artifact states without dropping the snapshot', async () => {
      const service = new OpenSpecCliService('/workspace');
      const exec = vi.spyOn(service as any, 'execOpenSpec');

      exec
        .mockResolvedValueOnce(JSON.stringify({
          changes: [{ name: 'unknown-state', completedTasks: 0, totalTasks: 0, lastModified: '2026-08-24' }],
        }))
        .mockResolvedValueOnce(JSON.stringify({
          schema: 'custom-schema',
          artifacts: [{ id: 'future-node', status: 'future-state' }],
        }));

      const [change] = await service.listChanges();

      expect(change.workflowSnapshot?.artifacts).toEqual([
        expect.objectContaining({ id: 'future-node', status: 'blocked' }),
      ]);
      expect(change.attention?.required).toBe(true);
    });

    it('preserves explicit created metadata from openspec list output', async () => {
      const service = new OpenSpecCliService('/workspace');
      const exec = vi.spyOn(service as any, 'execOpenSpec');

      exec
        .mockResolvedValueOnce(JSON.stringify({
          changes: [
            {
              name: 'polish-ui',
              completedTasks: 1,
              totalTasks: 2,
              lastModified: '2026-06-10T12:00:00.000Z',
              createdAt: '2026-06-01T09:00:00.000Z',
            },
          ],
        }))
        .mockResolvedValueOnce(JSON.stringify({
          artifacts: [],
        }));

      await expect(service.listChanges()).resolves.toMatchObject([
        {
          name: 'polish-ui',
          lastModified: '2026-06-10T12:00:00.000Z',
          createdAt: '2026-06-01T09:00:00.000Z',
        },
      ]);
    });

    it('marks metadata-read-failed when getChangeStatus throws (not silent empty artifacts)', async () => {
      const service = new OpenSpecCliService('/workspace');
      const exec = vi.spyOn(service as any, 'execOpenSpec');

      exec
        .mockResolvedValueOnce(JSON.stringify({
          changes: [
            {
              name: 'status-broke',
              completedTasks: 0,
              totalTasks: 2,
              lastModified: '2026-06-10T12:00:00.000Z',
            },
          ],
        }))
        .mockRejectedValueOnce(new Error('status failed'));

      await expect(service.listChanges()).resolves.toMatchObject([
        {
          name: 'status-broke',
          artifacts: [],
          lifecycleStatus: 'planning',
          attention: {
            required: true,
            reasons: ['metadata-read-failed'],
          },
        },
      ]);
    });
  });

  describe('getChangeStatus', () => {
    it('returns status when CLI returns valid JSON', async () => {
      mockSpawnSuccess(JSON.stringify({ change: 'add-foo', artifacts: [{ id: 'proposal', status: 'complete' }] }));
      const service = new OpenSpecCliService(workspaceRoot);
      const result = await service.getChangeStatus('add-foo');
      expect(result.artifacts).toEqual([{ id: 'proposal', status: 'complete' }]);
    });

    it('returns { artifacts: [] } when CLI returns non-JSON', async () => {
      mockSpawnSuccess('Artifacts:\n  ✓ proposal\n');
      const service = new OpenSpecCliService(workspaceRoot);
      const result = await service.getChangeStatus('add-foo');
      expect(result).toEqual({ artifacts: [] });
    });
  });

  describe('showChange', () => {
    it('returns ChangeDetails when CLI returns valid JSON', async () => {
      mockSpawnSuccess(
        JSON.stringify({
          name: 'add-foo',
          schema: 'spec-driven',
          artifacts: [{ id: 'proposal' }],
          tasks: [{ id: '1', title: 'Task 1', done: false }],
          metadata: {},
        })
      );
      const service = new OpenSpecCliService(workspaceRoot);
      const result = await service.showChange('add-foo');
      expect(result.name).toBe('add-foo');
      expect(result.schema).toBe('spec-driven');
      expect(result.artifacts).toHaveLength(1);
      expect(result.tasks).toHaveLength(1);
    });

    it('returns minimal ChangeDetails when CLI returns non-JSON', async () => {
      mockSpawnSuccess('Change: add-foo\nSchema: spec-driven\n...');
      const service = new OpenSpecCliService(workspaceRoot);
      const result = await service.showChange('add-foo');
      expect(result.name).toBe('add-foo');
      expect(result.schema).toBe('unknown');
      expect(result.artifacts).toEqual([]);
      expect(result.tasks).toEqual([]);
      expect(result.metadata).toEqual({});
    });

    it('returns minimal ChangeDetails when CLI exits with code 1', async () => {
      mockVersionThenExit(1, 'Change not found or invalid');
      const service = new OpenSpecCliService(workspaceRoot);
      const result = await service.showChange('add-foo');
      expect(result.name).toBe('add-foo');
      expect(result.schema).toBe('unknown');
      expect(result.artifacts).toEqual([]);
      expect(result.tasks).toEqual([]);
    });
  });

  describe('validateChange', () => {
    it('returns ValidationResult when CLI returns valid JSON', async () => {
      mockSpawnSuccess(JSON.stringify({ valid: true, errors: [], warnings: ['design.md: missing section'] }));
      const service = new OpenSpecCliService(workspaceRoot);
      const result = await service.validateChange('add-foo');
      expect(result.valid).toBe(true);
      expect(result.warnings).toEqual(['design.md: missing section']);
    });

    it('returns valid: false with error when CLI returns non-JSON', async () => {
      mockSpawnSuccess('Validating add-foo...\n  ✓ proposal.md valid\n');
      const service = new OpenSpecCliService(workspaceRoot);
      const result = await service.validateChange('add-foo');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('CLI returned non-JSON output');
      expect(result.warnings).toEqual([]);
    });
  });

  describe('getInstructions', () => {
    it('returns raw string from CLI', async () => {
      mockSpawnSuccess('Create a design.md with Technical Approach section.\n');
      const service = new OpenSpecCliService(workspaceRoot);
      const result = await service.getInstructions('design', 'add-foo');
      expect(result).toContain('Technical Approach');
    });
  });

  describe('createChange', () => {
    it('resolves when CLI exits 0', async () => {
      mockSpawnSuccess('');
      const service = new OpenSpecCliService(workspaceRoot);
      await expect(service.createChange('my-change')).resolves.toBeUndefined();
      expect(spawn).toHaveBeenCalledWith('openspec', ['new', 'change', 'my-change'], expect.any(Object));
    });

    it('uses the resolved absolute command and env for subsequent CLI commands', async () => {
      let call = 0;
      vi.mocked(spawn).mockImplementation((command: string, args: readonly string[], options: any) => {
        call += 1;
        if (call === 1 && command === 'openspec') {
          return {
            stdout: { on: vi.fn() },
            stderr: { on: vi.fn() },
            on: (event: string, fn: (err: Error) => void) => {
              if (event === 'error') setImmediate(() => fn(new Error('spawn openspec ENOENT')));
            },
            kill: vi.fn(),
          } as any;
        }
        if (call === 2 && args.join(' ').includes('command -v openspec')) {
          return {
            stdout: {
              on: (_e: string, fn: (d: Buffer) => void) => {
                setImmediate(() => fn(Buffer.from('/opt/homebrew/bin/openspec\n')));
              },
            },
            stderr: { on: vi.fn() },
            on: (event: string, fn: (...args: unknown[]) => void) => {
              if (event === 'close') setImmediate(() => fn(0));
            },
            kill: vi.fn(),
          } as any;
        }
        if (command === '/opt/homebrew/bin/openspec') {
          expect(options.env.PATH.split(':')).toContain('/opt/homebrew/bin');
        }
        return {
          stdout: {
            on: (_e: string, fn: (d: Buffer) => void) => {
              setImmediate(() => fn(Buffer.from(command === '/opt/homebrew/bin/openspec' && args[0] === '--version' ? '1.3.1' : '')));
            },
          },
          stderr: { on: vi.fn() },
          on: (event: string, fn: (...args: unknown[]) => void) => {
            if (event === 'close') setImmediate(() => fn(0));
          },
          kill: vi.fn(),
        } as any;
      });

      const service = new OpenSpecCliService(workspaceRoot);
      await expect(service.createChange('my-change')).resolves.toBeUndefined();

      expect(spawn).toHaveBeenCalledWith('/opt/homebrew/bin/openspec', ['new', 'change', 'my-change'], expect.any(Object));
    });
  });

  describe('archiveChange', () => {
    it('resolves when CLI exits 0', async () => {
      mockSpawnSuccess('');
      const service = new OpenSpecCliService(workspaceRoot);
      await expect(service.archiveChange('my-change')).resolves.toBeUndefined();
      expect(spawn).toHaveBeenCalledWith('openspec', ['archive', 'my-change', '--yes'], expect.any(Object));
    });

    it('rejects when archive command exits 0 but reports an abort', async () => {
      mockSpawnSuccess('Task status: ✓ Complete\nAborted. No files were changed.\n');
      const service = new OpenSpecCliService(workspaceRoot);
      await expect(service.archiveChange('my-change')).rejects.toThrow('Aborted. No files were changed.');
    });

    it('uses a longer timeout for archive operations', async () => {
      vi.useFakeTimers();
      const archiveProc = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn(),
        kill: vi.fn(),
      };
      vi.mocked(spawn).mockImplementation((_cmd, args: readonly string[]) => {
        if (args[0] === '--version') {
          return {
            stdout: {
              on: (_e: string, fn: (d: Buffer) => void) => {
                setImmediate(() => fn(Buffer.from('1.3.1')));
              },
            },
            stderr: { on: vi.fn() },
            on: (_e: string, fn: (...args: any[]) => void) => {
              if (_e === 'close') setImmediate(() => fn(0));
            },
            kill: vi.fn(),
          } as any;
        }
        return archiveProc as any;
      });

      try {
        const service = new OpenSpecCliService(workspaceRoot);
        const promise = service.archiveChange('my-change');
        const expectation = expect(promise).rejects.toThrow('Command timed out after 120 seconds');

        await vi.advanceTimersByTimeAsync(30000);
        expect(archiveProc.kill).not.toHaveBeenCalled();

        await vi.advanceTimersByTimeAsync(90000);
        await expectation;
        expect(archiveProc.kill).toHaveBeenCalled();
      } finally {
        vi.useRealTimers();
      }
    });
  });

  it('getVersion returns trimmed output on success', async () => {
    mockSpawnSuccess('  1.2.3  \n');
    const service = new OpenSpecCliService(workspaceRoot);
    const version = await service.getVersion();
    expect(version).toBe('1.2.3');
  });

  it('getVersion throws when command fails', async () => {
    mockSpawnExit(127, 'not found');
    const service = new OpenSpecCliService(workspaceRoot);
    await expect(service.getVersion()).rejects.toThrow();
  });

  it('shows diagnostic-aware notification when CLI resolution fails', async () => {
    const vscode = await import('vscode');
    // Simulate resolver throwing OpenSpecCliResolutionError by making all resolution attempts fail
    vi.mocked(spawn).mockImplementation(() => createSpawnErrorProcess('spawn openspec ENOENT') as any);

    const service = new OpenSpecCliService(workspaceRoot);
    await expect(service.getVersion()).rejects.toThrow();

    // Should show diagnostic-aware message with top-3 recovery actions
    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.any(String),
      expect.any(String)
    );
  });

  it('reloads the window when retry is selected from CLI not found message', async () => {
    const vscode = await import('vscode');
    vi.mocked(vscode.window.showErrorMessage).mockResolvedValueOnce('Retry' as any);
    mockSpawnExit(127, 'command not found');
    const service = new OpenSpecCliService(workspaceRoot);

    await expect(service.getVersion()).rejects.toThrow();

    await new Promise((resolve) => setImmediate(resolve));
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith('workbench.action.reloadWindow');
  });

  it('opens cliPath settings when settings action is selected from CLI not found message', async () => {
    const vscode = await import('vscode');
    vi.mocked(vscode.window.showErrorMessage).mockResolvedValueOnce('Open CLI Path Settings' as any);
    mockSpawnExit(127, 'command not found');
    const service = new OpenSpecCliService(workspaceRoot);

    await expect(service.getVersion()).rejects.toThrow();

    await new Promise((resolve) => setImmediate(resolve));
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith('workbench.action.openSettings', 'openspec.cliPath');
  });

  it('command execution error rejects with error', async () => {
    mockSpawnExit(1, 'some error');
    const service = new OpenSpecCliService(workspaceRoot);
    await expect(service.getVersion()).rejects.toThrow();
  });

  it('rejects with timeout error when CLI does not complete within 30s', async () => {
    vi.useFakeTimers();
    vi.mocked(spawn).mockImplementation((_cmd, args: readonly string[]) => {
      if (args[0] === '--version') {
        return {
          stdout: {
            on: (_e: string, fn: (d: Buffer) => void) => {
              setImmediate(() => fn(Buffer.from('1.3.1')));
            },
          },
          stderr: { on: vi.fn() },
          on: (_e: string, fn: (...args: any[]) => void) => {
            if (_e === 'close') setImmediate(() => fn(0));
          },
          kill: vi.fn(),
        } as any;
      }
      return {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn(),
        kill: vi.fn(),
      } as any;
    });

    const service = new OpenSpecCliService(workspaceRoot);
    const promise = service.listSpecs();
    const expectation = expect(promise).rejects.toThrow('Command timed out after 30 seconds');

    // Advance past all 3 retry timeouts (30s each) plus backoff (1s + 2s)
    await vi.advanceTimersByTimeAsync(100000);

    await expectation;
    vi.useRealTimers();
  });
});

describe('CLI activation diagnostics', () => {
  const workspaceRoot = '/fake/workspace';

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.mocked(spawn).mockReset();
    // Reset vscode mock to default (empty cliPath)
    const vscode = vi.mocked(await import('vscode'));
    vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
      get: vi.fn(() => ''),
    } as any);
  });

  // Helper to simulate full resolver failure chain (openspec → shell → known paths all fail)
  function mockResolverTotalFailure() {
    vi.mocked(spawn).mockImplementation((command: string, args: readonly string[]) => {
      if (command === 'openspec') {
        return createSpawnErrorProcess('spawn openspec ENOENT') as any;
      }
      // Shell command and known paths all fail
      return createSpawnErrorProcess(`spawn ${command} ENOENT`) as any;
    });
  }

  // Helper to simulate configured path failure
  function mockConfiguredPathFailure(path: string) {
    vi.mocked(spawn).mockImplementation((command: string) => {
      if (command === path) {
        return createSpawnErrorProcess(`spawn ${path} ENOENT`) as any;
      }
      return createSpawnErrorProcess(`spawn ${command} ENOENT`) as any;
    });
  }

  it('stores cli-not-found diagnostic when resolver cannot resolve openspec', async () => {
    mockResolverTotalFailure();

    const service = new OpenSpecCliService(workspaceRoot);
    await expect(service.checkAvailability(false)).resolves.toBe(false);

    expect(service.getCliActivationDiagnostic()).toMatchObject({
      category: 'cli-not-found',
      recoveryActions: ['open-docs', 'open-settings', 'retry', 'copy-diagnostics'],
    });
  });

  it('stores configured-path-invalid diagnostic without falling through to auto discovery', async () => {
    const vscode = await import('vscode');
    vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
      get: vi.fn((key: string) => (key === 'cliPath' ? '/bad/openspec' : false)),
    } as any);
    mockConfiguredPathFailure('/bad/openspec');

    const service = new OpenSpecCliService(workspaceRoot);
    await expect(service.checkAvailability(false)).resolves.toBe(false);

    expect(service.getCliActivationDiagnostic()?.category).toBe('configured-path-invalid');
    // Should only try the configured path, not fall through to other resolution methods
    const calls = vi.mocked(spawn).mock.calls;
    const firstCall = calls[0];
    expect(firstCall[0]).toBe('/bad/openspec');
  });

  it('stores spawn-failed diagnostic when spawn fails after resolution', async () => {
    // First: make resolver succeed and cache a path
    vi.mocked(spawn).mockImplementation((command: string, args: readonly string[]) => {
      if (command === 'openspec') {
        return createSpawnErrorProcess('spawn openspec ENOENT') as any;
      }
      if (args.join(' ').includes('command -v openspec')) {
        return createSpawnSuccessProcess('/usr/local/bin/openspec\n') as any;
      }
      // Resolver validation of /usr/local/bin/openspec succeeds
      return createSpawnSuccessProcess('1.3.1\n') as any;
    });

    const service = new OpenSpecCliService(workspaceRoot);
    await service.checkAvailability(false);
    expect(service.getCliActivationDiagnostic()).toBeNull();

    // Now make the actual spawn fail for subsequent commands
    vi.mocked(spawn).mockImplementation((command: string, _args: readonly string[]) => {
      if (command === '/usr/local/bin/openspec') {
        return createSpawnErrorProcess('spawn /usr/local/bin/openspec ENOENT') as any;
      }
      return createSpawnErrorProcess(`spawn ${command} ENOENT`) as any;
    });

    await expect(service.getVersion()).rejects.toThrow();

    const diagnostic = service.getCliActivationDiagnostic();
    expect(diagnostic?.category).toBe('spawn-failed');
    expect(diagnostic?.normalizedMessage).toContain('enoent');
  });

  it('stores permission-denied diagnostic for EACCES errors', async () => {
    let callCount = 0;
    vi.mocked(spawn).mockImplementation((command: string, args: readonly string[]) => {
      callCount += 1;
      if (command === 'openspec') {
        return createSpawnErrorProcess('spawn openspec ENOENT') as any;
      }
      if (args.join(' ').includes('command -v openspec')) {
        return createSpawnSuccessProcess('/usr/local/bin/openspec\n') as any;
      }
      if (command === '/usr/local/bin/openspec') {
        return createSpawnErrorProcess('spawn /usr/local/bin/openspec EACCES') as any;
      }
      return createSpawnErrorProcess(`spawn ${command} ENOENT`) as any;
    });

    const service = new OpenSpecCliService(workspaceRoot);
    await expect(service.checkAvailability(false)).resolves.toBe(false);

    expect(service.getCliActivationDiagnostic()?.category).toBe('permission-denied');
  });

  it('stores shell-resolution-failed diagnostic when shell fallback fails', async () => {
    // On non-Windows: shell fails, and known paths also fail
    const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
    Object.defineProperty(process, 'platform', { value: 'darwin' });

    try {
      vi.mocked(spawn).mockImplementation((command: string, args: readonly string[]) => {
        if (command === 'openspec') {
          return createSpawnErrorProcess('spawn openspec ENOENT') as any;
        }
        if (args.join(' ').includes('command -v openspec')) {
          // Shell fails with timeout
          return createSpawnErrorProcess('shell command timed out') as any;
        }
        // Known paths all fail
        return createSpawnErrorProcess(`spawn ${command} ENOENT`) as any;
      });

      const service = new OpenSpecCliService(workspaceRoot);
      await expect(service.checkAvailability(false)).resolves.toBe(false);

      const diagnostic = service.getCliActivationDiagnostic();
      expect(diagnostic).not.toBeNull();
      // The classification depends on resolver diagnostics containing 'login shell path: failed'
      expect(diagnostic?.category).toBe('shell-resolution-failed');
    } finally {
      if (originalPlatform) {
        Object.defineProperty(process, 'platform', originalPlatform);
      }
    }
  });

  it('warns for unsupported minimum version but still reports availability', async () => {
    mockSpawnSuccess('0.9.0');
    const vscode = await import('vscode');
    const service = new OpenSpecCliService(workspaceRoot);

    await expect(service.checkAvailability()).resolves.toBe(true);

    expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
      expect.stringContaining('OpenSpec CLI 0.9.0'),
      expect.any(String)
    );
    expect(service.getCliActivationDiagnostic()).toBeNull();
  });

  it('clears diagnostic after successful availability check', async () => {
    // First fail
    mockResolverTotalFailure();
    const service = new OpenSpecCliService(workspaceRoot);
    await service.checkAvailability(false);
    expect(service.getCliActivationDiagnostic()).not.toBeNull();

    // Then succeed
    mockSpawnSuccess('1.3.1');
    await service.checkAvailability(false);
    expect(service.getCliActivationDiagnostic()).toBeNull();
  });

  it('deduplicates notifications by category and normalized message', async () => {
    const vscode = await import('vscode');
    mockResolverTotalFailure();

    const service = new OpenSpecCliService(workspaceRoot);
    await service.checkAvailability(true);
    await service.checkAvailability(true);

    // Should only show once per session for same dedupe key
    expect(vscode.window.showErrorMessage).toHaveBeenCalledTimes(1);
  });

  it('shows top-3 recovery actions in notification', async () => {
    const vscode = await import('vscode');
    mockResolverTotalFailure();

    const service = new OpenSpecCliService(workspaceRoot);
    await service.checkAvailability(true);

    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.any(String),
      expect.any(String)
    );
  });

  it('does not show diagnostic notification for workspace-not-initialized errors', async () => {
    const vscode = await import('vscode');
    mockSpawnSuccess('1.3.1');
    vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
      get: vi.fn(() => ''),
    } as any);

    // Simulate a workspace not initialized error (exit 1 with specific message)
    vi.mocked(spawn).mockImplementation((_cmd, args: readonly string[]) => {
      if (args[0] === '--version') {
        return {
          stdout: {
            on: (_e: string, fn: (d: Buffer) => void) => {
              setImmediate(() => fn(Buffer.from('1.3.1')));
            },
          },
          stderr: { on: vi.fn() },
          on: (_e: string, fn: (...args: any[]) => void) => {
            if (_e === 'close') setImmediate(() => fn(0));
          },
          kill: vi.fn(),
        } as any;
      }
      return {
        stdout: { on: vi.fn() },
        stderr: {
          on: (_e: string, fn: (d: Buffer) => void) => {
            setImmediate(() => fn(Buffer.from('Workspace not initialized')));
          },
        },
        on: (_e: string, fn: (...args: any[]) => void) => {
          if (_e === 'close') setImmediate(() => fn(1));
        },
        kill: vi.fn(),
      } as any;
    });

    const service = new OpenSpecCliService(workspaceRoot);
    // listChanges should fail but not show CLI activation diagnostic
    await expect(service.listChanges()).rejects.toThrow();

    // Workspace errors should not create CLI activation diagnostics
    expect(service.getCliActivationDiagnostic()).toBeNull();
  });
});

describe('argsPrefix and scope support', () => {
  const workspaceRoot = '/fake/workspace';

  beforeEach(() => {
    vi.mocked(spawn).mockReset();
  });

  function mockVersionThenCommand(commandStdout: string) {
    let versionCalled = false;
    vi.mocked(spawn).mockImplementation((_command: string, args: readonly string[], _options?: any) => {
      if (args[0] === '--version' && !versionCalled) {
        versionCalled = true;
        return createSpawnSuccessProcess('1.3.1') as any;
      }
      return createSpawnSuccessProcess(commandStdout) as any;
    });
  }

  function mockVersionThenCommandExit(code: number, stderrOut = '') {
    let versionCalled = false;
    vi.mocked(spawn).mockImplementation((_command: string, args: readonly string[], _options?: any) => {
      if (args[0] === '--version' && !versionCalled) {
        versionCalled = true;
        return createSpawnSuccessProcess('1.3.1') as any;
      }
      return {
        stdout: { on: vi.fn() },
        stderr: {
          on: (_e: string, fn: (d: Buffer) => void) => {
            if (stderrOut) setImmediate(() => fn(Buffer.from(stderrOut)));
          },
        },
        on: (_e: string, fn: (...args: any[]) => void) => {
          if (_e === 'close') setImmediate(() => fn(code));
        },
        kill: vi.fn(),
      } as any;
    });
  }

  it('runJson spawns with argsPrefix from runtime (installed mode)', async () => {
    // Simulate installed mode: resolver checks version, then runJson spawns the command
    let spawnCalls: Array<{ command: string; args: readonly string[] }> = [];
    vi.mocked(spawn).mockImplementation((command: string, args: readonly string[], _options?: any) => {
      spawnCalls.push({ command, args });
      if (args[0] === '--version') {
        return createSpawnSuccessProcess('1.3.1') as any;
      }
      expect(command).toBe('openspec');
      return createSpawnSuccessProcess(JSON.stringify({ changes: [{ name: 'test-change' }] })) as any;
    });

    const service = new OpenSpecCliService(workspaceRoot);
    const result = await service.runJson(['list', '--json']);
    expect(result).toEqual({ changes: [{ name: 'test-change' }] });
    // Verify the second call has the correct args (first call is --version from resolver)
    expect(spawnCalls.length).toBe(2);
    expect(spawnCalls[1].command).toBe('openspec');
    expect(spawnCalls[1].args).toEqual(['list', '--json']);
  });

  it('runJson prepends argsPrefix in local source mode', async () => {
    // Simulate local source mode by mocking spawn to expect node + bin/openspec.js as prefix
    let capturedCommand = '';
    let capturedArgs: readonly string[] = [];
    vi.mocked(spawn).mockImplementation((command: string, args: readonly string[], _options?: any) => {
      capturedCommand = command;
      capturedArgs = args;
      return createSpawnSuccessProcess(JSON.stringify({ result: 'ok' })) as any;
    });

    const service = new OpenSpecCliService(workspaceRoot);

    // Override the resolver's resolveRuntime to return local source mode
    const originalResolveRuntime = (service as any).resolver.resolveRuntime.bind((service as any).resolver);
    (service as any).resolver.resolveRuntime = vi.fn().mockResolvedValue({
      command: process.execPath,
      argsPrefix: ['/Users/test/openspec/bin/openspec.js'],
      env: process.env,
      version: '1.4.0',
      source: 'localSource',
      sourceLabel: 'local source (/Users/test/openspec)',
      diagnostics: [],
    });

    try {
      const result = await service.runJson(['status', '--json']);
      expect(result).toEqual({ result: 'ok' });
      expect(capturedCommand).toBe(process.execPath);
      expect(capturedArgs).toEqual(['/Users/test/openspec/bin/openspec.js', 'status', '--json']);
    } finally {
      (service as any).resolver.resolveRuntime = originalResolveRuntime;
    }
  });

  it('listChanges spawns node + bin/openspec.js prefix in localSource mode (main path)', async () => {
    // The review flagged that listChanges/create/validate/archive still used the old
    // resolver.resolve() path and ignored argsPrefix. After unifying, the main path
    // must spawn node with the bin/openspec.js prefix.
    const listCalls: Array<{ command: string; args: readonly string[] }> = [];
    vi.mocked(spawn).mockImplementation((command: string, args: readonly string[], _options?: any) => {
      listCalls.push({ command, args });
      if (args[args.length - 2] === 'list') {
        return createSpawnSuccessProcess(
          JSON.stringify({ changes: [{ name: 'demo' }] })
        ) as any;
      }
      return createSpawnSuccessProcess(JSON.stringify({ artifacts: [] })) as any;
    });

    const service = new OpenSpecCliService(workspaceRoot);
    (service as any).resolver.resolveRuntime = vi.fn().mockResolvedValue({
      command: process.execPath,
      argsPrefix: ['/Users/test/openspec/bin/openspec.js'],
      env: process.env,
      version: '1.4.0',
      source: 'localSource',
      sourceLabel: 'local source (/Users/test/openspec)',
      diagnostics: [],
    });

    await service.listChanges();

    // The list call: prefix + ['list', '--json']
    const listCall = listCalls.find((c) => c.args[c.args.length - 2] === 'list');
    expect(listCall).toBeDefined();
    expect(listCall!.command).toBe(process.execPath);
    expect(listCall!.args).toEqual([
      '/Users/test/openspec/bin/openspec.js',
      'list',
      '--json',
    ]);
  });

  it('runJson throws when JSON parsing fails', async () => {
    mockVersionThenCommand('not valid json');

    const service = new OpenSpecCliService(workspaceRoot);
    await expect(service.runJson(['list', '--json'])).rejects.toThrow();
  });

  it('runJson rejects when command exits non-zero', async () => {
    mockVersionThenCommandExit(1, 'error output');

    const service = new OpenSpecCliService(workspaceRoot);
    await expect(service.runJson(['list', '--json'])).rejects.toThrow('Command failed with code 1');
  });

  it('root-resolving commands append --store for a store scope', async () => {
    // Version probe (installed mode) then the actual command(s).
    const listCalls: Array<{ command: string; args: readonly string[] }> = [];
    vi.mocked(spawn).mockImplementation((command: string, args: readonly string[], _options?: any) => {
      if (args[0] === '--version') {
        return createSpawnSuccessProcess('1.3.1') as any;
      }
      // Capture every non-version spawn (list + status enrich).
      listCalls.push({ command, args });
      if (args[0] === 'list') {
        return createSpawnSuccessProcess(
          JSON.stringify({ changes: [{ name: 'demo' }] })
        ) as any;
      }
      // status --change demo --json
      return createSpawnSuccessProcess(JSON.stringify({ artifacts: [] })) as any;
    });

    const service = new OpenSpecCliService(workspaceRoot);
    await service.listChanges({ storeId: 'store-123' });

    const listCall = listCalls.find((c) => c.args[0] === 'list');
    expect(listCall).toBeDefined();
    expect(listCall!.args).toEqual(['list', '--json', '--store', 'store-123']);
    // The status enrich call must also be store-scoped.
    const statusCall = listCalls.find((c) => c.args[0] === 'status');
    expect(statusCall!.args).toEqual([
      'status',
      '--change',
      'demo',
      '--json',
      '--store',
      'store-123',
    ]);
  });

  it('createChange appends --store for a store scope', async () => {
    let commandArgs: readonly string[] = [];
    vi.mocked(spawn).mockImplementation((_command: string, args: readonly string[], _options?: any) => {
      if (args[0] === '--version') {
        return createSpawnSuccessProcess('1.3.1') as any;
      }
      commandArgs = args;
      return createSpawnSuccessProcess('') as any;
    });

    const service = new OpenSpecCliService(workspaceRoot);
    await service.createChange('my-change', { storeId: 'store-123' });

    expect(commandArgs).toEqual(['new', 'change', 'my-change', '--store', 'store-123']);
  });

  it('root-resolving commands omit --store for a local scope (no storeId)', async () => {
    const listCalls: Array<{ command: string; args: readonly string[] }> = [];
    vi.mocked(spawn).mockImplementation((command: string, args: readonly string[], _options?: any) => {
      if (args[0] === '--version') {
        return createSpawnSuccessProcess('1.3.1') as any;
      }
      listCalls.push({ command, args });
      if (args[0] === 'list') {
        return createSpawnSuccessProcess(
          JSON.stringify({ changes: [{ name: 'demo' }] })
        ) as any;
      }
      return createSpawnSuccessProcess(JSON.stringify({ artifacts: [] })) as any;
    });

    const service = new OpenSpecCliService(workspaceRoot);
    // No scope at all — same as local root.
    await service.listChanges();

    const listCall = listCalls.find((c) => c.args[0] === 'list');
    expect(listCall).toBeDefined();
    expect(listCall!.args).toEqual(['list', '--json']);
  });

  it('spawns local OpenSpec commands with cwd equal to the service construction root', async () => {
    // A per-scope OpenSpecCliService constructed for a declared project root must
    // spawn with cwd = that root so local OpenSpec commands run from the project.
    const declaredRoot = '/work/fastgpt';
    const capturedOptions: Array<{ cwd?: string }> = [];
    vi.mocked(spawn).mockImplementation((_command: string, args: readonly string[], options?: any) => {
      if (args[0] === '--version') {
        return createSpawnSuccessProcess('1.3.1') as any;
      }
      capturedOptions.push({ cwd: options?.cwd });
      return createSpawnSuccessProcess(JSON.stringify({ changes: [] })) as any;
    });

    const service = new OpenSpecCliService(declaredRoot);
    await service.listChanges();

    // Every command (list/status) spawned with cwd = the declared project root.
    expect(capturedOptions.length).toBeGreaterThan(0);
    expect(capturedOptions.every((o) => o.cwd === declaredRoot)).toBe(true);
  });
});
