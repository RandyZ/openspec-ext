import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { setLocale } from '../../../src/i18n';
import { TaskList } from '../../../src/webview/components/TaskList';
import type { WorkflowLaunchConfigView } from '../../../src/shared/workflowLaunchConfig';

const executableConfig: WorkflowLaunchConfigView = {
  workflowLaunchMode: 'adapter',
  preferredAgentAdapter: 'cursor',
  cursorLaunchMode: 'deeplink',
  cursorAgentModel: 'auto',
  cursorLaunchModeExplicit: false,
  effectiveAdapterId: 'cursor',
};

const copyOnlyConfig: WorkflowLaunchConfigView = {
  workflowLaunchMode: 'clipboard',
  preferredAgentAdapter: 'clipboard',
  cursorLaunchMode: 'clipboard',
  cursorAgentModel: 'auto',
  cursorLaunchModeExplicit: false,
  effectiveAdapterId: null,
};

describe('TaskList next actions', () => {
  it('renders Next with Agent on incomplete tasks and hides actions on completed tasks', () => {
    setLocale('en');
    const html = renderToStaticMarkup(
      <TaskList
        content={'- [ ] First task\n- [x] Done task\n- [ ] Third task'}
        changeName="demo"
        workflowLaunchConfig={executableConfig}
        onToggleTask={vi.fn()}
        onExecuteTask={vi.fn()}
      />,
    );

    expect(html).toContain('1/3');
    expect(html.match(/Next with Agent/g)?.length).toBe(2);
    expect(html).not.toContain('Done task</span><button');
  });

  it('shows in-progress marker as incomplete and keeps it actionable', () => {
    setLocale('en');
    const html = renderToStaticMarkup(
      <TaskList
        content={'- [~] Working task'}
        changeName="demo"
        workflowLaunchConfig={executableConfig}
        onToggleTask={vi.fn()}
        onExecuteTask={vi.fn()}
      />,
    );

    expect(html).toContain('0/1');
    expect(html).toContain('Next with Agent');
    expect(html).toContain('codicon-circle-filled');
  });

  it('does not show Next on parent tasks while nested children remain incomplete', () => {
    setLocale('en');
    const html = renderToStaticMarkup(
      <TaskList
        content={'- [ ] Parent\n  - [ ] Child'}
        changeName="demo"
        workflowLaunchConfig={executableConfig}
        onToggleTask={vi.fn()}
        onExecuteTask={vi.fn()}
      />,
    );

    expect(html.match(/Next with Agent/g)?.length).toBe(1);
    expect(html).toContain('Child');
  });

  it('uses Copy when effective adapter is clipboard even if cursor launch mode is explicit', () => {
    setLocale('en');
    const html = renderToStaticMarkup(
      <TaskList
        content={'- [ ] First task'}
        changeName="demo"
        workflowLaunchConfig={{
          workflowLaunchMode: 'adapter',
          preferredAgentAdapter: 'clipboard',
          cursorLaunchMode: 'deeplink',
          cursorLaunchModeExplicit: true,
          cursorAgentModel: 'auto',
          effectiveAdapterId: 'clipboard',
        }}
        onToggleTask={vi.fn()}
        onExecuteTask={vi.fn()}
      />,
    );

    expect(html).toContain('Copy');
    expect(html).not.toContain('Next with Agent');
  });

  it('uses Copy label in copy-only mode', () => {
    setLocale('en');
    const html = renderToStaticMarkup(
      <TaskList
        content={'- [ ] First task'}
        changeName="demo"
        workflowLaunchConfig={copyOnlyConfig}
        onToggleTask={vi.fn()}
        onExecuteTask={vi.fn()}
      />,
    );

    expect(html).toContain('Copy');
    expect(html).not.toContain('Next with Agent');
  });

  it('disables blocked tasks and surfaces the blocking dependency reason', () => {
    setLocale('en');
    const html = renderToStaticMarkup(
      <TaskList
        content={'- [ ] First task\n- [ ] Blocked task'}
        changeName="demo"
        workflowLaunchConfig={executableConfig}
        taskDependencyPolicy="block"
        onToggleTask={vi.fn()}
        onExecuteTask={vi.fn()}
      />,
    );

    expect(html).toContain('Blocked: waiting on &quot;First task&quot;.');
    expect(html).toContain('aria-disabled="true"');
  });

  it('does not render next actions for archived changes', () => {
    setLocale('en');
    const html = renderToStaticMarkup(
      <TaskList
        content={'- [ ] First task'}
        changeName="demo"
        isArchived
        workflowLaunchConfig={executableConfig}
        onToggleTask={vi.fn()}
        onExecuteTask={vi.fn()}
      />,
    );

    expect(html).not.toContain('Next with Agent');
    expect(html).not.toContain('Copy');
  });
});
