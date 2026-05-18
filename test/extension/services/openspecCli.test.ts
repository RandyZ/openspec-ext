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
    showInformationMessage: vi.fn(() => Promise.resolve()),
  },
  env: {
    openExternal: vi.fn(() => Promise.resolve()),
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

describe('OpenSpecCliService', () => {
  const workspaceRoot = '/fake/workspace';

  beforeEach(() => {
    vi.mocked(spawn).mockReset();
  });

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

  it('listSpecs returns empty array for human-readable "Specs: ..." output', async () => {
    mockSpawnSuccess('Specs: chat-bi-table-pagination requirement-spec some-other\n');
    const service = new OpenSpecCliService(workspaceRoot);
    const result = await service.listSpecs();
    expect(result).toEqual([]);
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
      expect(spawn).toHaveBeenCalledWith('openspec', ['archive', 'my-change'], expect.any(Object));
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

  it('calls showCliNotFoundError when exit code 127 (command not found)', async () => {
    const vscode = await import('vscode');
    mockSpawnExit(127, 'command not found');
    const service = new OpenSpecCliService(workspaceRoot);
    await expect(service.getVersion()).rejects.toThrow();
    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
      'OpenSpec CLI not found. Install it or configure openspec.cliPath.',
      'Install Instructions',
      'Retry',
      'Open CLI Path Settings'
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
