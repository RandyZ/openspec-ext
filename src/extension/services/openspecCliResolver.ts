import { spawn } from 'child_process';
import * as path from 'path';
import * as vscode from 'vscode';
import { logger } from '../utils/logger';

export interface ResolvedOpenSpecCli {
  command: string;
  env: NodeJS.ProcessEnv;
  version: string;
  diagnostics: string[];
}

export type OpenSpecRuntimeSource = 'installed' | 'customPath' | 'localSource';

export interface ResolvedOpenSpecRuntime {
  command: string;
  argsPrefix: string[];
  env: NodeJS.ProcessEnv;
  version: string;
  source: OpenSpecRuntimeSource;
  sourceLabel: string;
  diagnostics: string[];
}

export interface OpenSpecCliResolverOptions {
  timeoutMs?: number;
  knownPaths?: string[];
  shell?: string;
}

const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_KNOWN_PATHS = [
  '/opt/homebrew/bin/openspec',
  '/usr/local/bin/openspec',
  '/usr/bin/openspec',
];

export class OpenSpecCliResolutionError extends Error {
  constructor(
    message: string,
    public readonly diagnostics: string[],
    public readonly category: string = 'unknown'
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

    const discoveredPaths = await this.resolveFromShell(diagnostics);
    for (const discoveredPath of discoveredPaths) {
      const shellResolved = await this.tryCommand(discoveredPath, diagnostics, 'discovered PATH');
      if (shellResolved) return this.cache(shellResolved);
    }

    for (const candidate of this.options.knownPaths ?? DEFAULT_KNOWN_PATHS) {
      const known = await this.tryCommand(candidate, diagnostics, `known path ${candidate}`);
      if (known) return this.cache(known);
    }

    throw new OpenSpecCliResolutionError('OpenSpec CLI executable could not be resolved', diagnostics);
  }

  async resolveRuntime(): Promise<ResolvedOpenSpecRuntime> {
    const config = vscode.workspace.getConfiguration('openspec');
    const rawCliMode = config.get<string>('cliMode');
    const cliMode = (typeof rawCliMode === 'string' ? rawCliMode : 'auto').trim();
    const rawLocalSourcePath = config.get<string>('localOpenSpecSourcePath');
    const localSourcePath = (typeof rawLocalSourcePath === 'string' ? rawLocalSourcePath : '').trim();
    const diagnostics: string[] = [
      `openspec.cliMode=${cliMode}`,
    ];

    if (cliMode === 'localSource') {
      diagnostics.push(`openspec.localOpenSpecSourcePath=${localSourcePath || '<empty>'}`);

      if (!localSourcePath) {
        diagnostics.push('localSource mode: source path is empty');
        throw new OpenSpecCliResolutionError(
          'OpenSpec local source path is not configured. Set openspec.localOpenSpecSourcePath.',
          diagnostics,
          'local-source-invalid'
        );
      }

      try {
        return await this.resolveLocalSourceRuntime(localSourcePath, diagnostics, 'localSource mode');
      } catch (err) {
        throw new OpenSpecCliResolutionError(
          `OpenSpec local source checkout invalid: ${localSourcePath}`,
          diagnostics,
          'local-source-invalid'
        );
      }
    }

    if (cliMode === 'customPath') {
      const configuredPath = this.getConfiguredPath();
      diagnostics.push(`openspec.cliPath=${configuredPath || '<empty>'}`);

      if (!configuredPath) {
        diagnostics.push('customPath mode: cliPath is empty');
        throw new OpenSpecCliResolutionError(
          'OpenSpec CLI path is not configured in customPath mode. Set openspec.cliPath.',
          diagnostics,
          'configured-path-invalid'
        );
      }

      const resolved = await this.tryCommand(configuredPath, diagnostics, 'customPath mode');
      if (resolved) {
        return {
          command: resolved.command,
          argsPrefix: [],
          env: resolved.env,
          version: resolved.version,
          source: 'customPath',
          sourceLabel: `custom path (${configuredPath})`,
          diagnostics: [...diagnostics],
        };
      }

      throw new OpenSpecCliResolutionError(
        `Configured OpenSpec CLI path is invalid: ${configuredPath}`,
        diagnostics,
        'configured-path-invalid'
      );
    }

    if (cliMode === 'auto' && localSourcePath) {
      diagnostics.push(`openspec.localOpenSpecSourcePath=${localSourcePath}`);
      try {
        return await this.resolveLocalSourceRuntime(localSourcePath, diagnostics, 'auto localSource');
      } catch (err) {
        diagnostics.push(`auto localSource: falling back to installed CLI (${(err as Error).message})`);
      }
    }

    // cliMode === 'auto' or 'installed' — use existing resolve() behavior when
    // no usable local source checkout is configured.
    const base = await this.resolve();
    return {
      command: base.command,
      argsPrefix: [],
      env: base.env,
      version: base.version,
      source: 'installed',
      sourceLabel: `installed (${base.command})`,
      diagnostics: [...base.diagnostics],
    };
  }

