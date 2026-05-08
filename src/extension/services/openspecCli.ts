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

export class OpenSpecCliService {
  private workspaceRoot: string;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
  }

  /**
   * Check if OpenSpec CLI is available
   */
  async checkAvailability(): Promise<boolean> {
    try {
      await this.execOpenSpec(['--version']);
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
              status: this.determineStatus(c),
              artifacts,
            };
          } catch {
            return {
              name: c.name,
              completedTasks: c.completedTasks || 0,
              totalTasks: c.totalTasks || 0,
              lastModified: c.lastModified,
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
      // `-y`: non-interactive; `openspec archive` otherwise waits for stdin and the extension hits its CLI timeout.
      const args = ['archive', name, '-y'];
      const skipSpecs = vscode.workspace.getConfiguration('openspec').get<boolean>('archiveSkipSpecs', false);
      if (skipSpecs) {
        args.push('--skip-specs');
      }
      await this.execOpenSpec(args);
      logger.info(`Archived change: ${name}`);
    } catch (error) {
      logger.error(`Failed to archive change: ${name}`, error as Error);
      throw error;
    }
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
  private async execOpenSpec(args: string[], retries: number = 3): Promise<string> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        return await this.execOpenSpecOnce(args);
      } catch (error) {
        lastError = error as Error;

        if (error instanceof OpenSpecCliError && error.exitCode === 127) {
          this.showCliNotFoundError();
          throw error;
        }

        if (attempt < retries - 1) {
          const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
          logger.warn(`Command failed, retrying in ${delay}ms (attempt ${attempt + 1}/${retries})`);
          await this.sleep(delay);
        }
      }
    }

    if (lastError && this.isCliNotFoundError(lastError)) {
      this.showCliNotFoundError();
    }
    throw lastError;
  }

  /** True when the error indicates openspec binary was not found (e.g. spawn ENOENT). */
  private isCliNotFoundError(err: Error): boolean {
    const msg = err.message.toLowerCase();
    return msg.includes('spawn') && (msg.includes('enoent') || msg.includes('not found'));
  }

  /**
   * Execute OpenSpec CLI command (single attempt)
   */
  private async execOpenSpecOnce(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const proc = spawn('openspec', args, {
        cwd: this.workspaceRoot,
        env: process.env,
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
        reject(new Error(`Failed to spawn openspec: ${error.message}`));
      });

      const timeoutMs = vscode.workspace.getConfiguration('openspec').get<number>('cliTimeoutMs', 120000);
      const timeout = setTimeout(() => {
        proc.kill();
        reject(new Error(`Command timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      proc.on('close', () => {
        clearTimeout(timeout);
      });
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
   * Show user-friendly error notification
   */
  showCliNotFoundError(): void {
    const message = t('cli.notFound');
    const installBtn = t('cli.installInstructions');
    vscode.window
      .showErrorMessage(message, installBtn)
      .then((selection) => {
        if (selection === installBtn) {
          vscode.env.openExternal(
            vscode.Uri.parse('https://github.com/Fission-AI/OpenSpec#quick-start')
          );
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
