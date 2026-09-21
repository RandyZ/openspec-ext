import { describe, expect, it } from 'vitest';
import { setLocale } from '../../../src/i18n';
import type { WorkflowLaunchConfigView } from '../../../src/shared/workflowLaunchConfig';
import {
  resolveExecutorUiLaunchConfig,
  WEBVIEW_EXECUTOR_FN_MARKER,
  WEBVIEW_EXECUTOR_UI_BUILD_MARKER,
} from '../../../src/webview/utils/executorUiLaunchConfig';
import { getTaskNextButtonLabel } from '../../../src/webview/utils/taskNextButtonLabels';
import { getWorkflowActionButtonLabel, getWorkflowLaunchModeHint } from '../../../src/webview/utils/workflowLaunchLabels';

const cursorSettingsConfig: WorkflowLaunchConfigView = {
  workflowLaunchMode: 'adapter',
  preferredAgentAdapter: 'cursor',
  cursorLaunchMode: 'deeplink',
  cursorLaunchModeExplicit: true,
  cursorAgentModel: 'auto',
  effectiveAdapterId: 'cursor',
};

describe('executorUiLaunchConfig', () => {
  it('embeds VSIX verification markers', () => {
    expect(WEBVIEW_EXECUTOR_UI_BUILD_MARKER).toBe('openspec-webview-executor-ui-v1');
    expect(WEBVIEW_EXECUTOR_FN_MARKER).toBe('buildExecutorLaunchPresentation');
  });

  it('returns Copy labels before presentation arrives (no settings cursor fallback)', () => {
    setLocale('en');
    const uiConfig = resolveExecutorUiLaunchConfig(null);
    expect(getTaskNextButtonLabel(uiConfig)).toBe('Copy');
    expect(getWorkflowActionButtonLabel('Continue planning', uiConfig)).toBe('Copy Continue planning');
    expect(getWorkflowLaunchModeHint(uiConfig)).toBe('Copies command');
  });

  it('forces Copy when settings=cursor but runtime adapters are clipboard-only with mismatched currentId', () => {
    setLocale('en');
    const uiConfig = resolveExecutorUiLaunchConfig({
      agentAdapters: {
        available: [{ id: 'clipboard', displayName: 'Clipboard (copy to clipboard)' }],
        currentId: 'cursor',
      },
      workflowLaunchConfig: cursorSettingsConfig,
      uiWorkflowLaunchConfig: cursorSettingsConfig,
    });

    expect(uiConfig.effectiveAdapterId).toBe('clipboard');
    expect(getTaskNextButtonLabel(uiConfig)).toBe('Copy');
    expect(getWorkflowActionButtonLabel('Continue planning', uiConfig)).toBe('Copy Continue planning');
    expect(getWorkflowLaunchModeHint(uiConfig)).toBe('Copies command');
  });

  it('forces Copy when adapters list is empty on init message', () => {
    setLocale('en');
    const uiConfig = resolveExecutorUiLaunchConfig({
      agentAdapters: { available: [], currentId: null },
      workflowLaunchConfig: cursorSettingsConfig,
      uiWorkflowLaunchConfig: cursorSettingsConfig,
    });

    expect(getTaskNextButtonLabel(uiConfig)).toBe('Copy');
    expect(getWorkflowActionButtonLabel('Continue planning', uiConfig)).not.toContain('Open Cursor');
  });
});
