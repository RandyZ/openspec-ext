import { spawn } from 'child_process';
import * as vscode from 'vscode';
import { logger } from '../utils/logger';
import {
  ChangeInfo,
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
   * List all changes
   */
  async listChanges(): Promise<ChangeInfo[]> {
    try {
      const output = await this.execOpenSpec(['list', '--json']);
      const data = JSON.parse(output);

      if (!data.changes || !Array.isArray(data.changes)) {
        logger.warn('Unexpected format from openspec list');
        return [];
      }

      return data.changes.map((c: any) => ({
        name: c.name,
        completedTasks: c.completedTasks || 0,
        totalTasks: c.totalTasks || 0,
        lastModified: c.lastModified,
        status: this.determineStatus(c),
      }));
    } catch (error) {
      logger.error('Failed to list changes', error as Error);
      throw error;
    }
  }

  /**
   * Show details for a specific change
   */
  async showChange(name: string): Promise<ChangeDetails> {
    try {
      const output = await this.execOpenSpec(['show', name, '--json']);
      const data = JSON.parse(output);

      return {
        name: data.name || name,
        schema: data.schema || 'unknown',
        artifacts: data.artifacts || [],
        tasks: data.tasks || [],
        metadata: data.metadata || {},
      };
    } catch (error) {
      logger.error(`Failed to show change: ${name}`, error as Error);
      throw error;
    }
  }

  /**
   * List all specs
   * Note: OpenSpec CLI may return "No specs found.\n" instead of JSON when there are no specs.
   */
  async listSpecs(): Promise<SpecInfo[]> {
    try {
      const output = (await this.execOpenSpec(['list', '--specs', '--json'])).trim();

      // CLI returns plain text "No specs found." when there are no specs (not valid JSON)
      if (!output || output.startsWith('No specs found')) {
        return [];
      }

      let data: any;
      try {
        data = JSON.parse(output);
      } catch (parseError) {
        logger.warn(`openspec list --specs returned non-JSON (${output.slice(0, 60)}...), treating as empty`);
        return [];
      }

      if (!data.specs || !Array.isArray(data.specs)) {
        logger.warn('Unexpected format from openspec list --specs');
        return [];
      }

      return data.specs.map((s: any) => ({
        id: s.id,
        requirementCount: s.requirementCount || 0,
        path: s.path,
      }));
    } catch (error) {
      logger.error('Failed to list specs', error as Error);
      throw error;
    }
  }

  /**
   * Validate a change
   */
  async validateChange(name: string): Promise<ValidationResult> {
    try {
      const output = await this.execOpenSpec(['validate', name, '--json']);
      const data = JSON.parse(output);

      return {
        valid: data.valid || false,
        errors: data.errors || [],
        warnings: data.warnings || [],
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
      await this.execOpenSpec(['archive', name]);
      logger.info(`Archived change: ${name}`);
    } catch (error) {
      logger.error(`Failed to archive change: ${name}`, error as Error);
      throw error;
    }
  }

  /**
   * Execute OpenSpec CLI command with retry logic
   */
  private async execOpenSpec(args: string[], retries: number = 3): Promise<string> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        return await this.execOpenSpecOnce(args);
      } catch (error) {
        lastError = error as Error;

        if (error instanceof OpenSpecCliError && error.exitCode === 127) {
          // Command not found, don't retry
          throw error;
        }

        if (attempt < retries - 1) {
          const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
          logger.warn(`Command failed, retrying in ${delay}ms (attempt ${attempt + 1}/${retries})`);
          await this.sleep(delay);
        }
      }
    }

    throw lastError;
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

      // Timeout after 30 seconds
      const timeout = setTimeout(() => {
        proc.kill();
        reject(new Error('Command timed out after 30 seconds'));
      }, 30000);

      proc.on('close', () => {
        clearTimeout(timeout);
      });
    });
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
    const message = 'OpenSpec CLI not found. Please install it first.';
    vscode.window
      .showErrorMessage(message, 'Install Instructions')
      .then((selection) => {
        if (selection === 'Install Instructions') {
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
    const message = 'OpenSpec not initialized in this workspace.';
    vscode.window
      .showErrorMessage(message, 'Initialize Now', 'Learn More')
      .then((selection) => {
        if (selection === 'Initialize Now') {
          // TODO: Run openspec init
          vscode.window.showInformationMessage('Run: openspec init');
        } else if (selection === 'Learn More') {
          vscode.env.openExternal(
            vscode.Uri.parse('https://github.com/Fission-AI/OpenSpec/blob/main/docs/getting-started.md')
          );
        }
      });
  }
}
