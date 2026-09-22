import * as vscode from 'vscode';
import type { AgentAdapterOption } from '../../shared/executorLaunchPresentation';
import { clipboardAdapter } from './clipboard-adapter';
import { claudeCodeAdapter } from './claude-code-adapter';
import { cursorAdapter } from './cursor-adapter';
import { opencodeAdapter } from './opencode-adapter';
import { vscodeChatAdapter } from './vscode-chat-adapter';
import { vscodeCopilotAdapter } from './vscode-copilot-adapter';
import type { IAgentExecutorAdapter } from '../services/agentExecutor.types';

const registeredAdapters: IAgentExecutorAdapter[] = [
  vscodeCopilotAdapter,
  vscodeChatAdapter,
  claudeCodeAdapter,
  opencodeAdapter,
  cursorAdapter,
  clipboardAdapter,
];

function isCursorHost(): boolean {
  return (vscode.env.appName ?? '').toLowerCase().includes('cursor');
}

/** Runtime launch adapters (must pass isAvailable). */
export async function getAvailableAdapters(): Promise<IAgentExecutorAdapter[]> {
  const results = await Promise.all(
    registeredAdapters.map(async (adapter) => ({ adapter, ok: await adapter.isAvailable() })),
  );
  return results.filter((result) => result.ok).map((result) => result.adapter);
}

/**
 * Executor dropdown options shown in Change detail.
 * VS Code hosts always include VS Code Chat even when Copilot is absent.
 */
export async function listExecutorAdapterOptions(): Promise<AgentAdapterOption[]> {
  const options: AgentAdapterOption[] = [];
  const cursorHost = isCursorHost();

  if (!cursorHost) {
    if (await vscodeCopilotAdapter.isAvailable()) {
      options.push({ id: vscodeCopilotAdapter.id, displayName: vscodeCopilotAdapter.displayName });
    }
    options.push({ id: vscodeChatAdapter.id, displayName: vscodeChatAdapter.displayName });
  }

  if (await claudeCodeAdapter.isAvailable()) {
    options.push({ id: claudeCodeAdapter.id, displayName: claudeCodeAdapter.displayName });
  }
  if (await opencodeAdapter.isAvailable()) {
    options.push({ id: opencodeAdapter.id, displayName: opencodeAdapter.displayName });
  }
  if (cursorHost && await cursorAdapter.isAvailable()) {
    options.push({ id: cursorAdapter.id, displayName: cursorAdapter.displayName });
  }

  options.push({ id: clipboardAdapter.id, displayName: clipboardAdapter.displayName });
  return options;
}

export function getRegisteredAdapterById(id: string): IAgentExecutorAdapter | undefined {
  return registeredAdapters.find((adapter) => adapter.id === id);
}
