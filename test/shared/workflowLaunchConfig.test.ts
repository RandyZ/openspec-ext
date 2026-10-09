import { describe, expect, it } from 'vitest';
import {
  isCopyOnlyWorkflowMode,
  resolveWorkflowLaunchConfig,
  resolveWorkflowLabelLaunchConfig,
  shouldUseAgentWorkflowLabels,
  toWorkflowLaunchConfigView,
  type WorkflowLaunchConfigWithExplicit,
} from '../../src/shared/workflowLaunchConfig';

const packageDefaults: WorkflowLaunchConfigWithExplicit = {
  workflowLaunchMode: 'clipboard',
  preferredAgentAdapter: 'clipboard',
  cursorLaunchMode: 'clipboard',
  cursorAgentModel: 'auto',
  cursorLaunchModeExplicit: false,
  workflowLaunchModeExplicit: false,
  preferredAgentAdapterExplicit: false,
};

describe('workflow launch label intent', () => {
  it('uses agent labels for adapter mode with non-clipboard preferred adapter', () => {
    const config = toWorkflowLaunchConfigView({
      workflowLaunchMode: 'adapter',
      preferredAgentAdapter: 'cursor',
      cursorLaunchMode: 'deeplink',
      cursorAgentModel: 'auto',
      cursorLaunchModeExplicit: false,
    });
    expect(shouldUseAgentWorkflowLabels(config)).toBe(true);
  });

  it('returns true for clipboard mode copy-only checks', () => {
    const config = toWorkflowLaunchConfigView({
      workflowLaunchMode: 'clipboard',
      preferredAgentAdapter: 'clipboard',
      cursorLaunchMode: 'clipboard',
      cursorAgentModel: 'auto',
      cursorLaunchModeExplicit: false,
    });
    expect(isCopyOnlyWorkflowMode(config)).toBe(true);
    expect(shouldUseAgentWorkflowLabels(config)).toBe(false);
  });
});

describe('copy-only vs implicit cursorLaunchMode=clipboard (regression .17)', () => {
  it('VS Code adapter + vscode-chat with package-default cursorLaunchMode is not copy-only', () => {
    const view = toWorkflowLaunchConfigView(
      resolveWorkflowLaunchConfig(
        {
          ...packageDefaults,
          workflowLaunchMode: 'adapter',
          preferredAgentAdapter: 'vscode-chat',
        },
        { isCursorHost: false },
      ),
    );
    expect(view.cursorLaunchMode).toBe('clipboard');
    expect(view.effectiveAdapterId).toBe('vscode-chat');
    expect(isCopyOnlyWorkflowMode(view)).toBe(false);
    expect(shouldUseAgentWorkflowLabels(view)).toBe(true);
  });

  it('Cursor package defaults resolve agentPanel and are not copy-only', () => {
    const view = toWorkflowLaunchConfigView(
      resolveWorkflowLaunchConfig(packageDefaults, { isCursorHost: true }),
    );
    expect(view.cursorLaunchMode).toBe('agentPanel');
    expect(view.effectiveAdapterId).toBe('cursor');
    expect(isCopyOnlyWorkflowMode(view)).toBe(false);
  });

  it('explicit cursorLaunchMode=clipboard on Cursor is copy-only', () => {
    const view = toWorkflowLaunchConfigView(
      resolveWorkflowLaunchConfig(
        {
          ...packageDefaults,
          workflowLaunchMode: 'adapter',
          preferredAgentAdapter: 'cursor',
          cursorLaunchMode: 'clipboard',
          cursorLaunchModeExplicit: true,
        },
        { isCursorHost: true },
      ),
    );
    expect(isCopyOnlyWorkflowMode(view)).toBe(true);
    expect(shouldUseAgentWorkflowLabels(view)).toBe(false);
  });

  it('explicit cursorLaunchMode=clipboard with vscode-chat adapter is not copy-only', () => {
    const view = toWorkflowLaunchConfigView(
      resolveWorkflowLaunchConfig(
        {
          ...packageDefaults,
          workflowLaunchMode: 'adapter',
          preferredAgentAdapter: 'vscode-chat',
          preferredAgentAdapterExplicit: true,
          cursorLaunchMode: 'clipboard',
          cursorLaunchModeExplicit: true,
        },
        { isCursorHost: false },
      ),
    );
    expect(isCopyOnlyWorkflowMode(view)).toBe(false);
    expect(shouldUseAgentWorkflowLabels(view)).toBe(true);
  });

  it('keeps host agentAutoSubmit when resolving label launch config', () => {
    const host = toWorkflowLaunchConfigView({
      workflowLaunchMode: 'adapter',
      preferredAgentAdapter: 'cursor',
      cursorLaunchMode: 'agentPanel',
      cursorAgentModel: 'auto',
      cursorLaunchModeExplicit: false,
    });
    const ui = { ...host, agentAutoSubmit: 'readOnly' as const };
    const hostNever = { ...host, agentAutoSubmit: 'never' as const };
    expect(resolveWorkflowLabelLaunchConfig(hostNever, ui).agentAutoSubmit).toBe('never');
  });
});
