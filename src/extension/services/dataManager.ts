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
import type { CliActivationDiagnostic } from './cliActivationDiagnostic';
import { OpenSpecScopeManager, loadScopeRelationships, type OpenSpecScope } from './openspecScope';
import { detectOpenSpecFeatures, type OpenSpecCapabilities } from './openspecFeatures';
import type { CacheStats, CacheStatsOptions, OpenSpecCacheService } from './openSpecCacheService';
import type { ChangeWorkflowSnapshot, WorkflowBindingIdentity } from '../../shared/changeWorkflow';
import {
  buildChangeStatusCounts,
  enrichChangeWithLifecycle,
  type ChangeStatusCounts,
} from '../../shared/changeLifecycle';

export interface ScopeInfo {
  id: string;
  label: string;
  source: string;
  rootPath: string;
  storeId?: string;
  runtimeSource: 'installed' | 'customPath' | 'localSource';
  capabilities: OpenSpecCapabilities;
}

export interface ReferenceEntryView {
  store_id: string;
  specs?: { id: string; summary?: string }[];
  fetch?: string;
  status: { severity: string; code: string; message: string; fix?: string }[];
}

export interface RelationshipPanelData {
  references: ReferenceEntryView[];
  health?: { root: { path: string; healthy: boolean; status: unknown[] } };
}

export interface FeatureDiagnosticView {
  code: string;
  message: string;
  severity: 'info' | 'warning' | 'error';
}

export interface WorksetView {
  name: string;
  tool?: string;
  members: { name: string; path: string }[];
}

export interface DashboardData {
  changes: ChangeInfo[];
  specs: SpecInfo[];
  archivedChanges: ArchivedChangeInfo[];
  changeStatusCounts: ChangeStatusCounts;
  lastRefresh: number;
  scope?: ScopeInfo;
  scopes?: ScopeInfo[];
  relationships?: RelationshipPanelData;
  featureDiagnostics?: FeatureDiagnosticView[];
  worksets?: WorksetView[];
}

export interface CachedDashboardData {
  payload: DashboardData;
  metadata: { generatedAt: number };
  source: 'memory' | 'disk';
}

export interface CachedArtifactContent {
  content: string;
  source: 'memory' | 'disk';
  generatedAt: number;
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
  /** Canonical OpenSpec root for watcher-originated invalidation, when known. */
  rootPath?: string;
}

export interface DataManagerOptions {
  cacheService?: OpenSpecCacheService;
  /**
   * Additional OpenSpec project roots discovered in a multi-folder workspace.
   * Each becomes a selectable 'declared' project-root scope (the activation
   * root passed to the constructor stays the 'local' scope). Folders without an
   * openspec/config.yaml must be filtered out by the caller.
   */
  projectRoots?: { path: string; label: string }[];
}

export class DataManager {
  private cliService: OpenSpecCliService;
  private stateReader: StateReader;
  private contentAccess: IOpenSpecContentAccess;
  private fileWatcher: FileWatcherService;
  private watchedProjectRoot: string;
  private taskExecutorService: TaskExecutorService;
  private readonly cacheService?: OpenSpecCacheService;
  private cachedData: DashboardData | null = null;
  private cliDiagnostic: CliActivationDiagnostic | null = null;
  private refreshInFlight: Promise<DashboardData> | null = null;
  private queuedRefresh: Promise<DashboardData> | null = null;
  private refreshCallbacks: Set<(data: DashboardData) => void> = new Set();
  private artifactChangedCallbacks: Set<(event: ArtifactChangedEvent) => void> = new Set();
  private cliAvailable = false;

  // Scope-aware additions
  private scopeManager?: OpenSpecScopeManager;
  private capabilities?: OpenSpecCapabilities;
  private scopedContentAccess = new Map<string, IOpenSpecContentAccess>();
  private scopedStateReaders = new Map<string, StateReader>();
  private scopedTaskExecutors = new Map<string, TaskExecutorService>();
  /**
   * Per-scope CLI services for declared (non-store) project roots whose rootPath
   * differs from the activation root. These run local OpenSpec commands with
   * cwd = scope.rootPath. Store scopes are NOT here — they keep using the single
   * activation-root CLI service and append --store instead.
   */
  private scopedCliServices = new Map<string, OpenSpecCliService>();

