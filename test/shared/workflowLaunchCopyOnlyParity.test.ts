import { describe, expect, it } from 'vitest';
import { buildExecutorLaunchPresentation } from '../../src/shared/executorLaunchPresentation';
import {
  isCopyOnlyWorkflowMode,
  isHostWorkflowLaunchCopyOnly,
  resolveWorkflowLaunchConfig,
  toWorkflowLaunchConfigView,
  type WorkflowLaunchConfigWithExplicit,
} from '../../src/shared/workflowLaunchConfig';

const base: WorkflowLaunchConfigWithExplicit = {
  workflowLaunchMode: 'adapter',
  preferredAgentAdapter: 'cursor',
  cursorLaunchMode: 'agentPanel',
  cursorAgentModel: 'auto',
  cursorLaunchModeExplicit: false,
  workflowLaunchModeExplicit: false,
  preferredAgentAdapterExplicit: false,
};

type CopyOnlyCase = {
  name: string;
  input: Partial<WorkflowLaunchConfigWithExplicit>;
  host: 'cursor' | 'vscode';
  executorId: string;
};

const copyOnlyCases: CopyOnlyCase[] = [
  {
    name: 'workflowLaunchMode=clipboard with vscode-chat executor',
    input: {
      workflowLaunchMode: 'clipboard',
      workflowLaunchModeExplicit: true,
      preferredAgentAdapter: 'vscode-chat',
      preferredAgentAdapterExplicit: true,
    },
    host: 'vscode',
    executorId: 'vscode-chat',
  },
  {
    name: 'workflowLaunchMode=clipboard with cursor executor',
    input: {
      workflowLaunchMode: 'clipboard',
      workflowLaunchModeExplicit: true,
      preferredAgentAdapter: 'cursor',
      preferredAgentAdapterExplicit: true,
    },
    host: 'cursor',
    executorId: 'cursor',
  },
  {
    name: 'adapter + preferredAgentAdapter=clipboard',
    input: {
      workflowLaunchMode: 'adapter',
      preferredAgentAdapter: 'clipboard',
      preferredAgentAdapterExplicit: true,
    },
    host: 'cursor',
    executorId: 'cursor',
  },
  {
    name: 'cursorLaunchMode=clipboard',
    input: { cursorLaunchMode: 'clipboard', cursorLaunchModeExplicit: true },
    host: 'cursor',
    executorId: 'cursor',
  },
];

const notCopyOnlyCases: CopyOnlyCase[] = [
  {
    name: 'VS Code adapter + vscode-chat with implicit cursorLaunchMode=clipboard',
    input: {
      workflowLaunchMode: 'adapter',
      preferredAgentAdapter: 'vscode-chat',
    },
    host: 'vscode',
    executorId: 'vscode-chat',
  },
  {
    name: 'explicit cursorLaunchMode=clipboard with vscode-chat adapter',
    input: {
      workflowLaunchMode: 'adapter',
      preferredAgentAdapter: 'vscode-chat',
      preferredAgentAdapterExplicit: true,
      cursorLaunchMode: 'clipboard',
      cursorLaunchModeExplicit: true,
    },
    host: 'vscode',
    executorId: 'vscode-chat',
  },
];

describe('copy-only parity (host settings vs webview UI override)', () => {
  it.each(copyOnlyCases)('$name', ({ input, host, executorId }) => {
    const hostSettings = toWorkflowLaunchConfigView(
      resolveWorkflowLaunchConfig({ ...base, ...input }, { isCursorHost: host === 'cursor' }),
    );
    expect(isCopyOnlyWorkflowMode(hostSettings)).toBe(true);
    expect(isHostWorkflowLaunchCopyOnly(hostSettings)).toBe(true);

    const presentation = buildExecutorLaunchPresentation(
      hostSettings,
      [
        { id: 'clipboard', displayName: 'Clipboard' },
        { id: executorId, displayName: executorId },
      ],
      executorId,
    );

    expect(isHostWorkflowLaunchCopyOnly(presentation.workflowLaunchConfig)).toBe(true);
    if (hostSettings.workflowLaunchMode === 'clipboard') {
      expect(isCopyOnlyWorkflowMode(presentation.uiWorkflowLaunchConfig)).toBe(false);
    }
  });

  it.each(notCopyOnlyCases)('not copy-only: $name', ({ input, host, executorId }) => {
    const hostSettings = toWorkflowLaunchConfigView(
      resolveWorkflowLaunchConfig({ ...base, ...input }, { isCursorHost: host === 'cursor' }),
    );
    expect(isCopyOnlyWorkflowMode(hostSettings)).toBe(false);
    expect(isHostWorkflowLaunchCopyOnly(hostSettings)).toBe(false);

    const presentation = buildExecutorLaunchPresentation(
      hostSettings,
      [
        { id: 'clipboard', displayName: 'Clipboard' },
        { id: executorId, displayName: executorId },
      ],
      executorId,
    );

    expect(isHostWorkflowLaunchCopyOnly(presentation.workflowLaunchConfig)).toBe(false);
    expect(isCopyOnlyWorkflowMode(presentation.workflowLaunchConfig)).toBe(
      isCopyOnlyWorkflowMode(hostSettings),
    );
  });
});
