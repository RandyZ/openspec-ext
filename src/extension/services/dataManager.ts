import * as vscode from 'vscode';
import * as path from 'path';
import { logger } from '../utils/logger';
import { OpenSpecCliService } from './openspecCli';
import { FileManagerService } from './fileManager';
import { FileWatcherService } from './fileWatcher';
import { ChangeInfo, ChangeDetails, SpecInfo } from './types';

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
   * Refresh dashboard data from CLI
   */
  async refresh(): Promise<DashboardData> {
    try {
      logger.info('Refreshing dashboard data...');

      const [changes, specs] = await Promise.all([
        this.cliService.listChanges(),
        this.cliService.listSpecs(),
      ]);

      this.cachedData = {
        changes,
        specs,
        lastRefresh: Date.now(),
      };

      logger.info(`Refreshed: ${changes.length} changes, ${specs.length} specs`);
      this.notifyRefresh();
      return this.cachedData;
    } catch (error) {
      logger.error('Failed to refresh dashboard data', error as Error);
      throw error;
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
