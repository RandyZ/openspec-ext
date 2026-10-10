import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as vscode from 'vscode';
import {
  configureAgentLaunchPrefillNotify,
  notifyAgentPrefillLaunchHint,
  resetAgentLaunchPrefillNotifyForTests,
} from '@extension/services/agentLaunchPrefillNotify';

vi.mock('vscode', () => ({
  window: {
    showInformationMessage: vi.fn(async () => undefined),
  },
  commands: {
    executeCommand: vi.fn(),
  },
}));

describe('agentLaunchPrefillNotify', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAgentLaunchPrefillNotifyForTests();
  });

  it('shows hint when not suppressed', async () => {
    configureAgentLaunchPrefillNotify({
      globalState: {
        get: vi.fn(() => false),
        update: vi.fn(),
      },
    } as unknown as vscode.ExtensionContext);

    await notifyAgentPrefillLaunchHint();

    expect(vscode.window.showInformationMessage).toHaveBeenCalled();
  });

  it('shows at most once per extension activation', async () => {
    configureAgentLaunchPrefillNotify({
      globalState: {
        get: vi.fn(() => false),
        update: vi.fn(),
      },
    } as unknown as vscode.ExtensionContext);

    await notifyAgentPrefillLaunchHint();
    await notifyAgentPrefillLaunchHint();

    expect(vscode.window.showInformationMessage).toHaveBeenCalledTimes(1);
  });

  it('skips hint when suppressed in globalState', async () => {
    configureAgentLaunchPrefillNotify({
      globalState: {
        get: vi.fn(() => true),
        update: vi.fn(),
      },
    } as unknown as vscode.ExtensionContext);

    await notifyAgentPrefillLaunchHint();

    expect(vscode.window.showInformationMessage).not.toHaveBeenCalled();
  });
});
