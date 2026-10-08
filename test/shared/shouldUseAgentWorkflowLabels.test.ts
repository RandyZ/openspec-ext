import { describe, expect, it } from 'vitest';
import { shouldUseAgentWorkflowLabels, toWorkflowLaunchConfigView } from '../../src/shared/workflowLaunchConfig';

describe('shouldUseAgentWorkflowLabels', () => {
  it('returns false when cursorLaunchMode is explicit clipboard', () => {
    const view = toWorkflowLaunchConfigView({
      workflowLaunchMode: 'adapter',
      preferredAgentAdapter: 'cursor',
      cursorLaunchMode: 'clipboard',
      cursorAgentModel: 'auto',
      cursorLaunchModeExplicit: true,
      workflowLaunchModeExplicit: false,
      preferredAgentAdapterExplicit: false,
    });
    expect(shouldUseAgentWorkflowLabels(view)).toBe(false);
  });
});
