import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { logger } from '../utils/logger';
import { t } from '../../i18n';
import {
  ChangeInfo,
  ArtifactStatus,
  ArtifactInfo,
  TaskInfo,
  SpecInfo,
  ChangeDetails,
  ValidationResult,
  OpenSpecCliError,
  OpenSpecContextResult,
  OpenSpecStoreListResult,
  OpenSpecWorksetListResult,
} from './types';
import { OpenSpecCliResolver, OpenSpecCliResolutionError, type ResolvedOpenSpecRuntime } from './openspecCliResolver';
import type { OpenSpecScope } from './openspecScope';
import {
  buildCliActivationDiagnostic,
  type CliActivationDiagnostic,
  type CliActivationDiagnosticCategory,
} from './cliActivationDiagnostic';
import { enrichChangeWithLifecycle } from '../../shared/changeLifecycle';
import {
  getWorkflowBindingKey,
  type ChangeWorkflowSnapshot,
  type WorkflowArtifactNode,
  type WorkflowArtifactStatus,
  type WorkflowBindingIdentity,
} from '../../shared/changeWorkflow';

const MINIMUM_OPENSPEC_VERSION = '1.0.0';

/**
 * Launcher extensions CreateProcess can execute with `shell: false` on Windows.
 * npm global directories also emit an extension-less bash shim and a `.ps1`
 * launcher alongside `openspec.cmd`; neither can be spawned without a shell.
 */
const WINDOWS_SPAWNABLE_EXTENSIONS = ['.exe', '.cmd', '.bat'];

export interface ScopeOption {
  /** When set, root-resolving commands append `--store <storeId>`. */
  storeId?: string;
}

/** Shell-free spawn target for the Windows non-local-source branch. */
interface WindowsSpawnTarget {
  command: string;
  argsPrefix: string[];
}

/**
 * Extract the Node.js entry script from an npm-style cmd-shim (`.cmd`/`.bat`).
 *
 * npm launchers end with an invocation line like
 * `node "%~dp0\node_modules\<pkg>\bin\entry.js" %*` — older shims inline `node`
 * or `"%~dp0\node.exe"` as the interpreter, npm >= 9 shims use a `"%_prog%"`
 * variable that resolves to one of those. The entry is the quoted
 * `%~dp0`-rooted token ending in .js/.mjs/.cjs on a line that forwards
 * arguments via `%*`. Returns the entry path relative to the shim directory
 * (to be joined with the shim's own directory), or undefined when no known
 * invocation shape matches — callers must fail closed in that case rather
 * than hand the launcher to cmd.exe, whose parsing would corrupt verbatim
 * arguments (notably `%VAR%` sequences, which cannot be escaped at all).
 *
 * Known limitation (accepted): any line echoing a quoted `%~dp0`-rooted .js
 * path together with `%*` matches, not only the real invocation line. Real
 * npm cmd-shims never emit such decoy lines, and a decoy would still resolve
 * inside the shim's own package directory.
 */
export function parseWindowsCmdShimEntry(content: string): string | undefined {
  for (const line of content.split(/\r?\n/)) {
    if (!line.includes('%*')) continue;
    const tokenPattern = /"(?:%~dp0|%dp0%)(?:[\\/])([^"]+?)"/gi;
    let match: RegExpExecArray | null;
    while ((match = tokenPattern.exec(line)) !== null) {
      const relative = match[1];
      if (/\.(?:js|mjs|cjs)$/i.test(relative)) return relative;
    }
  }
  return undefined;
}

export class OpenSpecCliService {
  private workspaceRoot: string;
  private resolver: OpenSpecCliResolver;
  private cliActivationDiagnostic: CliActivationDiagnostic | null = null;
  private shownCliDiagnosticKeys = new Set<string>();
  /** Resolved shell-free spawn targets for Windows launcher commands. */
  private windowsSpawnTargets = new Map<string, WindowsSpawnTarget>();

  constructor(workspaceRoot: string, resolver?: OpenSpecCliResolver) {
    this.workspaceRoot = workspaceRoot;
    this.resolver = resolver ?? new OpenSpecCliResolver(workspaceRoot);
  }

  getResolver(): OpenSpecCliResolver {
    return this.resolver;
  }

  getCliActivationDiagnostic(): CliActivationDiagnostic | null {
    return this.cliActivationDiagnostic;
  }

  clearCliActivationDiagnostic(): void {
    this.cliActivationDiagnostic = null;
  }

  private classifyResolutionError(error: OpenSpecCliResolutionError): CliActivationDiagnosticCategory {
    const details = error.diagnostics.join('\n').toLowerCase();
    if (error.message.toLowerCase().includes('configured openspec cli path is invalid')) {
      return 'configured-path-invalid';
    }
    if (details.includes('permission denied') || details.includes('eacces') || details.includes('eperm')) {
      return 'permission-denied';
    }
    const shellDetail = error.diagnostics.find((d) => d.toLowerCase().startsWith('login shell path:'));
    if (shellDetail) {
      const shellLower = shellDetail.toLowerCase();
      if (
        shellLower.includes('timed out') ||
        shellLower.includes('skipped') ||
        shellLower.includes('<empty>')
      ) {
        return 'shell-resolution-failed';
      }
    }
    if (details.includes('--version') && details.includes('failed')) {
      return 'version-check-failed';
    }
    return 'cli-not-found';
  }

