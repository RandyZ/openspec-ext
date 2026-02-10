import { describe, it, expect, vi, beforeEach } from 'vitest';
import { spawn } from 'child_process';
import { OpenSpecCliService } from './openspecCli';

vi.mock('vscode', () => ({
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
}));

vi.mock('../utils/logger', () => ({
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

  it('command execution error rejects with error', async () => {
    mockSpawnExit(1, 'some error');
    const service = new OpenSpecCliService(workspaceRoot);
    await expect(service.getVersion()).rejects.toThrow();
  });
});
