import * as vscode from 'vscode';
import { t } from '../../i18n';
import { getCurrentAdapter } from '../adapters';
import { buildAgentInitPrompt, OPENSPEC_INIT_COMMAND } from '../../shared/agentInit';

export async function launchAgentInit(workspacePath?: string): Promise<void> {
  const prompt = buildAgentInitPrompt(workspacePath);
  const adapter = await getCurrentAdapter();
  if (adapter) {
    await adapter.fillChat({
      changeName: '',
      taskIndex: -1,
      taskText: '',
      contextFiles: [],
      workspaceRoot: workspacePath ?? '',
      promptOverride: prompt,
    });
    return;
  }
  await vscode.env.clipboard.writeText(prompt);
  void vscode.window.showInformationMessage(t('clipboard.copiedChat'));
}

export async function copyInitCommand(): Promise<void> {
  await vscode.env.clipboard.writeText(OPENSPEC_INIT_COMMAND);
  void vscode.window.showInformationMessage(t('workflow.copiedCommand', { command: OPENSPEC_INIT_COMMAND }));
}

export async function openWorkspaceFolder(): Promise<void> {
  await vscode.commands.executeCommand('vscode.openFolder');
}
