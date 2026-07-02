import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as vscode from 'vscode';
import { ChangeDetailPanelManager } from '@extension/providers/changeDetailPanelManager';

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
});
