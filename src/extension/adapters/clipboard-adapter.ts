import * as vscode from 'vscode';
import type { IAgentExecutorAdapter, TaskExecuteRequest, TaskExecuteResult } from '../services/agentExecutor.types';

const ADAPTER_ID = 'clipboard';
const DISPLAY_NAME = 'Clipboard (copy to clipboard)';

function buildPromptText(request: TaskExecuteRequest): string {
  const refs = request.contextFiles.length
    ? `\n参考文档：\n${request.contextFiles.map((f) => `- ${f}`).join('\n')}`
    : '';
  return `请实现以下任务：

Change: ${request.changeName}
Task: ${request.taskText}
${refs}

完成后请按 OpenSpec 流程在 tasks.md 中标记该任务为已完成。`;
}

export const clipboardAdapter: IAgentExecutorAdapter = {
  id: ADAPTER_ID,
  displayName: DISPLAY_NAME,

  async isAvailable(): Promise<boolean> {
    return true;
  },

  async executeTask(request: TaskExecuteRequest): Promise<TaskExecuteResult> {
    const text = request.promptOverride ?? buildPromptText(request);
    await vscode.env.clipboard.writeText(text);
    vscode.window.showInformationMessage('已复制到剪贴板，可粘贴到 Chat 或终端执行。');
    return { success: true, adapterId: ADAPTER_ID, message: 'Copied to clipboard' };
  },

  async fillChat(request: TaskExecuteRequest): Promise<TaskExecuteResult> {
    const text = request.promptOverride ?? buildPromptText(request);
    await vscode.env.clipboard.writeText(text);
    vscode.window.showInformationMessage('已复制到剪贴板，可粘贴到 Chat 输入框。');
    return { success: true, adapterId: ADAPTER_ID, message: 'Copied to clipboard' };
  },
};
