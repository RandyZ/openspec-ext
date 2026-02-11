import * as vscode from 'vscode';
import type { IAgentExecutorAdapter } from '../services/agentExecutor.types';
import { clipboardAdapter } from './clipboard-adapter';
import { cursorAdapter } from './cursor-adapter';

const registeredAdapters: IAgentExecutorAdapter[] = [clipboardAdapter, cursorAdapter];

/**
 * Discover all adapters that are currently available (isAvailable() resolves to true).
 */
export async function getAvailableAdapters(): Promise<IAgentExecutorAdapter[]> {
  const results = await Promise.all(
    registeredAdapters.map(async (a) => ({ adapter: a, ok: await a.isAvailable() }))
  );
  return results.filter((r) => r.ok).map((r) => r.adapter);
}

/**
 * Get the current adapter to use: preferred from config if available, otherwise first available or clipboard.
 */
export async function getCurrentAdapter(): Promise<IAgentExecutorAdapter | null> {
  const available = await getAvailableAdapters();
  if (available.length === 0) return null;

  const config = vscode.workspace.getConfiguration('openspec');
  const preferredId = config.get<string>('preferredAgentAdapter')?.trim() || '';

  if (preferredId) {
    const found = available.find((a) => a.id === preferredId);
    if (found) return found;
  }

  const clipboard = available.find((a) => a.id === 'clipboard');
  return clipboard ?? available[0];
}

export { clipboardAdapter, cursorAdapter };
