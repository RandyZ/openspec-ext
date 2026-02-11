import * as vscode from 'vscode';
import { logger } from '../utils/logger';
import type { TaskExecuteRequest } from './agentExecutor.types';
import type { FileManagerService } from './fileManager';
import { getCurrentAdapter } from '../adapters';
import { getPromptForFlow } from './openspecPromptHandler';
import { OpenSpecCliService } from './openspecCli';

export class TaskExecutorService {
  constructor(
    private workspaceRoot: string,
    private fileManager: FileManagerService
  ) {}

  /**
   * Execute or fillChat for a task: dependency check, then delegate to current adapter.
   * @returns { success: boolean } so the UI can clear the "running" state.
   */
  async execute(changeName: string, taskIndex: number, taskText: string): Promise<{ success: boolean }> {
    const config = vscode.workspace.getConfiguration('openspec');
    const mode = config.get<'auto' | 'fillChat'>('taskExecutionMode') ?? 'fillChat';
    const policy = config.get<'block' | 'warn'>('taskDependencyPolicy') ?? 'block';

    const tasks = await this.fileManager.readTasks(changeName);
    if (taskIndex < 0 || taskIndex >= tasks.length) {
      vscode.window.showErrorMessage(`任务索引无效: ${taskIndex}`);
      return { success: false };
    }

    const incompletePreceding = tasks
      .slice(0, taskIndex)
      .map((t, i) => ({ index: i, text: t.text, done: t.done }))
      .filter((t) => !t.done);

    if (incompletePreceding.length > 0) {
      const list = incompletePreceding.map((t) => `  ${t.index + 1}. ${t.text}`).join('\n');
      if (policy === 'block') {
        vscode.window.showErrorMessage(`请先完成以下任务：\n${list}`);
        return { success: false };
      }
      const choice = await vscode.window.showWarningMessage(
        `以下任务尚未完成，是否仍要执行？\n${list}`,
        { modal: true },
        '继续执行',
        '取消'
      );
      if (choice !== '继续执行') return { success: false };
    }

    const adapter = await getCurrentAdapter();
    if (!adapter) {
      vscode.window.showErrorMessage(
        '当前没有可用的执行者。请安装 Cursor 或使用剪贴板（Clipboard）适配器。'
      );
      return { success: false };
    }

    const base = `openspec/changes/${changeName}`;
    const contextFiles = [
      `${base}/proposal.md`,
      `${base}/design.md`,
      `${base}/tasks.md`,
    ];
    const request: TaskExecuteRequest = {
      changeName,
      taskIndex,
      taskText,
      contextFiles,
      workspaceRoot: this.workspaceRoot,
    };

    try {
      const cliService = new OpenSpecCliService(this.workspaceRoot);
      const formattedPrompt = await getPromptForFlow(
        {
          flow: 'apply',
          changeName,
          taskIndex,
          taskText,
          contextFiles,
          workspaceRoot: this.workspaceRoot,
        },
        cliService
      );
      request.promptOverride = formattedPrompt;
    } catch (e) {
      logger.debug('TaskExecutorService: getPromptForFlow failed, adapter will use fallback', e as Error);
    }

    try {
      const result =
        mode === 'auto'
          ? await adapter.executeTask(request)
          : await adapter.fillChat(request);

      if (result.success) {
        vscode.window.showInformationMessage(
          result.message || `已通过 ${adapter.displayName} 处理`
        );
      } else {
        vscode.window.showErrorMessage(result.message || '执行失败');
      }
      return { success: result.success };
    } catch (err) {
      logger.error('Task execution failed', err as Error);
      vscode.window.showErrorMessage((err as Error).message || '执行失败');
      return { success: false };
    }
  }
}
