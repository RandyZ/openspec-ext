import * as vscode from 'vscode';
import * as path from 'path';
import { logger } from '../utils/logger';
import { DataManager } from '../services/dataManager';
import { InteractiveAgentTerminalManager } from '../services/interactiveAgentTerminalManager';
import {
  handleWebviewMessage,
  getWebviewContent,
  getWorkflowLaunchConfigMessage,
} from './webviewMessageHandler';
import type { ChangeDetailTabId, InteractiveWorkflowAction } from '../../shared/interactiveWorkflow';
import {
  isChangeWorkflowSnapshot,
  isWorkflowSnapshotBoundTo,
  type ChangeWorkflowSnapshot,
} from '../../shared/changeWorkflow';
import type { OpenSpecScope } from '../services/openspecScope';
import type { OpenSpecRootBinding, ProjectContext } from '../services/types';

/** Delay (ms) before sending initial setContext so the webview is ready to receive it. */
const INITIAL_SET_CONTEXT_DELAY_MS = 150;
const PANEL_KEY_SEPARATOR = '\u0000';

export interface ChangeDetailPanelOptions {
  initialTab?: ChangeDetailTabId;
  interactiveAction?: InteractiveWorkflowAction;
  scopeId?: string;
  project?: ProjectContext;
  binding?: OpenSpecRootBinding;
  workflowSnapshot?: ChangeWorkflowSnapshot;
}

interface PendingSetContext {
  changeName: string;
  options?: ChangeDetailPanelOptions;
}

export function createProjectBoundScope(
  binding: OpenSpecRootBinding,
  label = binding.projectId
): OpenSpecScope {
  return {
    id: `project:${binding.projectId}:${binding.rootPath}:${binding.rootSource}:${binding.storeId ?? ''}`,
    label,
    rootPath: binding.rootPath,
    source: binding.storeId ? 'store' : 'declared',
    ...(binding.storeId ? { storeId: binding.storeId } : {}),
    runtimeSource: 'installed',
    capabilities: {
      stores: false,
      context: false,
      doctor: false,
      worksets: false,
      diagnostics: [],
    },
    diagnostics: [],
  };
}

/**
 * Manages WebviewPanels for Change Detail view in the editor area.
 * One panel per change; reuses panel when opening the same change again.
 */
export class ChangeDetailPanelManager {
  private panels = new Map<string, vscode.WebviewPanel>();
  private panelRootPaths = new Map<string, string | undefined>();
  private panelScopes = new Map<vscode.Webview, OpenSpecScope | undefined>();
  private pendingSetContext = new Map<vscode.Webview, PendingSetContext>();

  constructor(
    private dataManager: DataManager,
    private extensionPath: string,
    private interactiveTerminalManager: InteractiveAgentTerminalManager,
    private onAfterOpen?: () => void,
    private onRevealSidebar?: () => void
  ) {}

  private panelKey(changeName: string, scopeId?: string): string {
    return `${scopeId ?? 'default'}${PANEL_KEY_SEPARATOR}${changeName}`;
  }

  private keyMatchesChange(key: string, changeName: string): boolean {
    return key.endsWith(`${PANEL_KEY_SEPARATOR}${changeName}`);
  }

  private resolveScope(scopeId?: string): OpenSpecScope | undefined {
    return this.dataManager.resolveScope(scopeId) ?? this.dataManager.getSelectedScope();
  }

  private resolveScopeForOptions(options?: ChangeDetailPanelOptions): OpenSpecScope | undefined {
    return options?.binding
      ? createProjectBoundScope(options.binding, options.project?.label)
      : this.resolveScope(options?.scopeId);
  }

  private toScopeView(scope: OpenSpecScope | undefined): {
    id: string;
    label: string;
    source: string;
    rootPath: string;
    storeId?: string;
  } | undefined {
    return scope
      ? {
        id: scope.id,
        label: scope.label,
        source: scope.source,
        rootPath: scope.rootPath,
        storeId: scope.storeId,
      }
      : undefined;
  }

