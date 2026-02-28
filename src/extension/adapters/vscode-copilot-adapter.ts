import * as vscode from 'vscode';
import type { IAgentExecutorAdapter, TaskExecuteRequest, TaskExecuteResult } from '../services/agentExecutor.types';
import { t } from '../../i18n';

const ADAPTER_ID = 'vscode-copilot';
const DISPLAY_NAME = 'VS Code Copilot Chat';

export const vscodeCopilotAdapter: IAgentExecutorAdapter = {
  id: ADAPTER_ID,
  displayName: DISPLAY_NAME,

  async isAvailable(): Promise<boolean> {
    const copilotChat = vscode.extensions.getExtension('github.copilot-chat');
    return copilotChat !== undefined;
  },

  async executeTask(request: TaskExecuteRequest): Promise<TaskExecuteResult> {
    return this.fillChat(request);
  },

  async fillChat(request: TaskExecuteRequest): Promise<TaskExecuteResult> {
    const prompt = request.promptOverride ?? `/opsx:apply ${request.changeName}`;
    try {
      await vscode.commands.executeCommand('workbench.action.chat.open', {
        query: prompt,
        isPartialQuery: true,
      });
      return { success: true, adapterId: ADAPTER_ID, message: 'Chat opened with prompt' };
    } catch {
      await vscode.env.clipboard.writeText(prompt);
      vscode.window.showInformationMessage(t('clipboard.copiedChat'));
      return { success: true, adapterId: ADAPTER_ID, message: 'Copied to clipboard (fallback)' };
    }
  },
};
