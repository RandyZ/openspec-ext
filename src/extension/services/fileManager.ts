import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../utils/logger';
import type { IOpenSpecContentAccess } from './contentAccess';
import type { ArchivedChangeInfo, SpecInfo } from './types';

export interface Task {
  lineIndex: number;
  indent: number;
  done: boolean;
  text: string;
  originalLine: string;
}

export interface TaskProgress {
  completed: number;
  total: number;
}

export class FileManagerService implements IOpenSpecContentAccess {
  constructor(private openspecDir: string) {}

  /**
   * Get path to an artifact.
   * For archived changes, changeName must be "archive:YYYY-MM-DD-name" (directoryName under archive).
   */
  /**
   * Base directory for a change (draft or archive). Reused for artifact paths and .openspec.yaml.
   */
  private getChangeBasePath(changeName: string): string {
    return changeName.startsWith('archive:')
      ? path.join(this.openspecDir, 'changes', 'archive', changeName.slice(8))
      : path.join(this.openspecDir, 'changes', changeName);
  }

  /**
   * Resolve absolute path to a change's .openspec.yaml.
   * Draft: openspec/changes/<name>/.openspec.yaml
   * Archive: openspec/changes/archive/<dir>/.openspec.yaml
   */
  getChangeOpenspecYamlPath(changeName: string): string {
    return path.join(this.getChangeBasePath(changeName), '.openspec.yaml');
  }

  getArtifactPath(changeName: string, artifactType: string): string {
    const basePath = this.getChangeBasePath(changeName);

    switch (artifactType) {
      case 'proposal':
        return path.join(basePath, 'proposal.md');
      case 'design':
        return path.join(basePath, 'design.md');
      case 'tasks':
        return path.join(basePath, 'tasks.md');
      case 'specs':
        return path.join(basePath, 'specs');
      default:
        return path.join(basePath, `${artifactType}.md`);
    }
  }

  /**
   * Check if artifact exists
   */
  async artifactExists(changeName: string, artifactType: string): Promise<boolean> {
    const artifactPath = this.getArtifactPath(changeName, artifactType);
    logger.info(`[archived] artifactExists: openspecDir=${this.openspecDir}, changeName=${changeName}, artifactType=${artifactType}, path=${artifactPath}`);
    try {
      await fs.promises.access(artifactPath);
      logger.info(`[archived] artifactExists: OK`);
      return true;
    } catch (e) {
      const code = (e as NodeJS.ErrnoException)?.code ?? (e as Error)?.message;
      logger.info(`[archived] artifactExists: MISSING (${code})`);
      return false;
    }
  }

  /**
   * Read artifact content
   */
  async readArtifact(changeName: string, artifactType: string): Promise<string> {
    const artifactPath = this.getArtifactPath(changeName, artifactType);
    logger.info(`[archived] readArtifact: path=${artifactPath}`);

    try {
      const content = await fs.promises.readFile(artifactPath, 'utf-8');
      logger.debug(`Read artifact: ${changeName}/${artifactType}`);
      return content;
    } catch (error) {
      logger.error(`Failed to read artifact: ${artifactPath}`, error as Error);
      throw error;
    }
  }

  /**
   * Read spec content
   */
  async readSpec(specId: string): Promise<string> {
    const specPath = path.join(this.openspecDir, 'specs', specId, 'spec.md');

    try {
      const content = await fs.promises.readFile(specPath, 'utf-8');
      logger.debug(`Read spec: ${specId}`);
      return content;
    } catch (error) {
      logger.error(`Failed to read spec: ${specId}`, error as Error);
      throw error;
    }
  }

  /**
   * Read delta spec from a change (or from archive when changeName is "archive:directoryName").
   */
  async readDeltaSpec(changeName: string, specId: string): Promise<string | null> {
    const changesBase = changeName.startsWith('archive:')
      ? path.join(this.openspecDir, 'changes', 'archive', changeName.slice(8))
      : path.join(this.openspecDir, 'changes', changeName);
    const deltaPath = path.join(changesBase, 'specs', specId, 'spec.md');

    try {
      const content = await fs.promises.readFile(deltaPath, 'utf-8');
      logger.debug(`Read delta spec: ${changeName}/specs/${specId}`);
      return content;
    } catch {
      return null;
    }
  }

  /**
   * Parse tasks from markdown content
   */
  parseTasksMarkdown(content: string): Task[] {
    const lines = content.split('\n');
    const tasks: Task[] = [];
    let lineIndex = 0;

    for (const line of lines) {
      const match = line.match(/^(\s*)- \[([ xX])\] (.+)$/);
      if (match) {
        tasks.push({
          lineIndex,
          indent: match[1].length,
          done: match[2].toLowerCase() === 'x',
          text: match[3],
          originalLine: line,
        });
      }
      lineIndex++;
    }

    return tasks;
  }

  /**
   * 获取某任务的直接子任务在 tasks 数组中的下标（缩进更大，直到遇到同层或更前层级）。
   */
  getDirectChildIndices(tasks: Task[], taskIndex: number): number[] {
    if (taskIndex < 0 || taskIndex >= tasks.length) return [];
    const parentIndent = tasks[taskIndex].indent;
    const childIndices: number[] = [];
    for (let j = taskIndex + 1; j < tasks.length; j++) {
      if (tasks[j].indent <= parentIndent) break;
      childIndices.push(j);
    }
    return childIndices;
  }

