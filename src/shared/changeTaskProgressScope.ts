import type { ChangeTaskProgressPatch } from './changeTaskProgressPatch';

/** Normalize an OpenSpec root path for comparison (no realpath; safe in webview). */
export function normalizeChangeRootPath(rootPath: string): string {
  if (!rootPath) return rootPath;
  let normalized = rootPath.replace(/\\/g, '/');
  if (normalized.length > 1 && normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
}

export function changeRootPathsEqual(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b) return false;
  return normalizeChangeRootPath(a) === normalizeChangeRootPath(b);
}

/** Best-effort root path embedded in a scope id (local / declared / project-bound). */
export function resolveRootPathFromScopeId(scopeId: string | undefined): string | undefined {
  if (!scopeId) return undefined;
  if (scopeId.startsWith('local:')) {
    return scopeId.slice('local:'.length);
  }
  if (scopeId.startsWith('declared:')) {
    return scopeId.slice('declared:'.length);
  }
  if (scopeId.startsWith('project:')) {
    const withoutPrefix = scopeId.slice('project:'.length);
    const firstColon = withoutPrefix.indexOf(':');
    if (firstColon === -1) return undefined;
    const afterProjectId = withoutPrefix.slice(firstColon + 1);
    const rootSourceMatch = afterProjectId.match(
      /^(.+):(?:local|store|declared)(?::|$)/,
    );
    if (rootSourceMatch?.[1]) {
      return rootSourceMatch[1];
    }
    const parts = afterProjectId.split(':');
    if (parts.length >= 2 && parts[0].startsWith('/')) {
      return parts[0];
    }
    return undefined;
  }
  return undefined;
}

export interface TaskProgressPanelScope {
  changeName: string;
  scopeId?: string;
  planningRoot?: string;
}

export function resolvePanelChangeRoot(panel: TaskProgressPanelScope): string | undefined {
  if (panel.planningRoot) return panel.planningRoot;
  return resolveRootPathFromScopeId(panel.scopeId);
}

export function resolvePatchChangeRoot(patch: ChangeTaskProgressPatch): string | undefined {
  if (patch.changeRootPath) return patch.changeRootPath;
  return resolveRootPathFromScopeId(patch.scopeId);
}

/**
 * True when a host task-progress patch targets the same change at the same OpenSpec root
 * as the detail panel (project-bound scope ids may differ from watcher local/store ids).
 */
export function changeTaskProgressPatchAppliesToPanel(
  patch: ChangeTaskProgressPatch,
  panel: TaskProgressPanelScope,
): boolean {
  if (patch.changeName !== panel.changeName) return false;

  const patchRoot = resolvePatchChangeRoot(patch);
  const panelRoot = resolvePanelChangeRoot(panel);

  if (patchRoot && panelRoot) {
    return changeRootPathsEqual(patchRoot, panelRoot);
  }

  if (patch.scopeId && panel.scopeId && patch.scopeId === panel.scopeId) {
    return true;
  }

  return !patchRoot && !panelRoot;
}
