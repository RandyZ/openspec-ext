import * as vscode from 'vscode';
import * as path from 'path';
import { existsSync } from 'fs';
import { getOpenSpecProjectRoots } from '../utils/workspaceRoot';

export function workspaceHasOpenSpecRootSync(): boolean {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders?.length) return false;
  return folders.some((folder) =>
    existsSync(path.join(folder.uri.fsPath, 'openspec', 'config.yaml')),
  );
}

export async function workspaceHasOpenSpecRoot(): Promise<boolean> {
  if (workspaceHasOpenSpecRootSync()) return true;
  return (await getOpenSpecProjectRoots()).length > 0;
}

export function getPrimaryWorkspacePath(): string | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}
