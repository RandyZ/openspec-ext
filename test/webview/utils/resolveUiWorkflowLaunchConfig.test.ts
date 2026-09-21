import { describe, expect, it } from 'vitest';
import {
  normalizeExecutorAdapterId,
  resolveUiWorkflowLaunchConfig,
} from '../../../src/webview/utils/resolveUiWorkflowLaunchConfig';
import type { WorkflowLaunchConfigView } from '../../../src/shared/workflowLaunchConfig';
import { getTaskNextButtonLabel } from '../../../src/webview/utils/taskNextButtonLabels';
import {
  getWorkflowActionButtonLabel,
  getWorkflowLaunchModeHint,
} from '../../../src/webview/utils/workflowLaunchLabels';
import { setLocale } from '../../../src/i18n';

const cursorLaunchConfig: WorkflowLaunchConfigView = {
  workflowLaunchMode: 'adapter',
  preferredAgentAdapter: 'cursor',
  cursorLaunchMode: 'deeplink',
  cursorLaunchModeExplicit: true,
  cursorAgentModel: 'auto',
  effectiveAdapterId: 'cursor',
};

describe('normalizeExecutorAdapterId', () => {
  it('uses the sole available adapter when settings prefer an unavailable cursor adapter', () => {
    expect(
      normalizeExecutorAdapterId('cursor', 'cursor', ['clipboard']),
    ).toBe('clipboard');
  });
});

describe('resolveUiWorkflowLaunchConfig', () => {
  it('maps executor=clipboard to Copy labels for task rows and header actions', () => {
    setLocale('en');
    const uiConfig = resolveUiWorkflowLaunchConfig(cursorLaunchConfig, 'clipboard');

    expect(uiConfig?.effectiveAdapterId).toBe('clipboard');
    expect(getTaskNextButtonLabel(uiConfig)).toBe('Copy');
    expect(getWorkflowActionButtonLabel('Continue planning', uiConfig)).toBe('Copy Continue planning');
    expect(getWorkflowLaunchModeHint(uiConfig)).toBe('Copies command');
  });

  it('maps executor=cursor to Next labels for task rows and header actions', () => {
    setLocale('en');
    const uiConfig = resolveUiWorkflowLaunchConfig(cursorLaunchConfig, 'cursor', ['cursor', 'clipboard']);

    expect(uiConfig?.effectiveAdapterId).toBe('cursor');
    expect(getTaskNextButtonLabel(uiConfig)).toBe('Next');
    expect(getWorkflowActionButtonLabel('Continue planning', uiConfig)).toBe('Open Cursor · Continue planning');
    expect(getWorkflowLaunchModeHint(uiConfig)).toBe('Runs in Cursor');
  });

  it('forces copy-only presentation when VS Code only exposes clipboard', () => {
    setLocale('en');
    const uiConfig = resolveUiWorkflowLaunchConfig(
      cursorLaunchConfig,
      'cursor',
      ['clipboard'],
    );

    expect(uiConfig?.preferredAgentAdapter).toBe('clipboard');
    expect(getTaskNextButtonLabel(uiConfig)).toBe('Copy');
    expect(getWorkflowActionButtonLabel('Continue planning', uiConfig)).toBe('Copy Continue planning');
    expect(getWorkflowLaunchModeHint(uiConfig)).toBe('Copies command');
  });
});
