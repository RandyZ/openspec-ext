import { describe, expect, it } from 'vitest';
import { shouldUseAgentWorkflowLabels, toWorkflowLaunchConfigView } from '../../src/shared/workflowLaunchConfig';

describe('shouldUseAgentWorkflowLabels', () => {
  it('returns false when cursorLaunchMode is explicit clipboard on Cursor adapter', () => {
    const view = toWorkflowLaunchConfigView({
      workflowLaunchMode: 'adapter',
      preferredAgentAdapter: 'cursor',
      cursorLaunchMode: 'clipboard',
      cursorAgentModel: 'auto',
      cursorLaunchModeExplicit: true,
      workflowLaunchModeExplicit: false,
      preferredAgentAdapterExplicit: false,
    });
    expect(shouldUseAgentWorkflowLabels({ ...view, effectiveAdapterId: 'cursor' })).toBe(false);
  });

  it('returns true for VS Code Chat when cursorLaunchMode defaults to clipboard', () => {
    const view = toWorkflowLaunchConfigView({
      workflowLaunchMode: 'adapter',
      preferredAgentAdapter: 'vscode-copilot',
      cursorLaunchMode: 'clipboard',
      cursorAgentModel: 'auto',
      cursorLaunchModeExplicit: false,
      workflowLaunchModeExplicit: false,
      preferredAgentAdapterExplicit: false,
    });
    expect(shouldUseAgentWorkflowLabels({ ...view, effectiveAdapterId: 'vscode-copilot' })).toBe(true);
  });
});
