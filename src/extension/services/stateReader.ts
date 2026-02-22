/**
 * State Reader：提供变更列表、变更详情、任务列表、spec 列表、归档列表等状态。
 * 优先从 CLI 获取，CLI 不提供的部分经 Content Access 获取；不直接调 fs。
 */
import { logger } from '../utils/logger';
import type { IOpenSpecContentAccess, Task } from './contentAccess';
import type {
  ChangeInfo,
  ChangeDetails,
  SpecInfo,
  ArchivedChangeInfo,
} from './types';

export interface IOpenSpecCliGateway {
  listChanges(): Promise<ChangeInfo[]>;
  getChangeStatus(name: string): Promise<{ artifacts?: unknown[] }>;
  showChange(name: string): Promise<ChangeDetails>;
  listSpecs(): Promise<SpecInfo[]>;
}

export class StateReader {
  constructor(
    private gateway: IOpenSpecCliGateway,
    private contentAccess: IOpenSpecContentAccess
  ) {}

  /** 变更列表：仅通过 CLI list + status */
  async listChanges(): Promise<ChangeInfo[]> {
    return this.gateway.listChanges();
  }

  /** 变更详情：仅通过 CLI show */
  async getChangeDetails(changeName: string): Promise<ChangeDetails> {
    return this.gateway.showChange(changeName);
  }

  /**
   * 任务列表：优先用 show 的 tasks（若结构兼容、含 indent 等），否则经 Content Access 读 tasks.md。
   * 当前 CLI show.tasks 无 indent，父子结构依赖 indent，故始终用 contentAccess.readTasks。
   */
  async getTasks(changeName: string): Promise<Task[]> {
    try {
      const details = await this.gateway.showChange(changeName);
      const cliTasks = details.tasks;
      if (cliTasks?.length && this.isCliTasksCompatibleWithUi(cliTasks)) {
        return this.mapCliTasksToTasks(cliTasks);
      }
    } catch {
      // ignore, fallback to content
    }
    return this.contentAccess.readTasks(changeName);
  }

  /** CLI tasks 与 UI 兼容需含层级信息（如 indent）；当前 CLI 无，返回 false */
  private isCliTasksCompatibleWithUi(_tasks: { description?: string; done?: boolean; indent?: number }[]): boolean {
    return false;
  }

  private mapCliTasksToTasks(
    cliTasks: { id?: string; description?: string; done?: boolean }[]
  ): Task[] {
    return cliTasks.map((t, i) => ({
      lineIndex: i,
      indent: 0,
      done: !!t.done,
      text: (t.description ?? t.id ?? '').toString(),
      originalLine: `- [${t.done ? 'x' : ' '}] ${(t.description ?? t.id ?? '').toString()}`,
    }));
  }

  /** Artifact 是否存在：由 show 的 artifacts 推导，否则 Content Access */
  async artifactExists(changeName: string, artifactType: string): Promise<boolean> {
    // CLI does not support "archive:YYYY-MM-DD-name"; skip to file check to avoid failed command + retries.
    if (changeName.startsWith('archive:')) {
      return this.contentAccess.artifactExists(changeName, artifactType);
    }
    try {
      const details = await this.gateway.showChange(changeName);
      const artifacts = details.artifacts ?? [];
      const found = artifacts.some(
        (a: { id?: string }) => (a.id ?? '').toLowerCase() === artifactType.toLowerCase()
      );
      logger.info(`[archived] StateReader.artifactExists: CLI showChange ok, found=${found}, artifactType=${artifactType}`);
      if (found) return true;
    } catch (e) {
      logger.info(`[archived] StateReader.artifactExists: CLI showChange failed, fallback to contentAccess: ${(e as Error)?.message}`);
    }
    return this.contentAccess.artifactExists(changeName, artifactType);
  }

  /** Spec 列表：CLI list --specs，空时 fallback 到 Content Access 从 changes 列出 */
  async listSpecs(): Promise<SpecInfo[]> {
    const cliSpecs = await this.gateway.listSpecs();
    if (cliSpecs.length > 0) return cliSpecs;
    return this.contentAccess.listSpecsFromChanges();
  }

  /** 归档列表：CLI 暂无，经 Content Access */
  async listArchivedChanges(): Promise<ArchivedChangeInfo[]> {
    return this.contentAccess.listArchivedChanges();
  }
}
