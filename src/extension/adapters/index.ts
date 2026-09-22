import * as vscode from 'vscode';
import type { IAgentExecutorAdapter } from '../services/agentExecutor.types';
import { getWorkflowLaunchConfig } from '../services/workflowLaunchConfig';
import {
  getAvailableAdapters,
  getRegisteredAdapterById,
  listExecutorAdapterOptions,
} from './adapterRegistry';
import { clipboardAdapter } from './clipboard-adapter';
import { cursorAdapter } from './cursor-adapter';
import { vscodeChatAdapter } from './vscode-chat-adapter';
import { vscodeCopilotAdapter } from './vscode-copilot-adapter';
import { claudeCodeAdapter } from './claude-code-adapter';
import { opencodeAdapter } from './opencode-adapter';

export { getAvailableAdapters, listExecutorAdapterOptions };

export async function getAdapterById(id: string): Promise<IAgentExecutorAdapter | null> {
  const registered = getRegisteredAdapterById(id);
  if (!registered) return null;
  if (!(await registered.isAvailable())) return null;
  return registered;
}

export async function getCurrentAdapter(): Promise<IAgentExecutorAdapter | null> {
  const available = await getAvailableAdapters();
  if (available.length === 0) return null;

  const config = getWorkflowLaunchConfig();
  const preferredId = config.preferredAgentAdapter;

  if (preferredId) {
    const found = available.find((adapter) => adapter.id === preferredId);
    if (found) return found;
    if (preferredId === 'vscode-copilot' || preferredId === 'cursor') {
      const vscodeHostAdapter = available.find((adapter) =>
        adapter.id === 'vscode-copilot' || adapter.id === 'vscode-chat');
      if (vscodeHostAdapter) return vscodeHostAdapter;
    }
  }

  const nonClipboard = available.find((adapter) => adapter.id !== 'clipboard');
  return nonClipboard ?? available[0];
}

export {
  clipboardAdapter,
  cursorAdapter,
  vscodeChatAdapter,
  vscodeCopilotAdapter,
  claudeCodeAdapter,
  opencodeAdapter,
};
