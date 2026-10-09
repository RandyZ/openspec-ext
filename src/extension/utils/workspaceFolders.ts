import * as vscode from 'vscode';
import { isPathUnderWorkspaceFolder, normalizePathForComparison } from './workspacePathCompare';

/** True when resolvedPath is the workspace folder or a path under it. */
export function isPathInWorkspaceFolders(resolvedPath: string): boolean {
  const folders = vscode.workspace.workspaceFolders ?? [];
  if (folders.length === 0) {
    return true;
  }
  return folders.some((folder) =>
    isPathUnderWorkspaceFolder(folder.uri.fsPath, resolvedPath),
  );
}

export function normalizeScopeRootForWorkspaceCheck(rootPath: string): string {
  return normalizePathForComparison(rootPath);
}
