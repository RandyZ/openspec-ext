import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  getWebviewContent,
  handleAgentUnavailableMessage,
  postAgentUnavailableContext,
} from '@extension/providers/webviewMessageHandler';

vi.mock('vscode', () => ({
  env: {
    language: 'en',
    clipboard: { writeText: vi.fn() },
    openExternal: vi.fn(),
  },
  window: {
    showInformationMessage: vi.fn(),
  },
  Uri: {
    file: vi.fn((fsPath: string) => ({ fsPath })),
    parse: vi.fn((value: string) => ({ fsPath: value })),
  },
}));

vi.mock('@extension/utils/logger', () => ({
  logger: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

vi.mock('@extension/services/workflowLaunchConfig', () => ({
  getWorkflowLaunchConfig: vi.fn(() => ({
    workflowLaunchMode: 'clipboard',
    preferredAgentAdapter: 'clipboard',
    cursorLaunchMode: 'clipboard',
    cursorAgentModel: 'auto',
    cursorLaunchModeExplicit: false,
  })),
}));

describe('agent unavailable webview handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('posts agent unavailable context for getDashboardData', async () => {
    const messages: unknown[] = [];
    const webview = { postMessage: vi.fn((msg) => messages.push(msg)) };

    await handleAgentUnavailableMessage(
      webview as never,
      { type: 'getDashboardData' },
      '/tmp/ws-b-empty',
    );

    expect(messages).toEqual([
      {
        type: 'setContext',
        view: 'agentUnavailable',
        workspacePath: '/tmp/ws-b-empty',
      },
      expect.objectContaining({ type: 'workflowLaunchConfig' }),
    ]);
  });

  it('posts agent unavailable context for webviewReady', async () => {
    const messages: unknown[] = [];
    const webview = { postMessage: vi.fn((msg) => messages.push(msg)) };

    await handleAgentUnavailableMessage(
      webview as never,
      { type: 'webviewReady' },
    );

    expect(messages[0]).toEqual({
      type: 'setContext',
      view: 'agentUnavailable',
    });
  });

  it('embeds bootstrap attributes in webview HTML', () => {
    const webview = {
      asWebviewUri: vi.fn((uri: { fsPath: string }) => `vscode-webview://${uri.fsPath}`),
      cspSource: 'vscode-webview:',
    };

    const html = getWebviewContent(webview as never, '/ext', {
      view: 'agentUnavailable',
      workspacePath: '/tmp/ws-b',
    });

    expect(html).toContain('data-openspec-view="agentUnavailable"');
    expect(html).toContain('data-workspace-path="/tmp/ws-b"');
  });

  it('postAgentUnavailableContext includes workflow launch config', () => {
    const messages: unknown[] = [];
    const webview = { postMessage: vi.fn((msg) => messages.push(msg)) };

    postAgentUnavailableContext(webview as never, '/tmp/ws');

    expect(messages).toHaveLength(2);
    expect(messages[0]).toMatchObject({ type: 'setContext', view: 'agentUnavailable' });
    expect(messages[1]).toMatchObject({ type: 'workflowLaunchConfig' });
  });
});
