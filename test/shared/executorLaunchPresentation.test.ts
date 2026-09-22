import { describe, expect, it } from 'vitest';
import { setLocale } from '../../src/i18n';
import {
  buildExecutorLaunchPresentation,
  normalizeAgentAdaptersState,
  normalizeExecutorAdapterId,
  resolveUiWorkflowLaunchConfig,
} from '../../src/shared/executorLaunchPresentation';
import type { WorkflowLaunchConfigView } from '../../src/shared/workflowLaunchConfig';
import { getTaskNextButtonLabel } from '../../src/webview/utils/taskNextButtonLabels';
import { getWorkflowActionButtonLabel, getWorkflowLaunchModeHint } from '../../src/webview/utils/workflowLaunchLabels';

const cursorSettingsConfig: WorkflowLaunchConfigView = {
  workflowLaunchMode: 'adapter',
  preferredAgentAdapter: 'cursor',
  cursorLaunchMode: 'deeplink',
  cursorLaunchModeExplicit: true,
  cursorAgentModel: 'auto',
  effectiveAdapterId: 'cursor',
};

const clipboardOnlyAvailable = [
  { id: 'clipboard', displayName: 'Clipboard (copy to clipboard)' },
];

describe('buildExecutorLaunchPresentation', () => {
  it('initial clipboard-only host keeps adapter intent labels without user interaction', () => {
    setLocale('en');
    const presentation = buildExecutorLaunchPresentation(
      cursorSettingsConfig,
      clipboardOnlyAvailable,
      'cursor',
    );

    expect(presentation.agentAdapters.currentId).toBe('clipboard');
    expect(presentation.uiWorkflowLaunchConfig.effectiveAdapterId).toBe('cursor');
    expect(getTaskNextButtonLabel(presentation.uiWorkflowLaunchConfig)).toBe('Next with Agent');
    expect(getWorkflowActionButtonLabel('Continue planning', presentation.uiWorkflowLaunchConfig)).toBe('Open Cursor · Continue planning');
    expect(getWorkflowLaunchModeHint(presentation.uiWorkflowLaunchConfig)).toBe('Runs in Cursor');
  });

  it('cursor executor with both adapters available resolves to Next', () => {
    setLocale('en');
    const presentation = buildExecutorLaunchPresentation(
      cursorSettingsConfig,
      [
        { id: 'cursor', displayName: 'Cursor (agent CLI)' },
        ...clipboardOnlyAvailable,
      ],
      'cursor',
    );

    expect(getTaskNextButtonLabel(presentation.uiWorkflowLaunchConfig)).toBe('Next with Agent');
    expect(getWorkflowActionButtonLabel('Continue planning', presentation.uiWorkflowLaunchConfig)).toBe('Open Cursor · Continue planning');
  });
});

describe('normalizeAgentAdaptersState', () => {
  it('aligns currentId with the only available adapter', () => {
    expect(
      normalizeAgentAdaptersState(clipboardOnlyAvailable, 'cursor'),
    ).toEqual({
      available: clipboardOnlyAvailable,
      currentId: 'clipboard',
    });
  });
});

describe('resolveUiWorkflowLaunchConfig', () => {
  it('maps executor=clipboard to Agent labels when adapter mode prefers cursor', () => {
    setLocale('en');
    const uiConfig = resolveUiWorkflowLaunchConfig(cursorSettingsConfig, 'clipboard');
    expect(getTaskNextButtonLabel(uiConfig)).toBe('Next with Agent');
  });
});

describe('normalizeExecutorAdapterId', () => {
  it('never keeps cursor when only clipboard adapter is available', () => {
    expect(normalizeExecutorAdapterId('cursor', 'cursor', ['clipboard'])).toBe('clipboard');
    expect(normalizeExecutorAdapterId(null, 'cursor', ['clipboard'])).toBe('clipboard');
  });
});

describe('b663c24 regression: settings cursor + runtime clipboard only', () => {
  it('settings-only resolution keeps Agent labels even when runtime adapters are clipboard-only', () => {
    setLocale('en');
    const settingsOnly = resolveUiWorkflowLaunchConfig(cursorSettingsConfig, null, []);
    expect(getTaskNextButtonLabel(settingsOnly)).toBe('Next with Agent');
    expect(getWorkflowActionButtonLabel('Continue planning', settingsOnly)).toBe('Open Cursor · Continue planning');

    const presentation = buildExecutorLaunchPresentation(
      cursorSettingsConfig,
      clipboardOnlyAvailable,
      'cursor',
    );
    expect(getTaskNextButtonLabel(presentation.uiWorkflowLaunchConfig)).toBe('Next with Agent');
    expect(getWorkflowActionButtonLabel('Continue planning', presentation.uiWorkflowLaunchConfig)).toBe(
      'Open Cursor · Continue planning',
    );
    expect(getWorkflowLaunchModeHint(presentation.uiWorkflowLaunchConfig)).toBe('Runs in Cursor');
  });
});