  constructor(
    private workspaceRoot: string,
    private options: DataManagerOptions = {}
  ) {
    const openspecDir = path.join(workspaceRoot, 'openspec');

    this.cacheService = options.cacheService;
    this.cliService = new OpenSpecCliService(workspaceRoot);
    this.contentAccess = new FileManagerService(openspecDir);
    this.stateReader = new StateReader(this.cliService, this.contentAccess);
    this.fileWatcher = new FileWatcherService(workspaceRoot);
    this.watchedProjectRoot = workspaceRoot;
    this.taskExecutorService = new TaskExecutorService(workspaceRoot, this.contentAccess);
  }

  /** Workspace root used for openspec (same root used by "Open in Editor" and content read). */
  getWorkspaceRoot(): string {
    return this.workspaceRoot;
  }

  /** Keep one watcher aligned with the currently selected Project-first root. */
  setWatchedProjectRoot(rootPath: string): void {
    const normalizedRoot = path.normalize(rootPath);
    if (normalizedRoot === path.normalize(this.watchedProjectRoot)) return;
    this.watchedProjectRoot = normalizedRoot;
    this.fileWatcher.retarget(normalizedRoot);
    this.cachedData = null;
  }

  /**
   * Get the latest CLI activation diagnostic, if any.
   * Read-only access; retry/cache orchestration lives elsewhere.
   */
  getCliDiagnostic(): CliActivationDiagnostic | null {
    return this.cliDiagnostic;
  }

  getCacheRootPath(): string | undefined {
    return this.cacheService?.getCacheRootPath();
  }

  async getCacheStats(options?: CacheStatsOptions): Promise<CacheStats | undefined> {
    if (!this.cacheService) return undefined;
    try {
      return await this.cacheService.getCacheStats(options);
    } catch (error) {
      logger.warn('Failed to calculate cache stats', error as Error);
      return undefined;
    }
  }

  async clearCache(): Promise<void> {
    if (!this.cacheService) return;
    await this.cacheService.clearAll();
    this.cachedData = null;
  }

  // ── Scope-aware additions ──────────────────────────────────────────────────

  /** Initialize scope manager after CLI service is ready. Call from initialize(). */
  async initializeScopeManager(): Promise<void> {
    this.capabilities = await detectOpenSpecFeatures(this.cliService);
    this.scopeManager = new OpenSpecScopeManager(
      this.workspaceRoot,
      this.cliService,
      this.capabilities,
      this.cliService.getResolver(),
      this.options.projectRoots ?? [],
    );
    await this.scopeManager.loadScopeOptions();
    this.scopeManager.onDidChangeScope(() => {
      this.cachedData = null;
      this.scopedContentAccess.clear();
      this.scopedCliServices.clear();
      this.scopedStateReaders.clear();
      this.scopedTaskExecutors.clear();
    });
  }

  getScopeManager(): OpenSpecScopeManager | undefined {
    return this.scopeManager;
  }

  getSelectedScope(): OpenSpecScope | undefined {
    return this.scopeManager?.getSelectedScope();
  }

  selectScope(scopeId: string): void {
    this.scopeManager?.selectScope(scopeId);
  }

  getCapabilities(): OpenSpecCapabilities | undefined {
    return this.capabilities;
  }

  private getContentAccessForScope(scope: OpenSpecScope): IOpenSpecContentAccess {
    const cached = this.scopedContentAccess.get(scope.id);
    if (cached) return cached;
    const access = new FileManagerService(path.join(scope.rootPath, 'openspec'));
    this.scopedContentAccess.set(scope.id, access);
    return access;
  }

  /**
   * Build (or reuse) a per-scope OpenSpecCliService rooted at scope.rootPath.
   *
   * Non-store project scopes (e.g. declared multi-folder roots) MUST run local
   * OpenSpec commands with cwd = scope.rootPath rather than the activation root.
   * The CLI service shares the same resolver as the activation-root service so
   * localSource/customPath/installed resolution stays consistent. Store scopes
   * never reach this path — they use the single activation-root service + --store.
   */
  private createScopedCliService(rootPath: string): OpenSpecCliService {
    return new OpenSpecCliService(rootPath, this.cliService.getResolver());
  }

  private getScopedCliService(scope: OpenSpecScope): OpenSpecCliService {
    // Store scopes always use the single activation-root CLI service (with --store).
    // The activation root also uses the default service. Only additional non-store
    // project roots need a cwd override.
    if (scope.source === 'store' || path.normalize(scope.rootPath) === path.normalize(this.workspaceRoot)) {
      return this.cliService;
    }
    let service = this.scopedCliServices.get(scope.id);
    if (!service) {
      service = this.createScopedCliService(scope.rootPath);
      this.scopedCliServices.set(scope.id, service);
    }
    return service;
  }

