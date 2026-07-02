import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import type * as vscode from 'vscode';
import type { DashboardData } from './dataManager';
import type { OpenSpecScope as ScopeInfo } from './openspecScope';

export interface OpenSpecCacheServiceOptions {
  workspaceRoot: string;
  extensionVersion: string;
}

export interface ArtifactCacheKey {
  scope: ScopeInfo;
  changeName: string;
  artifactType: string;
  specId?: string;
}

export interface CacheMetadata {
  schemaVersion: 1;
  extensionVersion: string;
  workspaceHash: string;
  workspaceRoot: string;
  scopeId: string;
  scopeRootPath: string;
  dataKind: 'dashboard' | 'artifact-content';
  generatedAt: number;
}

export interface CachedValue<T> {
  metadata: CacheMetadata;
  payload: T;
  filePath: string;
}

export interface CacheStats {
  rootPath: string;
  totalBytes: number;
  fileCount: number;
  calculatedAt: number;
  isCalculating: boolean;
}

export interface CacheStatsOptions {
  force?: boolean;
  ttlMs?: number;
}

interface CacheEnvelope<T> extends CacheMetadata {
  payload: T;
}

const DEFAULT_STATS_TTL_MS = 30_000;

export class OpenSpecCacheService {
  private static readonly schemaVersion = 1 as const;
  private statsSnapshot?: CacheStats;
  private statsInFlight?: Promise<CacheStats>;
  private statsDirty = true;
  private statsGeneration = 0;

  constructor(
    private readonly storageUri: vscode.Uri,
    private readonly options: OpenSpecCacheServiceOptions
  ) {}

  getCacheRootPath(): string {
    return path.join(
      this.storageUri.fsPath,
      'openspec-cache',
      'v1',
      this.hash(this.normalize(this.options.workspaceRoot))
    );
  }

  markStatsDirty(): void {
    this.statsGeneration += 1;
    this.statsDirty = true;
  }

  async getCacheStats(options: CacheStatsOptions = {}): Promise<CacheStats> {
    const ttlMs = options.ttlMs ?? DEFAULT_STATS_TTL_MS;
    const now = Date.now();
    if (
      !options.force
      && !this.statsDirty
      && this.statsSnapshot
      && now - this.statsSnapshot.calculatedAt <= ttlMs
    ) {
      return this.statsSnapshot;
    }

    if (this.statsInFlight) {
      return this.statsInFlight;
    }

    const generation = this.statsGeneration;
    const inFlight = this.calculateCacheStats()
      .catch(() => this.emptyStats())
      .then((stats) => {
        if (generation !== this.statsGeneration) {
          return this.statsSnapshot ?? stats;
        }
        this.statsSnapshot = stats;
        this.statsDirty = false;
        return stats;
      })
      .finally(() => {
        if (this.statsInFlight === inFlight) {
          this.statsInFlight = undefined;
        }
      });

    this.statsInFlight = inFlight;
    return this.statsInFlight;
  }

  async clearAll(): Promise<void> {
    await fs.rm(this.getCacheRootPath(), { recursive: true, force: true });
    this.statsGeneration += 1;
    this.statsSnapshot = this.emptyStats();
    this.statsDirty = false;
  }

  async readDashboard(scope: ScopeInfo): Promise<CachedValue<DashboardData> | undefined> {
    return this.readEnvelope<DashboardData>(this.dashboardPath(scope), 'dashboard', scope);
  }

  async writeDashboard(scope: ScopeInfo, data: DashboardData): Promise<void> {
    await this.writeEnvelope(this.dashboardPath(scope), 'dashboard', scope, data);
  }

  async readArtifactContent(key: ArtifactCacheKey): Promise<CachedValue<string> | undefined> {
    return this.readEnvelope<string>(this.artifactPath(key), 'artifact-content', key.scope);
  }

  async writeArtifactContent(key: ArtifactCacheKey, content: string): Promise<void> {
    await this.writeEnvelope(this.artifactPath(key), 'artifact-content', key.scope, content);
  }

  async invalidateScope(scope: ScopeInfo): Promise<void> {
    await fs.rm(this.scopeDir(scope), { recursive: true, force: true });
    this.markStatsDirty();
  }

