import { beforeEach, describe, expect, it } from 'vitest';
import { setLocale, t } from '../../src/i18n';
import zhCn from '../../src/i18n/locales/zh-cn.json';
import {
  getVerifyArchiveDescription,
  getVerifyArchiveHint,
  getWorkflowActionButtonLabel,
  getWorkflowLaunchModeHint,
} from '../../src/webview/utils/workflowLaunchLabels';
import type { WorkflowLaunchConfigView } from '../../src/shared/workflowLaunchConfig';

const agentPanelConfig: WorkflowLaunchConfigView = {
  workflowLaunchMode: 'adapter',
  preferredAgentAdapter: 'cursor',
  cursorLaunchMode: 'agentPanel',
  cursorAgentModel: 'auto',
  cursorLaunchModeExplicit: true,
  effectiveAdapterId: 'cursor',
};

const clipboardConfig: WorkflowLaunchConfigView = {
  workflowLaunchMode: 'clipboard',
  preferredAgentAdapter: 'clipboard',
  cursorLaunchMode: 'clipboard',
  cursorAgentModel: 'auto',
  cursorLaunchModeExplicit: false,
  effectiveAdapterId: null,
};

describe('zh-CN release debt (D1/D2/D10)', () => {
  beforeEach(() => setLocale('zh-cn'));

  it('D2: workflow action buttons use Chinese action labels, not English Verify/Copy', () => {
    expect(getWorkflowActionButtonLabel('Verify', agentPanelConfig)).toBe('打开 Agent 面板 · 验证');
    expect(getWorkflowActionButtonLabel('Apply', clipboardConfig)).toBe('复制 实施');
    expect(getWorkflowLaunchModeHint({
      ...agentPanelConfig,
      cursorLaunchMode: 'agentCli',
      cursorLaunchModeExplicit: true,
    })).toBe('无界面 Agent CLI（可能修改文件）');
  });

  it('D2: user-facing hints use 回车, not Enter', () => {
    expect(t('verifyArchive.verifyAgentPrefillHint', { command: '/opsx:verify demo' })).toContain('回车');
    expect(t('verifyArchive.verifyAgentPrefillHint', { command: '/opsx:verify demo' })).not.toMatch(/Enter/i);
    expect(t('agentLaunch.prefillHint')).toContain('回车');
  });

  it('D1: copy descriptions and hints embed the real change name, not my-change or placeholder', () => {
    const changeName = 'improve-cursor-native-interaction';
    const desc = getVerifyArchiveDescription(clipboardConfig, { isCursorHost: false }, changeName);
    expect(desc).toContain(`/opsx:verify ${changeName}`);
    expect(desc).toContain(`/opsx:archive ${changeName}`);
    expect(desc).not.toContain('my-change');
    expect(desc).not.toContain('<change-name>');

    const hint = getVerifyArchiveHint('verify', agentPanelConfig, { isCursorHost: true }, changeName);
    expect(hint).toContain(`/opsx-verify ${changeName}`);
    expect(hint).not.toContain('my-change');
  });

  it('D10: sidebar and panel chrome strings avoid stray English Dashboard/Copy labels', () => {
    expect(t('projectSidebar.dashboard')).toBe('仪表盘');
    expect(t('projectSidebar.allChanges')).toBe('全部变更');
    expect(t('projectSidebar.cardDashboardSupporting')).toBe('在编辑器中打开项目仪表盘');
    expect(t('dashboard.panelTitle')).toBe('OpenSpec 仪表盘');
    expect(t('detail.verifyArchive')).toBe('验证并归档');
    expect(t('references.copyFetchCommand')).toBe('复制获取命令');
  });

  it('locale file has no Enter/Headless in zh-cn user strings', () => {
    const values = Object.values(zhCn).join('\n');
    expect(values).not.toMatch(/\bEnter\b/);
    expect(values).not.toMatch(/\bHeadless\b/);
    expect(values).not.toMatch(/\bheadless\b/);
  });
});
