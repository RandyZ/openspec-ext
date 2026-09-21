import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { setLocale } from '../../../src/i18n';
import { ActionBar } from '../../../src/webview/components/ActionBar';
import { TaskList } from '../../../src/webview/components/TaskList';
import { buildExecutorLaunchPresentation } from '../../../src/shared/executorLaunchPresentation';
import type { WorkflowLaunchConfigView } from '../../../src/shared/workflowLaunchConfig';
import { resolveWorkflowActions } from '../../../src/shared/changeWorkflow';

const cursorSettingsConfig: WorkflowLaunchConfigView = {
  workflowLaunchMode: 'adapter',
  preferredAgentAdapter: 'cursor',
  cursorLaunchMode: 'deeplink',
  cursorLaunchModeExplicit: true,
  cursorAgentModel: 'auto',
  effectiveAdapterId: 'cursor',
};

const workflowSnapshot = {
  bindingKey: 'demo',
  schemaName: 'spec-driven',
  artifacts: [
    { id: 'proposal', outputPath: 'proposal.md', status: 'done' as const },
    { id: 'tasks', outputPath: 'tasks.md', status: 'ready' as const },
  ],
};

describe('Change detail executor-driven labels', () => {
  it('renders Copy labels for ActionBar and TaskList when host exposes only clipboard (no user action)', () => {
    setLocale('en');
    const presentation = buildExecutorLaunchPresentation(
      cursorSettingsConfig,
      [{ id: 'clipboard', displayName: 'Clipboard (copy to clipboard)' }],
      'cursor',
    );
    const resolvedActions = resolveWorkflowActions(workflowSnapshot, {
      completedTasks: 0,
      totalTasks: 2,
      isArchived: false,
      hasDeltaSpecs: false,
    });

    const actionBarHtml = renderToStaticMarkup(
      <ActionBar
        changeName="demo"
        isArchived={false}
        resolvedActions={resolvedActions}
        workflowLaunchConfig={presentation.uiWorkflowLaunchConfig}
        onAction={vi.fn()}
        onCopyFf={vi.fn()}
        onCopyApply={vi.fn()}
      />,
    );
    const taskListHtml = renderToStaticMarkup(
      <TaskList
        content={'- [ ] First task\n- [ ] Blocked task'}
        changeName="demo"
        workflowLaunchConfig={presentation.uiWorkflowLaunchConfig}
        onToggleTask={vi.fn()}
        onExecuteTask={vi.fn()}
      />,
    );

    expect(actionBarHtml).toContain('Copy Continue planning');
    expect(actionBarHtml).not.toContain('Open Cursor');
    expect(taskListHtml).toContain('Copy');
    expect(taskListHtml).not.toContain('>Next<');
  });

  it('renders Next labels when cursor executor is available and selected', () => {
    setLocale('en');
    const presentation = buildExecutorLaunchPresentation(
      cursorSettingsConfig,
      [
        { id: 'cursor', displayName: 'Cursor (agent CLI)' },
        { id: 'clipboard', displayName: 'Clipboard (copy to clipboard)' },
      ],
      'cursor',
    );

    const taskListHtml = renderToStaticMarkup(
      <TaskList
        content={'- [ ] First task'}
        changeName="demo"
        workflowLaunchConfig={presentation.uiWorkflowLaunchConfig}
        onToggleTask={vi.fn()}
        onExecuteTask={vi.fn()}
      />,
    );

    expect(taskListHtml).toContain('Next');
    expect(taskListHtml).not.toContain('>Copy<');
  });
});
