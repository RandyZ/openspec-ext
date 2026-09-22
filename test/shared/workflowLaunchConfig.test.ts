import { describe, expect, it } from 'vitest';
import {
  isCopyOnlyWorkflowMode,
  shouldUseAgentWorkflowLabels,
  toWorkflowLaunchConfigView,
} from '../../src/shared/workflowLaunchConfig';

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
