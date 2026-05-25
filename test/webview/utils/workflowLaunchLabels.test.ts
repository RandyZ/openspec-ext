import { describe, expect, it } from 'vitest';
import {
  getWorkflowActionButtonLabel,
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
  it('shows copy-only wording for the safe default configuration', () => {
    expect(getWorkflowActionButtonLabel('Apply', baseConfig)).toBe('Copy Apply');
  });

  it('shows Agent CLI wording when Cursor launch mode is explicitly agentCli', () => {
    expect(
      getWorkflowActionButtonLabel('Apply', {
        ...baseConfig,
        cursorLaunchMode: 'agentCli',
        cursorLaunchModeExplicit: true,
        effectiveAdapterId: 'cursor',
      })
    ).toBe('Run Agent Apply');
  });

  it('shows Cursor prompt wording for deeplink routing', () => {
    expect(
      getWorkflowActionButtonLabel('Apply', {
        ...baseConfig,
        workflowLaunchMode: 'adapter',
        preferredAgentAdapter: 'cursor',
        cursorLaunchMode: 'deeplink',
        effectiveAdapterId: 'cursor',
      })
    ).toBe('Open Cursor Apply');
  });

  it('shows Chat wording for Cursor chat command routing', () => {
    expect(
      getWorkflowActionButtonLabel('Verify', {
        ...baseConfig,
        workflowLaunchMode: 'adapter',
        preferredAgentAdapter: 'cursor',
        cursorLaunchMode: 'chatCommand',
        effectiveAdapterId: 'cursor',
      })
    ).toBe('Open Chat Verify');
  });
});
