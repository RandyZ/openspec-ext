import { spawn } from 'child_process';
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
} from './types';
import { OpenSpecCliResolver, OpenSpecCliResolutionError } from './openspecCliResolver';
import {
  buildCliActivationDiagnostic,
  type CliActivationDiagnostic,
  type CliActivationDiagnosticCategory,
} from './cliActivationDiagnostic';

const MINIMUM_OPENSPEC_VERSION = '1.0.0';

export class OpenSpecCliService {
  private workspaceRoot: string;
  private resolver: OpenSpecCliResolver;
  private cliActivationDiagnostic: CliActivationDiagnostic | null = null;
  private shownCliDiagnosticKeys = new Set<string>();

  constructor(workspaceRoot: string, resolver?: OpenSpecCliResolver) {
    this.workspaceRoot = workspaceRoot;
    this.resolver = resolver ?? new OpenSpecCliResolver(workspaceRoot);
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

  /**
   * Get change status with artifact details.
   * If CLI returns non-JSON, returns { artifacts: [] } so listChanges can still show basic change list.
   */
  async getChangeStatus(name: string): Promise<{ artifacts?: unknown[]; [k: string]: unknown }> {
    try {
      const output = await this.execOpenSpec(['status', '--change', name, '--json']);
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
  async listChanges(): Promise<ChangeInfo[]> {
    try {
      const output = await this.execOpenSpec(['list', '--json']);
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
            const status = await this.getChangeStatus(c.name);
            const artifacts = this.normalizeArtifactStatuses(status.artifacts ?? []);
            return {
              name: c.name,
              completedTasks: c.completedTasks || 0,
              totalTasks: c.totalTasks || 0,
              lastModified: c.lastModified,
              createdAt: this.normalizeCreatedAt(c),
              status: this.determineStatus(c),
              artifacts,
            };
          } catch {
            return {
              name: c.name,
              completedTasks: c.completedTasks || 0,
              totalTasks: c.totalTasks || 0,
              lastModified: c.lastModified,
              createdAt: this.normalizeCreatedAt(c),
              status: this.determineStatus(c),
              artifacts: [] as ArtifactStatus[],
            };
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
  async showChange(name: string): Promise<ChangeDetails> {
    try {
      const output = await this.execOpenSpec(['show', name, '--json']);
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
  async listSpecs(): Promise<SpecInfo[]> {
    try {
      const output = (await this.execOpenSpec(['list', '--specs', '--json'])).trim();

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
  async validateChange(name: string): Promise<ValidationResult> {
    try {
      const output = await this.execOpenSpec(['validate', name, '--json']);
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
  async createChange(name: string): Promise<void> {
    try {
      await this.execOpenSpec(['new', 'change', name]);
      logger.info(`Created change: ${name}`);
    } catch (error) {
      logger.error(`Failed to create change: ${name}`, error as Error);
      throw error;
    }
  }

  /**
   * Archive a change
   */
  async archiveChange(name: string): Promise<void> {
    try {
      const output = await this.execOpenSpec(['archive', name, '--yes'], 1, { timeoutMs: 120000 });
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
  async getInstructions(artifact: string, changeName: string): Promise<string> {
    return await this.execOpenSpec([
      'instructions',
      artifact,
      '--change',
      changeName,
      '--json',
    ]);
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
   * Execute OpenSpec CLI command (single attempt)
   */
  private async execOpenSpecOnce(args: string[], timeoutMs: number): Promise<string> {
    return new Promise((resolve, reject) => {
      this.resolver.resolve().then(({ command, env }) => {
      const proc = spawn(command, args, {
        cwd: this.workspaceRoot,
        env,
        // Windows: npm global installs `openspec.cmd`; `spawn` without shell often fails with
        // ENOENT in Electron/Cursor when PATH is resolved differently than in a terminal.
        shell: process.platform === 'win32',
        windowsHide: process.platform === 'win32',
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
      }).catch(reject);
    });
  }

  /** Normalize CLI artifact list (unknown[]) to ArtifactStatus[]; CLI may use 'complete' for done. */
  private normalizeArtifactStatuses(raw: unknown[]): ArtifactStatus[] {
    return this.normalizeArtifactInfos(raw) as ArtifactStatus[];
  }

  private normalizeArtifactInfos(raw: unknown[]): ArtifactInfo[] {
    const allowed: Array<'done' | 'ready' | 'blocked'> = ['done', 'ready', 'blocked'];
    return raw
      .filter((a): a is Record<string, unknown> => a != null && typeof a === 'object')
      .map((a) => {
        const status = a.status === 'complete' ? 'done' : a.status;
        return {
          id: typeof a.id === 'string' ? a.id : '',
          outputPath: typeof a.outputPath === 'string' ? a.outputPath : (a.path as string) ?? '',
          status: (typeof status === 'string' && allowed.includes(status as 'done' | 'ready' | 'blocked') ? status : 'blocked') as 'done' | 'ready' | 'blocked',
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
