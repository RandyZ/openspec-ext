import { describe, it, expect, vi, beforeEach } from 'vitest';
import { spawn } from 'child_process';
import { handleWebviewMessage } from '@extension/providers/webviewMessageHandler';
import { createProjectBoundScope } from '@extension/providers/changeDetailPanelManager';
import { OpenSpecCliService } from '@extension/services/openspecCli';
import { getWorkflowBindingKey } from '@/shared/changeWorkflow';
import { launchWorkflowAgentCommand, resetWorkflowLaunchDedupeForTests } from '@extension/services/workflowAgentLaunch';

vi.mock('@extension/services/workflowAgentLaunch', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@extension/services/workflowAgentLaunch')>();
  return {
    ...actual,
    launchWorkflowAgentCommand: vi.fn(actual.launchWorkflowAgentCommand),
  };
});

vi.mock('vscode', () => ({
  workspace: {
    getConfiguration: vi.fn(() => ({
      get: vi.fn((_key: string, defaultValue?: unknown) => defaultValue),
    })),
  },
  window: {
    showInformationMessage: vi.fn(() => Promise.resolve()),
    showWarningMessage: vi.fn(() => Promise.resolve()),
    showErrorMessage: vi.fn(() => Promise.resolve()),
    createOutputChannel: () => ({
      appendLine: vi.fn(),
      show: vi.fn(),
      dispose: vi.fn(),
    }),
  },
  env: {
    clipboard: { writeText: vi.fn(() => Promise.resolve()) },
    openExternal: vi.fn(() => Promise.resolve(true)),
    uriScheme: 'cursor',
    appName: 'Cursor',
  },
  commands: {
    getCommands: vi.fn(() => Promise.resolve(['composer.createNew'])),
    executeCommand: vi.fn(() => Promise.resolve()),
  },
}));

vi.mock('@extension/utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock('child_process', () => ({
  spawn: vi.fn(),
}));

function mockSpawnSequence(responses: string[]) {
  let index = 0;
  vi.mocked(spawn).mockImplementation(() => {
    const stdout = responses[Math.min(index, responses.length - 1)] ?? '{}';
    index += 1;
    const proc = {
      stdout: {
        on: (_e: string, fn: (d: Buffer) => void) => {
          setImmediate(() => fn(Buffer.from(stdout)));
        },
      },
      stderr: { on: vi.fn() },
      on: (_e: string, fn: (...args: unknown[]) => void) => {
        if (_e === 'close') setImmediate(() => fn(0));
      },
      kill: vi.fn(),
    };
    return proc as never;
  });
}

describe('workflow binding launch (nearest rootSource)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetWorkflowLaunchDedupeForTests();
    vi.mocked(launchWorkflowAgentCommand).mockResolvedValue({
      success: true,
      command: '/opsx-verify demo-nearest',
      target: 'agentPanel',
      layer: 'composerCreateNew',
      outcome: 'started',
    });
  });

  it('uses real snapshot bindingKey and launches when project scope carries workflowBinding', async () => {
    const binding = {
      projectId: '/projects/demo',
      commandCwd: '/projects/demo',
      rootPath: '/projects/demo/planning',
      rootSource: 'nearest',
    };
    const scope = createProjectBoundScope(binding, 'Demo');
    const bindingKey = getWorkflowBindingKey(binding);
    const changeName = 'demo-nearest';

    mockSpawnSequence([
      JSON.stringify({ changes: [{ name: changeName, completedTasks: 0, totalTasks: 0 }] }),
      JSON.stringify({
        schema: 'spec-driven',
        artifacts: [{ id: 'proposal', status: 'done', requires: [], missingDeps: [] }],
      }),
    ]);

    const cli = new OpenSpecCliService(binding.rootPath);
    const dataManager = {
      getWorkspaceRoot: () => binding.rootPath,
      async getChangeWorkflowSnapshot(
        name: string,
        scoped?: typeof scope,
        workflowBinding?: typeof binding,
      ) {
        return (await cli.listChanges(scoped, workflowBinding))
          .find((change) => change.name === name)
          ?.workflowSnapshot;
      },
    };

    const webview = { postMessage: vi.fn() };
    await handleWebviewMessage(
      {
        type: 'launchWorkflowAction',
        action: 'verify',
        changeName,
        requestId: 'req-nearest-1',
        bindingKey,
      },
      webview as never,
      dataManager as never,
      undefined,
      scope,
    );

    expect(launchWorkflowAgentCommand).toHaveBeenCalledWith({
      action: 'verify',
      changeName,
      workspaceRoot: binding.rootPath,
    });
    expect(webview.postMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: 'workflowActionReceipt',
      status: 'delivered',
      bindingKey,
    }));
  });

  it('recovers binding from bindingKey when scope lacks workflowBinding', async () => {
    const binding = {
      projectId: '/projects/demo',
      commandCwd: '/projects/demo',
      rootPath: '/projects/demo/planning',
      rootSource: 'nearest',
    };
    const bindingKey = getWorkflowBindingKey(binding);
    const changeName = 'demo-parse-key';
    const scope = {
      id: 'local',
      label: 'Local',
      rootPath: binding.rootPath,
      source: 'declared',
      runtimeSource: 'installed' as const,
      capabilities: {
        stores: false,
        context: false,
        doctor: false,
        worksets: false,
        diagnostics: [],
      },
      diagnostics: [],
    };

    mockSpawnSequence([
      JSON.stringify({ changes: [{ name: changeName, completedTasks: 0, totalTasks: 0 }] }),
      JSON.stringify({
        schema: 'spec-driven',
        artifacts: [{ id: 'proposal', status: 'done', requires: [], missingDeps: [] }],
      }),
    ]);

    const cli = new OpenSpecCliService(binding.rootPath);
    const dataManager = {
      getWorkspaceRoot: () => binding.rootPath,
      async getChangeWorkflowSnapshot(
        name: string,
        scoped?: typeof scope,
        workflowBinding?: typeof binding,
      ) {
        return (await cli.listChanges(scoped, workflowBinding))
          .find((change) => change.name === name)
          ?.workflowSnapshot;
      },
    };

    const webview = { postMessage: vi.fn() };
    await handleWebviewMessage(
      {
        type: 'launchWorkflowAction',
        action: 'apply',
        changeName,
        requestId: 'req-parse-key',
        bindingKey,
      },
      webview as never,
      dataManager as never,
    );

    expect(launchWorkflowAgentCommand).toHaveBeenCalled();
  });
});
