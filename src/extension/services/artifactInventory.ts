import * as fs from 'fs';
import * as path from 'path';

export interface OtherArtifactEntry {
  /** Stable slug used as message key (relativePath with path separators replaced). */
  id: string;
  /** Path relative to the change directory (e.g. `task-details` or `notes.md`). */
  relativePath: string;
  isDirectory: boolean;
  /** File count for directories (single-level); always 1 for files. */
  fileCount: number;
}

const SKIP_NAMES = new Set(['.openspec.yaml']);

/**
 * Extract the top-level entry name that a known artifact output path "owns"
 * inside a change directory.
 *
 * Accepts:
 * - Schema-relative paths: `proposal.md`, `specs/**\/*.md`
 * - Filesystem-fallback paths: `openspec/changes/<name>/proposal.md`
 * - Absolute paths under a change directory (matched by basename of first segment after change dir)
 */
export function toKnownTopLevelName(outputPath: string, changeName?: string): string | null {
  if (!outputPath || typeof outputPath !== 'string') return null;
  let rel = outputPath.replace(/\\/g, '/').trim();
  if (!rel) return null;

  if (changeName) {
    const marker = `openspec/changes/${changeName}/`;
    const archiveMarker = changeName.startsWith('archive:')
      ? `openspec/changes/archive/${changeName.slice(8)}/`
      : null;
    const idx = rel.indexOf(marker);
    if (idx >= 0) {
      rel = rel.slice(idx + marker.length);
    } else if (archiveMarker) {
      const aidx = rel.indexOf(archiveMarker);
      if (aidx >= 0) rel = rel.slice(aidx + archiveMarker.length);
    }
  }

  // Strip glob suffixes: "specs/**/*.md" -> "specs/"
  const beforeGlob = rel.split('*')[0].replace(/\/+$/, '');
  if (!beforeGlob) return null;

  // Absolute path: take the last segment that isn't a glob leftover
  if (path.isAbsolute(outputPath) && !changeName) {
    const base = path.basename(beforeGlob);
    return base || null;
  }

  const segments = beforeGlob.split('/').filter(Boolean);
  return segments[0] ?? null;
}

function slugId(relativePath: string): string {
  return relativePath.replace(/\\/g, '/').replace(/\//g, '__');
}

async function countFilesInDirectory(dirPath: string): Promise<number> {
  try {
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
    return entries.filter((e) => e.isFile()).length;
  } catch {
    return 0;
  }
}

/**
 * Diff the change directory's direct children against known Schema / fallback
 * artifact paths. Returns entries that exist on disk but are not declared.
 *
 * Only scans one level deep. File counts for "other" directories are also single-level.
 */
export async function buildOtherArtifacts(
  changeDir: string,
  knownOutputPaths: string[],
  changeName?: string
): Promise<OtherArtifactEntry[]> {
  const known = new Set<string>();
  for (const p of knownOutputPaths) {
    const name = toKnownTopLevelName(p, changeName);
    if (name) known.add(name);
  }

  let dirents: fs.Dirent[];
  try {
    dirents = await fs.promises.readdir(changeDir, { withFileTypes: true });
  } catch {
    return [];
  }

  const results: OtherArtifactEntry[] = [];
  for (const dirent of dirents) {
    const name = dirent.name;
    if (!name || name.startsWith('.')) continue;
    if (SKIP_NAMES.has(name)) continue;
    if (known.has(name)) continue;

    const absolute = path.join(changeDir, name);
    if (dirent.isDirectory()) {
      const fileCount = await countFilesInDirectory(absolute);
      results.push({
        id: slugId(name),
        relativePath: name,
        isDirectory: true,
        fileCount,
      });
    } else if (dirent.isFile()) {
      results.push({
        id: slugId(name),
        relativePath: name,
        isDirectory: false,
        fileCount: 1,
      });
    }
  }

  results.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  return results;
}

/**
 * Resolve the absolute path to open for an inventory entry or artifact outputPath.
 * Glob paths like `specs/**\/*.md` resolve to the directory `specs`.
 */
export function resolveOpenablePath(changeDir: string, relativeOrGlob: string): string {
  const beforeGlob = relativeOrGlob.replace(/\\/g, '/').split('*')[0].replace(/\/+$/, '');
  const top = beforeGlob.split('/').filter(Boolean)[0] ?? beforeGlob;
  return path.join(changeDir, top);
}
