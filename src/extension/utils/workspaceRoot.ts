import * as vscode from 'vscode';
import * as path from 'path';
import { logger } from './logger';

const OPENSPEC_CONFIG = 'openspec/config.yaml';

/**
 * Resolve the workspace folder that contains OpenSpec (openspec/config.yaml).
 * Used so that multi-root workspaces use the correct root for reading/writing openspec data.
 * Activation event is workspaceContains:openspec/config.yaml, so at least one folder has it.
 */
export async function getOpenSpecWorkspaceRoot(): Promise<string | null> {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) return null;

  for (const folder of folders) {
    const configUri = vscode.Uri.joinPath(folder.uri, OPENSPEC_CONFIG);
    try {
      await vscode.workspace.fs.stat(configUri);
      const root = folder.uri.fsPath;
      logger.info(`[archived] OpenSpec workspace root resolved: ${root} (folder: ${folder.name})`);
      return root;
    } catch (e) {
      logger.info(`[archived] Folder "${folder.name}" has no openspec/config.yaml, skip`);
    }
  }

  // Fallback: use first folder (same as before; avoids breaking single-folder)
  const fallback = folders[0].uri.fsPath;
  logger.info(`OpenSpec workspace root (fallback): ${fallback}`);
  return fallback;
}

export interface OpenSpecProjectRoot {
  path: string;
  label: string;
}

/**
 * Discover ALL workspace folders containing openspec/config.yaml.
 *
 * Multi-folder workspaces can contain several OpenSpec project roots (e.g.
 * FastGPT and Server_DotNetCore side by side). Each such folder becomes an
 * independent project root selectable in the root selector. Folders without an
 * OpenSpec config are excluded entirely — they must NOT become project roots.
 *
 * Returns folders in workspace order so the activation (first) root stays stable.
 */
export async function getOpenSpecProjectRoots(): Promise<OpenSpecProjectRoot[]> {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) return [];

  const roots: OpenSpecProjectRoot[] = [];
  for (const folder of folders) {
    const configUri = vscode.Uri.joinPath(folder.uri, OPENSPEC_CONFIG);
    try {
      await vscode.workspace.fs.stat(configUri);
      roots.push({ path: folder.uri.fsPath, label: folder.name });
    } catch {
      // Folder without openspec/config.yaml — not a project root.
    }
  }
  return roots;
}

/**
 * Sync variant for callers that already have a root (e.g. from DataManager).
 * Use getOpenSpecWorkspaceRoot() when resolving at activation.
 */
export function getChangesBasePath(workspaceRoot: string, changeName: string): string {
  return changeName.startsWith('archive:')
    ? path.join(workspaceRoot, 'openspec', 'changes', 'archive', changeName.slice(8))
    : path.join(workspaceRoot, 'openspec', 'changes', changeName);
}