  async invalidateArtifact(key: ArtifactCacheKey): Promise<void> {
    await fs.rm(this.artifactPath(key), { force: true });
    this.markStatsDirty();
  }

  private emptyStats(): CacheStats {
    return {
      rootPath: this.getCacheRootPath(),
      totalBytes: 0,
      fileCount: 0,
      calculatedAt: Date.now(),
      isCalculating: false,
    };
  }

  private async calculateCacheStats(): Promise<CacheStats> {
    const rootPath = this.getCacheRootPath();
    let totalBytes = 0;
    let fileCount = 0;

    const visit = async (dirPath: string): Promise<void> => {
      let entries: import('fs').Dirent[];
      try {
        entries = await fs.readdir(dirPath, { withFileTypes: true });
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code === 'ENOENT' || code === 'ENOTDIR' || code === 'EACCES') return;
        throw error;
      }

      await Promise.all(entries.map(async (entry) => {
        const entryPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
          await visit(entryPath);
          return;
        }
        if (!entry.isFile()) return;
        try {
          const stat = await fs.stat(entryPath);
          totalBytes += stat.size;
          fileCount += 1;
        } catch {
          // A file may disappear while stats are being calculated; skip it.
        }
      }));
    };

    await visit(rootPath);

    return {
      rootPath,
      totalBytes,
      fileCount,
      calculatedAt: Date.now(),
      isCalculating: false,
    };
  }

  private async readEnvelope<T>(
    filePath: string,
    expectedKind: CacheMetadata['dataKind'],
    scope: ScopeInfo
  ): Promise<CachedValue<T> | undefined> {
    try {
      const raw = await fs.readFile(filePath, 'utf8');
      const parsed = JSON.parse(raw) as Partial<CacheEnvelope<T>>;
      if (!this.isValidEnvelope(parsed, expectedKind, scope)) return undefined;
      const { payload, ...metadata } = parsed as CacheEnvelope<T>;
      return { metadata, payload, filePath };
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'ENOENT') return undefined;
      return undefined;
    }
  }

  private async writeEnvelope<T>(
    filePath: string,
    dataKind: CacheMetadata['dataKind'],
    scope: ScopeInfo,
    payload: T
  ): Promise<void> {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const envelope: CacheEnvelope<T> = {
      schemaVersion: OpenSpecCacheService.schemaVersion,
      extensionVersion: this.options.extensionVersion,
      workspaceHash: this.hash(this.normalize(this.options.workspaceRoot)),
      workspaceRoot: this.options.workspaceRoot,
      scopeId: scope.id,
      scopeRootPath: scope.rootPath,
      dataKind,
      generatedAt: Date.now(),
      payload,
    };
    await fs.writeFile(filePath, JSON.stringify(envelope, null, 2), 'utf8');
    this.markStatsDirty();
  }

  private isValidEnvelope<T>(
    value: Partial<CacheEnvelope<T>>,
    expectedKind: CacheMetadata['dataKind'],
    scope: ScopeInfo
  ): value is CacheEnvelope<T> {
    return value.schemaVersion === OpenSpecCacheService.schemaVersion
      && value.dataKind === expectedKind
      && value.workspaceHash === this.hash(this.normalize(this.options.workspaceRoot))
      && value.scopeId === scope.id
      && value.scopeRootPath === scope.rootPath
      && value.payload !== undefined
      && typeof value.generatedAt === 'number';
  }

  private dashboardPath(scope: ScopeInfo): string {
    return path.join(this.scopeDir(scope), 'dashboard.json');
  }

  private artifactPath(key: ArtifactCacheKey): string {
    const artifactHash = this.hash([
      key.changeName,
      key.artifactType,
      key.specId ?? '',
    ].join('\n'));
    return path.join(this.scopeDir(key.scope), 'artifacts', `${artifactHash}.json`);
  }

  private scopeDir(scope: ScopeInfo): string {
    return path.join(
      this.getCacheRootPath(),
      this.hash(`${scope.id}\n${this.normalize(scope.rootPath)}`)
    );
  }

  private normalize(value: string): string {
    return path.resolve(value);
  }

  private hash(value: string): string {
    return crypto.createHash('sha256').update(value).digest('hex').slice(0, 16);
  }
}
