import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../utils/logger';

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

export class FileManagerService {
  constructor(private openspecDir: string) {}

  /**
   * Get path to an artifact.
   * For archived changes, changeName must be "archive:YYYY-MM-DD-name" (directoryName under archive).
   */
  getArtifactPath(changeName: string, artifactType: string): string {
    const basePath = changeName.startsWith('archive:')
      ? path.join(this.openspecDir, 'changes', 'archive', changeName.slice(8))
      : path.join(this.openspecDir, 'changes', changeName);

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
    try {
      await fs.promises.access(artifactPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Read artifact content
   */
  async readArtifact(changeName: string, artifactType: string): Promise<string> {
    const artifactPath = this.getArtifactPath(changeName, artifactType);

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
}
