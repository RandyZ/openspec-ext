import { spawn } from 'child_process';
import * as path from 'path';
import * as vscode from 'vscode';
import { logger } from '../utils/logger';

export interface ResolvedOpenSpecCli {
  command: string;
  version: string;
  diagnostics: string[];
}

export interface OpenSpecCliResolverOptions {
  timeoutMs?: number;
  knownPaths?: string[];
  shell?: string;
}

const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_KNOWN_PATHS = [
  '/opt/homebrew/bin/openspec',
  '/usr/local/bin/openspec',
  '/usr/bin/openspec',
];

export class OpenSpecCliResolutionError extends Error {
  constructor(
    message: string,
    public readonly diagnostics: string[]
  ) {
    super(message);
    this.name = 'OpenSpecCliResolutionError';
  }
}

export class OpenSpecCliResolver {
  private cached: ResolvedOpenSpecCli | null = null;
  private lastConfiguredPath = '';

  constructor(
    private readonly cwd: string,
    private readonly options: OpenSpecCliResolverOptions = {}
  ) {}

  clearCache(): void {
    this.cached = null;
  }

  async resolve(): Promise<ResolvedOpenSpecCli> {
    const configuredPath = this.getConfiguredPath();
    if (this.cached && configuredPath === this.lastConfiguredPath) {
      return this.cached;
    }

    this.cached = null;
    this.lastConfiguredPath = configuredPath;

    const diagnostics: string[] = [
      `openspec.cliPath=${configuredPath || '<empty>'}`,
      `process.env.PATH=${process.env.PATH ?? '<unset>'}`,
      `process.env.SHELL=${process.env.SHELL ?? '<unset>'}`,
    ];

    if (configuredPath) {
      const resolved = await this.tryCommand(configuredPath, diagnostics, 'configured path');
      if (resolved) return this.cache(resolved);
      throw new OpenSpecCliResolutionError(`Configured OpenSpec CLI path is invalid: ${configuredPath}`, diagnostics);
    }

    const direct = await this.tryCommand('openspec', diagnostics, 'extension host PATH');
    if (direct) return this.cache(direct);

    const shellPath = await this.resolveFromShell(diagnostics);
    if (shellPath) {
      const shellResolved = await this.tryCommand(shellPath, diagnostics, 'login shell PATH');
      if (shellResolved) return this.cache(shellResolved);
    }

    for (const candidate of this.options.knownPaths ?? DEFAULT_KNOWN_PATHS) {
      const known = await this.tryCommand(candidate, diagnostics, `known path ${candidate}`);
      if (known) return this.cache(known);
    }

    throw new OpenSpecCliResolutionError('OpenSpec CLI executable could not be resolved', diagnostics);
  }

  private cache(resolved: ResolvedOpenSpecCli): ResolvedOpenSpecCli {
    this.cached = resolved;
    return resolved;
  }

  private getConfiguredPath(): string {
    return (vscode.workspace.getConfiguration('openspec').get<string>('cliPath') ?? '').trim();
  }

  private async tryCommand(
    command: string,
    diagnostics: string[],
    label: string
  ): Promise<ResolvedOpenSpecCli | null> {
    try {
      const version = (await this.spawnAndCollect(command, ['--version'], this.options.timeoutMs)).trim();
      diagnostics.push(`${label}: ok (${command}) -> ${version}`);
      return { command, version, diagnostics: [...diagnostics] };
    } catch (err) {
      diagnostics.push(`${label}: failed (${command}) ${(err as Error).message}`);
      return null;
    }
  }

  private async resolveFromShell(diagnostics: string[]): Promise<string | null> {
    if (process.platform === 'win32') {
      diagnostics.push('login shell PATH: skipped on Windows');
      return null;
    }

    const shell = this.options.shell || process.env.SHELL || '/bin/zsh';
    if (!/^\/[\w./-]+$/.test(shell)) {
      diagnostics.push(`login shell PATH: skipped unsafe shell ${shell}`);
      return null;
    }

    try {
      const stdout = await this.spawnAndCollect(
        shell,
        ['-l', '-c', 'command -v openspec'],
        this.options.timeoutMs
      );
      const resolved = stdout.trim().split(/\r?\n/)[0]?.trim();
      diagnostics.push(`login shell PATH: ${resolved || '<empty>'}`);
      return resolved || null;
    } catch (err) {
      diagnostics.push(`login shell PATH: failed ${(err as Error).message}`);
      return null;
    }
  }

  private spawnAndCollect(command: string, args: string[], timeoutMs = DEFAULT_TIMEOUT_MS): Promise<string> {
    return new Promise((resolve, reject) => {
      const proc = spawn(command, args, {
        cwd: this.cwd,
        env: this.buildCommandEnv(command),
      });
      let stdout = '';
      let stderr = '';
      let settled = false;
      const timeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        proc.kill();
        reject(new Error(`Command timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      proc.stdout?.on('data', (data) => {
        stdout += data.toString();
      });
      proc.stderr?.on('data', (data) => {
        stderr += data.toString();
      });
      proc.on('error', (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        reject(error);
      });
      proc.on('close', (code) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`Command failed with code ${code ?? -1}: ${stderr}`));
        }
      });
    });
  }

  private buildCommandEnv(command: string): NodeJS.ProcessEnv {
    if (!path.isAbsolute(command)) {
      return process.env;
    }
    const commandDir = path.dirname(command);
    return {
      ...process.env,
      PATH: [commandDir, process.env.PATH].filter(Boolean).join(path.delimiter),
    };
  }
}

