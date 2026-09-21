import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as vscode from 'vscode';
import {
  getCursorAgentModel,
  getWorkflowLaunchConfig,
} from '@extension/services/workflowLaunchConfig';

vi.mock('vscode', () => ({
  workspace: {
    getConfiguration: vi.fn(),
  },
  env: {
    appName: 'Visual Studio Code',
  },
}));

const getConfiguration = vi.mocked(vscode.workspace.getConfiguration);

function mockConfig(values: Record<string, unknown>) {
  getConfiguration.mockReturnValue({
    get: vi.fn((key: string) => values[key]),
    inspect: vi.fn((key: string) => {
      if (key === 'cursorLaunchMode' && values.__explicitCursorLaunchMode === true) {
        return { globalValue: values.cursorLaunchMode };
      }
      return undefined;
    }),
  } as any);
}

describe('workflow launch config', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses copy-only defaults when settings are missing on non-Cursor hosts', () => {
    vi.mocked(vscode.env).appName = 'Visual Studio Code';
    mockConfig({});

    expect(getWorkflowLaunchConfig()).toEqual({
      workflowLaunchMode: 'clipboard',
      preferredAgentAdapter: 'clipboard',
      cursorLaunchMode: 'clipboard',
      cursorAgentModel: 'auto',
      cursorLaunchModeExplicit: false,
    });
  });

  it('defaults Cursor hosts to launch mode with deeplink when settings are missing', () => {
    vi.mocked(vscode.env).appName = 'Cursor';
    mockConfig({});

    expect(getWorkflowLaunchConfig()).toEqual({
      workflowLaunchMode: 'adapter',
      preferredAgentAdapter: 'cursor',
      cursorLaunchMode: 'deeplink',
      cursorAgentModel: 'auto',
      cursorLaunchModeExplicit: false,
    });
  });

  it('normalizes invalid enum values back to safe defaults', () => {
    vi.mocked(vscode.env).appName = 'Visual Studio Code';
    mockConfig({
      workflowLaunchMode: 'run-everything',
      preferredAgentAdapter: 'unknown',
      cursorLaunchMode: 'magic',
      cursorAgentModel: '',
    });

    expect(getWorkflowLaunchConfig()).toEqual({
      workflowLaunchMode: 'clipboard',
      preferredAgentAdapter: 'clipboard',
      cursorLaunchMode: 'clipboard',
      cursorAgentModel: 'auto',
      cursorLaunchModeExplicit: false,
    });
  });

  it('reads supported launch settings', () => {
    mockConfig({
      workflowLaunchMode: 'adapter',
      preferredAgentAdapter: 'cursor',
      cursorLaunchMode: 'agentCli',
      cursorAgentModel: 'composer-1',
      __explicitCursorLaunchMode: true,
    });

    expect(getWorkflowLaunchConfig()).toEqual({
      workflowLaunchMode: 'adapter',
      preferredAgentAdapter: 'cursor',
      cursorLaunchMode: 'agentCli',
      cursorAgentModel: 'composer-1',
      cursorLaunchModeExplicit: true,
    });
  });

  it('detects explicit Cursor launch mode even when workflow launch mode remains safe default', () => {
    mockConfig({
      cursorLaunchMode: 'agentCli',
      __explicitCursorLaunchMode: true,
    });

    expect(getWorkflowLaunchConfig()).toMatchObject({
      workflowLaunchMode: 'clipboard',
      preferredAgentAdapter: 'clipboard',
      cursorLaunchMode: 'agentCli',
      cursorLaunchModeExplicit: true,
    });
  });

  it('falls back to legacy agentModel for Cursor CLI model', () => {
    mockConfig({
      agentModel: 'legacy-model',
    });

    expect(getCursorAgentModel()).toBe('legacy-model');
  });
});
