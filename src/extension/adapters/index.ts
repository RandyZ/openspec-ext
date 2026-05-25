import * as vscode from 'vscode';
import type { IAgentExecutorAdapter } from '../services/agentExecutor.types';
import { clipboardAdapter } from './clipboard-adapter';
import { cursorAdapter } from './cursor-adapter';
import { vscodeCopilotAdapter } from './vscode-copilot-adapter';
import { claudeCodeAdapter } from './claude-code-adapter';
import { opencodeAdapter } from './opencode-adapter';
import { getWorkflowLaunchConfig } from '../services/workflowLaunchConfig';

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

export async function getAdapterById(id: string): Promise<IAgentExecutorAdapter | null> {
  const available = await getAvailableAdapters();
  return available.find((a) => a.id === id) ?? null;
}

export async function getCurrentAdapter(): Promise<IAgentExecutorAdapter | null> {
  const available = await getAvailableAdapters();
  if (available.length === 0) return null;

  const config = getWorkflowLaunchConfig();
  const preferredId = config.preferredAgentAdapter;

  if (preferredId) {
    const found = available.find((a) => a.id === preferredId);
    if (found) return found;
  }

  return available[0];
}

export { clipboardAdapter, cursorAdapter, vscodeCopilotAdapter, claudeCodeAdapter, opencodeAdapter };
