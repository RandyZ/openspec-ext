import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../utils/logger';
import { OpenSpecCliService } from './openspecCli';
import { FileManagerService } from './fileManager';
import { FileWatcherService } from './fileWatcher';
import { ChangeInfo, ChangeDetails, SpecInfo, ArchivedChangeInfo } from './types';

export interface DashboardData {
  changes: ChangeInfo[];
  specs: SpecInfo[];
  lastRefresh: number;
}

export class DataManager {
  private cliService: OpenSpecCliService;
  private fileManager: FileManagerService;
  private fileWatcher: FileWatcherService;
  private cachedData: DashboardData | null = null;
  private refreshCallbacks: Set<() => void> = new Set();

  constructor(private workspaceRoot: string) {
    const openspecDir = path.join(workspaceRoot, 'openspec');

    this.cliService = new OpenSpecCliService(workspaceRoot);
    this.fileManager = new FileManagerService(openspecDir);
    this.fileWatcher = new FileWatcherService(workspaceRoot);
  }

  /**
   * Initialize services
   */
  async initialize(): Promise<void> {
    // Check CLI availability
    const cliAvailable = await this.cliService.checkAvailability();
    if (!cliAvailable) {
      this.cliService.showCliNotFoundError();
      throw new Error('OpenSpec CLI not available');
    }

    const version = await this.cliService.getVersion();
    logger.info(`Initialized with OpenSpec CLI ${version}`);

    // Start file watcher
    this.fileWatcher.start((events) => {
      logger.info(`File changes detected (${events.length} events), refreshing...`);
      this.refresh();
    });
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.fileWatcher.stop();
  }

  /**
   * Refresh dashboard data from CLI (and from change specs when CLI returns none)
   */
  async refresh(): Promise<DashboardData> {
    try {
      logger.info('Refreshing dashboard data...');

      const [changes, cliSpecs] = await Promise.all([
        this.cliService.listChanges(),
        this.cliService.listSpecs(),
      ]);

      // When CLI returns no specs, show delta specs from each change's specs/ folder
      const specs: SpecInfo[] = cliSpecs.length > 0 ? cliSpecs : await this.listSpecsFromChanges();

      const data: DashboardData = {
        changes,
        specs,
        lastRefresh: Date.now(),
      };
      this.cachedData = data;

      logger.info(`Refreshed: ${changes.length} changes, ${specs.length} specs`);
      this.notifyRefresh();
      return this.cachedData;
    } catch (error) {
      logger.error('Failed to refresh dashboard data', error as Error);
      throw error;
    }
  }

  /**
   * List delta specs from openspec/changes/.../specs/.../spec.md when CLI list --specs is empty.
   * Counts requirements by matching "### Requirement:" in each spec.md.
   */
  private async listSpecsFromChanges(): Promise<SpecInfo[]> {
    const changesDir = path.join(this.workspaceRoot, 'openspec', 'changes');
    const result: SpecInfo[] = [];

    try {
      const entries = await fs.promises.readdir(changesDir, { withFileTypes: true });
      for (const ent of entries) {
        if (!ent.isDirectory() || ent.name === 'archive') continue;
        const changeName = ent.name;
        const specsDir = path.join(changesDir, changeName, 'specs');
        try {
          const specEntries = await fs.promises.readdir(specsDir, { withFileTypes: true });
          for (const se of specEntries) {
            if (!se.isDirectory()) continue;
            const specPath = path.join(specsDir, se.name, 'spec.md');
            try {
              await fs.promises.access(specPath);
              const relativePath = path.relative(this.workspaceRoot, specPath);
              const requirementCount = await this.countRequirementsInSpec(specPath);
              result.push({
                id: `${changeName} / ${se.name}`,
                requirementCount,
                path: relativePath,
              });
            } catch {
              // no spec.md in this subdir
            }
          }
        } catch {
          // no specs dir or not readable
        }
      }
    } catch (err) {
      logger.debug(`Could not list specs from changes: ${(err as Error).message}`);
    }

    return result;
  }

