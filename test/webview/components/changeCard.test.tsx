import React, { isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { ChangeCard } from '../../../src/webview/components/ChangeCard';
import { ArchivedChangeCard } from '../../../src/webview/components/ArchivedChangeCard';
import type { ChangeInfo } from '../../../src/webview/types/messages';
import type { ChangeLifecycleStatus } from '../../../src/shared/changeLifecycle';
import { getWorkflowActionsForLifecycle } from '../../../src/shared/changeLifecycle';
import { setLocale, t } from '../../../src/i18n';
import type { WorkflowAction } from '../../../src/shared/workflowCommand';

const change: ChangeInfo = {
  name: 'polish-dashboard-change-detail-ui',
  completedTasks: 3,
  totalTasks: 5,
  lastModified: '2026-06-10T12:00:00.000Z',
  createdAt: '2026-06-01T09:00:00.000Z',
  status: 'in-progress',
  lifecycleStatus: 'applying',
  artifacts: [
    { id: 'proposal', outputPath: 'proposal.md', status: 'done' },
    { id: 'design', outputPath: 'design.md', status: 'done' },
  ],
  proposalWhySummary: 'Improve dashboard readability.',
  proposalWhyFullText: 'Improve dashboard readability for active changes.',
};

const LIFECYCLE_LABEL_KEYS: Record<ChangeLifecycleStatus, string> = {
  planning: 'dashboard.lifecyclePlanning',
  'ready-to-apply': 'dashboard.lifecycleReadyToApply',
  applying: 'dashboard.lifecycleApplying',
  'ready-to-verify': 'dashboard.lifecycleReadyToVerify',
  archived: 'dashboard.lifecycleArchived',
};

const ACTION_LABELS: Record<string, string> = {
  continue: 'Continue',
  ff: 'FF',
  apply: 'Apply',
  verify: 'Verify',
  archive: 'Archive',
};

function makeChange(
  lifecycleStatus: ChangeInfo['lifecycleStatus'] | 'archived',
  overrides: Partial<ChangeInfo> = {}
): ChangeInfo {
  return {
    ...change,
    lifecycleStatus: lifecycleStatus as ChangeInfo['lifecycleStatus'],
    ...overrides,
  };
}

function walkElements(node: ReactNode, visit: (el: ReactElement) => void): void {
  if (node == null || typeof node === 'boolean') return;
  if (Array.isArray(node)) {
    node.forEach((child) => walkElements(child, visit));
    return;
  }
  if (!isValidElement(node)) return;
  visit(node);
  walkElements((node.props as { children?: ReactNode }).children, visit);
}

describe('ChangeCard', () => {
  it('renders identity, summary, artifacts, time metadata, and progress', () => {
    const html = renderToStaticMarkup(
      <ChangeCard change={change} onClick={vi.fn()} onLaunchWorkflow={vi.fn()} />
    );

    expect(html).toContain('polish-dashboard-change-detail-ui');
    expect(html).toContain('Improve dashboard readability.');
    expect(html).toContain('proposal');
    expect(html).toContain('design');
    expect(html).toContain('Created');
    expect(html).toContain('Updated');
    expect(html).toContain('3 / 5 tasks');
    expect(html).toContain('60%');

    // Tooltip / Title check
    expect(html).toContain('title="Improve dashboard readability for active changes."');

    // Transitions & Focus rings check
    expect(html).toContain('transition-colors');
    expect(html).toContain('focus:outline-none');
    expect(html).toContain('focus:ring-1');
    expect(html).toContain('transition-[width]');
    expect(html).toContain('duration-150');
    expect(html).toContain('ease-out');

    // Default state: action rail exists but is visually hidden until hover/focus
    expect(html).toContain('data-action');
    expect(html).toMatch(/aria-hidden="true"/);
  });

  it('hides Created when createdAt is missing', () => {
    const html = renderToStaticMarkup(
      <ChangeCard change={{ ...change, createdAt: undefined }} onClick={vi.fn()} />
    );

    expect(html).not.toContain('Created');
    expect(html).toContain('Updated');
  });
});

describe('ChangeCard lifecycle badge', () => {
  beforeEach(() => {
    setLocale('en');
  });

  it.each(
    (Object.keys(LIFECYCLE_LABEL_KEYS) as ChangeLifecycleStatus[]).map((status) => ({
      status,
      label: t(LIFECYCLE_LABEL_KEYS[status]),
    }))
  )('renders localized badge for $status', ({ status, label }) => {
    const html = renderToStaticMarkup(
      <ChangeCard change={makeChange(status)} onClick={vi.fn()} onLaunchWorkflow={vi.fn()} />
    );

    expect(html).toContain(`data-lifecycle-status="${status}"`);
    expect(html).toContain(label);
  });

  it('shows Needs Attention when attention.required is true', () => {
    const html = renderToStaticMarkup(
      <ChangeCard
        change={makeChange('planning', {
          attention: { required: true, reasons: ['invalid-task-progress'] },
        })}
        onClick={vi.fn()}
        onLaunchWorkflow={vi.fn()}
      />
    );

    expect(html).toContain('data-attention="true"');
    expect(html).toContain(t('dashboard.needsAttention'));
  });

  it('does not show attention marker when attention is absent', () => {
    const html = renderToStaticMarkup(
      <ChangeCard change={makeChange('planning')} onClick={vi.fn()} onLaunchWorkflow={vi.fn()} />
    );

    expect(html).not.toContain('data-attention="true"');
  });
});

describe('ChangeCard lifecycle-driven workflow actions', () => {
  beforeEach(() => {
    setLocale('en');
  });

  it('prefers Host lifecycleStatus over conflicting artifact/task math for actions', () => {
    // Artifacts incomplete + tasks incomplete would have made getSmartActions return Continue/FF,
    // but Host says ready-to-verify → Verify only.
    const conflicting = makeChange('ready-to-verify', {
      status: 'draft',
      completedTasks: 0,
      totalTasks: 5,
      artifacts: [{ id: 'proposal', outputPath: 'proposal.md', status: 'ready' }],
    });

    const html = renderToStaticMarkup(
      <ChangeCard change={conflicting} onClick={vi.fn()} onLaunchWorkflow={vi.fn()} />
    );

    expect(html).toContain('data-workflow-action="verify"');
    expect(html).not.toContain('data-workflow-action="continue"');
    expect(html).not.toContain('data-workflow-action="ff"');
    expect(html).not.toContain('data-workflow-action="apply"');
    expect(html).not.toContain('data-workflow-action="archive"');
  });

  it('does not contain getSmartActions in ChangeCard source', () => {
    const source = readFileSync(
      path.resolve(__dirname, '../../../src/webview/components/ChangeCard.tsx'),
      'utf8'
    );
    expect(source).not.toContain('function getSmartActions');
    expect(source).toContain('getWorkflowActionsForLifecycle');
  });

  it.each([
    { status: 'planning' as const, actions: ['continue', 'ff'] },
    { status: 'ready-to-apply' as const, actions: ['apply'] },
    { status: 'applying' as const, actions: ['apply'] },
    { status: 'ready-to-verify' as const, actions: ['verify'] },
    { status: 'archived' as const, actions: [] as string[] },
  ])('exposes mapped actions for $status', ({ status, actions }) => {
    const html = renderToStaticMarkup(
      <ChangeCard change={makeChange(status)} onClick={vi.fn()} onLaunchWorkflow={vi.fn()} />
    );

    const expected = getWorkflowActionsForLifecycle(status).map((d) => d.action);
    expect(expected).toEqual(actions);

    for (const action of actions) {
      expect(html).toContain(`data-workflow-action="${action}"`);
    }
    for (const action of ['continue', 'ff', 'apply', 'verify', 'archive'] as WorkflowAction[]) {
      if (!actions.includes(action)) {
        expect(html).not.toContain(`data-workflow-action="${action}"`);
      }
    }
  });

  it('wires ready-to-verify to the Verify action (Verify & Archive entry point)', () => {
    const html = renderToStaticMarkup(
      <ChangeCard
        change={makeChange('ready-to-verify')}
        onClick={vi.fn()}
        onLaunchWorkflow={vi.fn()}
      />
    );
    expect(html).toContain('data-workflow-action="verify"');
    expect(html).not.toContain('data-workflow-action="apply"');
    expect(html).not.toContain('data-workflow-action="archive"');

    const source = readFileSync(
      path.resolve(__dirname, '../../../src/webview/components/ChangeCard.tsx'),
      'utf8'
    );
    expect(source).toContain('onLaunchWorkflow(descriptor.action, change.name)');
  });

  it('renders no workflow write actions when lifecycleStatus is missing', () => {
    const withoutLifecycle = { ...change } as ChangeInfo;
    delete (withoutLifecycle as { lifecycleStatus?: string }).lifecycleStatus;

    const html = renderToStaticMarkup(
      <ChangeCard change={withoutLifecycle} onClick={vi.fn()} onLaunchWorkflow={vi.fn()} />
    );

    expect(html).not.toContain('data-workflow-action=');
  });

  it('archived ChangeCard has zero workflow buttons and no task mutation callback', () => {
    const html = renderToStaticMarkup(
      <ChangeCard change={makeChange('archived')} onClick={vi.fn()} onLaunchWorkflow={vi.fn()} />
    );

    expect(html).not.toContain('data-workflow-action=');
    expect(html).toContain(t('dashboard.lifecycleArchived'));
    expect(html).not.toContain('data-action');
  });
});

describe('ChangeCard badge and action consistency', () => {
  beforeEach(() => {
    setLocale('en');
  });

  it.each([
    {
      status: 'planning' as const,
      badge: 'Planning',
      actions: ['continue', 'ff'] as WorkflowAction[],
      attention: false,
    },
    {
      status: 'ready-to-apply' as const,
      badge: 'Ready to Apply',
      actions: ['apply'] as WorkflowAction[],
      attention: false,
    },
    {
      status: 'applying' as const,
      badge: 'Applying',
      actions: ['apply'] as WorkflowAction[],
      attention: true,
    },
    {
      status: 'ready-to-verify' as const,
      badge: 'Ready to Verify',
      actions: ['verify'] as WorkflowAction[],
      attention: false,
    },
    {
      status: 'archived' as const,
      badge: 'Archived',
      actions: [] as WorkflowAction[],
      attention: false,
    },
  ])('pairs badge $badge with actions $actions', ({ status, badge, actions, attention }) => {
    const fixture = makeChange(status, {
      attention: attention
        ? { required: true, reasons: ['validation-failed'] }
        : { required: false, reasons: [] },
    });
    const html = renderToStaticMarkup(
      <ChangeCard change={fixture} onClick={vi.fn()} onLaunchWorkflow={vi.fn()} />
    );

    expect(html).toContain(`data-lifecycle-status="${status}"`);
    expect(html).toContain(badge);

    if (attention) {
      expect(html).toContain('data-attention="true"');
      expect(html).toContain('Needs Attention');
    }

    for (const action of actions) {
      expect(html).toContain(`data-workflow-action="${action}"`);
      // Verify uses raw label; others may be adapter-prefixed (Copy …)
      if (action === 'verify' || action === 'archive') {
        expect(html).toContain(ACTION_LABELS[action]);
      } else {
        expect(html).toContain(ACTION_LABELS[action]);
      }
    }

    if (actions.length === 0) {
      expect(html).not.toContain('data-workflow-action=');
    }
  });
});

describe('Dashboard ready-to-verify Verify & Archive path', () => {
  it('routes verify/archive through openChangeDetailInEditor with scopeId', () => {
    const source = readFileSync(
      path.resolve(__dirname, '../../../src/webview/components/Dashboard.tsx'),
      'utf8'
    );
    expect(source).toContain("action === 'verify' || action === 'archive'");
    expect(source).toContain("openChangeDetailInEditor(changeName, 'verifyArchive', action, state.data?.scope?.id)");
    expect(source).toContain('launchWorkflowAction(action, changeName, state.data?.scope?.id)');
  });
});

describe('ArchivedChangeCard read-only detail opening', () => {
  const archive = {
    directoryName: '2026-01-01-old-feature',
    name: 'old-feature',
    archiveDate: '2026-01-01T00:00:00.000Z',
  };

  it('renders read-only archived card without workflow write controls', () => {
    const html = renderToStaticMarkup(
      <ArchivedChangeCard archive={archive} onOpen={vi.fn()} />
    );

    expect(html).toContain('data-archived-card');
    expect(html).toContain('data-readonly="true"');
    expect(html).toContain('old-feature');
    expect(html).toContain('Archived');
    expect(html).not.toContain('data-action');
    expect(html).not.toContain('Apply');
    expect(html).toContain('read only');
  });

  it('uses the archive name when archiveDate is missing instead of inventing a date', () => {
    const html = renderToStaticMarkup(
      <ArchivedChangeCard
        archive={{ directoryName: 'undated-feature', name: 'undated-feature', archiveDate: '' }}
        onOpen={vi.fn()}
      />
    );

    expect(html).toContain('undated-feature');
    expect(html).not.toMatch(/2026-\d{2}-\d{2}/);
  });

  it('calls onOpen with directoryName when the card is activated', () => {
    const onOpen = vi.fn();
    const tree = ArchivedChangeCard({ archive, onOpen });
    let button: ReactElement | null = null;
    walkElements(tree, (el) => {
      if ((el.props as { 'data-archived-card'?: boolean })['data-archived-card']) {
        button = el;
      }
    });
    expect(button).not.toBeNull();
    (button!.props as { onClick: () => void }).onClick();
    expect(onOpen).toHaveBeenCalledWith('2026-01-01-old-feature');
  });
});
