import { beforeEach, describe, expect, it } from 'vitest';
import { setLocale } from '../../../src/i18n';
import { getTaskNextButtonLabel } from '../../../src/webview/utils/taskNextButtonLabels';
import type { WorkflowLaunchConfigView } from '../../../src/shared/workflowLaunchConfig';

const copyOnlyConfig: WorkflowLaunchConfigView = {
  workflowLaunchMode: 'clipboard',
  preferredAgentAdapter: 'clipboard',
  cursorLaunchMode: 'clipboard',
  cursorAgentModel: 'auto',
  cursorLaunchModeExplicit: false,
  effectiveAdapterId: null,
};

const executableConfig: WorkflowLaunchConfigView = {
  workflowLaunchMode: 'adapter',
  preferredAgentAdapter: 'cursor',
  cursorLaunchMode: 'deeplink',
  cursorAgentModel: 'auto',
  cursorLaunchModeExplicit: false,
  effectiveAdapterId: 'cursor',
};

describe('task next button labels', () => {
  beforeEach(() => setLocale('en'));

  it('shows Next with Agent for executable launch mode', () => {
    expect(getTaskNextButtonLabel(executableConfig)).toBe('Next with Agent');
  });

  it('shows Copy for copy-only launch mode', () => {
    expect(getTaskNextButtonLabel(copyOnlyConfig)).toBe('Copy');
  });

  it('shows Working… while a task is executing', () => {
    expect(getTaskNextButtonLabel(executableConfig, { working: true })).toBe('Working…');
  });
});

describe('task next button labels (zh-cn)', () => {
  beforeEach(() => setLocale('zh-cn'));

  it('shows localized Next and Copy labels', () => {
    expect(getTaskNextButtonLabel(executableConfig)).toBe('让 Agent 继续');
    expect(getTaskNextButtonLabel(copyOnlyConfig)).toBe('复制');
    expect(getTaskNextButtonLabel(executableConfig, { working: true })).toBe('进行中…');
  });
});
