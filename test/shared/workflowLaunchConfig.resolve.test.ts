import { describe, expect, it } from 'vitest';
import {
  getEffectiveWorkflowAdapterId,
  resolveWorkflowLaunchConfig,
  type WorkflowLaunchConfigWithExplicit,
} from '../../src/shared/workflowLaunchConfig';

const baseConfig: WorkflowLaunchConfigWithExplicit = {
  workflowLaunchMode: 'clipboard',
  preferredAgentAdapter: 'clipboard',
  cursorLaunchMode: 'clipboard',
  cursorAgentModel: 'auto',
  cursorLaunchModeExplicit: false,
  workflowLaunchModeExplicit: false,
  preferredAgentAdapterExplicit: false,
};

describe('resolveWorkflowLaunchConfig', () => {
  it('defaults Cursor hosts to launch mode with deeplink when settings are unset', () => {
    const resolved = resolveWorkflowLaunchConfig(baseConfig, { isCursorHost: true });

    expect(resolved).toMatchObject({
      workflowLaunchMode: 'adapter',
      preferredAgentAdapter: 'cursor',
      cursorLaunchMode: 'deeplink',
    });
    expect(getEffectiveWorkflowAdapterId(resolved)).toBe('cursor');
  });

  it('keeps copy-only defaults on non-Cursor hosts', () => {
    const resolved = resolveWorkflowLaunchConfig(baseConfig, { isCursorHost: false });

    expect(resolved).toMatchObject({
      workflowLaunchMode: 'clipboard',
      preferredAgentAdapter: 'clipboard',
      cursorLaunchMode: 'clipboard',
    });
    expect(getEffectiveWorkflowAdapterId(resolved)).toBe('clipboard');
  });

  it('respects explicit copy-only workflow launch mode on Cursor', () => {
    const resolved = resolveWorkflowLaunchConfig(
      {
        ...baseConfig,
        workflowLaunchModeExplicit: true,
      },
      { isCursorHost: true },
    );

    expect(resolved.workflowLaunchMode).toBe('clipboard');
    expect(getEffectiveWorkflowAdapterId(resolved)).toBe('clipboard');
  });

  it('never smart-defaults agentCli; only explicit cursorLaunchMode may select it', () => {
    const resolved = resolveWorkflowLaunchConfig(baseConfig, { isCursorHost: true });

    expect(resolved.cursorLaunchMode).toBe('deeplink');

    const explicitAgentCli = resolveWorkflowLaunchConfig(
      {
        ...baseConfig,
        cursorLaunchMode: 'agentCli',
        cursorLaunchModeExplicit: true,
      },
      { isCursorHost: true },
    );

    expect(explicitAgentCli.cursorLaunchMode).toBe('agentCli');
  });

  it('preserves non-clipboard cursor launch modes set in configuration reads', () => {
    const resolved = resolveWorkflowLaunchConfig(
      {
        ...baseConfig,
        workflowLaunchMode: 'adapter',
        preferredAgentAdapter: 'cursor',
        cursorLaunchMode: 'chatCommand',
      },
      { isCursorHost: true },
    );

    expect(resolved.cursorLaunchMode).toBe('chatCommand');
  });

  it('treats explicit clipboard executor as copy-only even with explicit cursor launch mode', () => {
    const resolved = resolveWorkflowLaunchConfig(
      {
        ...baseConfig,
        workflowLaunchMode: 'adapter',
        preferredAgentAdapter: 'clipboard',
        preferredAgentAdapterExplicit: true,
        cursorLaunchMode: 'deeplink',
        cursorLaunchModeExplicit: true,
      },
      { isCursorHost: true },
    );

    expect(getEffectiveWorkflowAdapterId(resolved)).toBe('clipboard');
  });

  it('preserves explicit adapter selections', () => {
    const resolved = resolveWorkflowLaunchConfig(
      {
        ...baseConfig,
        workflowLaunchMode: 'adapter',
        workflowLaunchModeExplicit: true,
        preferredAgentAdapter: 'vscode-copilot',
        preferredAgentAdapterExplicit: true,
        cursorLaunchMode: 'chatCommand',
        cursorLaunchModeExplicit: true,
      },
      { isCursorHost: true },
    );

    expect(resolved).toMatchObject({
      workflowLaunchMode: 'adapter',
      preferredAgentAdapter: 'vscode-copilot',
      cursorLaunchMode: 'chatCommand',
    });
  });
});
