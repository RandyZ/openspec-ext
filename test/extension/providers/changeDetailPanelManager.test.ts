import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as vscode from 'vscode';
import { ChangeDetailPanelManager } from '@extension/providers/changeDetailPanelManager';
import { getWorkflowBindingKey } from '@/shared/changeWorkflow';

const { handleWebviewMessageMock } = vi.hoisted(() => ({
  handleWebviewMessageMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@extension/providers/webviewMessageHandler', () => ({
  handleWebviewMessage: handleWebviewMessageMock,
  getWebviewContent: vi.fn(() => '<!doctype html>'),
  getWorkflowLaunchConfigMessage: vi.fn(() => ({
    type: 'workflowLaunchConfig',
    config: {},
  })),
}));

vi.mock('vscode', () => ({
  Uri: {
    file: (fsPath: string) => ({ fsPath }),
  },
  workspace: {
    getConfiguration: vi.fn(() => ({
      get: vi.fn(() => false),
    })),
  },
  env: {
    language: 'en',
  },
  window: {
    createWebviewPanel: vi.fn(),
  },
  ViewColumn: {
    One: 1,
  },
}));

vi.mock('@extension/utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

function createPanel() {
  return {
    webview: {
      html: '',
      cspSource: 'vscode-resource',
      asWebviewUri: vi.fn((uri) => `vscode-resource:${uri.fsPath}`),
      postMessage: vi.fn(),
      onDidReceiveMessage: vi.fn(),
    },
    reveal: vi.fn(),
    onDidChangeViewState: vi.fn(),
    onDidDispose: vi.fn(),
  };
}

describe('ChangeDetailPanelManager scope binding', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  it('keeps same-named change detail panels isolated by scope', async () => {
    const localScope = {
      id: 'local:/workspace',
      label: 'Local Root',
      rootPath: '/workspace',
      source: 'local',
      capabilities: {},
      diagnostics: [],
    };
    const storeScope = {
      id: 'store:team-plans',
      label: 'team-plans',
      rootPath: '/stores/team-plans',
      source: 'store',
      storeId: 'team-plans',
      capabilities: {},
      diagnostics: [],
    };
    const dataManager = {
      resolveScope: vi.fn((scopeId?: string) => {
        if (scopeId === storeScope.id) return storeScope;
        return localScope;
      }),
      getSelectedScope: vi.fn(() => localScope),
      getDashboardData: vi.fn().mockResolvedValue({
        scope: { id: localScope.id },
        changes: [
          {
            name: 'same-change',
            artifacts: [{ id: 'proposal', status: 'done' }],
          },
        ],
        specs: [],
        lastRefresh: 1,
      }),
      artifactExists: vi.fn(async (_changeName: string, artifactType: string, scope?: { id: string }) =>
        scope?.id === storeScope.id && artifactType === 'tasks'
      ),
    };
    const panels = [createPanel(), createPanel()];
    vi.mocked(vscode.window.createWebviewPanel)
      .mockReturnValueOnce(panels[0] as any)
      .mockReturnValueOnce(panels[1] as any);

    const manager = new ChangeDetailPanelManager(dataManager as any, '/ext', {} as any);

    manager.open('same-change', { scopeId: localScope.id });
    manager.open('same-change', { scopeId: storeScope.id });
    await vi.runAllTimersAsync();

    expect(vscode.window.createWebviewPanel).toHaveBeenCalledTimes(2);
    expect(panels[0].webview.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        changeName: 'same-change',
        existingArtifactIds: ['proposal'],
        scope: expect.objectContaining({ id: localScope.id }),
      })
    );
    expect(panels[1].webview.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        changeName: 'same-change',
        existingArtifactIds: ['tasks'],
        scope: expect.objectContaining({ id: storeScope.id }),
      })
    );

    manager.notifyArtifactChanged('same-change', ['tasks']);

    expect(panels[0].webview.postMessage).toHaveBeenCalledWith({
      type: 'artifactInvalidated',
      changeName: 'same-change',
      artifactTypes: ['tasks'],
    });
    expect(panels[1].webview.postMessage).toHaveBeenCalledWith({
      type: 'artifactInvalidated',
      changeName: 'same-change',
      artifactTypes: ['tasks'],
    });
  });

  it('invalidates only the same-named Project-bound panel with the matching root', async () => {
    const project = {
      id: '/projects/current',
      label: 'Current Project',
      projectPath: '/projects/current',
    };
    const bindingA = {
      projectId: project.id,
      commandCwd: project.projectPath,
      rootPath: '/planning/project-a',
      rootSource: 'nearest',
    };
    const bindingB = {
      ...bindingA,
      rootPath: '/planning/project-b',
    };
    const panels = [createPanel(), createPanel()];
    const dataManager = {
      resolveScope: vi.fn(),
      getSelectedScope: vi.fn(),
      getDashboardData: vi.fn().mockResolvedValue({ changes: [], specs: [], lastRefresh: 1 }),
      artifactExists: vi.fn().mockResolvedValue(false),
    };
    vi.mocked(vscode.window.createWebviewPanel)
      .mockReturnValueOnce(panels[0] as any)
      .mockReturnValueOnce(panels[1] as any);

    const manager = new ChangeDetailPanelManager(dataManager as any, '/ext', {} as any);
    manager.open('same-change', { project, binding: bindingA });
    manager.open('same-change', { project, binding: bindingB });
    await vi.runAllTimersAsync();
    panels.forEach((panel) => panel.webview.postMessage.mockClear());

    (manager.notifyArtifactChanged as any)('same-change', ['tasks'], bindingA.rootPath);

    expect(panels[0].webview.postMessage).toHaveBeenCalledWith({
      type: 'artifactInvalidated',
      changeName: 'same-change',
      artifactTypes: ['tasks'],
    });
    expect(panels[1].webview.postMessage).not.toHaveBeenCalled();
  });

  it('does not reuse a Project-bound panel when only rootSource differs', () => {
    const project = {
      id: '/projects/current',
      label: 'Current Project',
      projectPath: '/projects/current',
    };
    const bindingA = {
      projectId: project.id,
      commandCwd: project.projectPath,
      rootPath: '/planning/shared',
      rootSource: 'nearest',
    };
    const bindingB = {
      ...bindingA,
      rootSource: 'global_default',
    };
    const panels = [createPanel(), createPanel()];
    const dataManager = {
      resolveScope: vi.fn(),
      getSelectedScope: vi.fn(),
      getDashboardData: vi.fn().mockResolvedValue({ changes: [], specs: [], lastRefresh: 1 }),
      artifactExists: vi.fn().mockResolvedValue(false),
    };
    vi.mocked(vscode.window.createWebviewPanel)
      .mockReturnValueOnce(panels[0] as any)
      .mockReturnValueOnce(panels[1] as any);

    const manager = new ChangeDetailPanelManager(dataManager as any, '/ext', {} as any);

    manager.open('same-change', { project, binding: bindingA });
    manager.open('same-change', { project, binding: bindingB });

    expect(vscode.window.createWebviewPanel).toHaveBeenCalledTimes(2);
  });

  it('keeps Project-first detail bound when a legacy Store scope is also supplied', async () => {
    const legacyStore = {
      id: 'store:legacy',
      label: 'Legacy Store',
      rootPath: '/stores/legacy',
      source: 'store',
      storeId: 'legacy',
      capabilities: {},
      diagnostics: [],
    };
    const project = {
      id: '/projects/current',
      label: 'Current Project',
      projectPath: '/projects/current',
    };
    const binding = {
      projectId: project.id,
      commandCwd: project.projectPath,
      rootPath: '/planning/current',
      rootSource: 'nearest',
    };
    const panel = createPanel();
    const dataManager = {
      resolveScope: vi.fn().mockReturnValue(legacyStore),
      getSelectedScope: vi.fn().mockReturnValue(legacyStore),
      getDashboardData: vi.fn().mockResolvedValue({
        scope: legacyStore,
        changes: [],
        specs: [],
        lastRefresh: 1,
      }),
      artifactExists: vi.fn().mockResolvedValue(false),
    };
    vi.mocked(vscode.window.createWebviewPanel).mockReturnValue(panel as any);

    const manager = new ChangeDetailPanelManager(dataManager as any, '/ext', {} as any);
    manager.open('same-change', { scopeId: legacyStore.id, project, binding });
    await vi.runAllTimersAsync();

    expect(dataManager.resolveScope).not.toHaveBeenCalled();
    expect(panel.webview.postMessage).toHaveBeenCalledWith(expect.objectContaining({
      project,
      binding,
      scope: expect.objectContaining({
        rootPath: binding.rootPath,
        source: 'declared',
      }),
    }));
  });

  it('passes the host-created Project scope to every consecutive detail operation', async () => {
    const project = {
      id: '/projects/current',
      label: 'Current Project',
      projectPath: '/projects/current',
    };
    const binding = {
      projectId: project.id,
      commandCwd: project.projectPath,
      rootPath: '/planning/current',
      rootSource: 'nearest',
    };
    const selectedScope = {
      id: 'store:selected',
      label: 'Selected Store',
      rootPath: '/stores/selected',
      source: 'store',
      storeId: 'selected',
      capabilities: {},
      diagnostics: [],
    };
    const panel = createPanel();
    const dataManager = {
      resolveScope: vi.fn(),
      getSelectedScope: vi.fn().mockReturnValue(selectedScope),
      getDashboardData: vi.fn().mockResolvedValue({ changes: [], specs: [], lastRefresh: 1 }),
      artifactExists: vi.fn().mockResolvedValue(false),
    };
    vi.mocked(vscode.window.createWebviewPanel).mockReturnValue(panel as any);

    const manager = new ChangeDetailPanelManager(dataManager as any, '/ext', {} as any);
    manager.open('same-change', { project, binding });
    const receiveMessage = vi.mocked(panel.webview.onDidReceiveMessage).mock.calls[0][0];

    await receiveMessage({
      type: 'getArtifactContent',
      changeName: 'same-change',
      artifactType: 'tasks',
      scopeId: selectedScope.id,
    } as any);
    await receiveMessage({
      type: 'toggleTask',
      changeName: 'same-change',
      taskIndex: 0,
      scopeId: selectedScope.id,
    } as any);
    await receiveMessage({
      type: 'launchWorkflowAction',
      action: 'apply',
      changeName: 'same-change',
      scopeId: selectedScope.id,
    } as any);

    expect(handleWebviewMessageMock).toHaveBeenCalledTimes(3);
    expect(handleWebviewMessageMock.mock.calls.map((call) => call[4])).toEqual([
      expect.objectContaining({ rootPath: binding.rootPath }),
      expect.objectContaining({ rootPath: binding.rootPath }),
      expect.objectContaining({ rootPath: binding.rootPath }),
    ]);
    expect(dataManager.resolveScope).not.toHaveBeenCalled();
  });

  it('keeps a legacy scope-only panel bound across consecutive messages', async () => {
    const selectedScope = {
      id: 'store:selected',
      label: 'Selected Store',
      rootPath: '/stores/selected',
      source: 'store',
      storeId: 'selected',
      capabilities: {},
      diagnostics: [],
    };
    const legacyScope = {
      id: 'store:legacy',
      label: 'Legacy Store',
      rootPath: '/stores/legacy',
      source: 'store',
      storeId: 'legacy',
      capabilities: {},
      diagnostics: [],
    };
    const panel = createPanel();
    const dataManager = {
      resolveScope: vi.fn((scopeId?: string) => scopeId === legacyScope.id ? legacyScope : selectedScope),
      getSelectedScope: vi.fn().mockReturnValue(selectedScope),
      getDashboardData: vi.fn().mockResolvedValue({ changes: [], specs: [], lastRefresh: 1 }),
      artifactExists: vi.fn().mockResolvedValue(false),
    };
    vi.mocked(vscode.window.createWebviewPanel).mockReturnValue(panel as any);

    const manager = new ChangeDetailPanelManager(dataManager as any, '/ext', {} as any);
    manager.open('same-change', { scopeId: legacyScope.id });
    const receiveMessage = vi.mocked(panel.webview.onDidReceiveMessage).mock.calls[0][0];

    await receiveMessage({
      type: 'getArtifactContent',
      changeName: 'same-change',
      artifactType: 'tasks',
      scopeId: legacyScope.id,
    } as any);
    await receiveMessage({
      type: 'toggleTask',
      changeName: 'same-change',
      taskIndex: 0,
      scopeId: legacyScope.id,
    } as any);

    expect(handleWebviewMessageMock.mock.calls.slice(-2).map((call) => call[4])).toEqual([
      expect.objectContaining({ id: legacyScope.id, rootPath: legacyScope.rootPath }),
      expect.objectContaining({ id: legacyScope.id, rootPath: legacyScope.rootPath }),
    ]);
  });

  it('propagates only a snapshot whose binding matches the detail panel root', async () => {
    const project = {
      id: '/projects/current',
      label: 'Current Project',
      projectPath: '/projects/current',
    };
    const binding = {
      projectId: project.id,
      commandCwd: project.projectPath,
      rootPath: '/planning/current',
      rootSource: 'nearest',
    };
    const workflowSnapshot = {
      changeName: 'same-change',
      schema: 'custom-schema',
      bindingKey: getWorkflowBindingKey(binding),
      artifacts: [{
        id: 'custom-ready',
        status: 'ready',
        requires: [],
        missingDeps: [],
        outputPath: 'openspec/changes/same-change/custom-ready.md',
        existingOutputPaths: [],
      }],
    };
    const panel = createPanel();
    const dataManager = {
      resolveScope: vi.fn(),
      getSelectedScope: vi.fn(),
      getDashboardData: vi.fn().mockResolvedValue({
        scope: { rootPath: binding.rootPath },
        changes: [{ name: 'same-change', workflowSnapshot }],
        specs: [],
        lastRefresh: 1,
      }),
      artifactExists: vi.fn().mockResolvedValue(false),
    };
    vi.mocked(vscode.window.createWebviewPanel).mockReturnValue(panel as any);

    const manager = new ChangeDetailPanelManager(dataManager as any, '/ext', {} as any);
    manager.open('same-change', { project, binding });
    await vi.runAllTimersAsync();

    expect(panel.webview.postMessage).toHaveBeenCalledWith(expect.objectContaining({ workflowSnapshot }));
  });

  it('uses the project-bound snapshot gateway when legacy dashboard data has no snapshot', async () => {
    const project = {
      id: '/projects/current',
      label: 'Current Project',
      projectPath: '/projects/current',
    };
    const binding = {
      projectId: project.id,
      commandCwd: project.projectPath,
      rootPath: '/planning/current',
      rootSource: 'nearest',
    };
    const workflowSnapshot = {
      changeName: 'same-change',
      schema: 'custom-schema',
      bindingKey: getWorkflowBindingKey(binding),
      artifacts: [{
        id: 'proposal',
        status: 'done',
        requires: [],
        missingDeps: [],
        outputPath: 'openspec/changes/same-change/proposal.md',
        existingOutputPaths: ['/planning/current/openspec/changes/same-change/proposal.md'],
      }],
    };
    const panel = createPanel();
    const dataManager = {
      resolveScope: vi.fn(),
      getSelectedScope: vi.fn(),
      getDashboardData: vi.fn().mockResolvedValue({ changes: [], specs: [], lastRefresh: 1 }),
      getChangeWorkflowSnapshot: vi.fn().mockResolvedValue(workflowSnapshot),
      artifactExists: vi.fn().mockResolvedValue(false),
    };
    vi.mocked(vscode.window.createWebviewPanel).mockReturnValue(panel as any);

    const manager = new ChangeDetailPanelManager(dataManager as any, '/ext', {} as any);
    manager.open('same-change', { project, binding });
    await vi.runAllTimersAsync();

    expect(dataManager.getChangeWorkflowSnapshot).toHaveBeenCalledWith(
      'same-change',
      expect.objectContaining({ rootPath: binding.rootPath }),
      binding,
    );
    expect(panel.webview.postMessage).toHaveBeenCalledWith(expect.objectContaining({ workflowSnapshot }));
  });

  it('does not propagate a same-named snapshot from another root', async () => {
    const project = {
      id: '/projects/current',
      label: 'Current Project',
      projectPath: '/projects/current',
    };
    const binding = {
      projectId: project.id,
      commandCwd: project.projectPath,
      rootPath: '/planning/current',
      rootSource: 'nearest',
    };
    const panel = createPanel();
    const dataManager = {
      resolveScope: vi.fn(),
      getSelectedScope: vi.fn(),
      getDashboardData: vi.fn().mockResolvedValue({
        scope: { rootPath: '/planning/other' },
        changes: [{
          name: 'same-change',
          workflowSnapshot: {
            changeName: 'same-change',
            schema: 'custom-schema',
            bindingKey: getWorkflowBindingKey({ ...binding, rootPath: '/planning/other' }),
            artifacts: [],
          },
        }],
        specs: [],
        lastRefresh: 1,
      }),
      artifactExists: vi.fn().mockResolvedValue(false),
    };
    vi.mocked(vscode.window.createWebviewPanel).mockReturnValue(panel as any);

    const manager = new ChangeDetailPanelManager(dataManager as any, '/ext', {} as any);
    manager.open('same-change', { project, binding });
    await vi.runAllTimersAsync();

    expect(panel.webview.postMessage).toHaveBeenCalledWith(
      expect.not.objectContaining({ workflowSnapshot: expect.anything() })
    );
  });
});
