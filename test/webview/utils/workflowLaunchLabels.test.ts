import { beforeEach, describe, expect, it } from 'vitest';
import { setLocale } from '../../../src/i18n';
import {
  getExampleWorkflowCommand,
  getVerifyArchiveDescription,
  getVerifyArchiveHint,
  getWorkflowActionButtonLabel,
  getWorkflowLaunchModeHint,
  type WorkflowLaunchConfigView,
} from '../../../src/webview/utils/workflowLaunchLabels';

const baseConfig: WorkflowLaunchConfigView = {
  workflowLaunchMode: 'clipboard',
  preferredAgentAdapter: 'clipboard',
  cursorLaunchMode: 'clipboard',
  cursorAgentModel: 'auto',
  cursorLaunchModeExplicit: false,
  effectiveAdapterId: null,
};

describe('workflow launch labels', () => {
  beforeEach(() => setLocale('en'));

  it('shows copy-only wording for the safe default configuration', () => {
    expect(getWorkflowActionButtonLabel('Apply', baseConfig)).toBe('Copy Apply');
    expect(getWorkflowLaunchModeHint(baseConfig)).toBe('Copies command');
  });

  it('shows launching state while a workflow action is pending', () => {
    expect(
      getWorkflowActionButtonLabel('Apply', baseConfig, { launching: true }),
    ).toBe('Launching…');
  });

  it('shows Agent CLI wording when Cursor launch mode is explicitly agentCli', () => {
    expect(
      getWorkflowActionButtonLabel('Apply', {
        ...baseConfig,
        workflowLaunchMode: 'adapter',
        preferredAgentAdapter: 'cursor',
        cursorLaunchMode: 'agentCli',
        cursorLaunchModeExplicit: true,
        effectiveAdapterId: 'cursor',
      }),
    ).toBe('Run Agent · Apply');
  });

  it('shows Cursor prompt wording for deeplink routing', () => {
    expect(
      getWorkflowActionButtonLabel('Apply', {
        ...baseConfig,
        workflowLaunchMode: 'adapter',
        preferredAgentAdapter: 'cursor',
        cursorLaunchMode: 'deeplink',
        effectiveAdapterId: 'cursor',
      }),
    ).toBe('Open Agent panel · Apply');
    expect(
      getWorkflowLaunchModeHint({
        ...baseConfig,
        effectiveAdapterId: 'cursor',
        workflowLaunchMode: 'adapter',
        preferredAgentAdapter: 'cursor',
        cursorLaunchMode: 'deeplink',
      }),
    ).toBe('Opens Agent panel');
  });

  it('shows Chat wording for Cursor chat command routing', () => {
    expect(
      getWorkflowActionButtonLabel('Verify', {
        ...baseConfig,
        workflowLaunchMode: 'adapter',
        preferredAgentAdapter: 'cursor',
        cursorLaunchMode: 'chatCommand',
        effectiveAdapterId: 'cursor',
      }),
    ).toBe('Open Chat · Verify');
  });

  it('formats Verify & Archive copy description with IDE-specific command syntax', () => {
    const desc = getVerifyArchiveDescription(baseConfig, { isCursorHost: false });
    expect(desc).toContain('/opsx:verify <change-name>');
    expect(desc).toContain('/opsx:archive <change-name>');
    expect(desc).not.toContain('/opsx-verify');

    const cursorCopy: WorkflowLaunchConfigView = {
      ...baseConfig,
      workflowLaunchMode: 'adapter',
      preferredAgentAdapter: 'cursor',
      cursorLaunchMode: 'clipboard',
      cursorLaunchModeExplicit: true,
      effectiveAdapterId: 'cursor',
    };
    const cursorDesc = getVerifyArchiveDescription(cursorCopy, { isCursorHost: true });
    expect(cursorDesc).toContain('/opsx-verify <change-name>');
    expect(cursorDesc).toContain('/opsx-archive <change-name>');
  });

  it('formats Verify & Archive hints with colon commands for VS Code Chat', () => {
    const config: WorkflowLaunchConfigView = {
      ...baseConfig,
      workflowLaunchMode: 'adapter',
      preferredAgentAdapter: 'vscode-chat',
      effectiveAdapterId: 'vscode-chat',
    };
    expect(getExampleWorkflowCommand('verify', config)).toBe('/opsx:verify <change-name>');
    expect(getVerifyArchiveHint('verify', config, undefined, 'real-change')).toContain('/opsx:verify real-change');
    expect(getVerifyArchiveHint('verify', config)).toContain('Chat');
    expect(getVerifyArchiveHint('verify', config)).not.toContain('/opsx-verify');
  });

  it('shows generic launch wording for non-Cursor adapters', () => {
    expect(
      getWorkflowActionButtonLabel('Apply', {
        ...baseConfig,
        workflowLaunchMode: 'adapter',
        preferredAgentAdapter: 'vscode-copilot',
        cursorLaunchMode: 'clipboard',
        effectiveAdapterId: 'vscode-copilot',
      }),
    ).toBe('Launch · Apply');
    expect(
      getWorkflowLaunchModeHint({
        ...baseConfig,
        workflowLaunchMode: 'adapter',
        preferredAgentAdapter: 'vscode-copilot',
        cursorLaunchMode: 'clipboard',
        effectiveAdapterId: 'vscode-copilot',
      }),
    ).toBe('Launch via adapter');
  });
});
