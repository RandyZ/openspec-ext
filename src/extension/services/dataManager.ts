import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import YAML from 'yaml';
import { logger } from '../utils/logger';
import { OpenSpecCliService } from './openspecCli';
import { FileManagerService } from './fileManager';
import { FileWatcherService } from './fileWatcher';
import { TaskExecutorService } from './taskExecutorService';
import { StateReader } from './stateReader';
import type { IOpenSpecContentAccess } from './contentAccess';
import { getAvailableAdapters, getCurrentAdapter } from '../adapters';
import { ChangeInfo, ChangeDetails, SpecInfo, ArchivedChangeInfo } from './types';

export interface DashboardData {
  changes: ChangeInfo[];
  specs: SpecInfo[];
  lastRefresh: number;
}

export interface AgentAdapterInfo {
  available: { id: string; displayName: string }[];
  currentId: string | null;
}

export class DataManager {
  private cliService: OpenSpecCliService;
  private stateReader: StateReader;
  private contentAccess: IOpenSpecContentAccess;
  private fileWatcher: FileWatcherService;
  private taskExecutorService: TaskExecutorService;
  private cachedData: DashboardData | null = null;
  private refreshCallbacks: Set<() => void> = new Set();

  constructor(private workspaceRoot: string) {
    const openspecDir = path.join(workspaceRoot, 'openspec');

    this.cliService = new OpenSpecCliService(workspaceRoot);
    this.contentAccess = new FileManagerService(openspecDir);
    this.stateReader = new StateReader(this.cliService, this.contentAccess);
    this.fileWatcher = new FileWatcherService(workspaceRoot);
    this.taskExecutorService = new TaskExecutorService(workspaceRoot, this.contentAccess);
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

    // One-time migration: move openspec/.execution-state.json into each change's .openspec.yaml
    await this.migrateExecutionStateFromGlobalFile();

    // Start file watcher
    this.fileWatcher.start((events) => {
      for (const e of events) {
        const relative = path.relative(this.workspaceRoot, e.uri.fsPath).replace(/\\/g, '/');
        const archiveMatch = relative.match(/^openspec\/changes\/archive\/([^/]+)\/tasks\.md$/);
        const draftMatch = relative.match(/^openspec\/changes\/(?!archive)([^/]+)\/tasks\.md$/);
        const changeName = archiveMatch ? `archive:${archiveMatch[1]}` : draftMatch ? draftMatch[1] : null;
        if (changeName) {
          this.contentAccess.autoCompleteParents(changeName).catch((err) =>
            logger.warn('autoCompleteParents after tasks.md change', err as Error)
          );
        }
      }
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
   * Refresh dashboard data from State Reader (CLI list + status, specs with fallback)
   */
  async refresh(): Promise<DashboardData> {
    try {
      logger.info('Refreshing dashboard data...');

      const [changes, specs] = await Promise.all([
        this.stateReader.listChanges(),
        this.stateReader.listSpecs(),
      ]);

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
   * Get cached dashboard data or refresh
   */
  async getDashboardData(): Promise<DashboardData> {
    if (!this.cachedData) {
      return await this.refresh();
    }
    return this.cachedData;
  }

  /**
   * Get change details (from State Reader / CLI show)
   */
  async getChangeDetails(changeName: string): Promise<ChangeDetails> {
    return await this.stateReader.getChangeDetails(changeName);
  }

  /**
   * Check if artifact exists (State Reader: show artifacts or Content Access)
   */
  async artifactExists(changeName: string, artifactType: string): Promise<boolean> {
    return await this.stateReader.artifactExists(changeName, artifactType);
  }

  /**
   * Read artifact content (Content Access)
   */
  async readArtifact(changeName: string, artifactType: string): Promise<string> {
    return await this.contentAccess.readArtifact(changeName, artifactType);
  }

  /**
   * Read main spec content (Content Access)
   */
  async readSpec(specId: string): Promise<string> {
    return await this.contentAccess.readSpec(specId);
  }

  /**
   * Read delta spec (Content Access)
   */
  async readDeltaSpec(changeName: string, specId: string): Promise<string | null> {
    return await this.contentAccess.readDeltaSpec(changeName, specId);
  }

  /**
   * List archived changes (State Reader -> Content Access)
   */
  async listArchivedChanges(): Promise<ArchivedChangeInfo[]> {
    return await this.stateReader.listArchivedChanges();
  }

  /**
   * List delta spec ids for a change (Content Access)
   */
  async listDeltaSpecIds(changeName: string): Promise<string[]> {
    return await this.contentAccess.listDeltaSpecIds(changeName);
  }

  /**
   * Read tasks for a change (State Reader: show.tasks or Content Access)
   */
  async readTasks(changeName: string) {
    return await this.stateReader.getTasks(changeName);
  }

  /**
   * Toggle task completion. 若子任务全部完成，会自动勾选父任务。
   */
  async toggleTask(changeName: string, taskIndex: number): Promise<void> {
    await this.contentAccess.toggleTask(changeName, taskIndex);
    await this.contentAccess.autoCompleteParents(changeName);
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
   * Execute task via current adapter (dependency check + mode handled inside).
   * @returns { success: boolean } for UI to clear running state.
   */
  async executeTaskRequest(changeName: string, taskIndex: number, taskText: string): Promise<{ success: boolean }> {
    return await this.taskExecutorService.execute(changeName, taskIndex, taskText);
  }

  /**
   * Get available agent adapters and current selection for UI.
   */
  async getAgentAdaptersInfo(): Promise<AgentAdapterInfo> {
    const available = await getAvailableAdapters();
    const current = await getCurrentAdapter();
    return {
      available: available.map((a) => ({ id: a.id, displayName: a.displayName })),
      currentId: current?.id ?? null,
    };
  }

  /**
   * One-time migration: if openspec/.execution-state.json exists, write each change's state
   * into that change's .openspec.yaml under extension.taskExecution, then delete the global file.
   */
  private async migrateExecutionStateFromGlobalFile(): Promise<void> {
    const globalPath = path.join(this.workspaceRoot, 'openspec', '.execution-state.json');
    let data: Record<string, Record<string, { success: boolean; timestamp: number }>> = {};
    try {
      const raw = await fs.promises.readFile(globalPath, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) data = parsed;
    } catch {
      return; // no file or invalid: nothing to migrate
    }
    for (const changeName of Object.keys(data)) {
      const taskExecution = data[changeName];
      if (!taskExecution || typeof taskExecution !== 'object') continue;
      const filePath = this.contentAccess.getChangeOpenspecYamlPath(changeName);
      const dir = path.dirname(filePath);
      await fs.promises.mkdir(dir, { recursive: true });
      let doc: Record<string, unknown> = {};
      try {
        const raw = await fs.promises.readFile(filePath, 'utf8');
        const parsed = YAML.parse(raw);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) doc = parsed as Record<string, unknown>;
      } catch {
        // missing or invalid
      }
      if (!doc.extension || typeof doc.extension !== 'object') doc.extension = {};
      (doc.extension as Record<string, unknown>).taskExecution = { ...taskExecution };
      await fs.promises.writeFile(filePath, YAML.stringify(doc), 'utf8');
    }
    try {
      await fs.promises.unlink(globalPath);
      logger.info('Migrated execution state from .execution-state.json to per-change .openspec.yaml');
    } catch (err) {
      logger.warn('Could not remove legacy .execution-state.json', err as Error);
    }
  }

  /**
   * Read task execution state from the change's .openspec.yaml (extension.taskExecution).
   * Returns {} if file missing, parse error, or extension.taskExecution absent.
   */
  async getTaskExecutionState(changeName: string): Promise<Record<number, { success: boolean; timestamp: number }>> {
    const filePath = this.contentAccess.getChangeOpenspecYamlPath(changeName);
    try {
      const raw = await fs.promises.readFile(filePath, 'utf8');
      const data = YAML.parse(raw) as { extension?: { taskExecution?: Record<string, { success?: boolean; timestamp?: number }> } } | null;
      const taskExecution = data?.extension?.taskExecution;
      if (!taskExecution || typeof taskExecution !== 'object') return {};
      const out: Record<number, { success: boolean; timestamp: number }> = {};
      for (const [k, v] of Object.entries(taskExecution)) {
        const idx = Number(k);
        if (Number.isInteger(idx) && v && typeof v.success === 'boolean' && typeof v.timestamp === 'number') {
          out[idx] = { success: v.success, timestamp: v.timestamp };
        }
      }
      return out;
    } catch {
      return {};
    }
  }

  /**
   * Persist execution result for a task in the change's .openspec.yaml (extension.taskExecution).
   * Preserves all other top-level keys; ensures parent directory exists.
   */
  async setTaskExecutionState(changeName: string, taskIndex: number, success: boolean): Promise<void> {
    const filePath = this.contentAccess.getChangeOpenspecYamlPath(changeName);
    const dir = path.dirname(filePath);
    await fs.promises.mkdir(dir, { recursive: true });

    let data: Record<string, unknown> = {};
    try {
      const raw = await fs.promises.readFile(filePath, 'utf8');
      const parsed = YAML.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) data = parsed as Record<string, unknown>;
    } catch {
      // missing or invalid: start with minimal content
    }
    if (!data.extension || typeof data.extension !== 'object') data.extension = {};
    const ext = data.extension as Record<string, unknown>;
    if (!ext.taskExecution || typeof ext.taskExecution !== 'object') ext.taskExecution = {};
    (ext.taskExecution as Record<string, { success: boolean; timestamp: number }>)[String(taskIndex)] = {
      success,
      timestamp: Date.now(),
    };
    await fs.promises.writeFile(filePath, YAML.stringify(data), 'utf8');
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
