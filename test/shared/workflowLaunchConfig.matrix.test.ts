import { describe, expect, it } from 'vitest';
import {
  getEffectiveWorkflowAdapterId,
  isCopyOnlyWorkflowMode,
  resolveWorkflowLaunchConfig,
  toWorkflowLaunchConfigView,
  type WorkflowLaunchConfigWithExplicit,
} from '../../src/shared/workflowLaunchConfig';

const defaults: WorkflowLaunchConfigWithExplicit = {
  workflowLaunchMode: 'clipboard',
  preferredAgentAdapter: 'clipboard',
  cursorLaunchMode: 'clipboard',
  cursorAgentModel: 'auto',
  cursorLaunchModeExplicit: false,
  workflowLaunchModeExplicit: false,
  preferredAgentAdapterExplicit: false,
};

type MatrixRow = {
  name: string;
  input: Partial<WorkflowLaunchConfigWithExplicit>;
  host: 'cursor' | 'vscode';
  expect: {
    workflowLaunchMode: 'clipboard' | 'adapter';
    preferredAgentAdapter: string;
    cursorLaunchMode: string;
    effectiveAdapterId: string | null;
    copyOnly: boolean;
  };
};

const matrix: MatrixRow[] = [
  {
    name: 'Cursor unset → agent panel defaults',
    input: {},
    host: 'cursor',
    expect: {
      workflowLaunchMode: 'adapter',
      preferredAgentAdapter: 'cursor',
      cursorLaunchMode: 'agentPanel',
      effectiveAdapterId: 'cursor',
      copyOnly: false,
    },
  },
  {
    name: 'VS Code unset → copy-only defaults',
    input: {},
    host: 'vscode',
    expect: {
      workflowLaunchMode: 'clipboard',
      preferredAgentAdapter: 'clipboard',
      cursorLaunchMode: 'clipboard',
      effectiveAdapterId: 'clipboard',
      copyOnly: true,
    },
  },
  {
    name: 'Cursor legacy workspace deeplink only (R3)',
    input: {
      cursorLaunchMode: 'agentPanel',
      cursorLaunchModeExplicit: true,
    },
    host: 'cursor',
    expect: {
      workflowLaunchMode: 'adapter',
      preferredAgentAdapter: 'cursor',
      cursorLaunchMode: 'agentPanel',
      effectiveAdapterId: 'cursor',
      copyOnly: false,
    },
  },
  {
    name: 'Cursor legacy chatCommand explicit (normalized to agentPanel on read)',
    input: {
      cursorLaunchMode: 'agentPanel',
      cursorLaunchModeExplicit: true,
    },
    host: 'cursor',
    expect: {
      workflowLaunchMode: 'adapter',
      preferredAgentAdapter: 'cursor',
      cursorLaunchMode: 'agentPanel',
      effectiveAdapterId: 'cursor',
      copyOnly: false,
    },
  },
  {
    name: 'Cursor explicit cursorLaunchMode=clipboard (copy-only launch)',
    input: {
      workflowLaunchMode: 'adapter',
      preferredAgentAdapter: 'cursor',
      cursorLaunchMode: 'clipboard',
      cursorLaunchModeExplicit: true,
    },
    host: 'cursor',
    expect: {
      workflowLaunchMode: 'adapter',
      preferredAgentAdapter: 'cursor',
      cursorLaunchMode: 'clipboard',
      effectiveAdapterId: 'cursor',
      copyOnly: true,
    },
  },
  {
    name: 'Cursor explicit copy-only workflowLaunchMode',
    input: {
      workflowLaunchModeExplicit: true,
      cursorLaunchMode: 'agentPanel',
      cursorLaunchModeExplicit: true,
    },
    host: 'cursor',
    expect: {
      workflowLaunchMode: 'clipboard',
      preferredAgentAdapter: 'clipboard',
      cursorLaunchMode: 'agentPanel',
      effectiveAdapterId: 'clipboard',
      copyOnly: true,
    },
  },
  {
    name: 'Cursor explicit clipboard adapter overrides legacy cursor mode',
    input: {
      workflowLaunchMode: 'adapter',
      preferredAgentAdapter: 'clipboard',
      preferredAgentAdapterExplicit: true,
      cursorLaunchMode: 'agentPanel',
      cursorLaunchModeExplicit: true,
    },
    host: 'cursor',
    expect: {
      workflowLaunchMode: 'adapter',
      preferredAgentAdapter: 'clipboard',
      cursorLaunchMode: 'agentPanel',
      effectiveAdapterId: 'clipboard',
      copyOnly: true,
    },
  },
  {
    name: 'Cursor explicit agentCli',
    input: {
      cursorLaunchMode: 'agentCli',
      cursorLaunchModeExplicit: true,
    },
    host: 'cursor',
    expect: {
      workflowLaunchMode: 'adapter',
      preferredAgentAdapter: 'cursor',
      cursorLaunchMode: 'agentCli',
      effectiveAdapterId: 'cursor',
      copyOnly: false,
    },
  },
  {
    name: 'Cursor explicit adapter + mode (regression)',
    input: {
      workflowLaunchMode: 'adapter',
      workflowLaunchModeExplicit: true,
      preferredAgentAdapter: 'cursor',
      preferredAgentAdapterExplicit: true,
      cursorLaunchMode: 'agentPanel',
      cursorLaunchModeExplicit: true,
    },
    host: 'cursor',
    expect: {
      workflowLaunchMode: 'adapter',
      preferredAgentAdapter: 'cursor',
      cursorLaunchMode: 'agentPanel',
      effectiveAdapterId: 'cursor',
      copyOnly: false,
    },
  },
  {
    name: 'Cursor explicit vscode-copilot adapter',
    input: {
      workflowLaunchMode: 'adapter',
      workflowLaunchModeExplicit: true,
      preferredAgentAdapter: 'vscode-copilot',
      preferredAgentAdapterExplicit: true,
      cursorLaunchMode: 'agentPanel',
      cursorLaunchModeExplicit: true,
    },
    host: 'cursor',
    expect: {
      workflowLaunchMode: 'adapter',
      preferredAgentAdapter: 'vscode-copilot',
      cursorLaunchMode: 'agentPanel',
      effectiveAdapterId: 'vscode-copilot',
      copyOnly: false,
    },
  },
];

describe('workflow launch config matrix (host × settings → route)', () => {
  it.each(matrix)('$name', ({ input, host, expect: expected }) => {
    const resolved = resolveWorkflowLaunchConfig(
      { ...defaults, ...input },
      { isCursorHost: host === 'cursor' },
    );
    const view = toWorkflowLaunchConfigView(resolved);

    expect(resolved.workflowLaunchMode).toBe(expected.workflowLaunchMode);
    expect(resolved.preferredAgentAdapter).toBe(expected.preferredAgentAdapter);
    expect(resolved.cursorLaunchMode).toBe(expected.cursorLaunchMode);
    expect(getEffectiveWorkflowAdapterId(resolved)).toBe(expected.effectiveAdapterId);
    expect(view.effectiveAdapterId).toBe(expected.effectiveAdapterId);
    expect(isCopyOnlyWorkflowMode(view)).toBe(expected.copyOnly);
  });
});
