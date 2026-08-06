import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { logger } from '../utils/logger';
import { resolveOpenablePath } from '../services/artifactInventory';

/**
 * Open a file or directory under a change folder in the editor and reveal it
 * in the Explorer. For directories (or glob output paths), selects the most
 * recently modified file inside the directory.
 */
export async function openAndRevealPath(
  changeDir: string,
  relativeOrGlob: string
): Promise<{ opened: boolean; reason?: string }> {
  const target = resolveOpenablePath(changeDir, relativeOrGlob);
  let stat: fs.Stats;
  try {
    stat = await fs.promises.stat(target);
  } catch {
    return { opened: false, reason: 'missing' };
  }

  let fileToOpen = target;
  if (stat.isDirectory()) {
    const recent = await findMostRecentlyModifiedFile(target);
    if (!recent) {
      // Reveal the empty directory if possible; nothing to open in the editor.
      try {
        await vscode.commands.executeCommand('revealInExplorer', vscode.Uri.file(target));
      } catch (err) {
        logger.warn(`revealInExplorer failed for directory ${target}: ${(err as Error)?.message}`);
      }
      return { opened: false, reason: 'empty-directory' };
    }
    fileToOpen = recent;
  }

  try {
    const doc = await vscode.workspace.openTextDocument(fileToOpen);
    await vscode.window.showTextDocument(doc);
    try {
      await vscode.commands.executeCommand('revealInExplorer', doc.uri);
    } catch (err) {
      // Best-effort for store roots outside the workspace (see artifact-viewing spec).
      logger.warn(`revealInExplorer failed for ${fileToOpen}: ${(err as Error)?.message}`);
    }
    return { opened: true };
  } catch (err) {
    logger.error(`Failed to open path: ${fileToOpen}`, err as Error);
    return { opened: false, reason: 'open-failed' };
  }
}

async function findMostRecentlyModifiedFile(dirPath: string): Promise<string | null> {
  let entries: fs.Dirent[];
  try {
    entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
  } catch {
    return null;
  }

  let best: { path: string; mtime: number } | null = null;
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dirPath, entry.name);
    try {
      const st = await fs.promises.stat(full);
      if (!best || st.mtimeMs > best.mtime) {
        best = { path: full, mtime: st.mtimeMs };
      }
    } catch {
      // skip
    }
  }
  return best?.path ?? null;
}