  /**
   * Resolve a scope by id. Falls back to the currently selected scope when id is
   * omitted/unknown, then to the local workspace root. Used by message handlers so
   * change-detail panels can bind to a specific store root.
   */
  resolveScope(scopeId?: string): OpenSpecScope | undefined {
    if (this.scopeManager) {
      if (scopeId) {
        const match = this.scopeManager.getScopeOptions().find((s) => s.id === scopeId);
        if (match) return match;
      }
      return this.scopeManager.getSelectedScope();
    }
    return undefined;
  }

  /**
   * Return the services (StateReader + content access) bound to a scope.
   * Local scope reuses the default instances; store scopes get a scoped
   * FileManagerService + StateReader rooted at scope.rootPath. Declared
   * (non-store) project scopes additionally get a per-scope CLI service so
   * local OpenSpec commands run with cwd = scope.rootPath.
   */
  private getScopedServices(scope?: OpenSpecScope): {
    stateReader: StateReader;
    contentAccess: IOpenSpecContentAccess;
    cli: OpenSpecCliService;
    rootPath: string;
    scope: OpenSpecScope | undefined;
  } {
    if (!scope || scope.source === 'local') {
      return {
        stateReader: this.stateReader,
        contentAccess: this.contentAccess,
        cli: this.cliService,
        rootPath: this.workspaceRoot,
        scope,
      };
    }
    const contentAccess = this.getContentAccessForScope(scope);
    const cli = this.getScopedCliService(scope);
    let stateReader = this.scopedStateReaders.get(scope.id);
    if (!stateReader) {
      stateReader = new StateReader(cli, contentAccess);
      this.scopedStateReaders.set(scope.id, stateReader);
    }
    return { stateReader, contentAccess, cli, rootPath: scope.rootPath, scope };
  }

  private getTaskExecutorForScope(scope?: OpenSpecScope): TaskExecutorService {
    if (!scope || scope.source === 'local') return this.taskExecutorService;
    const cached = this.scopedTaskExecutors.get(scope.id);
    if (cached) return cached;
    const services = this.getScopedServices(scope);
    const executor = new TaskExecutorService(services.rootPath, services.contentAccess);
    this.scopedTaskExecutors.set(scope.id, executor);
    return executor;
  }

  async openWorkset(name: string): Promise<void> {
    await this.cliService.runCommand(['workset', 'open', name]);
  }

  /**
   * Remove a saved workset via the OpenSpec CLI. This deletes ONLY the saved
   * workset record — member folders, repos, and stores are never touched.
   * Invalidates the cached dashboard data and refreshes so the removed workset
   * disappears from the panel. Scopes are unaffected, so (unlike register/setup
   * store) there is no need to reload scope options.
   */
  async removeWorkset(name: string): Promise<DashboardData> {
    await this.cliService.runJson(['workset', 'remove', name, '--yes', '--json']);
    await this.invalidateDashboardCache();
    return await this.refresh();
  }

  async registerStore(rootPath: string): Promise<DashboardData> {
    const payload = await this.cliService.runJson([
      'store',
      'register',
      rootPath,
      '--yes',
      '--json',
    ]);
    const store = this.parseStoreMutationPayload(payload, rootPath);
    await this.reloadScopesAfterStoreChange();
    this.selectStoreScope(store);
    await this.invalidateDashboardCache();
    return await this.refresh();
  }

  async setupStore(id: string, rootPath: string): Promise<DashboardData> {
    const payload = await this.cliService.runJson([
      'store',
      'setup',
      id,
      '--path',
      rootPath,
      '--json',
    ]);
    const store = this.parseStoreMutationPayload(payload, rootPath);
    await this.reloadScopesAfterStoreChange();
    this.selectStoreScope({ id: store.id ?? id, rootPath: store.rootPath });
    await this.invalidateDashboardCache();
    return await this.refresh();
  }

  private async reloadScopesAfterStoreChange(): Promise<void> {
    if (this.scopeManager) {
      await this.scopeManager.loadScopeOptions();
    } else if (this.cliAvailable) {
      await this.initializeScopeManager();
    }
    this.cachedData = null;
    this.scopedContentAccess.clear();
    this.scopedStateReaders.clear();
    this.scopedCliServices.clear();
  }

