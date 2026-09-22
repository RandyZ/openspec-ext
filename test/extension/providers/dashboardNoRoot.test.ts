import { describe, expect, it, vi, beforeEach } from 'vitest';
import { DashboardViewProvider } from '@extension/providers/dashboardViewProvider';

const configureAgentUnavailableWebview = vi.hoisted(() => vi.fn());

vi.mock('@extension/providers/agentUnavailableWebview', () => ({
  configureAgentUnavailableWebview,
}));

vi.mock('@extension/services/openspecRootGate', () => ({
  workspaceHasOpenSpecRoot: vi.fn(async () => false),
  workspaceHasOpenSpecRootSync: vi.fn(() => false),
  getPrimaryWorkspacePath: vi.fn(() => '/tmp/ws-b-empty'),
}));

vi.mock('@extension/utils/logger', () => ({
  logger: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

describe('DashboardViewProvider without OpenSpec root', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('configures agent unavailable webview instead of loading dashboard data', () => {
    const provider = new DashboardViewProvider(
      {
        onRefresh: vi.fn(() => ({ dispose: vi.fn() })),
      } as never,
      '/ext',
    );
    const webview = {
      options: {},
      html: '',
      onDidReceiveMessage: vi.fn(),
      postMessage: vi.fn(),
    };
    const webviewView = {
      webview,
      onDidDispose: vi.fn((cb: () => void) => ({ dispose: cb })),
    };

    provider.resolveWebviewView(webviewView as never, {} as never, {} as never);

    expect(configureAgentUnavailableWebview).toHaveBeenCalledWith(
      webview,
      '/ext',
      '/tmp/ws-b-empty',
    );
    expect(webview.html).toBe('');
  });
});
