import React from 'react';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it } from 'vitest';
import { setLocale, t } from '../../src/i18n';
import { VerifyArchivePanel } from '../../src/webview/components/VerifyArchivePanel';
import { Header } from '../../src/webview/components/Header';

const outDir = '/opt/cursor/artifacts/a3-i18n-zh-cn';

const shellCss = `
:root {
  --vscode-editor-background:#1e1e1e;
  --vscode-foreground:#cccccc;
  --vscode-descriptionForeground:#999999;
  --vscode-button-background:#0e639c;
  --vscode-button-foreground:#ffffff;
  --vscode-button-secondaryBackground:#3a3d41;
  --vscode-button-secondaryForeground:#cccccc;
  --vscode-panel-border:#3c3c3c;
  --vscode-sideBar-background:#252526;
}
body { margin:0; padding:16px; background:var(--vscode-editor-background); color:var(--vscode-foreground); font:13px sans-serif; }
.wrap { max-width:280px; border:1px solid var(--vscode-panel-border); padding:8px; background:var(--vscode-sideBar-background); }
`;

function writeFixture(name: string, body: string) {
  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    path.join(outDir, `${name}.html`),
    `<!DOCTYPE html><html lang="zh-cn"><head><meta charset="UTF-8"/><style>${shellCss}</style></head><body>${body}</body></html>`,
    'utf8',
  );
}

describe('capture A3 zh-CN fixtures', () => {
  it('writes webview HTML fixtures for D1/D2/D10 evidence', () => {
    setLocale('zh-cn');
    const changeName = 'improve-cursor-native-interaction';
    const verifyMarkup = renderToStaticMarkup(
      React.createElement(VerifyArchivePanel, {
        changeName,
        isArchived: false,
        workflowLaunchConfig: {
          workflowLaunchMode: 'adapter',
          preferredAgentAdapter: 'cursor',
          cursorLaunchMode: 'agentPanel',
          cursorAgentModel: 'auto',
          cursorLaunchModeExplicit: true,
          effectiveAdapterId: 'cursor',
        },
        onRun: () => undefined,
      }),
    );
    writeFixture(
      'd1-d2-verify-archive-panel',
      `<h2>D1/D2 · ${t('detail.verifyArchive')}</h2><div class="wrap">${verifyMarkup}</div>
<p>${t('verifyArchive.verifyAgentPrefillHint', { command: `/opsx-verify ${changeName}` })}</p>`,
    );

    const headerMarkup = renderToStaticMarkup(
      React.createElement(Header, {
        onRefresh: () => undefined,
        onNewChange: () => undefined,
        loading: false,
        project: { id: '/p/demo', label: 'Demo', projectPath: '/p/demo' },
        onOpenSpecs: () => undefined,
        onOpenDashboard: () => undefined,
        onOpenWorksets: () => undefined,
        worksetCount: 2,
      }),
    );
    writeFixture(
      'd10-project-sidebar-nav',
      `<h2>D10 · ${t('projectSidebar.navigationLabel')}</h2><div class="wrap">${headerMarkup}</div>
<p>${t('projectSidebar.allChanges')} · ${t('projectSidebar.dashboard')}</p>`,
    );

    writeFixture(
      'd2-workflow-labels',
      `<h2>D2 · 工作流动作</h2><div class="wrap">
<button style="background:var(--vscode-button-background);color:var(--vscode-button-foreground);border:none;padding:6px 10px;border-radius:4px">
${t('workflow.button.launch', { action: t('workflow.action.verify') })}
</button>
<p>${t('workflow.button.copy', { action: t('workflow.action.apply') })}</p>
<p>${t('workflow.modeHint.executableAgentCli')}</p>
<p>${t('agentLaunch.prefillHint')}</p></div>`,
    );
  });
});