  private async getExistingArtifactIds(
    changeName: string,
    scope: OpenSpecScope | undefined,
    binding: OpenSpecRootBinding | undefined,
    providedSnapshot?: ChangeWorkflowSnapshot
  ): Promise<{ ids: string[]; workflowSnapshot?: ChangeWorkflowSnapshot; invalidSnapshot: boolean }> {
    let snapshotWasPresent = false;
    try {
      if (binding && typeof this.dataManager.getChangeWorkflowSnapshot === 'function') {
        const snapshot = await this.dataManager.getChangeWorkflowSnapshot(changeName, scope, binding);
        if (snapshot) {
          if (!isWorkflowSnapshotBoundTo(snapshot, binding, changeName)) {
            return { ids: [], invalidSnapshot: true };
          }
          return {
            invalidSnapshot: false,
            workflowSnapshot: snapshot,
            ids: snapshot.artifacts
              .filter((artifact) => artifact.status === 'done')
              .map((artifact) => artifact.id),
          };
        }
      }
      let data = await this.dataManager.getDashboardData();
      const readSnapshot = (candidateData: Awaited<ReturnType<DataManager['getDashboardData']>>) => {
        const change = candidateData.changes.find((c) => c.name === changeName);
        const dataRootPath = candidateData.scope?.rootPath;
        const scopeMatches = !scope
          || candidateData.scope?.id === scope.id
          || dataRootPath === scope.rootPath
          || (binding && dataRootPath === binding.rootPath);
        if (!change || !scopeMatches) return undefined;
        if (change.workflowSnapshot !== undefined) snapshotWasPresent = true;

        const snapshot = change.workflowSnapshot;
        if (!snapshot && !binding) {
          return {
            invalidSnapshot: false,
            ids: change.artifacts?.filter((artifact) => artifact.status === 'done').map((artifact) => artifact.id) ?? [],
          } as const;
        }
        if (!snapshot) return undefined;
        const valid = binding
          ? isWorkflowSnapshotBoundTo(snapshot, binding, changeName)
          : isChangeWorkflowSnapshot(snapshot, undefined, changeName);
        if (!valid) return { invalidSnapshot: true } as const;
        return {
          invalidSnapshot: false,
          workflowSnapshot: snapshot,
          ids: snapshot.artifacts
            .filter((artifact) => artifact.status === 'done')
            .map((artifact) => artifact.id),
        } as const;
      };

      let resolved = readSnapshot(data);
      if ((!resolved || resolved.invalidSnapshot) && binding && typeof this.dataManager.refresh === 'function') {
        try {
          data = await this.dataManager.refresh();
          resolved = readSnapshot(data);
        } catch {
          // A failed refresh remains non-actionable for a Project-bound panel.
        }
      }
      if (resolved && !resolved.invalidSnapshot) return resolved;
      const validProvidedSnapshot = binding
        ? isWorkflowSnapshotBoundTo(providedSnapshot, binding, changeName)
        : isChangeWorkflowSnapshot(providedSnapshot, undefined, changeName);
      if (validProvidedSnapshot && providedSnapshot) {
        return {
          ids: providedSnapshot.artifacts
            .filter((artifact) => artifact.status === 'done')
            .map((artifact) => artifact.id),
          workflowSnapshot: providedSnapshot,
          invalidSnapshot: false,
        };
      }
      if (resolved?.invalidSnapshot || snapshotWasPresent || binding) {
        return { ids: [], invalidSnapshot: true };
      }
    } catch {
      if (binding) return { ids: [], invalidSnapshot: true };
    }

    const artifactTypes = ['proposal', 'design', 'specs', 'tasks'] as const;
    const ids = await Promise.all(
      artifactTypes.map(async (artifactType) => {
        try {
          return (await this.dataManager.artifactExists(changeName, artifactType, scope))
            ? artifactType
            : null;
        } catch {
          return null;
        }
      })
    );
    return {
      ids: ids.filter((id): id is typeof artifactTypes[number] => id !== null),
      invalidSnapshot: false,
    };
  }

  private async buildSetContextPayload(changeName: string, options?: ChangeDetailPanelOptions): Promise<{
    type: 'setContext';
    view: 'changeDetail';
    changeName: string;
    existingArtifactIds?: string[];
    debug?: boolean;
    initialTab?: ChangeDetailTabId;
    interactiveAction?: InteractiveWorkflowAction;
    project?: ProjectContext;
    binding?: OpenSpecRootBinding;
    scope?: {
      id: string;
      label: string;
      source: string;
      rootPath: string;
      storeId?: string;
    };
    workflowSnapshot?: ChangeWorkflowSnapshot;
  }> {
    const debug = vscode.workspace.getConfiguration('openspec').get<boolean>('debug') ?? false;
    const scope = this.resolveScopeForOptions(options);
    const scopeView = this.toScopeView(scope);
    try {
      const workflow = await this.getExistingArtifactIds(
        changeName,
        scope,
        options?.binding,
        options?.workflowSnapshot
      );
      return {
        type: 'setContext',
        view: 'changeDetail',
        changeName,
        existingArtifactIds: workflow.ids,
        debug,
        ...(options?.initialTab !== undefined ? { initialTab: options.initialTab } : {}),
        ...(options?.interactiveAction !== undefined ? { interactiveAction: options.interactiveAction } : {}),
        ...(options?.project ? { project: options.project } : {}),
        ...(options?.binding ? { binding: options.binding } : {}),
        ...(scopeView ? { scope: scopeView } : {}),
        ...(workflow.workflowSnapshot ? { workflowSnapshot: workflow.workflowSnapshot } : {}),
      };
    } catch {
      return {
        type: 'setContext',
        view: 'changeDetail',
        changeName,
        debug,
        ...(options?.initialTab !== undefined ? { initialTab: options.initialTab } : {}),
        ...(options?.interactiveAction !== undefined ? { interactiveAction: options.interactiveAction } : {}),
        ...(options?.project ? { project: options.project } : {}),
        ...(options?.binding ? { binding: options.binding } : {}),
        ...(scopeView ? { scope: scopeView } : {}),
        ...(options?.workflowSnapshot ? { workflowSnapshot: options.workflowSnapshot } : {}),
      };
    }
  }