  private parseStoreMutationPayload(
    payload: unknown,
    fallbackRootPath: string
  ): { id?: string; rootPath?: string } {
    if (!payload || typeof payload !== 'object') {
      return { rootPath: fallbackRootPath };
    }
    const store = 'store' in payload && payload.store && typeof payload.store === 'object'
      ? payload.store as Record<string, unknown>
      : payload as Record<string, unknown>;
    const id = typeof store.id === 'string'
      ? store.id
      : typeof store.store_id === 'string'
        ? store.store_id
        : undefined;
    const rootPath = typeof store.root === 'string'
      ? store.root
      : typeof store.path === 'string'
        ? store.path
        : fallbackRootPath;
    return { id, rootPath };
  }

  private selectStoreScope(store: { id?: string; rootPath?: string }): void {
    if (!this.scopeManager) return;
    const normalizedRoot = store.rootPath ? path.normalize(store.rootPath) : undefined;
    const match = this.scopeManager.getScopeOptions().find((scope) => {
      if (scope.source !== 'store') return false;
      if (store.id && scope.storeId === store.id) return true;
      return normalizedRoot !== undefined && path.normalize(scope.rootPath) === normalizedRoot;
    });
    if (match) {
      this.scopeManager.selectScope(match.id);
    }
  }

  /**
   * List worksets via `openspec workset list --json`. Capability-gated and
   * defensively parsed; returns [] on any failure (UI degrades to hidden panel).
   */
  private async listWorksets(scope?: OpenSpecScope): Promise<WorksetView[]> {
    if (!this.capabilities?.worksets) return [];
    try {
      const payload = (await this.cliService.runJson(['workset', 'list', '--json'])) as { worksets?: unknown[] } | null;
      const raw = Array.isArray(payload?.worksets) ? payload!.worksets : [];
      return raw
        .filter((w): w is Record<string, unknown> => w != null && typeof w === 'object')
        .map((w) => {
          const membersRaw = Array.isArray(w.members) ? w.members : [];
          return {
            name: typeof w.name === 'string' ? w.name : String(w.name ?? ''),
            tool: typeof w.tool === 'string' ? w.tool : undefined,
            members: membersRaw
              .filter((m): m is Record<string, unknown> => m != null && typeof m === 'object')
              .map((m) => ({
                name: typeof m.name === 'string' ? m.name : String(m.name ?? ''),
                path: typeof m.path === 'string' ? m.path : String(m.path ?? ''),
              })),
          };
        });
    } catch (error) {
      logger.warn('Failed to list worksets', error as Error);
      return [];
    }
  }

