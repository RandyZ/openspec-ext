import * as vscode from 'vscode';
import type { IAgentExecutorAdapter } from '../services/agentExecutor.types';
import { clipboardAdapter } from './clipboard-adapter';
import { cursorAdapter } from './cursor-adapter';
import { vscodeCopilotAdapter } from './vscode-copilot-adapter';
import { claudeCodeAdapter } from './claude-code-adapter';
import { opencodeAdapter } from './opencode-adapter';

const registeredAdapters: IAgentExecutorAdapter[] = [
  vscodeCopilotAdapter,
  claudeCodeAdapter,
  opencodeAdapter,
  cursorAdapter,
  clipboardAdapter,
];

export async function getAvailableAdapters(): Promise<IAgentExecutorAdapter[]> {
  const results = await Promise.all(
    registeredAdapters.map(async (a) => ({ adapter: a, ok: await a.isAvailable() }))
  );
  return results.filter((r) => r.ok).map((r) => r.adapter);
}

export async function getCurrentAdapter(): Promise<IAgentExecutorAdapter | null> {
  const available = await getAvailableAdapters();
  if (available.length === 0) return null;

  const config = vscode.workspace.getConfiguration('openspec');
  const preferredId = config.get<string>('preferredAgentAdapter')?.trim() || '';

  if (preferredId) {
    const found = available.find((a) => a.id === preferredId);
    if (found) return found;
  }

  return available[0];
}

export { clipboardAdapter, cursorAdapter, vscodeCopilotAdapter, claudeCodeAdapter, opencodeAdapter };