  /**
   * Count lines matching "### Requirement:" in a spec markdown file
   */
  private async countRequirementsInSpec(specPath: string): Promise<number> {
    try {
      const content = await fs.promises.readFile(specPath, 'utf-8');
      const matches = content.match(/^### Requirement:/gm);
      return matches ? matches.length : 0;
    } catch {
      return 0;
    }
  }

  /**
   * Get cached dashboard data or refresh
   */
  async getDashboardData(): Promise<DashboardData> {
    if (!this.cachedData) {
      return await this.refresh();
    }
    return this.cachedData;
  }

  /**
   * Get change details (from CLI)
   */
  async getChangeDetails(changeName: string): Promise<ChangeDetails> {
    return await this.cliService.showChange(changeName);
  }

  /**
   * Check if artifact file exists
   */
  async artifactExists(changeName: string, artifactType: string): Promise<boolean> {
    return await this.fileManager.artifactExists(changeName, artifactType);
  }

  /**
   * Read artifact content (from file system)
   */
  async readArtifact(changeName: string, artifactType: string): Promise<string> {
    return await this.fileManager.readArtifact(changeName, artifactType);
  }

  /**
   * Read spec content (from file system)
   */
  async readSpec(specId: string): Promise<string> {
    return await this.fileManager.readSpec(specId);
  }

  /**
   * Read delta spec (from file system)
   */
  async readDeltaSpec(changeName: string, specId: string): Promise<string | null> {
    return await this.fileManager.readDeltaSpec(changeName, specId);
  }

  /**
   * List archived changes (scan openspec/changes/archive, lazy-loaded).
   * Directory names are expected to be YYYY-MM-DD-<name>.
   */
  async listArchivedChanges(): Promise<ArchivedChangeInfo[]> {
    const archiveDir = path.join(this.workspaceRoot, 'openspec', 'changes', 'archive');
    const result: ArchivedChangeInfo[] = [];
    try {
      const entries = await fs.promises.readdir(archiveDir, { withFileTypes: true });
      for (const ent of entries) {
        if (!ent.isDirectory()) continue;
        const directoryName = ent.name;
        const match = directoryName.match(/^(\d{4}-\d{2}-\d{2})-(.+)$/);
        const archiveDate = match ? match[1] : '';
        const name = match ? match[2] : directoryName;
        result.push({ directoryName, name, archiveDate });
      }
      result.sort((a, b) =>
        (b.archiveDate || b.directoryName).localeCompare(a.archiveDate || a.directoryName)
      );
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        logger.debug(`Could not list archive: ${(err as Error).message}`);
      }
    }
    return result;
  }

  /**
   * List delta spec ids for a change (specs/<id>/spec.md).
   * For archived changes, changeName must be prefixed with "archive:" and then directoryName.
   */
  async listDeltaSpecIds(changeName: string): Promise<string[]> {
    const baseDir = changeName.startsWith('archive:')
      ? path.join(this.workspaceRoot, 'openspec', 'changes', 'archive', changeName.slice(8))
      : path.join(this.workspaceRoot, 'openspec', 'changes', changeName);
    const specsDir = path.join(baseDir, 'specs');
    try {
      const entries = await fs.promises.readdir(specsDir, { withFileTypes: true });
      const ids: string[] = [];
      for (const ent of entries) {
        if (!ent.isDirectory()) continue;
        const specPath = path.join(specsDir, ent.name, 'spec.md');
        try {
          await fs.promises.access(specPath);
          ids.push(ent.name);
        } catch {
          // no spec.md
        }
      }
      return ids;
    } catch {
      return [];
    }
  }

  /**
   * Read tasks for a change
   */
  async readTasks(changeName: string) {
    return await this.fileManager.readTasks(changeName);
  }

  /**
   * Toggle task completion
   */
  async toggleTask(changeName: string, taskIndex: number): Promise<void> {
    await this.fileManager.toggleTask(changeName, taskIndex);
    // Refresh to update task counts
    await this.refresh();
  }

  /**
   * Create new change (via CLI)
   */
  async createChange(name: string): Promise<void> {
    await this.cliService.createChange(name);
    await this.refresh();
  }

  /**
   * Archive a change (via CLI)
   */
  async archiveChange(name: string): Promise<void> {
    await this.cliService.archiveChange(name);
    await this.refresh();
  }

  /**
   * Register refresh callback
   */
  onRefresh(callback: () => void): vscode.Disposable {
    this.refreshCallbacks.add(callback);
    return new vscode.Disposable(() => {
      this.refreshCallbacks.delete(callback);
    });
  }

  /**
   * Notify all refresh callbacks
   */
  private notifyRefresh(): void {
    this.refreshCallbacks.forEach((callback) => {
      try {
        callback();
      } catch (error) {
        logger.error('Error in refresh callback', error as Error);
      }
    });
  }
}