  /**
   * Read tasks from tasks.md
   */
  async readTasks(changeName: string): Promise<Task[]> {
    try {
      const content = await this.readArtifact(changeName, 'tasks');
      return this.parseTasksMarkdown(content);
    } catch (error) {
      logger.warn(`No tasks found for change: ${changeName}`);
      return [];
    }
  }

  /**
   * Toggle a task's completion status
   */
  async toggleTask(changeName: string, taskIndex: number): Promise<void> {
    const tasksPath = this.getArtifactPath(changeName, 'tasks');

    try {
      const content = await fs.promises.readFile(tasksPath, 'utf-8');
      const lines = content.split('\n');

      let taskCount = -1;
      for (let i = 0; i < lines.length; i++) {
        if (/^(\s*)- \[([ xX])\]/.test(lines[i])) {
          taskCount++;
          if (taskCount === taskIndex) {
            // Toggle the checkbox
            lines[i] = lines[i].replace(/\[([ xX])\]/, (_, char) => {
              return char.toLowerCase() === 'x' ? '[ ]' : '[x]';
            });
            break;
          }
        }
      }

      await fs.promises.writeFile(tasksPath, lines.join('\n'), 'utf-8');
      logger.info(`Toggled task ${taskIndex} in ${changeName}`);
    } catch (error) {
      logger.error(`Failed to toggle task: ${changeName}/${taskIndex}`, error as Error);
      throw error;
    }
  }

  /**
   * 子任务全部完成后，将对应父任务自动勾选（从后往前处理，支持多层父子）。
   */
  async autoCompleteParents(changeName: string): Promise<void> {
    const tasksPath = this.getArtifactPath(changeName, 'tasks');
    try {
      const content = await fs.promises.readFile(tasksPath, 'utf-8');
      const lines = content.split('\n');
      const tasks = this.parseTasksMarkdown(content);
      let changed = false;
      for (let i = tasks.length - 1; i >= 0; i--) {
        if (tasks[i].done) continue;
        const childIndices = this.getDirectChildIndices(tasks, i);
        if (childIndices.length === 0) continue;
        if (childIndices.some((c) => !tasks[c].done)) continue;
        const lineIdx = tasks[i].lineIndex;
        lines[lineIdx] = lines[lineIdx].replace(/\[([ xX])\]/, '[x]');
        tasks[i].done = true;
        changed = true;
      }
      if (changed) {
        await fs.promises.writeFile(tasksPath, lines.join('\n'), 'utf-8');
        logger.info(`Auto-completed parent tasks in ${changeName}`);
      }
    } catch (error) {
      logger.warn(`autoCompleteParents ${changeName} failed`, error as Error);
    }
  }

  /**
   * Get task completion progress
   */
  async getTaskProgress(changeName: string): Promise<TaskProgress> {
    const tasks = await this.readTasks(changeName);
    const completed = tasks.filter((t) => t.done).length;

    return {
      completed,
      total: tasks.length,
    };
  }

  /**
   * List delta spec ids for a change (specs/<id>/spec.md).
   * For archived changes, changeName must be "archive:YYYY-MM-DD-name".
   */
  async listDeltaSpecIds(changeName: string): Promise<string[]> {
    const changesBase = changeName.startsWith('archive:')
      ? path.join(this.openspecDir, 'changes', 'archive', changeName.slice(8))
      : path.join(this.openspecDir, 'changes', changeName);
    const specsDir = path.join(changesBase, 'specs');
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
   * List archived changes (directory names YYYY-MM-DD-<name> under openspec/changes/archive).
   */
  async listArchivedChanges(): Promise<ArchivedChangeInfo[]> {
    const archiveDir = path.join(this.openspecDir, 'changes', 'archive');
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
   * List delta specs from openspec/changes/.../specs/.../spec.md when CLI list --specs is empty.
   */
  async listSpecsFromChanges(): Promise<SpecInfo[]> {
    const changesDir = path.join(this.openspecDir, 'changes');
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
              const requirementCount = await this.countRequirementsInSpec(specPath);
              result.push({
                id: `${changeName} / ${se.name}`,
                requirementCount,
                path: specPath,
              });
            } catch {
              // no spec.md
            }
          }
        } catch {
          // no specs dir
        }
      }
    } catch (err) {
      logger.debug(`Could not list specs from changes: ${(err as Error).message}`);
    }
    return result;
  }

  async listMainSpecs(): Promise<SpecInfo[]> {
    const specsDir = path.join(this.openspecDir, 'specs');
    const result: SpecInfo[] = [];
    try {
      const entries = await fs.promises.readdir(specsDir, { withFileTypes: true });
      for (const ent of entries) {
        if (!ent.isDirectory()) continue;
        const specPath = path.join(specsDir, ent.name, 'spec.md');
        try {
          await fs.promises.access(specPath);
          const requirementCount = await this.countRequirementsInSpec(specPath);
          const relativePath = path.relative(path.dirname(this.openspecDir), specPath);
          result.push({
            id: ent.name,
            requirementCount,
            path: relativePath,
          });
        } catch {
          // no spec.md
        }
      }
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        logger.debug(`Could not list main specs: ${(err as Error).message}`);
      }
    }
    return result;
  }

  private async countRequirementsInSpec(specPath: string): Promise<number> {
    try {
      const content = await fs.promises.readFile(specPath, 'utf-8');
      const matches = content.match(/^### Requirement:/gm);
      return matches ? matches.length : 0;
    } catch {
      return 0;
    }
  }
}
