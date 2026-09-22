import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { setLocale } from '../../../src/i18n';
import { AgentUnavailableCard } from '../../../src/webview/components/AgentUnavailableCard';

vi.mock('../../../src/webview/hooks/useVscode', () => ({
  useVscode: () => ({
    postMessage: vi.fn(),
    onMessage: () => () => {},
    getState: () => ({}),
    setState: vi.fn(),
  }),
}));

describe('AgentUnavailableCard', () => {
  it('renders info card copy and agent-first actions in English', () => {
    setLocale('en');
    const html = renderToStaticMarkup(
      <AgentUnavailableCard workspacePath="/work/demo" />,
    );

    expect(html).toContain('Can&#x27;t start Agent workflow here');
    expect(html).toContain('This folder isn&#x27;t an OpenSpec project yet.');
    expect(html).toContain('Ask Agent to init OpenSpec');
    expect(html).toContain('Copy init command');
    expect(html).not.toContain('inputValidation-errorBackground');
  });

  it('renders localized copy in Chinese', () => {
    setLocale('zh-cn');
    const html = renderToStaticMarkup(<AgentUnavailableCard />);

    expect(html).toContain('这里还不能开 Agent 工作流');
    expect(html).toContain('让 Agent 初始化 OpenSpec');
    expect(html).toContain('复制 init 命令');
  });
});
