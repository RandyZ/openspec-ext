import * as vscode from 'vscode';
import type { IAgentExecutorAdapter, TaskExecuteRequest, TaskExecuteResult } from '../services/agentExecutor.types';

const ADAPTER_ID = 'clipboard';
const DISPLAY_NAME = 'Clipboard (copy to clipboard)';

function buildPromptText(request: TaskExecuteRequest): string {
  return `/opsx:apply ${request.changeName}`;
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
