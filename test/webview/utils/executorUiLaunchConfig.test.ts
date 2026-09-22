import { describe, expect, it } from 'vitest';
import { setLocale } from '../../../src/i18n';
import type { WorkflowLaunchConfigView } from '../../../src/shared/workflowLaunchConfig';
import {
  getExecutorUiModeLabel,
  resolveExecutorSelectValue,
  resolveExecutorUiLaunchConfig,
  shouldPersistNormalizedExecutor,
  WEBVIEW_EXECUTOR_FN_MARKER,
  WEBVIEW_EXECUTOR_NORMALIZE_MARKER,
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

const clipboardOnlyAdapters = {
  available: [{ id: 'clipboard', displayName: 'Clipboard (copy to clipboard)' }],
  currentId: 'cursor' as string | null,
};

describe('executorUiLaunchConfig', () => {
  it('embeds VSIX verification markers', () => {
    expect(WEBVIEW_EXECUTOR_UI_BUILD_MARKER).toBe('openspec-webview-executor-ui-v1');
    expect(WEBVIEW_EXECUTOR_FN_MARKER).toBe('buildExecutorLaunchPresentation');
    expect(WEBVIEW_EXECUTOR_NORMALIZE_MARKER).toBe('normalizeExecutorAdapterId');
  });

  it('returns Copy labels before presentation arrives (no settings cursor fallback)', () => {
    setLocale('en');
    const uiConfig = resolveExecutorUiLaunchConfig(null);
    expect(getTaskNextButtonLabel(uiConfig)).toBe('Copy');
    expect(getWorkflowActionButtonLabel('Continue planning', uiConfig)).toBe('Copy Continue planning');
    expect(getWorkflowLaunchModeHint(uiConfig)).toBe('Copies command');
    expect(getExecutorUiModeLabel(uiConfig)).toBe('copy');
  });

  it('keeps Agent labels when settings=adapter/cursor even if runtime adapters are clipboard-only', () => {
    setLocale('en');
    const uiConfig = resolveExecutorUiLaunchConfig({
      agentAdapters: clipboardOnlyAdapters,
      workflowLaunchConfig: cursorSettingsConfig,
      uiWorkflowLaunchConfig: cursorSettingsConfig,
    });

    expect(uiConfig.workflowLaunchMode).toBe('adapter');
    expect(uiConfig.preferredAgentAdapter).toBe('cursor');
    expect(getTaskNextButtonLabel(uiConfig)).toBe('Next with Agent');
    expect(getWorkflowActionButtonLabel('Continue planning', uiConfig)).toBe('Open Cursor · Continue planning');
    expect(getExecutorUiModeLabel(uiConfig)).toBe('cursor');
  });

  it('uses Agent labels when VS Code chat adapter is available', () => {
    setLocale('en');
    const uiConfig = resolveExecutorUiLaunchConfig({
      agentAdapters: {
        available: [
          { id: 'vscode-chat', displayName: 'VS Code Chat' },
          { id: 'clipboard', displayName: 'Clipboard (copy to clipboard)' },
        ],
        currentId: 'vscode-chat',
      },
      workflowLaunchConfig: cursorSettingsConfig,
      uiWorkflowLaunchConfig: cursorSettingsConfig,
    });

    expect(getTaskNextButtonLabel(uiConfig)).toBe('Next with Agent');
    expect(resolveExecutorSelectValue({
      available: [
        { id: 'vscode-chat', displayName: 'VS Code Chat' },
        { id: 'clipboard', displayName: 'Clipboard (copy to clipboard)' },
      ],
      currentId: 'vscode-chat',
    })).toBe('vscode-chat');
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
    expect(getWorkflowLaunchModeHint(uiConfig)).toBe('Copies command');
  });

  it('maps clipboard-only currentId=clipboard to Agent labels when adapter mode prefers cursor', () => {
    setLocale('en');
    const uiConfig = resolveExecutorUiLaunchConfig({
      agentAdapters: { ...clipboardOnlyAdapters, currentId: 'clipboard' },
      workflowLaunchConfig: cursorSettingsConfig,
      uiWorkflowLaunchConfig: cursorSettingsConfig,
    });

    expect(getExecutorUiModeLabel(uiConfig)).toBe('cursor');
    expect(getWorkflowLaunchModeHint(uiConfig)).toBe('Runs in Cursor');
  });

  it('resolves select value to clipboard when currentId is illegal', () => {
    expect(resolveExecutorSelectValue(clipboardOnlyAdapters)).toBe('clipboard');
    expect(shouldPersistNormalizedExecutor('cursor', clipboardOnlyAdapters)).toBe('clipboard');
    expect(shouldPersistNormalizedExecutor('clipboard', { ...clipboardOnlyAdapters, currentId: 'clipboard' })).toBeNull();
  });

});