  /**
   * Initialize services
   */
  async initialize(): Promise<void> {
    this.cliAvailable = await this.cliService.checkAvailability(false);
    this.cliDiagnostic = this.cliService.getCliActivationDiagnostic();
    if (this.cliAvailable) {
      const version = await this.cliService.getVersion();
      logger.info(`Initialized with OpenSpec CLI ${version}`);
    } else {
      logger.warn('OpenSpec CLI not available; continuing with filesystem fallback mode');
    }

    // Initialize scope manager (feature probes + store options). Probe failure MUST NOT
    // break the base dashboard: it produces diagnostics and degrades to local-root only.
    if (this.cliAvailable) {
      try {
        await this.initializeScopeManager();
      } catch (error) {
        logger.warn('Scope manager initialization failed; continuing with local root only', error as Error);
      }
    }

    // One-time migration: move openspec/.execution-state.json into each change's .openspec.yaml
    await this.migrateExecutionStateFromGlobalFile();

    // Start file watcher
    this.fileWatcher.start((events) => {
      // Collect artifact-specific changes to notify open panels
      const artifactChanges = new Map<string, Set<string>>();

      for (const e of events) {
        const relative = path.relative(this.watchedProjectRoot, e.uri.fsPath).replace(/\\/g, '/');

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
        this.notifyArtifactChanged({
          changeName,
          artifactTypes: [...types],
          rootPath: this.canonicalRootPath(this.watchedProjectRoot),
        });
      }

      logger.info(`File changes detected (${events.length} events), refreshing...`);
      void (async () => {
        await this.invalidateDashboardCache(this.resolveScopeForRoot(this.watchedProjectRoot));
        await this.refresh();
      })().catch((error) => {
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

  async getCachedDashboardData(scope = this.resolveScope()): Promise<CachedDashboardData | undefined> {
    if (this.cachedData && this.scopeMatches(this.cachedData.scope, scope)) {
      return {
        payload: this.cachedData,
        metadata: { generatedAt: this.cachedData.lastRefresh },
        source: 'memory',
      };
    }

    const cached = scope && this.cacheService
      ? await this.cacheService.readDashboard(scope)
      : undefined;

    return cached
      ? {
          payload: cached.payload,
          metadata: { generatedAt: cached.metadata.generatedAt },
          source: 'disk',
        }
      : undefined;
  }

  async getCachedArtifactContent(params: {
    changeName: string;
    artifactType: string;
    scope?: OpenSpecScope;
    specId?: string;
  }): Promise<CachedArtifactContent | undefined> {
    if (!this.cacheService || !params.scope) return undefined;
    try {
      const cached = await this.cacheService.readArtifactContent({
        scope: params.scope,
        changeName: params.changeName,
        artifactType: params.artifactType,
        specId: params.specId,
      });
      return cached
        ? { content: cached.payload, source: 'disk', generatedAt: cached.metadata.generatedAt }
        : undefined;
    } catch (error) {
      logger.warn('Failed to read artifact content cache', error as Error);
      return undefined;
    }
  }

  async writeArtifactContentCache(params: {
    changeName: string;
    artifactType: string;
    scope?: OpenSpecScope;
    specId?: string;
    content: string;
  }): Promise<void> {
    if (!this.cacheService || !params.scope) return;
    try {
      await this.cacheService.writeArtifactContent({
        scope: params.scope,
        changeName: params.changeName,
        artifactType: params.artifactType,
        specId: params.specId,
      }, params.content);
    } catch (error) {
      logger.warn('Failed to write artifact content cache', error as Error);
    }
  }

  private scopeMatches(
    left?: Pick<ScopeInfo, 'id' | 'rootPath'>,
    right?: Pick<ScopeInfo, 'id' | 'rootPath'>
  ): boolean {
    if (!left || !right) return false;
    return left.id === right.id && left.rootPath === right.rootPath;
  }

  private resolveScopeForRoot(rootPath: string): OpenSpecScope | undefined {
    const normalizedRoot = path.normalize(rootPath);
    return this.scopeManager?.getScopeOptions().find((scope) => (
      path.normalize(scope.rootPath) === normalizedRoot
    )) ?? this.resolveScope();
  }

  private canonicalRootPath(rootPath: string): string {
    try {
      return fs.realpathSync(rootPath);
    } catch {
      return path.normalize(rootPath);
    }
  }

  private isCurrentScope(scope?: OpenSpecScope): boolean {
    const currentScope = this.getSelectedScope();
    if (!scope || !currentScope) return scope === currentScope;
    return this.scopeMatches(scope, currentScope);
  }

  private async writeDashboardCache(scope: OpenSpecScope | undefined, data: DashboardData): Promise<void> {
    if (!scope || !this.cacheService) return;
    try {
      await this.cacheService.writeDashboard(scope, data);
    } catch (error) {
      logger.warn('Failed to write dashboard cache', error as Error);
    }
  }

  private async invalidateDashboardCache(scope = this.resolveScope()): Promise<void> {
    if (!scope || !this.cacheService) return;
    try {
      await this.cacheService.invalidateScope(scope);
    } catch (error) {
      logger.warn('Failed to invalidate dashboard cache', error as Error);
    }
  }

  private async invalidateArtifactContentCache(params: {
    scope?: OpenSpecScope;
    changeName: string;
    artifactType: string;
    specId?: string;
  }): Promise<void> {
    if (!params.scope || !this.cacheService) return;
    try {
      await this.cacheService.invalidateArtifact({
        scope: params.scope,
        changeName: params.changeName,
        artifactType: params.artifactType,
        specId: params.specId,
      });
    } catch (error) {
      logger.warn('Failed to invalidate artifact content cache', error as Error);
    }
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

  private async runRefresh(scope = this.getSelectedScope()): Promise<DashboardData> {
    try {
      logger.info('Refreshing dashboard data...');

      const services = this.getScopedServices(scope);

      const [rawChanges, specs, archivedChanges] = await Promise.all([
        this.listChangesWithFallback(services),
        services.stateReader.listSpecs(),
        services.stateReader.listArchivedChanges(),
      ]);
      const changesWithLifecycle = rawChanges.map((change) => enrichChangeWithLifecycle(change));
      const changes = await this.enrichChangesWithProposalWhy(changesWithLifecycle, services.contentAccess);
      const changeStatusCounts = buildChangeStatusCounts(changes, archivedChanges);

      const scopeInfo: ScopeInfo | undefined = scope
        ? {
            id: scope.id,
            label: scope.label,
            source: scope.source,
            rootPath: scope.rootPath,
            storeId: scope.storeId,
            runtimeSource: scope.runtimeSource,
            capabilities: scope.capabilities,
          }
        : undefined;

      // Scope options, relationships, feature diagnostics, and worksets are populated
      // when the scope manager is initialized. Probe failures degrade gracefully
      // (sections simply stay empty), never breaking the base dashboard.
      const scopeOptions = this.scopeManager?.getScopeOptions() ?? [];
      const scopesInfo: ScopeInfo[] = scopeOptions.map((s) => ({
        id: s.id,
        label: s.label,
        source: s.source,
        rootPath: s.rootPath,
        storeId: s.storeId,
        runtimeSource: s.runtimeSource,
        capabilities: s.capabilities,
      }));

      let relationships: RelationshipPanelData | undefined;
      let worksets: WorksetView[] | undefined;
      let featureDiagnostics: FeatureDiagnosticView[] | undefined;
      if (scope?.capabilities) {
        featureDiagnostics = scope.capabilities.diagnostics.map((d) => ({
          code: d.code,
          message: d.message,
          severity: d.severity,
        }));
      }

      if (scope && scope.capabilities.context) {
        try {
          const rel = await loadScopeRelationships(this.cliService, scope);
          relationships = {
            references: rel.references,
            health: rel.health,
          };
        } catch (error) {
          logger.warn('Failed to load scope relationships', error as Error);
        }
      }

      if (this.capabilities?.worksets) {
        worksets = await this.listWorksets(scope);
      }

      const data: DashboardData = {
        changes,
        specs,
        archivedChanges,
        changeStatusCounts,
        lastRefresh: Date.now(),
        scope: scopeInfo,
        scopes: scopesInfo.length > 0 ? scopesInfo : undefined,
        relationships,
        featureDiagnostics,
        worksets: worksets && worksets.length > 0 ? worksets : undefined,
      };
      await this.writeDashboardCache(scope, data);
      if (!this.isCurrentScope(scope)) {
        logger.info(`Skipped stale refresh publish for scope ${scope?.id ?? '<none>'}`);
        return data;
      }

      this.cachedData = data;
      this.cliDiagnostic = null;

      logger.info(
        `Refreshed: ${changes.length} changes, ${specs.length} specs, ${archivedChanges.length} archived`
      );
      this.notifyRefresh(data);
      return this.cachedData;
    } catch (error) {
      logger.error('Failed to refresh dashboard data', error as Error);

      const diagnostic = this.cliService.getCliActivationDiagnostic();
      if (diagnostic) {
        this.cliDiagnostic = diagnostic;
        if (this.isCurrentScope(scope) && this.cachedData) {
          this.notifyRefresh(this.cachedData);
          return this.cachedData;
        }
      }

      throw error;
    }
  }

  private async listChangesWithFallback(services: {
    stateReader: StateReader;
    contentAccess: IOpenSpecContentAccess;
    rootPath: string;
    scope?: OpenSpecScope;
  }): Promise<ChangeInfo[]> {
    if (!this.cliAvailable) {
      const diagnostic = this.cliService.getCliActivationDiagnostic();
      if (diagnostic) {
        this.cliDiagnostic = diagnostic;
        throw new Error(diagnostic.message);
      }
      return await this.listChangesFromFilesystem(services);
    }

    try {
      // CLI listing is scope-aware: store scopes append --store via the gateway.
      return await services.stateReader.listChanges(services.scope);
    } catch (error) {
      const diagnostic = this.cliService.getCliActivationDiagnostic();
      if (diagnostic) {
        this.cliDiagnostic = diagnostic;
        throw error;
      }
      logger.warn('CLI change listing failed; falling back to filesystem scan', error as Error);
      this.cliAvailable = false;
      return await this.listChangesFromFilesystem(services);
    }
  }

  private statCreatedAt(stat: fs.Stats): string | undefined {
    const time = stat.birthtimeMs > 0 ? stat.birthtime : stat.ctime;
    const ms = time.getTime();
    return Number.isFinite(ms) && ms > 0 ? time.toISOString() : undefined;
  }

  private async listChangesFromFilesystem(services: {
    contentAccess: IOpenSpecContentAccess;
    rootPath: string;
  }): Promise<ChangeInfo[]> {
    // Filesystem fallback is rooted at the selected scope's root, not workspace root,
    // so a store root outside the workspace still scans its own changes.
    const changesDir = path.join(services.rootPath, 'openspec', 'changes');
    let entries: fs.Dirent[];
    try {
      entries = await fs.promises.readdir(changesDir, { withFileTypes: true });
    } catch (error) {
      logger.warn('Filesystem fallback could not read changes directory', error as Error);
      return [];
    }

    const contentAccess = services.contentAccess;
    const changes = await Promise.all(
      entries
        .filter((entry) => entry.isDirectory() && entry.name !== 'archive')
        .map(async (entry): Promise<ChangeInfo> => {
          const changeName = entry.name;
          const changeDir = path.join(changesDir, changeName);
          const tasks = await contentAccess.readTasks(changeName);
          const completedTasks = tasks.filter((t) => t.done).length;
          const totalTasks = tasks.length;
          const artifacts = await this.getFilesystemArtifactStatuses(changeName, contentAccess);
          let lastModified = new Date().toISOString();
          let createdAt: string | undefined;
          try {
            const stat = await fs.promises.stat(changeDir);
            lastModified = stat.mtime.toISOString();
            createdAt = this.statCreatedAt(stat);
          } catch {
            // Keep current timestamp when stat fails; the entry still exists.
          }
          return enrichChangeWithLifecycle({
            name: changeName,
            completedTasks,
            totalTasks,
            lastModified,
            createdAt,
            status: totalTasks === 0 ? 'draft' : completedTasks === totalTasks ? 'complete' : 'in-progress',
            artifacts,
          });
        })
    );

    changes.sort((a, b) => b.lastModified.localeCompare(a.lastModified));
    logger.info(`Filesystem fallback listed ${changes.length} changes`);
    return changes;
  }

  private async getFilesystemArtifactStatuses(
    changeName: string,
    contentAccess: IOpenSpecContentAccess
  ): Promise<ChangeInfo['artifacts']> {
    // Always include the known standard artifact set. Missing files stay `ready`
    // so lifecycle derivation prefers planning when the fallback graph is incomplete
    // (custom schemas may still be incomplete; do not invent Ready to Apply).
    const artifacts: NonNullable<ChangeInfo['artifacts']> = [];
    for (const artifactType of ['proposal', 'design', 'tasks'] as const) {
      const exists = await contentAccess.artifactExists(changeName, artifactType);
      artifacts.push({
        id: artifactType,
        outputPath: `openspec/changes/${changeName}/${artifactType}.md`,
        status: exists ? 'done' : 'ready',
      });
    }

    const deltaSpecIds = await contentAccess.listDeltaSpecIds(changeName);
    artifacts.push({
      id: 'specs',
      outputPath: `openspec/changes/${changeName}/specs`,
      status: deltaSpecIds.length > 0 ? 'done' : 'ready',
    });
    return artifacts;
  }

  private async enrichChangesWithProposalWhy(
    changes: ChangeInfo[],
    contentAccess: IOpenSpecContentAccess
  ): Promise<ChangeInfo[]> {
    return await Promise.all(
      changes.map(async (change) => {
        try {
          const proposal = await contentAccess.readArtifact(change.name, 'proposal');
          const why = extractProposalWhy(proposal);
          const artifactSearchText = (change.artifacts ?? [])
            .map((a) => `${a.id} ${a.status}`)
            .join(' ');
          const createdSearchText = change.createdAt ? `created ${change.createdAt.split('T')[0]}` : '';
          const searchText = [
            change.name,
            change.status,
            artifactSearchText,
            why.summary,
            why.fullText,
            createdSearchText,
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

  async getChangeWorkflowSnapshot(
    changeName: string,
    scope?: OpenSpecScope,
    workflowBinding?: WorkflowBindingIdentity
  ): Promise<ChangeWorkflowSnapshot | undefined> {
    const services = this.getScopedServices(scope);
    return (await services.cli.listChanges(scope, workflowBinding))
      .find((change) => change.name === changeName)
      ?.workflowSnapshot;
  }

  /**
   * Check if artifact exists (State Reader: show artifacts or Content Access)
   */
  async artifactExists(changeName: string, artifactType: string, scope?: OpenSpecScope): Promise<boolean> {
    const reader = scope && scope.source !== 'local'
      ? this.getScopedServices(scope).stateReader
      : this.stateReader;
    return await reader.artifactExists(changeName, artifactType, scope);
  }

  /**
   * Read artifact content (Content Access), with optional scope override.
   */
  async readArtifact(changeName: string, artifactType: string, scope?: OpenSpecScope): Promise<string> {
    const access = scope ? this.getContentAccessForScope(scope) : this.contentAccess;
    return await access.readArtifact(changeName, artifactType);
  }

  /**
   * Read main spec content (Content Access)
   */
  async readSpec(specId: string, scope?: OpenSpecScope): Promise<string> {
    const access = scope ? this.getContentAccessForScope(scope) : this.contentAccess;
    return await access.readSpec(specId);
  }

  async getSpecRequirements(specId: string, scope?: OpenSpecScope): Promise<string[]> {
    const access = scope ? this.getContentAccessForScope(scope) : this.contentAccess;
    return await (access as any).getSpecRequirements?.(specId) ?? [];
  }

  /**
   * Read delta spec (Content Access)
   */
  async readDeltaSpec(changeName: string, specId: string, scope?: OpenSpecScope): Promise<string | null> {
    const access = scope ? this.getContentAccessForScope(scope) : this.contentAccess;
    return await access.readDeltaSpec(changeName, specId);
  }

  /**
   * List archived changes (State Reader -> Content Access)
   */
  async listArchivedChanges(scope?: OpenSpecScope): Promise<ArchivedChangeInfo[]> {
    const reader = scope && scope.source !== 'local'
      ? this.getScopedServices(scope).stateReader
      : this.stateReader;
    return await reader.listArchivedChanges();
  }

  /**
   * List delta spec ids for a change (Content Access)
   */
  async listDeltaSpecIds(changeName: string, scope?: OpenSpecScope): Promise<string[]> {
    const access = scope ? this.getContentAccessForScope(scope) : this.contentAccess;
    return await access.listDeltaSpecIds(changeName);
  }

  /**
   * Read tasks for a change (State Reader: show.tasks or Content Access)
   */
  async readTasks(changeName: string, scope?: OpenSpecScope) {
    const reader = scope && scope.source !== 'local'
      ? this.getScopedServices(scope).stateReader
      : this.stateReader;
    return await reader.getTasks(changeName, scope);
  }

  /**
   * Toggle task completion. If all subtasks are done, auto-completes the parent.
   * Accepts optional scope override for store-scoped changes.
   */
  async toggleTask(changeName: string, taskIndex: number, scope?: OpenSpecScope): Promise<void> {
    const access = scope ? this.getContentAccessForScope(scope) : this.contentAccess;
    await access.toggleTask(changeName, taskIndex);
    await access.autoCompleteParents(changeName);
    const resolvedScope = scope ?? this.resolveScope();
    await this.invalidateArtifactContentCache({
      scope: resolvedScope,
      changeName,
      artifactType: 'tasks',
    });
    await this.invalidateDashboardCache(resolvedScope);
    await this.refresh();
  }

  /**
   * Create new change (via CLI). Scope-aware: store scopes append --store.
   */
  async createChange(name: string, scope?: OpenSpecScope): Promise<void> {
    await this.cliService.createChange(name, scope);
    await this.invalidateDashboardCache(scope ?? this.resolveScope());
    await this.refresh();
  }

  /**
   * Archive a change (via CLI). Scope-aware: store scopes append --store.
   */
  async archiveChange(name: string, scope?: OpenSpecScope): Promise<DashboardData> {
    await this.cliService.archiveChange(name, scope);
    const resolvedScope = scope ?? this.resolveScope();
    await this.invalidateDashboardCache(resolvedScope);
    return this.runRefresh(resolvedScope);
  }

  /**
   * Execute task via current adapter (dependency check + mode handled inside).
   * @returns { success: boolean } for UI to clear running state.
   */
  async executeTaskRequest(
    changeName: string,
    taskIndex: number,
    taskText: string,
    scope?: OpenSpecScope,
  ): Promise<{ success: boolean }> {
    return await this.getTaskExecutorForScope(scope).execute(changeName, taskIndex, taskText);
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
  async getTaskExecutionState(
    changeName: string,
    scope?: OpenSpecScope,
  ): Promise<Record<number, { success: boolean; timestamp: number }>> {
    const filePath = this.getScopedServices(scope).contentAccess.getChangeOpenspecYamlPath(changeName);
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
  async setTaskExecutionState(
    changeName: string,
    taskIndex: number,
    success: boolean,
    scope?: OpenSpecScope,
  ): Promise<void> {
    const filePath = this.getScopedServices(scope).contentAccess.getChangeOpenspecYamlPath(changeName);
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
