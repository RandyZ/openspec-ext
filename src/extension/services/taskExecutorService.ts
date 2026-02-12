import * as vscode from 'vscode';
import { logger } from '../utils/logger';
import type { TaskExecuteRequest } from './agentExecutor.types';
import type { IOpenSpecContentAccess } from './contentAccess';
import { getCurrentAdapter } from '../adapters';
import { getPromptForFlow } from './openspecPromptHandler';
import { OpenSpecCliService } from './openspecCli';

export class TaskExecutorService {
  constructor(
    private workspaceRoot: string,
    private contentAccess: IOpenSpecContentAccess
  ) {}

  /**
   * Execute or fillChat for a task: dependency check, then delegate to current adapter.
   * @returns { success: boolean } so the UI can clear the "running" state.
   */
  async execute(changeName: string, taskIndex: number, taskText: string): Promise<{ success: boolean }> {
    const config = vscode.workspace.getConfiguration('openspec');
    const mode = config.get<'auto' | 'fillChat'>('taskExecutionMode') ?? 'fillChat';
    const policy = config.get<'block' | 'warn'>('taskDependencyPolicy') ?? 'block';

    const tasks = await this.contentAccess.readTasks(changeName);
    if (taskIndex < 0 || taskIndex >= tasks.length) {
      vscode.window.showErrorMessage(`任务索引无效: ${taskIndex}`);
      return { success: false };
    }

    // 父任务：直接执行所有未完成的直接子任务（不执行父任务本身）
    const childIndices = this.contentAccess.getDirectChildIndices(tasks, taskIndex);
    if (childIndices.length > 0) {
      const incompleteChildren = childIndices.filter((c) => !tasks[c].done);
      if (incompleteChildren.length > 0) {
        let lastResult: { success: boolean } = { success: true };
        for (const c of incompleteChildren) {
          lastResult = await this.execute(changeName, c, tasks[c].text);
          if (!lastResult.success) return lastResult;
        }
        return lastResult;
      }
      // 子任务都已完成，仅确保父任务被自动勾选
      await this.contentAccess.autoCompleteParents(changeName);
      return { success: true };
    }

    // 叶子任务：按原逻辑做前置检查并执行
    const currentIndent = tasks[taskIndex].indent;
    let parentIndex = -1;
    for (let j = taskIndex - 1; j >= 0; j--) {
      if (tasks[j].indent < currentIndent) {
        parentIndex = j;
        break;
      }
    }
    const incompletePreceding = tasks
      .slice(0, taskIndex)
      .map((t, i) => ({ taskNumber: i + 1, text: t.text, done: t.done, indent: t.indent }))
      .filter((t) => !t.done && t.taskNumber - 1 !== parentIndex);

    if (incompletePreceding.length > 0) {
      const maxShow = 5;
      const list = incompletePreceding
        .slice(0, maxShow)
        .map((t) => `  ${t.taskNumber}. ${t.text}`)
        .join('\n');
      const more = incompletePreceding.length > maxShow
        ? `\n  … 还有 ${incompletePreceding.length - maxShow} 项未完成`
        : '';
      if (policy === 'block') {
        vscode.window.showErrorMessage(
          `请先完成以下任务（当前为「先完成前置任务」策略）：\n${list}${more}\n\n可在设置中将 openspec.taskDependencyPolicy 改为 warn 以允许跳过前置任务执行。`
        );
        return { success: false };
      }
      const choice = await vscode.window.showWarningMessage(
        `以下任务尚未完成，是否仍要执行？\n${list}${more}`,
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
