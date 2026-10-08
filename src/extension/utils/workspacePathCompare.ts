import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

/** Canonical path for workspace membership checks (realpath + platform case rules). */
export function normalizePathForComparison(inputPath: string): string {
  let resolved = path.resolve(inputPath);
  try {
    resolved = fs.realpathSync.native(resolved);
  } catch {
    // Symlink target missing or permission error — fall back to resolved path.
  }
  if (os.platform() === 'darwin' || os.platform() === 'win32') {
    return resolved.toLowerCase();
  }
  return resolved;
}

/** True when two paths refer to the same location for workspace binding checks. */
export function pathsEqualForWorkspace(a: string, b: string): boolean {
  return normalizePathForComparison(a) === normalizePathForComparison(b);
}

export function isPathUnderWorkspaceFolder(folderRoot: string, candidatePath: string): boolean {
  const root = normalizePathForComparison(folderRoot);
  const normalized = normalizePathForComparison(candidatePath);
  if (normalized === root) return true;
  const rel = path.relative(root, normalized);
  return rel.length > 0 && !rel.startsWith('..') && !path.isAbsolute(rel);
}
