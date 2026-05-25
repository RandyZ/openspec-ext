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
import { extractProposalWhy } from './proposalWhy';

export interface DashboardData {
  changes: ChangeInfo[];
  specs: SpecInfo[];
  lastRefresh: number;
}

export interface AgentAdapterInfo {
  available: { id: string; displayName: string }[];
  currentId: string | null;
}

/** Downstream artifacts that should be invalidated when an upstream artifact changes */
const ARTIFACT_DOWNSTREAM: Record<string, string[]> = {
  proposal: ['design', 'specs', 'tasks'],
  design: ['tasks'],
  specs: ['tasks'],
  tasks: [],
};

export interface ArtifactChangedEvent {
  changeName: string;
  /** The artifact types whose cached content should be invalidated in the webview */
  artifactTypes: string[];
}

export class DataManager {
  private cliService: OpenSpecCliService;
  private stateReader: StateReader;
  private contentAccess: IOpenSpecContentAccess;
  private fileWatcher: FileWatcherService;
  private taskExecutorService: TaskExecutorService;
  private cachedData: DashboardData | null = null;
  private refreshInFlight: Promise<DashboardData> | null = null;
  private queuedRefresh: Promise<DashboardData> | null = null;
  private refreshCallbacks: Set<(data: DashboardData) => void> = new Set();
  private artifactChangedCallbacks: Set<(event: ArtifactChangedEvent) => void> = new Set();

  constructor(private workspaceRoot: string) {
    const openspecDir = path.join(workspaceRoot, 'openspec');

    this.cliService = new OpenSpecCliService(workspaceRoot);
    this.contentAccess = new FileManagerService(openspecDir);
    this.stateReader = new StateReader(this.cliService, this.contentAccess);
    this.fileWatcher = new FileWatcherService(workspaceRoot);
    this.taskExecutorService = new TaskExecutorService(workspaceRoot, this.contentAccess);
  }

