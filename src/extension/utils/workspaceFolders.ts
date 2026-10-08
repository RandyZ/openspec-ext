import * as path from 'path';
import * as vscode from 'vscode';

/** True when resolvedPath is the workspace folder or a path under it. */
export function isPathInWorkspaceFolders(resolvedPath: string): boolean {
  const normalized = path.resolve(resolvedPath);
  const folders = vscode.workspace.workspaceFolders ?? [];
  if (folders.length === 0) {
    return true;
  }
  return folders.some((folder) => {
    const root = path.resolve(folder.uri.fsPath);
    if (normalized === root) return true;
    const rel = path.relative(root, normalized);
    return rel.length > 0 && !rel.startsWith('..') && !path.isAbsolute(rel);
  });
}
