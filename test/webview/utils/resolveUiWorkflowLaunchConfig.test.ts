import { describe, expect, it } from 'vitest';
import { resolveUiWorkflowLaunchConfig } from '../../../src/webview/utils/resolveUiWorkflowLaunchConfig';
import type { WorkflowLaunchConfigView } from '../../../src/shared/workflowLaunchConfig';
import { getTaskNextButtonLabel } from '../../../src/webview/utils/taskNextButtonLabels';
import { getWorkflowActionButtonLabel } from '../../../src/webview/utils/workflowLaunchLabels';
import { setLocale } from '../../../src/i18n';

const cursorLaunchConfig: WorkflowLaunchConfigView = {
  workflowLaunchMode: 'adapter',
  preferredAgentAdapter: 'cursor',
  cursorLaunchMode: 'deeplink',
  cursorLaunchModeExplicit: true,
  cursorAgentModel: 'auto',
  effectiveAdapterId: 'cursor',
};

describe('resolveUiWorkflowLaunchConfig re-export', () => {
  it('maps executor=clipboard to Copy labels', () => {
    setLocale('en');
    const uiConfig = resolveUiWorkflowLaunchConfig(cursorLaunchConfig, 'clipboard');
    expect(getTaskNextButtonLabel(uiConfig)).toBe('Copy');
    expect(getWorkflowActionButtonLabel('Continue planning', uiConfig)).toBe('Copy Continue planning');
  });
});
