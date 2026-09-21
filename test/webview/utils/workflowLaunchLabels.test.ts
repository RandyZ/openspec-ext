import { beforeEach, describe, expect, it } from 'vitest';
import { setLocale } from '../../../src/i18n';
import {
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
    ).toBe('Open Cursor · Apply');
    expect(
      getWorkflowLaunchModeHint({
        ...baseConfig,
        effectiveAdapterId: 'cursor',
        workflowLaunchMode: 'adapter',
        preferredAgentAdapter: 'cursor',
        cursorLaunchMode: 'deeplink',
      }),
    ).toBe('Runs in Cursor');
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

  it('shows generic launch wording for non-Cursor adapters', () => {
    expect(
      getWorkflowActionButtonLabel('Apply', {
        ...baseConfig,
        workflowLaunchMode: 'adapter',
        preferredAgentAdapter: 'vscode-copilot',
        effectiveAdapterId: 'vscode-copilot',
      }),
    ).toBe('Launch · Apply');
    expect(
      getWorkflowLaunchModeHint({
        ...baseConfig,
        workflowLaunchMode: 'adapter',
        preferredAgentAdapter: 'vscode-copilot',
        effectiveAdapterId: 'vscode-copilot',
      }),
    ).toBe('Launch via adapter');
  });
});
