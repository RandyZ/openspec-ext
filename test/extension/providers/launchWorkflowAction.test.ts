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

vi.mock('../../../src/extension/services/workflowLaunchConfig', () => ({
  getWorkflowLaunchConfig: () => ({
    workflowLaunchMode: 'adapter',
    preferredAgentAdapter: 'cursor',
    cursorLaunchMode: 'agentCli',
    cursorAgentModel: 'auto',
    cursorLaunchModeExplicit: true,
    workflowLaunchModeExplicit: false,
    preferredAgentAdapterExplicit: false,
  }),
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

  it('does not post a delivered receipt when launch is deduped', async () => {
    launchWorkflowAgentCommand.mockResolvedValueOnce({
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
  });
});