  private classifySpawnError(error: Error): CliActivationDiagnosticCategory {
    const message = error.message.toLowerCase();
    if (message.includes('eacces') || message.includes('eperm') || message.includes('permission denied')) {
      return 'permission-denied';
    }
    if (message.includes('spawn')) {
      return 'spawn-failed';
    }
    return 'unknown';
  }

  private warnIfVersionUnsupported(version: string): void {
    if (this.compareSemver(version, MINIMUM_OPENSPEC_VERSION) >= 0) return;
    void vscode.window.showWarningMessage(
      t('cli.versionUnsupported', { version, minimum: MINIMUM_OPENSPEC_VERSION }),
      t('cli.installInstructions')
    ).then((selection) => {
      if (selection === t('cli.installInstructions')) {
        vscode.env.openExternal(vscode.Uri.parse('https://github.com/Fission-AI/OpenSpec#quick-start'));
      }
    });
  }

  private compareSemver(actual: string, minimum: string): number {
    const parse = (value: string) => value.match(/\d+(?:\.\d+){0,2}/)?.[0]
      .split('.')
      .map((part) => Number(part)) ?? [0];
    const a = parse(actual);
    const b = parse(minimum);
    for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
      const av = a[i] ?? 0;
      const bv = b[i] ?? 0;
      if (av !== bv) return av > bv ? 1 : -1;
    }
    return 0;
  }

  private showCliActivationDiagnosticError(diagnostic: CliActivationDiagnostic): void {
    const key = `${diagnostic.category}:${diagnostic.normalizedMessage}`;
    if (this.shownCliDiagnosticKeys.has(key)) return;
    this.shownCliDiagnosticKeys.add(key);

    const labels = diagnostic.recoveryActions.slice(0, 3).map((action) => this.getRecoveryActionLabel(action));
    vscode.window.showErrorMessage(diagnostic.message, ...labels).then((selection) => {
      void this.handleRecoveryActionSelection(selection, diagnostic);
    });
  }

  private getRecoveryActionLabel(action: string): string {
    switch (action) {
      case 'open-settings': return t('cli.openSettings');
      case 'retry': return t('cli.retry');
      case 'copy-diagnostics': return t('cli.copyDiagnostics');
      case 'open-docs': return t('cli.installInstructions');
      default: return action;
    }
  }

  private async handleRecoveryActionSelection(
    selection: string | undefined,
    diagnostic: CliActivationDiagnostic
  ): Promise<void> {
    if (selection === t('cli.openSettings')) {
      await vscode.commands.executeCommand('workbench.action.openSettings', 'openspec.cliPath');
    } else if (selection === t('cli.retry')) {
      await vscode.commands.executeCommand('workbench.action.reloadWindow');
    } else if (selection === t('cli.copyDiagnostics')) {
      await vscode.env.clipboard.writeText(diagnostic.copyText);
    } else if (selection === t('cli.installInstructions')) {
      await vscode.env.openExternal(vscode.Uri.parse('https://github.com/Fission-AI/OpenSpec#quick-start'));
    }
  }

  private setCliActivationDiagnostic(
    category: CliActivationDiagnosticCategory,
    error: Error,
    rawDetails: string[] = []
  ): CliActivationDiagnostic {
    const diagnostic = buildCliActivationDiagnostic({
      category,
      message: error.message,
      rawDetails,
      platform: process.platform,
      arch: process.arch,
      workspaceName: this.workspaceRoot.split(/[\\/]/).filter(Boolean).pop() ?? '<workspace>',
      configuredCliPath: vscode.workspace.getConfiguration('openspec').get<string>('cliPath') ?? '',
    });
    this.cliActivationDiagnostic = diagnostic;
    return diagnostic;
  }

  /**
   * Check if OpenSpec CLI is available
   */
  async checkAvailability(notifyCliNotFound = true): Promise<boolean> {
    try {
      const version = (await this.execOpenSpec(['--version'], 1, { notifyCliNotFound })).trim();
      this.clearCliActivationDiagnostic();
      this.warnIfVersionUnsupported(version);
      return true;
    } catch (error) {
      logger.error('OpenSpec CLI not available', error as Error);
      return false;
    }
  }

  /**
   * Get OpenSpec CLI version
   */
  async getVersion(): Promise<string> {
    try {
      const output = await this.execOpenSpec(['--version']);
      return output.trim();
    } catch (error) {
      logger.error('Failed to get OpenSpec version', error as Error);
      throw error;
    }
  }

  async getContext(scope?: ScopeOption | OpenSpecScope): Promise<OpenSpecContextResult> {
    return (await this.runJson(this.withStoreFlag(['context', '--json'], scope))) as OpenSpecContextResult;
  }

  /**
   * List machine-global Worksets. This probe is deliberately selector-free:
   * Worksets are not scoped to the currently selected Store.
   */
  async listWorksets(): Promise<OpenSpecWorksetListResult> {
    try {
      const payload = await this.runJson(['workset', 'list', '--json']);
      if (!payload || typeof payload !== 'object') return { worksets: [] };
      const worksets = (payload as { worksets?: unknown }).worksets;
      return { worksets: Array.isArray(worksets) ? worksets as OpenSpecWorksetListResult['worksets'] : [] };
    } catch (error) {
      logger.warn('Failed to list Worksets', error as Error);
      return { worksets: [] };
    }
  }

  /**
   * List registered machine-global Stores. This probe is deliberately
   * selector-free because the result is the authority used to classify
   * Workset members.
   */
  async listStores(): Promise<OpenSpecStoreListResult> {
    try {
      const payload = await this.runJson(['store', 'list', '--json']);
      if (!payload || typeof payload !== 'object'
        || !Array.isArray((payload as { stores?: unknown }).stores)) {
        throw new Error('Invalid Store inventory payload');
      }
      const stores = (payload as { stores?: unknown }).stores;
      return { stores: stores as OpenSpecStoreListResult['stores'] };
    } catch (error) {
      logger.warn('Failed to list Stores', error as Error);
      throw error;
    }
  }

  /**
   * Get change status with artifact details.
   * If CLI returns non-JSON, returns { artifacts: [] } so listChanges can still show basic change list.
   */
  async getChangeStatus(
    name: string,
    scope?: ScopeOption | OpenSpecScope
  ): Promise<{ artifacts?: unknown[]; [k: string]: unknown }> {
    try {
      const output = await this.execOpenSpec(
        this.withStoreFlag(['status', '--change', name, '--json'], scope)
      );
      const data = this.tryParseJson<{ artifacts?: unknown[] }>(output, `openspec status --change ${name} --json`);
      return data ?? { artifacts: [] };
    } catch (error) {
      logger.error(`Failed to get status for change: ${name}`, error as Error);
      throw error;
    }
  }

  /**
   * Try to parse CLI stdout as JSON; on failure log and return undefined.
   * Per OpenSpec CLI docs, list/show/status/validate support --json, but some versions or cases may return human-readable text.
   */
  private tryParseJson<T>(output: string, logContext: string): T | undefined {
    const trimmed = output.trim();
    if (!trimmed) return undefined;
    try {
      return JSON.parse(trimmed) as T;
    } catch {
      logger.warn(`${logContext} returned non-JSON (${trimmed.slice(0, 80)}...), treating as empty or fallback`);
      return undefined;
    }
  }

  private normalizeCreatedAt(change: any): string | undefined {
    const value = change.createdAt ?? change.created ?? change.metadataCreated;
    return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
  }

  /**
   * List all changes with artifact status.
   * Handles non-JSON output (e.g. human-readable "Active changes:") by returning [].
   */
  async listChanges(
    scope?: ScopeOption | OpenSpecScope,
    workflowBinding?: WorkflowBindingIdentity
  ): Promise<ChangeInfo[]> {
    try {
      const output = await this.execOpenSpec(this.withStoreFlag(['list', '--json'], scope));
      const data = this.tryParseJson<{ changes?: unknown[] }>(output, 'openspec list --json');
      if (!data?.changes || !Array.isArray(data.changes)) {
        if (!data) return [];
        logger.warn('Unexpected format from openspec list');
        return [];
      }

      // Enrich each change with artifact status
      const enrichedChanges = await Promise.all(
        data.changes.map(async (c: any) => {
          try {
            const status = await this.getChangeStatus(c.name, scope);
            const rawArtifacts = Array.isArray(status.artifacts) ? status.artifacts : [];
            const workflow = this.normalizeWorkflowSnapshot(c.name, status, scope, workflowBinding);
            const artifacts = this.normalizeArtifactStatuses(rawArtifacts);
            return enrichChangeWithLifecycle({
              name: c.name,
              completedTasks: c.completedTasks || 0,
              totalTasks: c.totalTasks || 0,
              lastModified: c.lastModified,
              createdAt: this.normalizeCreatedAt(c),
              status: this.determineStatus(c),
              artifacts,
              ...(workflow.snapshot ? { workflowSnapshot: workflow.snapshot } : {}),
              ...(workflow.invalid ? {
                attention: { required: true, reasons: ['invalid-artifact-status'] as const },
              } : {}),
            });
          } catch {
            // Distinguish status-read failure from a legitimate empty artifact list.
            return enrichChangeWithLifecycle({
              name: c.name,
              completedTasks: c.completedTasks || 0,
              totalTasks: c.totalTasks || 0,
              lastModified: c.lastModified,
              createdAt: this.normalizeCreatedAt(c),
              status: this.determineStatus(c),
              artifacts: [] as ArtifactStatus[],
              attention: { required: true, reasons: ['metadata-read-failed'] },
            });
          }
        })
      );

      return enrichedChanges;
    } catch (error) {
      logger.error('Failed to list changes', error as Error);
      throw error;
    }
  }

  /**
   * Show details for a specific change.
   * If CLI returns non-JSON or command fails (e.g. exit 1), returns minimal ChangeDetails so callers can fallback to Content Access.
   */
  async showChange(name: string, scope?: ScopeOption | OpenSpecScope): Promise<ChangeDetails> {
    try {
      const output = await this.execOpenSpec(this.withStoreFlag(['show', name, '--json'], scope));
      const data = this.tryParseJson<{ name?: string; schema?: string; artifacts?: unknown[]; tasks?: unknown[]; metadata?: Record<string, unknown> }>(
        output,
        `openspec show ${name} --json`
      );
      if (!data) {
        return this.minimalChangeDetails(name);
      }
      return {
        name: data.name || name,
        schema: data.schema || 'unknown',
        artifacts: this.normalizeArtifactInfos(data.artifacts ?? []),
        tasks: this.normalizeTaskInfos(data.tasks ?? []),
        metadata: data.metadata && typeof data.metadata === 'object' ? data.metadata : {},
      };
    } catch (error) {
      if (error instanceof OpenSpecCliError) {
        logger.warn(
          `openspec show ${name} failed (exit ${error.exitCode}): ${error.stderr || error.message}. Returning minimal details.`
        );
        return this.minimalChangeDetails(name);
      }
      logger.error(`Failed to show change: ${name}`, error as Error);
      throw error;
    }
  }

  private minimalChangeDetails(name: string): ChangeDetails {
    return {
      name,
      schema: 'unknown',
      artifacts: [],
      tasks: [],
      metadata: {},
    };
  }

  /**
   * List all specs.
   * CLI may return "No specs found.", or human-readable "Specs: ..." instead of JSON when --json is not honored or output is mixed.
   */
  async listSpecs(scope?: ScopeOption | OpenSpecScope): Promise<SpecInfo[]> {
    try {
      const output = (await this.execOpenSpec(this.withStoreFlag(['list', '--specs', '--json'], scope))).trim();

      if (!output || output.startsWith('No specs found')) {
        return [];
      }

      const data = this.tryParseJson<{ specs?: { id?: string; requirementCount?: number; path?: string }[] }>(
        output,
        'openspec list --specs --json'
      );
      if (!data?.specs || !Array.isArray(data.specs)) {
        return [];
      }

      return data.specs.map((s): SpecInfo => ({
        id: s.id ?? '',
        requirementCount: s.requirementCount ?? 0,
        path: s.path,
      }));
    } catch (error) {
      logger.error('Failed to list specs', error as Error);
      throw error;
    }
  }

  /**
   * Validate a change.
   * If CLI returns non-JSON, returns { valid: false, errors: ['Invalid or non-JSON output'], warnings: [] }.
   */
  async validateChange(name: string, scope?: ScopeOption | OpenSpecScope): Promise<ValidationResult> {
    try {
      const output = await this.execOpenSpec(this.withStoreFlag(['validate', name, '--json'], scope));
      const data = this.tryParseJson<{ valid?: boolean; errors?: string[]; warnings?: string[] }>(
        output,
        `openspec validate ${name} --json`
      );
      if (!data) {
        return { valid: false, errors: ['CLI returned non-JSON output'], warnings: [] };
      }
      return {
        valid: data.valid ?? false,
        errors: Array.isArray(data.errors) ? data.errors : [],
        warnings: Array.isArray(data.warnings) ? data.warnings : [],
      };
    } catch (error) {
      logger.error(`Failed to validate change: ${name}`, error as Error);
      throw error;
    }
  }

  /**
   * Create a new change
   */
  async createChange(name: string, scope?: ScopeOption | OpenSpecScope): Promise<void> {
    try {
      await this.execOpenSpec(this.withStoreFlag(['new', 'change', name], scope));
      logger.info(`Created change: ${name}`);
    } catch (error) {
      logger.error(`Failed to create change: ${name}`, error as Error);
      throw error;
    }
  }

  /**
   * Archive a change
   */
  async archiveChange(name: string, scope?: ScopeOption | OpenSpecScope): Promise<void> {
    try {
      const output = await this.execOpenSpec(
        this.withStoreFlag(['archive', name, '--yes'], scope),
        1,
        { timeoutMs: 120000 }
      );
      if (this.isArchiveAbortOutput(output)) {
        throw new OpenSpecCliError(this.extractArchiveAbortMessage(output), 0, output);
      }
      logger.info(`Archived change: ${name}`);
    } catch (error) {
      logger.error(`Failed to archive change: ${name}`, error as Error);
      throw error;
    }
  }

  private isArchiveAbortOutput(output: string): boolean {
    return /Aborted\.\s+No files were changed\./i.test(output);
  }

  private extractArchiveAbortMessage(output: string): string {
    const lines = output
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const abortIndex = lines.findIndex((line) => /Aborted\.\s+No files were changed\./i.test(line));
    if (abortIndex <= 0) {
      return lines[abortIndex] ?? 'Archive aborted. No files were changed.';
    }
    return `${lines[abortIndex - 1]}\n${lines[abortIndex]}`;
  }

  /**
   * Get instructions for an artifact (e.g. apply, proposal, design, tasks).
   * Returns raw JSON string from `openspec instructions <artifact> --change <changeName> --json`.
   * Throws if CLI is not available or command fails.
   */
  async getInstructions(
    artifact: string,
    changeName: string,
    scope?: ScopeOption | OpenSpecScope
  ): Promise<string> {
    return await this.execOpenSpec(
      this.withStoreFlag(['instructions', artifact, '--change', changeName, '--json'], scope)
    );
  }

  /**
   * Append --store <storeId> when a scope carries a storeId.
   * Accepts a ScopeOption ({ storeId? }) or a full OpenSpecScope; both expose storeId.
   */
  private withStoreFlag(
    args: string[],
    scope?: ScopeOption | OpenSpecScope
  ): string[] {
    const storeId = scope && typeof scope === 'object' ? (scope as ScopeOption).storeId : undefined;
    if (storeId) {
      return [...args, '--store', storeId];
    }
    return args;
  }

  /**
   * Execute an OpenSpec CLI command expecting JSON output.
   * Resolves the runtime, prepends argsPrefix, runs with retry logic, and parses the result as JSON.
   */
  async runJson(args: string[], options: { retries?: number } = {}): Promise<unknown> {
    const output = await this.execOpenSpec(args, options.retries ?? 3);
    return JSON.parse(output);
  }

  /** Execute a command whose stdout is intentionally ordinary text. */
  async runCommand(args: string[], options: { retries?: number } = {}): Promise<string> {
    return await this.execOpenSpec(args, options.retries ?? 3);
  }

  /**
   * Execute OpenSpec CLI command with retry logic.
   * On "command not found" (exit 127 or spawn ENOENT), calls showCliNotFoundError() and rethrows; no file fallback.
   */
  private async execOpenSpec(
    args: string[],
    retries: number = 3,
    options: { notifyCliNotFound?: boolean; timeoutMs?: number } = {}
  ): Promise<string> {
    let lastError: Error | undefined;
    const notifyCliNotFound = options.notifyCliNotFound ?? true;
    const timeoutMs = options.timeoutMs ?? 30000;

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        return await this.execOpenSpecOnce(args, timeoutMs);
      } catch (error) {
        lastError = error as Error;

        if (error instanceof OpenSpecCliResolutionError) {
          const category = this.classifyResolutionError(error);
          const diagnostic = this.setCliActivationDiagnostic(category, error, error.diagnostics);
          if (notifyCliNotFound) this.showCliActivationDiagnosticError(diagnostic);
          throw error;
        }

        if (error instanceof OpenSpecCliError && error.exitCode === 127) {
          const diagnostic = this.setCliActivationDiagnostic('cli-not-found', error);
          if (notifyCliNotFound) this.showCliActivationDiagnosticError(diagnostic);
          throw error;
        }

        if (this.isSpawnError(error as Error)) {
          const category = this.classifySpawnError(error as Error);
          const diagnostic = this.setCliActivationDiagnostic(category, error as Error);
          if (notifyCliNotFound) this.showCliActivationDiagnosticError(diagnostic);
          throw error;
        }

        if (attempt < retries - 1) {
          const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
          logger.warn(`Command failed, retrying in ${delay}ms (attempt ${attempt + 1}/${retries})`);
          await this.sleep(delay);
        }
      }
    }

    if (notifyCliNotFound && lastError && this.isSpawnError(lastError)) {
      const category = this.classifySpawnError(lastError);
      const diagnostic = this.setCliActivationDiagnostic(category, lastError);
      this.showCliActivationDiagnosticError(diagnostic);
    }
    throw lastError;
  }

  /** True when the error indicates a spawn-level failure after resolution. */
  private isSpawnError(err: Error): boolean {
    const msg = err.message.toLowerCase();
    return msg.includes('failed to spawn openspec');
  }

  /**
   * Execute OpenSpec CLI command (single attempt).
   *
   * Uses the resolved runtime (which may include argsPrefix for local source mode),
   * spawning `runtime.command [...runtime.argsPrefix, ...args]`. This is the single
   * execution path for every CLI command, so localSource/customPath/installed modes
   * all flow through the same code.
   */
  private async execOpenSpecOnce(args: string[], timeoutMs: number): Promise<string> {
    const runtime = await this.resolver.resolveRuntime();
    const isLocalSource = runtime.source === 'localSource';
    // Windows + non-local-source: never route through cmd.exe. Shell parsing would
    // corrupt arguments that must reach the CLI verbatim — a workset member path
    // like C:\work\%USERNAME%\repo must not be %-expanded, and `%VAR%` cannot be
    // escaped under `cmd /c` at all. .cmd/.bat launchers are instead resolved to
    // their underlying `node <entry.js>` invocation, and every case spawns
    // shell-free so all argv elements (spaces, metacharacters, `%VAR%`, unicode)
    // pass through byte-identical. Unresolvable launchers fail closed.
    const windowsShellFree = !isLocalSource && process.platform === 'win32';

    // Non-Windows and local-source modes stay byte-identical (no transformation).
    let command = runtime.command;
    let fullArgs = [...runtime.argsPrefix, ...args];

    if (windowsShellFree) {
      const target = await this.resolveWindowsSpawnTarget(runtime);
      command = target.command;
      fullArgs = [...target.argsPrefix, ...runtime.argsPrefix, ...args];
    }

    return new Promise((resolve, reject) => {
      const proc = spawn(command, fullArgs, {
        cwd: this.workspaceRoot,
        env: runtime.env,
        shell: false,
        windowsHide: windowsShellFree,
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        if (code !== 0) {
          const error = new OpenSpecCliError(
            `Command failed with code ${code}`,
            code || -1,
            stderr
          );
          reject(error);
        } else {
          resolve(stdout);
        }
      });

      proc.on('error', (error) => {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          this.resolver.clearCache();
          this.windowsSpawnTargets.clear();
        }
        reject(new Error(`Failed to spawn openspec: ${error.message}`));
      });

      const timeout = setTimeout(() => {
        proc.kill();
        reject(new Error(`Command timed out after ${Math.round(timeoutMs / 1000)} seconds`));
      }, timeoutMs);

      proc.on('close', () => {
        clearTimeout(timeout);
      });
    });
  }

  /**
   * Resolve how to spawn the resolved CLI command on Windows without cmd.exe.
   *
   * Fail-closed preference order (no silent fallback to shell parsing):
   * 1. `.cmd`/`.bat` launcher → read the npm-style shim and resolve it to
   *    `<node> <shim-dir-resolved entry.js>`; unresolvable shims throw.
   * 2. `.exe` (or extensionless fallback) → spawn directly; Windows
   *    CreateProcess resolves PATH itself and performs no shell parsing.
   * A bare extensionless command is first located via `where.exe`, because a
   * shell would match it against PATHEXT (finding e.g. `openspec.cmd`) while
   * CreateProcess only probes `<name>.exe`. Only `.exe`/`.cmd`/`.bat` hits are
   * accepted — npm global directories also list an extension-less bash shim
   * and a `.ps1` launcher, which CreateProcess cannot execute without a
   * shell — and resolution fails closed when no where.exe line qualifies.
   * PowerShell launchers cannot be spawned without a shell and are rejected
   * explicitly.
   *
   * `path.*` calls are host-native — identical to `path.win32` on Windows
   * hosts — so extension/path handling uses real Windows semantics wherever
   * this branch can execute.
   */
  private async resolveWindowsSpawnTarget(runtime: ResolvedOpenSpecRuntime): Promise<WindowsSpawnTarget> {
    const cacheKey = runtime.command;
    const cached = this.windowsSpawnTargets.get(cacheKey);
    if (cached) return cached;

    let command = runtime.command;
    if (path.extname(command) === '') {
      const located = await this.whereFirstSpawnableMatch(command);
      if (!located) {
        throw new OpenSpecCliResolutionError(
          `No spawnable OpenSpec CLI launcher (${WINDOWS_SPAWNABLE_EXTENSIONS.join('/')}) was found on PATH for "${runtime.command}". npm installs also emit extension-less and PowerShell launchers, which cannot be spawned without a shell. Point openspec.cliPath at the .cmd launcher or a direct executable.`,
          [...runtime.diagnostics]
        );
      }
      command = located;
    }

    const ext = path.extname(command).toLowerCase();
    let target: WindowsSpawnTarget;
    if (ext === '.cmd' || ext === '.bat') {
      target = await this.resolveWindowsShimTarget(command, runtime);
    } else if (ext === '.ps1') {
      throw new OpenSpecCliResolutionError(
        `OpenSpec CLI PowerShell launchers cannot be spawned without a shell: ${command}. Point openspec.cliPath at the .cmd launcher or a direct executable.`,
        [...runtime.diagnostics]
      );
    } else {
      target = { command, argsPrefix: [] };
    }

    this.windowsSpawnTargets.set(cacheKey, target);
    return target;
  }

  /** Read an npm-style .cmd/.bat launcher and resolve its node invocation. */
  private async resolveWindowsShimTarget(
    shimPath: string,
    runtime: ResolvedOpenSpecRuntime
  ): Promise<WindowsSpawnTarget> {
    const diagnostics = [...runtime.diagnostics];

    let content: string;
    try {
      content = await fs.promises.readFile(shimPath, 'utf8');
    } catch (error) {
      throw new OpenSpecCliResolutionError(
        `OpenSpec CLI launcher could not be read: ${shimPath} (${(error as Error).message})`,
        diagnostics
      );
    }

    const entryRelative = parseWindowsCmdShimEntry(content);
    if (!entryRelative) {
      throw new OpenSpecCliResolutionError(
        `OpenSpec CLI launcher could not be resolved to a Node.js invocation (unsupported .cmd/.bat format): ${shimPath}`,
        diagnostics
      );
    }

    const shimDir = path.dirname(shimPath);
    const nodeCommand = this.resolveWindowsNodeCommand(shimDir);
    return {
      command: nodeCommand,
      argsPrefix: [path.join(shimDir, entryRelative)],
    };
  }

  /**
   * Locate the node executable the shim itself would have invoked: npm shims
   * prefer a `node.exe` bundled next to them, and that direct `.exe` path is
   * safe to spawn. Otherwise the bare command `node` is returned — CreateProcess
   * then resolves `node.exe` via PATH with correct Unicode semantics.
   * `where.exe` is deliberately NOT consulted here: its first hit may be a
   * `node.cmd`/`node.bat` wrapper (unspawnable with shell:false), and its pipe
   * output is OEM-codepage decoded, so non-ASCII install paths (e.g. zh-cn
   * usernames) mojibake into ENOENT at spawn time.
   */
  private resolveWindowsNodeCommand(shimDir: string): string {
    const bundled = path.join(shimDir, 'node.exe');
    if (fs.existsSync(bundled)) return bundled;
    return 'node';
  }

  /**
   * First `where.exe <name>` hit (PATH + PATHEXT resolution) whose extension
   * CreateProcess can execute without a shell (`.exe`/`.cmd`/`.bat`), or
   * undefined when the lookup fails or offers no spawnable line. Skipped
   * entries include npm's extension-less bash shim and `.ps1` launchers.
   */
  private whereFirstSpawnableMatch(name: string): Promise<string | undefined> {
    return new Promise((resolve) => {
      let stdout = '';
      let settled = false;
      let timeout: NodeJS.Timeout | undefined;
      const finish = (value: string | undefined) => {
        if (settled) return;
        settled = true;
        if (timeout) clearTimeout(timeout);
        resolve(value);
      };
      // Match resolver/main-spawn semantics: probe PATH from the workspace
      // root, not the extension-host process cwd.
      const proc = spawn('where.exe', [name], {
        shell: false,
        windowsHide: true,
        cwd: this.workspaceRoot,
      });
      timeout = setTimeout(() => {
        proc.kill();
        finish(undefined);
      }, 5000);
      proc.stdout?.on('data', (data) => {
        stdout += data.toString();
      });
      proc.on('error', () => finish(undefined));
      proc.on('close', (code) => {
        if (code !== 0) {
          finish(undefined);
          return;
        }
        const first = stdout
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean)
          .find((line) => WINDOWS_SPAWNABLE_EXTENSIONS.includes(path.win32.extname(line).toLowerCase()));
        finish(first);
      });
    });
  }

  /** Normalize CLI artifact list (unknown[]) to ArtifactStatus[]; CLI may use 'complete' for done. */
  private normalizeArtifactStatuses(raw: unknown[]): ArtifactStatus[] {
    return this.normalizeArtifactInfos(raw) as ArtifactStatus[];
  }

  private normalizeWorkflowSnapshot(
    changeName: string,
    status: { artifacts?: unknown[]; [k: string]: unknown },
    scope?: ScopeOption | OpenSpecScope,
    workflowBinding?: WorkflowBindingIdentity
  ): { snapshot?: ChangeWorkflowSnapshot; invalid: boolean } {
    if (!Array.isArray(status.artifacts)) return { invalid: true };

    const artifactPaths = this.normalizeArtifactPaths(status.artifactPaths);
    const artifacts: WorkflowArtifactNode[] = [];
    const ids = new Set<string>();
    let malformed = false;
    let unknownState = false;

    for (const rawArtifact of status.artifacts) {
      if (!rawArtifact || typeof rawArtifact !== 'object') {
        malformed = true;
        continue;
      }
      const artifact = rawArtifact as Record<string, unknown>;
      const id = typeof artifact.id === 'string' ? artifact.id : '';
      if (!id || ids.has(id)) {
        malformed = true;
        continue;
      }
      ids.add(id);

      const rawStatus = typeof artifact.status === 'string' ? artifact.status : '';
      const normalizedStatus = this.normalizeWorkflowArtifactStatus(rawStatus);
      if (!normalizedStatus) unknownState = true;

      const requires = this.normalizeStringArray(artifact.requires);
      const missingDeps = this.normalizeStringArray(artifact.missingDeps);
      if (requires === undefined || missingDeps === undefined) malformed = true;

      const pathInfo = artifactPaths.get(id);
      const outputPath = typeof artifact.outputPath === 'string'
        ? artifact.outputPath
        : pathInfo?.outputPath ?? (typeof artifact.path === 'string' ? artifact.path : '');
      const existingOutputPaths = Array.isArray(artifact.existingOutputPaths)
        ? artifact.existingOutputPaths.filter((value): value is string => typeof value === 'string')
        : pathInfo?.existingOutputPaths ?? [];
      if (artifact.existingOutputPaths !== undefined && !Array.isArray(artifact.existingOutputPaths)) {
        malformed = true;
      }

      artifacts.push({
        id,
        status: normalizedStatus ?? 'blocked',
        requires: requires ?? [],
        missingDeps: missingDeps ?? [],
        outputPath,
        existingOutputPaths,
        ...(normalizedStatus ? {} : { rawStatus }),
      });
    }

    if (malformed) return { invalid: true };

    const binding = workflowBinding ?? this.defaultWorkflowBinding(scope);
    return {
      invalid: unknownState,
      snapshot: {
        changeName,
        schema: typeof status.schema === 'string'
          ? status.schema
          : typeof status.schemaName === 'string' ? status.schemaName : 'unknown',
        bindingKey: getWorkflowBindingKey(binding),
        artifacts,
        ...(unknownState ? { diagnostics: ['invalid-artifact-status'] } : {}),
      },
    };
  }

  private normalizeWorkflowArtifactStatus(status: string): WorkflowArtifactStatus | undefined {
    if (status === 'complete') return 'done';
    return ['done', 'ready', 'blocked', 'skipped'].includes(status)
      ? status as WorkflowArtifactStatus
      : undefined;
  }

  private normalizeStringArray(value: unknown): string[] | undefined {
    if (value === undefined) return [];
    return Array.isArray(value) && value.every((item) => typeof item === 'string')
      ? value
      : undefined;
  }

  private normalizeArtifactPaths(value: unknown): Map<string, {
    outputPath: string;
    existingOutputPaths: string[];
  }> {
    const paths = new Map<string, { outputPath: string; existingOutputPaths: string[] }>();
    if (!value || typeof value !== 'object' || Array.isArray(value)) return paths;

    for (const [id, rawPath] of Object.entries(value)) {
      if (typeof rawPath === 'string') {
        paths.set(id, { outputPath: rawPath, existingOutputPaths: [] });
        continue;
      }
      if (!rawPath || typeof rawPath !== 'object' || Array.isArray(rawPath)) continue;
      const pathInfo = rawPath as Record<string, unknown>;
      paths.set(id, {
        outputPath: typeof pathInfo.outputPath === 'string'
          ? pathInfo.outputPath
          : typeof pathInfo.path === 'string' ? pathInfo.path : '',
        existingOutputPaths: Array.isArray(pathInfo.existingOutputPaths)
          ? pathInfo.existingOutputPaths.filter((path): path is string => typeof path === 'string')
          : [],
      });
    }
    return paths;
  }

  private defaultWorkflowBinding(scope?: ScopeOption | OpenSpecScope): WorkflowBindingIdentity {
    const scoped = scope as Partial<OpenSpecScope> | undefined;
    return {
      projectId: this.workspaceRoot,
      commandCwd: this.workspaceRoot,
      rootPath: typeof scoped?.rootPath === 'string' ? scoped.rootPath : this.workspaceRoot,
      rootSource: typeof scoped?.source === 'string' ? scoped.source : 'nearest',
      ...(typeof scoped?.storeId === 'string' ? { storeId: scoped.storeId } : {}),
    };
  }

  private normalizeArtifactInfos(raw: unknown[]): ArtifactInfo[] {
    const allowed: WorkflowArtifactStatus[] = ['done', 'ready', 'blocked', 'skipped'];
    return raw
      .filter((a): a is Record<string, unknown> => a != null && typeof a === 'object')
      .map((a) => {
        const status = a.status === 'complete' ? 'done' : a.status;
        return {
          id: typeof a.id === 'string' ? a.id : '',
          outputPath: typeof a.outputPath === 'string' ? a.outputPath : (a.path as string) ?? '',
          status: (typeof status === 'string' && allowed.includes(status as WorkflowArtifactStatus)
            ? status
            : 'blocked') as WorkflowArtifactStatus,
        };
      });
  }

  private normalizeTaskInfos(raw: unknown[] | undefined): TaskInfo[] {
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((t): t is Record<string, unknown> => t != null && typeof t === 'object')
      .map((t) => ({
        id: typeof t.id === 'string' ? t.id : String(t.id ?? ''),
        description: typeof t.description === 'string' ? t.description : (t.title as string) ?? '',
        done: Boolean(t.done),
      }));
  }

  /**
   * Determine change status based on task progress
   */
  private determineStatus(change: any): 'draft' | 'in-progress' | 'complete' {
    if (change.totalTasks === 0) {
      return 'draft';
    }
    if (change.completedTasks === change.totalTasks) {
      return 'complete';
    }
    return 'in-progress';
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Show user-friendly error notification. Prefer diagnostic-aware toast when a
   * CLI activation diagnostic is available; fall back to the generic message otherwise.
   */
  showCliNotFoundError(error?: Error): void {
    const diagnostic = this.cliActivationDiagnostic;
    if (diagnostic) {
      this.showCliActivationDiagnosticError(diagnostic);
      return;
    }

    if (error instanceof OpenSpecCliResolutionError) {
      logger.error(`OpenSpec CLI resolution failed. ${error.diagnostics.join(' | ')}`);
    }
    const message = t('cli.notFound');
    const installBtn = t('cli.installInstructions');
    const retryBtn = t('cli.retry');
    const settingsBtn = t('cli.openSettings');
    vscode.window
      .showErrorMessage(message, installBtn, retryBtn, settingsBtn)
      .then((selection) => {
        if (selection === installBtn) {
          vscode.env.openExternal(
            vscode.Uri.parse('https://github.com/Fission-AI/OpenSpec#quick-start')
          );
        } else if (selection === retryBtn) {
          vscode.commands.executeCommand('workbench.action.reloadWindow');
        } else if (selection === settingsBtn) {
          vscode.commands.executeCommand('workbench.action.openSettings', 'openspec.cliPath');
        }
      });
  }

  /**
   * Show workspace not initialized error
   */
  showWorkspaceNotInitializedError(): void {
    const message = t('cli.notInitialized');
    const initBtn = t('cli.initializeNow');
    const learnMoreBtn = t('cli.learnMore');
    vscode.window
      .showErrorMessage(message, initBtn, learnMoreBtn)
      .then((selection) => {
        if (selection === initBtn) {
          // TODO: Run openspec init
          vscode.window.showInformationMessage(t('cli.runInit'));
        } else if (selection === learnMoreBtn) {
          vscode.env.openExternal(
            vscode.Uri.parse('https://github.com/Fission-AI/OpenSpec/blob/main/docs/getting-started.md')
          );
        }
      });
  }
}