  public open(
    changeName: string,
    options?: ChangeDetailPanelOptions
  ): void {
    const scope = this.resolveScopeForOptions(options);
    const scopeId = options?.binding
      ? createProjectBoundScope(options.binding, options.project?.label).id
      : scope?.id ?? options?.scopeId;
    const boundOptions: ChangeDetailPanelOptions | undefined = scopeId
      ? { ...options, scopeId }
      : options;
    const key = this.panelKey(changeName, scopeId);
    const boundScope = this.resolveScopeForOptions(boundOptions);
    const panelRootPath = boundScope?.rootPath;
    const existing = this.panels.get(key);
    if (existing) {
      this.panelRootPaths.set(key, panelRootPath);
      this.panelScopes.set(existing.webview, boundScope);
      existing.reveal(vscode.ViewColumn.One);
      this.buildSetContextPayload(changeName, boundOptions).then((payload) =>
        this.panels.get(key) === existing && existing.webview.postMessage(payload)
      );
      if (this.onAfterOpen) {
        this.onAfterOpen();
      }
      return;
    }

    const panelTitle = changeName.startsWith('archive:')
      ? `OpenSpec: ${changeName.slice(8)} (archived)`
      : `OpenSpec: ${changeName}`;
    const panel = vscode.window.createWebviewPanel(
      'openspecChangeDetail',
      panelTitle,
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.file(path.join(this.extensionPath, 'dist')),
        ],
      }
    );

    this.panels.set(key, panel);
    this.panelRootPaths.set(key, panelRootPath);
    this.panelScopes.set(panel.webview, boundScope);
    this.pendingSetContext.set(panel.webview, { changeName, options: boundOptions });

    panel.webview.html = getWebviewContent(panel.webview, this.extensionPath);

    // Proactively send setContext so webview can show ChangeDetail without waiting for first message
    setTimeout(() => {
      this.buildSetContextPayload(changeName, boundOptions).then((payload) =>
        this.panels.get(key) === panel && panel.webview.postMessage(payload)
      );
    }, INITIAL_SET_CONTEXT_DELAY_MS);

    panel.webview.onDidReceiveMessage(
      async (message) => {
        if (message?.type === 'revealSidebar') {
          logger.debug('Panel received revealSidebar');
          this.onRevealSidebar?.();
          return;
        }
        const pending = this.pendingSetContext.get(panel.webview);
        if (pending !== undefined) {
          this.pendingSetContext.delete(panel.webview);
          this.buildSetContextPayload(pending.changeName, pending.options).then((payload) =>
            this.panels.get(key) === panel && panel.webview.postMessage(payload)
          );
        }
        try {
          await handleWebviewMessage(
            message,
            panel.webview,
            this.dataManager,
            this.interactiveTerminalManager,
            this.panelScopes.get(panel.webview)
          );
        } catch (error) {
          logger.error('Error handling panel webview message', error as Error);
        }
      },
      undefined,
      []
    );

    panel.onDidChangeViewState((e) => {
      if (e.webviewPanel.visible && this.onAfterOpen) {
        logger.debug('Change detail panel became visible, calling onAfterOpen');
        this.onAfterOpen();
      }
    });

    panel.onDidDispose(() => {
      this.panels.delete(key);
      this.panelRootPaths.delete(key);
      this.panelScopes.delete(panel.webview);
      this.pendingSetContext.delete(panel.webview);
    });

    if (this.onAfterOpen) {
      this.onAfterOpen();
    }

    logger.info(`Change detail panel opened: ${changeName}`);
  }

  /**
   * Notify an open panel that certain artifact caches should be invalidated.
   * Called by DataManager's onArtifactChanged subscriber when upstream files change.
   */
  public notifyArtifactChanged(changeName: string, artifactTypes: string[], rootPath?: string): void {
    for (const [key, panel] of this.panels) {
      if (!this.keyMatchesChange(key, changeName)) continue;
      const panelRootPath = this.panelRootPaths.get(key);
      if (
        rootPath !== undefined
        && panelRootPath !== undefined
        && path.normalize(panelRootPath) !== path.normalize(rootPath)
      ) continue;
      try {
        panel.webview.postMessage({ type: 'artifactInvalidated', changeName, artifactTypes });
        logger.debug(`Sent artifactInvalidated to panel ${changeName}: ${artifactTypes.join(', ')}`);
      } catch (err) {
        logger.warn(`notifyArtifactChanged: panel ${changeName} may be disposed`, err as Error);
      }
    }
  }

  public postWorkflowLaunchConfig(): void {
    const message = getWorkflowLaunchConfigMessage();
    for (const panel of this.panels.values()) {
      panel.webview.postMessage(message);
    }
  }
}
