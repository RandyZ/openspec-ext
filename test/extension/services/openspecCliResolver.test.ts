import { describe, it, expect, vi, beforeEach } from 'vitest';
import { spawn } from 'child_process';
import { OpenSpecCliResolutionError, OpenSpecCliResolver } from '@extension/services/openspecCliResolver';

let cliPath = '';

vi.mock('vscode', () => ({
  workspace: {
    getConfiguration: vi.fn(() => ({
      get: vi.fn((key: string) => (key === 'cliPath' ? cliPath : undefined)),
    })),
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

type SpawnCall = { command: string; args: string[] };

function createProcess(stdout: string, code = 0) {
  return {
    stdout: {
      on: (event: string, cb: (chunk: Buffer) => void) => {
        if (event === 'data' && stdout) setImmediate(() => cb(Buffer.from(stdout)));
      },
    },
    stderr: { on: vi.fn() },
    on: (event: string, cb: (...args: unknown[]) => void) => {
      if (event === 'close') setImmediate(() => cb(code));
    },
    kill: vi.fn(),
  };
}

function createSpawnError(message = 'spawn openspec ENOENT') {
  return {
    stdout: { on: vi.fn() },
    stderr: { on: vi.fn() },
    on: (event: string, cb: (error: Error) => void) => {
      if (event === 'error') setImmediate(() => cb(new Error(message)));
    },
    kill: vi.fn(),
  };
}

describe('OpenSpecCliResolver', () => {
  const calls: SpawnCall[] = [];

  beforeEach(() => {
    cliPath = '';
    calls.length = 0;
    vi.mocked(spawn).mockReset();
  });

  it('uses configured openspec.cliPath first and validates it', async () => {
    cliPath = '/custom/bin/openspec';
    vi.mocked(spawn).mockImplementation((command: string, args: string[]) => {
      calls.push({ command, args });
      return createProcess('1.3.1') as any;
    });

    const result = await new OpenSpecCliResolver('/workspace').resolve();

    expect(result.command).toBe('/custom/bin/openspec');
    expect(result.version).toBe('1.3.1');
    expect(calls).toEqual([{ command: '/custom/bin/openspec', args: ['--version'] }]);
  });

  it('uses Extension Host PATH command when direct openspec works', async () => {
    vi.mocked(spawn).mockImplementation((command: string, args: string[]) => {
      calls.push({ command, args });
      return createProcess('1.3.1') as any;
    });

    const result = await new OpenSpecCliResolver('/workspace').resolve();

    expect(result.command).toBe('openspec');
    expect(calls).toEqual([{ command: 'openspec', args: ['--version'] }]);
  });

  it('falls back to login shell command -v when direct PATH cannot spawn openspec', async () => {
    vi.mocked(spawn).mockImplementation((command: string, args: string[]) => {
      calls.push({ command, args });
      if (command === 'openspec') return createSpawnError() as any;
      if (args.join(' ').includes('command -v openspec')) return createProcess('/opt/homebrew/bin/openspec\n') as any;
      if (command === '/opt/homebrew/bin/openspec') return createProcess('1.3.1') as any;
      return createSpawnError(`unexpected ${command}`) as any;
    });

    const result = await new OpenSpecCliResolver('/workspace', { shell: '/bin/zsh' }).resolve();

    expect(result.command).toBe('/opt/homebrew/bin/openspec');
    expect(calls.map((c) => c.command)).toEqual(['openspec', '/bin/zsh', '/opt/homebrew/bin/openspec']);
  });

  it('adds the resolved executable directory to the validation PATH', async () => {
    vi.mocked(spawn).mockImplementation((command: string, args: string[], options: any) => {
      calls.push({ command, args });
      if (command === 'openspec') return createSpawnError() as any;
      if (args.join(' ').includes('command -v openspec')) return createProcess('/usr/local/bin/openspec\n') as any;
      if (command === '/usr/local/bin/openspec') {
        expect(options.env.PATH.split(':')).toContain('/usr/local/bin');
        return createProcess('1.3.1') as any;
      }
      return createSpawnError(`unexpected ${command}`) as any;
    });

    await new OpenSpecCliResolver('/workspace', { shell: '/bin/zsh' }).resolve();
  });

  it('continues to known install paths when shell discovery fails', async () => {
    vi.mocked(spawn).mockImplementation((command: string, args: string[]) => {
      calls.push({ command, args });
      if (command === '/usr/local/bin/openspec') return createProcess('1.3.1') as any;
      return createSpawnError() as any;
    });

    const result = await new OpenSpecCliResolver('/workspace', {
      shell: '/bin/zsh',
      knownPaths: ['/opt/homebrew/bin/openspec', '/usr/local/bin/openspec'],
    }).resolve();

    expect(result.command).toBe('/usr/local/bin/openspec');
    expect(calls.map((c) => c.command)).toContain('/usr/local/bin/openspec');
  });

  it('throws diagnostics when every resolution strategy fails', async () => {
    vi.mocked(spawn).mockImplementation((command: string, args: string[]) => {
      calls.push({ command, args });
      return createSpawnError(`missing ${command}`) as any;
    });

    await expect(
      new OpenSpecCliResolver('/workspace', {
        shell: '/bin/zsh',
        knownPaths: ['/missing/openspec'],
      }).resolve()
    ).rejects.toMatchObject({
      name: 'OpenSpecCliResolutionError',
      diagnostics: expect.arrayContaining([
        expect.stringContaining('openspec.cliPath=<empty>'),
        expect.stringContaining('process.env.PATH='),
        expect.stringContaining('process.env.SHELL='),
        expect.stringContaining('extension host PATH: failed'),
        expect.stringContaining('known path /missing/openspec: failed'),
      ]),
    } satisfies Partial<OpenSpecCliResolutionError>);
  });

  it('reports invalid configured path instead of falling through', async () => {
    cliPath = '/bad/openspec';
    vi.mocked(spawn).mockImplementation((command: string, args: string[]) => {
      calls.push({ command, args });
      return createSpawnError(`missing ${command}`) as any;
    });

    await expect(new OpenSpecCliResolver('/workspace').resolve()).rejects.toThrow(
      'Configured OpenSpec CLI path is invalid'
    );
    expect(calls.map((c) => c.command)).toEqual(['/bad/openspec']);
  });

  it('invalidates cached resolution when openspec.cliPath changes', async () => {
    cliPath = '/first/openspec';
    vi.mocked(spawn).mockImplementation((command: string, args: string[]) => {
      calls.push({ command, args });
      return createProcess('1.3.1') as any;
    });
    const resolver = new OpenSpecCliResolver('/workspace');

    await resolver.resolve();
    cliPath = '/second/openspec';
    await resolver.resolve();

    expect(calls.map((c) => c.command)).toEqual(['/first/openspec', '/second/openspec']);
  });
});
