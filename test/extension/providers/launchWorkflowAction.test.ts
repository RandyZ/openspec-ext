import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as vscode from 'vscode';
import { processLaunchWorkflowAction } from '../../../src/extension/providers/launchWorkflowAction';
import { getWorkflowBindingKey } from '../../../src/shared/changeWorkflow';

const launchWorkflowAgentCommand = vi.fn();
const notifyWorkflowLaunchFailure = vi.fn();

vi.mock('../../../src/extension/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../../src/extension/utils/workspaceFolders', () => ({
  isPathInWorkspaceFolders: () => true,
}));

const getWorkflowLaunchConfigMock = vi.fn(() => ({
  workflowLaunchMode: 'adapter' as const,
  preferredAgentAdapter: 'cursor' as const,
  cursorLaunchMode: 'agentCli' as const,
  cursorAgentModel: 'auto',
  cursorLaunchModeExplicit: true,
  workflowLaunchModeExplicit: false,
  preferredAgentAdapterExplicit: false,
}));

vi.mock('../../../src/extension/services/workflowLaunchConfig', () => ({
  getWorkflowLaunchConfig: () => getWorkflowLaunchConfigMock(),
}));

vi.mock('../../../src/extension/services/workflowAgentLaunch', () => ({
  launchWorkflowAgentCommand: (...args: unknown[]) => launchWorkflowAgentCommand(...args),
  notifyWorkflowLaunchFailure: (...args: unknown[]) => notifyWorkflowLaunchFailure(...args),
}));

vi.mock('../../../src/extension/services/workflowWebviewRegistry', () => ({
  broadcastWorkflowActionReceipt: vi.fn(),
}));

describe('processLaunchWorkflowAction', () => {
  const binding = {
    projectId: 'ws2',
    commandCwd: '/workspace/fixtures/ws2',
    rootPath: '/workspace/fixtures/ws2',
    rootSource: 'declared' as const,
  };
  const bindingKey = getWorkflowBindingKey(binding);
  const webview = { postMessage: vi.fn() } as unknown as vscode.Webview;

  beforeEach(() => {
    vi.clearAllMocks();
    launchWorkflowAgentCommand
      .mockResolvedValueOnce({
        success: false,
        message: 'spawn agent ENOENT',
        target: 'agentCli',
        layer: 'agentCli',
        command: '/opsx-apply x',
      })
      .mockResolvedValueOnce({
        success: true,
        target: 'agentPanel',
        layer: 'composerCreateNew',
        outcome: 'prefilled',
        command: '/opsx-apply x',
      });
  });

  it('re-enters the launch pipeline when Retry is chosen after failure', async () => {
    const dataManager = {
      resolveScope: () => ({
        id: 'scope-1',
        label: 'ws2',
        rootPath: binding.rootPath,
        source: 'declared',
        workflowBinding: binding,
        runtimeSource: 'installed',
        capabilities: { stores: false, context: false, doctor: false, worksets: false, diagnostics: [] },
        diagnostics: [],
      }),
    } as unknown as import('../../../src/extension/services/dataManager').DataManager;

    await processLaunchWorkflowAction({
      webview,
      dataManager,
      action: 'apply',
      changeName: 'ws2-add-beta',
      requestId: 'req-retry',
      bindingKey,
    });

    expect(notifyWorkflowLaunchFailure).toHaveBeenCalledTimes(1);
    expect(launchWorkflowAgentCommand).toHaveBeenCalledTimes(1);
    const retry = notifyWorkflowLaunchFailure.mock.calls[0]?.[1];
    expect(retry).toBeTypeOf('function');
    await retry?.();
    expect(launchWorkflowAgentCommand).toHaveBeenCalledTimes(2);
    const posts = vi.mocked(webview.postMessage).mock.calls.map((call) => call[0]);
    expect(posts.some((msg) => msg.status === 'running')).toBe(true);
    expect(posts.filter((msg) => msg.status === 'failed').length).toBeGreaterThanOrEqual(1);
  });

  it('posts a suppressed completed receipt when launch is deduped so pending UI clears', async () => {
    launchWorkflowAgentCommand.mockReset();
    launchWorkflowAgentCommand.mockResolvedValue({
      success: true,
      outcome: 'deduped',
      target: 'agentCli',
      command: '/opsx-apply x',
    });
    const dataManager = {
      resolveScope: () => ({
        id: 'scope-1',
        label: 'ws2',
        rootPath: binding.rootPath,
        source: 'declared',
        workflowBinding: binding,
        runtimeSource: 'installed',
        capabilities: { stores: false, context: false, doctor: false, worksets: false, diagnostics: [] },
        diagnostics: [],
      }),
      getChangeWorkflowSnapshot: async () => ({ bindingKey }),
    } as unknown as import('../../../src/extension/services/dataManager').DataManager;

    await processLaunchWorkflowAction({
      webview,
      dataManager,
      action: 'apply',
      changeName: 'ws2-add-beta',
      requestId: 'req-dedup',
      bindingKey,
    });

    const posts = vi.mocked(webview.postMessage).mock.calls.map((call) => call[0]);
    expect(posts.some((msg) => msg.status === 'delivered')).toBe(false);
    expect(posts.some((msg) => msg.status === 'running')).toBe(true);
    const completed = posts.find((msg) => msg.status === 'completed');
    expect(completed).toBeDefined();
    expect(completed?.suppressPriorityAttention).toBe(true);
  });

  it('does not post running or status-bar launching for copy-only workflow mode', async () => {
    getWorkflowLaunchConfigMock.mockImplementation(() => ({
      workflowLaunchMode: 'clipboard',
      preferredAgentAdapter: 'clipboard',
      cursorLaunchMode: 'clipboard',
      cursorAgentModel: 'auto',
      cursorLaunchModeExplicit: false,
      workflowLaunchModeExplicit: true,
      preferredAgentAdapterExplicit: false,
    }));
    launchWorkflowAgentCommand.mockReset();
    launchWorkflowAgentCommand.mockResolvedValue({
      success: true,
      outcome: 'copied',
      target: 'clipboard',
      command: '/opsx:apply x',
    });
    const dataManager = {
      resolveScope: () => ({
        id: 'scope-1',
        label: 'ws2',
        rootPath: binding.rootPath,
        source: 'declared',
        workflowBinding: binding,
        runtimeSource: 'installed',
        capabilities: { stores: false, context: false, doctor: false, worksets: false, diagnostics: [] },
        diagnostics: [],
      }),
      getChangeWorkflowSnapshot: async () => ({ bindingKey }),
    } as unknown as import('../../../src/extension/services/dataManager').DataManager;

    await processLaunchWorkflowAction({
      webview,
      dataManager,
      action: 'apply',
      changeName: 'ws2-add-beta',
      requestId: 'req-copy',
      bindingKey,
    });

    const posts = vi.mocked(webview.postMessage).mock.calls.map((call) => call[0]);
    expect(posts.some((msg) => msg.status === 'running')).toBe(false);
    expect(posts.some((msg) => msg.status === 'copied')).toBe(true);

    getWorkflowLaunchConfigMock.mockImplementation(() => ({
      workflowLaunchMode: 'adapter' as const,
      preferredAgentAdapter: 'cursor' as const,
      cursorLaunchMode: 'agentCli' as const,
      cursorAgentModel: 'auto',
      cursorLaunchModeExplicit: true,
      workflowLaunchModeExplicit: false,
      preferredAgentAdapterExplicit: false,
    }));
  });
});