  /** Workspace root used for openspec (same root used by "Open in Editor" and content read). */
  getWorkspaceRoot(): string {
    return this.workspaceRoot;
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
      // Collect artifact-specific changes to notify open panels
      const artifactChanges = new Map<string, Set<string>>();

      for (const e of events) {
        const relative = path.relative(this.workspaceRoot, e.uri.fsPath).replace(/\\/g, '/');

        // tasks.md auto-complete parents
        const archiveTasksMatch = relative.match(/^openspec\/changes\/archive\/([^/]+)\/tasks\.md$/);
        const draftTasksMatch = relative.match(/^openspec\/changes\/(?!archive)([^/]+)\/tasks\.md$/);
        const tasksChangeName = archiveTasksMatch
          ? `archive:${archiveTasksMatch[1]}`
          : draftTasksMatch ? draftTasksMatch[1] : null;
        if (tasksChangeName) {
          this.contentAccess.autoCompleteParents(tasksChangeName).catch((err) =>
            logger.warn('autoCompleteParents after tasks.md change', err as Error)
          );
        }

        // Detect which artifact changed and compute downstream invalidations
        const parsed = this.parseArtifactFromPath(relative);
        if (parsed) {
          const { changeName, artifactType } = parsed;
          if (!artifactChanges.has(changeName)) {
            artifactChanges.set(changeName, new Set());
          }
          // Invalidate the changed artifact itself + its downstream dependents
          const invalidate = [artifactType, ...(ARTIFACT_DOWNSTREAM[artifactType] ?? [])];
          for (const t of invalidate) {
            artifactChanges.get(changeName)!.add(t);
          }
        }
      }

      // Notify artifact-level change subscribers (e.g. open change detail panels)
      for (const [changeName, types] of artifactChanges) {
        this.notifyArtifactChanged({ changeName, artifactTypes: [...types] });
      }

      logger.info(`File changes detected (${events.length} events), refreshing...`);
      void this.refresh().catch((error) => {
        logger.warn('Failed to refresh after file changes', error as Error);
      });
    });

    this.warmDashboardData();
  }

  /**
   * Parse a workspace-relative path to identify which change and artifact type changed.
   * Handles: proposal.md, design.md, tasks.md, specs/<id>/spec.md
   */
  private parseArtifactFromPath(
    relative: string
  ): { changeName: string; artifactType: string } | null {
    // Draft change artifact: openspec/changes/<name>/<artifact>.md
    const draftMatch = relative.match(
      /^openspec\/changes\/(?!archive\/)([^/]+)\/(proposal|design|tasks)\.md$/
    );
    if (draftMatch) {
      return { changeName: draftMatch[1], artifactType: draftMatch[2] };
    }
    // Delta spec: openspec/changes/<name>/specs/<specId>/spec.md
    const specMatch = relative.match(
      /^openspec\/changes\/(?!archive\/)([^/]+)\/specs\/[^/]+\/spec\.md$/
    );
    if (specMatch) {
      return { changeName: specMatch[1], artifactType: 'specs' };
    }
    return null;
  }

  /**
   * Register a callback for artifact-level changes (e.g. proposal.md modified → notify
   * open change detail panels to invalidate downstream artifact caches).
   */
  onArtifactChanged(callback: (event: ArtifactChangedEvent) => void): vscode.Disposable {
    this.artifactChangedCallbacks.add(callback);
    return new vscode.Disposable(() => {
      this.artifactChangedCallbacks.delete(callback);
    });
  }

  private notifyArtifactChanged(event: ArtifactChangedEvent): void {
    for (const cb of this.artifactChangedCallbacks) {
      try {
        cb(event);
      } catch (err) {
        logger.error('Error in artifactChanged callback', err as Error);
      }
    }
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
    if (!this.refreshInFlight) {
      return this.startRefresh();
    }

    if (!this.queuedRefresh) {
      const queuedRefresh = this.refreshInFlight
        .catch(() => undefined)
        .then(() => {
          if (this.queuedRefresh === queuedRefresh) {
            this.queuedRefresh = null;
          }
          return this.startRefresh();
        })
        .finally(() => {
          if (this.queuedRefresh === queuedRefresh) {
            this.queuedRefresh = null;
          }
        });
      this.queuedRefresh = queuedRefresh;
    }

    return this.queuedRefresh;
  }

  /**
   * Get cached dashboard data or refresh
   */
  async getDashboardData(): Promise<DashboardData> {
    if (!this.cachedData) {
      return await (this.queuedRefresh ?? this.refreshInFlight ?? this.startRefresh());
    }
    return this.cachedData;
  }

  private warmDashboardData(): void {
    void this.getDashboardData().catch((error) => {
      logger.warn('Failed to warm dashboard data', error as Error);
    });
  }

  private startRefresh(): Promise<DashboardData> {
    const refresh = this.runRefresh().finally(() => {
      if (this.refreshInFlight === refresh) {
        this.refreshInFlight = null;
      }
    });
    this.refreshInFlight = refresh;
    return refresh;
  }

  private async runRefresh(): Promise<DashboardData> {
    try {
      logger.info('Refreshing dashboard data...');

      const [rawChanges, specs] = await Promise.all([
        this.stateReader.listChanges(),
        this.stateReader.listSpecs(),
      ]);
      const changes = await this.enrichChangesWithProposalWhy(rawChanges);

      const data: DashboardData = {
        changes,
        specs,
        lastRefresh: Date.now(),
      };
      this.cachedData = data;

      logger.info(`Refreshed: ${changes.length} changes, ${specs.length} specs`);
      this.notifyRefresh(data);
      return this.cachedData;
    } catch (error) {
      logger.error('Failed to refresh dashboard data', error as Error);
      throw error;
    }
  }

  private async enrichChangesWithProposalWhy(changes: ChangeInfo[]): Promise<ChangeInfo[]> {
    return await Promise.all(
      changes.map(async (change) => {
        try {
          const proposal = await this.contentAccess.readArtifact(change.name, 'proposal');
          const why = extractProposalWhy(proposal);
          const artifactSearchText = (change.artifacts ?? [])
            .map((a) => `${a.id} ${a.status}`)
            .join(' ');
          const searchText = [
            change.name,
            change.status,
            artifactSearchText,
            why.summary,
            why.fullText,
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();

          return {
            ...change,
            proposalWhySummary: why.summary,
            proposalWhyFullText: why.fullText,
            searchText,
          };
        } catch {
          return change;
        }
      })
    );
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

  async getSpecRequirements(specId: string): Promise<string[]> {
    return await (this.contentAccess as any).getSpecRequirements?.(specId) ?? [];
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
  onRefresh(callback: (data: DashboardData) => void): vscode.Disposable {
    this.refreshCallbacks.add(callback);
    return new vscode.Disposable(() => {
      this.refreshCallbacks.delete(callback);
    });
  }

  /**
   * Notify all refresh callbacks
   */
  private notifyRefresh(data: DashboardData): void {
    this.refreshCallbacks.forEach((callback) => {
      try {
        callback(data);
      } catch (error) {
        logger.error('Error in refresh callback', error as Error);
      }
    });
  }
}
