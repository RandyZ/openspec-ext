import * as path from 'path';

/**
 * Check whether candidatePath is under rootPath, accounting for traversal.
 */
export function isPathUnderRoot(candidatePath: string, rootPath: string): boolean {
  const normalized = path.resolve(candidatePath);
  const root = path.resolve(rootPath);
  const rel = path.relative(root, normalized);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}
