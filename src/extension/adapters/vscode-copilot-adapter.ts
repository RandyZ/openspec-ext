import * as vscode from 'vscode';
import type { IAgentExecutorAdapter, TaskExecuteRequest, TaskExecuteResult } from '../services/agentExecutor.types';
import { t } from '../../i18n';
import { launchAgentPanelPrompt } from '../services/agentPanelLauncher';

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
    await vscode.env.clipboard.writeText(prompt);
    const panelResult = await launchAgentPanelPrompt({ text: prompt, autoSubmit: false });
    if (panelResult.outcome === 'copied') {
      vscode.window.showInformationMessage(t('agentLaunch.copied', { command: prompt }));
    } else {
      vscode.window.showInformationMessage(t('agentLaunch.prefilled', { command: prompt }));
    }
    return {
      success: panelResult.success,
      adapterId: ADAPTER_ID,
      message: panelResult.layer,
    };
  },
};