  private async resolveLocalSourceRuntime(
    sourcePath: string,
    diagnostics: string[],
    label: string
  ): Promise<ResolvedOpenSpecRuntime> {
    const openspecBin = path.join(sourcePath, 'bin', 'openspec.js');
    const command = process.execPath; // Node.js executable
    const argsPrefix = [openspecBin];
    const env = { ...process.env };
    try {
      const version = (await this.spawnAndCollect(
        command,
        [...argsPrefix, '--version'],
        this.options.timeoutMs,
        env
      )).trim();
      diagnostics.push(`${label}: ok (${command} ${openspecBin}) -> ${version}`);
      return {
        command,
        argsPrefix,
        env,
        version,
        source: 'localSource',
        sourceLabel: `local source (${sourcePath})`,
        diagnostics: [...diagnostics],
      };
    } catch (err) {
      diagnostics.push(`${label}: failed (${command} ${openspecBin}) ${(err as Error).message}`);
      throw err;
    }
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
      const env = this.buildCommandEnv(command);
      const version = (await this.spawnAndCollect(command, ['--version'], this.options.timeoutMs, env)).trim();
      diagnostics.push(`${label}: ok (${command}) -> ${version}`);
      return { command, env, version, diagnostics: [...diagnostics] };
    } catch (err) {
      diagnostics.push(`${label}: failed (${command}) ${(err as Error).message}`);
      return null;
    }
  }

  private async resolveFromShell(diagnostics: string[]): Promise<string[]> {
    if (process.platform === 'win32') {
      return this.resolveFromWindows(diagnostics);
    }

    const shell = this.options.shell || process.env.SHELL || '/bin/zsh';
    if (!/^\/[\w./-]+$/.test(shell)) {
      diagnostics.push(`login shell PATH: skipped unsafe shell ${shell}`);
      return [];
    }

    try {
      const stdout = await this.spawnAndCollect(
        shell,
        ['-l', '-c', 'command -v openspec'],
        this.options.timeoutMs
      );
      const resolved = stdout.trim().split(/\r?\n/)[0]?.trim();
      diagnostics.push(`login shell PATH: ${resolved || '<empty>'}`);
      return resolved ? [resolved] : [];
    } catch (err) {
      diagnostics.push(`login shell PATH: failed ${(err as Error).message}`);
      return [];
    }
  }

  private async resolveFromWindows(diagnostics: string[]): Promise<string[]> {
    const candidates: string[] = [];
    try {
      const stdout = await this.spawnAndCollect(
        'where.exe',
        ['openspec'],
        this.options.timeoutMs,
        process.env
      );
      const found = stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
      diagnostics.push(`Windows PATH: where.exe openspec -> ${found.join(', ') || '<empty>'}`);
      candidates.push(...found);
    } catch (err) {
      diagnostics.push(`Windows PATH: where.exe openspec failed ${(err as Error).message}`);
    }

    const appData = process.env.APPDATA;
    if (appData) {
      candidates.push(path.win32.join(appData, 'npm', 'openspec.cmd'));
      candidates.push(path.win32.join(appData, 'npm', 'openspec.ps1'));
    } else {
      diagnostics.push('Windows npm global path: APPDATA is unset');
    }

    const localAppData = process.env.LOCALAPPDATA;
    if (localAppData) {
      candidates.push(path.win32.join(localAppData, 'pnpm', 'openspec.cmd'));
    }

    return [...new Set(candidates)];
  }

  private spawnAndCollect(
    command: string,
    args: string[],
    timeoutMs = DEFAULT_TIMEOUT_MS,
    env = this.buildCommandEnv(command)
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const proc = spawn(command, args, {
        cwd: this.cwd,
        env,
        shell: this.shouldUseWindowsShell(command),
        windowsHide: process.platform === 'win32',
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
    const isAbsolute = process.platform === 'win32'
      ? path.win32.isAbsolute(command)
      : path.isAbsolute(command);
    if (!isAbsolute) {
      return process.env;
    }
    const commandDir = process.platform === 'win32'
      ? path.win32.dirname(command)
      : path.dirname(command);
    const delimiter = process.platform === 'win32' ? ';' : path.delimiter;
    return {
      ...process.env,
      PATH: [commandDir, process.env.PATH].filter(Boolean).join(delimiter),
    };
  }

  private shouldUseWindowsShell(command: string): boolean {
    if (process.platform !== 'win32') return false;
    const ext = path.win32.extname(command).toLowerCase();
    return ext === '.cmd' || ext === '.bat' || ext === '.ps1' || !path.win32.isAbsolute(command);
  }
}
