import { beforeEach, describe, expect, it } from 'vitest';
import { setLocale } from '../../../src/i18n';
import {
  getWorkflowActionButtonLabel,
  getWorkflowLaunchModeHint,
} from '../../../src/webview/utils/workflowLaunchLabels';
import {
  getEffectiveWorkflowAdapterId,
  toWorkflowLaunchConfigView,
  type WorkflowLaunchConfigWithExplicit,
} from '../../../src/shared/workflowLaunchConfig';

function viewFrom(config: WorkflowLaunchConfigWithExplicit) {
  const base = toWorkflowLaunchConfigView(config);
  return { ...base, effectiveAdapterId: getEffectiveWorkflowAdapterId(config) };
}

/** Regression matrix: Cursor/VS Code host configs M1–M10 from real-device retest oracle. */
describe('workflow launch label matrix (host × M1–M10)', () => {
  beforeEach(() => setLocale('en'));

  it('M1 default Cursor agent panel uses Open Cursor · Apply', () => {
    const config = viewFrom({
      workflowLaunchMode: 'adapter',
      preferredAgentAdapter: 'cursor',
      cursorLaunchMode: 'agentPanel',
      cursorAgentModel: 'auto',
      cursorLaunchModeExplicit: false,
      workflowLaunchModeExplicit: false,
      preferredAgentAdapterExplicit: false,
    });
    expect(getWorkflowActionButtonLabel('Apply', config)).toBe('Open Cursor · Apply');
    expect(getWorkflowLaunchModeHint(config)).toBe('Opens Agent panel');
  });

  it('M4 clipboard uses Copy Apply', () => {
    const config = viewFrom({
      workflowLaunchMode: 'clipboard',
      preferredAgentAdapter: 'clipboard',
      cursorLaunchMode: 'clipboard',
      cursorAgentModel: 'auto',
      cursorLaunchModeExplicit: false,
      workflowLaunchModeExplicit: false,
      preferredAgentAdapterExplicit: false,
    });
    expect(getWorkflowActionButtonLabel('Apply', config)).toBe('Copy Apply');
    expect(getWorkflowLaunchModeHint(config)).toBe('Copies command');
  });

  it('M6 agentCli uses Run Agent · Apply', () => {
    const config = viewFrom({
      workflowLaunchMode: 'adapter',
      preferredAgentAdapter: 'cursor',
      cursorLaunchMode: 'agentCli',
      cursorAgentModel: 'auto',
      cursorLaunchModeExplicit: true,
      workflowLaunchModeExplicit: false,
      preferredAgentAdapterExplicit: false,
    });
    expect(getWorkflowActionButtonLabel('Apply', config)).toBe('Run Agent · Apply');
  });

  it('M7 explicit Cursor clipboard uses Copy Apply', () => {
    const config = viewFrom({
      workflowLaunchMode: 'adapter',
      preferredAgentAdapter: 'cursor',
      cursorLaunchMode: 'clipboard',
      cursorAgentModel: 'auto',
      cursorLaunchModeExplicit: true,
      workflowLaunchModeExplicit: false,
      preferredAgentAdapterExplicit: false,
    });
    expect(getWorkflowActionButtonLabel('Apply', config)).toBe('Copy Apply');
  });

  it('M8 agent panel matches M1 Open Cursor wording', () => {
    const config = viewFrom({
      workflowLaunchMode: 'adapter',
      preferredAgentAdapter: 'cursor',
      cursorLaunchMode: 'agentPanel',
      cursorAgentModel: 'auto',
      cursorLaunchModeExplicit: true,
      workflowLaunchModeExplicit: false,
      preferredAgentAdapterExplicit: false,
    });
    expect(getWorkflowActionButtonLabel('Verify', config)).toBe('Open Cursor · Verify');
  });

  it('M8d deeplink uses Open Cursor · Apply', () => {
    const config = viewFrom({
      workflowLaunchMode: 'adapter',
      preferredAgentAdapter: 'cursor',
      cursorLaunchMode: 'deeplink',
      cursorAgentModel: 'auto',
      cursorLaunchModeExplicit: true,
      workflowLaunchModeExplicit: false,
      preferredAgentAdapterExplicit: false,
    });
    expect(getWorkflowActionButtonLabel('Apply', config)).toBe('Open Cursor · Apply');
  });

  it('M10 workflow clipboard uses Copy Verify', () => {
    const config = viewFrom({
      workflowLaunchMode: 'clipboard',
      preferredAgentAdapter: 'clipboard',
      cursorLaunchMode: 'agentPanel',
      cursorAgentModel: 'auto',
      cursorLaunchModeExplicit: false,
      workflowLaunchModeExplicit: true,
      preferredAgentAdapterExplicit: false,
    });
    expect(getWorkflowActionButtonLabel('Verify', config)).toBe('Copy Verify');
  });

  it('VS Code Chat default (adapter vscode-copilot, cursorLaunchMode default clipboard) uses Launch · Apply not Copy', () => {
    const config = viewFrom({
      workflowLaunchMode: 'adapter',
      preferredAgentAdapter: 'vscode-copilot',
      cursorLaunchMode: 'clipboard',
      cursorAgentModel: 'auto',
      cursorLaunchModeExplicit: false,
      workflowLaunchModeExplicit: false,
      preferredAgentAdapterExplicit: false,
    });
    expect(getWorkflowActionButtonLabel('Apply', config)).toBe('Launch · Apply');
    expect(getWorkflowLaunchModeHint(config)).toBe('Launch via adapter');
    expect(getWorkflowLaunchModeHint(config)).not.toBe('Copies command');
  });
});
