import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { AppProvider, type AppState } from '../../../src/webview/context/AppContext';
import {
  deriveProjectDashboardSummary,
  ProjectDashboard,
} from '../../../src/webview/components/ProjectDashboard';
import type { ProjectSidebarData } from '../../../src/webview/types/messages';

vi.mock('../../../src/webview/hooks/useVscode', () => ({
  useVscode: () => ({
    postMessage: vi.fn(),
    onMessage: vi.fn(() => vi.fn()),
    getState: () => undefined,
    setState: vi.fn(),
  }),
}));

const project = {
  id: '/projects/project-a',
  label: 'Project A',
  projectPath: '/projects/project-a',
} as const;

const binding = {
  projectId: project.id,
  commandCwd: project.projectPath,
  rootPath: '/projects/project-a/openspec',
  rootSource: 'nearest',
} as const;

function change(
  name: string,
  lifecycleStatus: 'planning' | 'ready-to-apply' | 'applying' | 'ready-to-verify',
  completedTasks: number,
  totalTasks: number,
  lastModified: string,
  artifacts: ProjectSidebarData['changes'][number]['artifacts'] = [],
) {
  return {
    name,
    lifecycleStatus,
    completedTasks,
    totalTasks,
    lastModified,
    status: 'draft' as const,
    artifacts,
  };
}

const data: ProjectSidebarData = {
  project,
  binding,
  changes: [
    change('planning-change', 'planning', 1, 2, '2026-08-20T00:00:00.000Z', [
      { id: 'proposal', outputPath: 'proposal.md', status: 'done' },
      { id: 'custom', outputPath: 'custom.md', status: 'ready' },
    ]),
    change('verify-change', 'ready-to-verify', 3, 3, '2026-08-23T00:00:00.000Z', [
      { id: 'custom', outputPath: 'custom.md', status: 'done' },
      { id: 'design', outputPath: 'design.md', status: 'done' },
    ]),
    change('applying-change', 'applying', 0, 1, '2026-08-22T00:00:00.000Z', [
      { id: 'proposal', outputPath: 'proposal.md', status: 'blocked' },
    ]),
    change('ready-change', 'ready-to-apply', 0, 0, '2026-08-21T00:00:00.000Z'),
  ],
  archivedChanges: [{
    directoryName: '2026-08-19-archived-change',
    name: 'archived-change',
    archiveDate: '2026-08-19',
  }],
  projectSpecs: [],
  referencedStoreSpecs: [{
    storeId: 'team-store',
    binding: { ...binding, rootPath: '/stores/team-store', rootSource: 'store', storeId: 'team-store' },
    specs: [{ id: 'store-only-spec', requirementCount: 99 }],
  }],
};

describe('ProjectDashboard summary', () => {
  it('derives Project-only metrics from Host lifecycle and task fields', () => {
    const summary = deriveProjectDashboardSummary(data);

    expect(summary).toMatchObject({
      totalChanges: 5,
      activeChanges: 4,
      readyToVerify: 1,
      archived: 1,
      activeTasks: 6,
      lifecycle: {
        planning: 1,
        'ready-to-apply': 1,
        applying: 1,
        'ready-to-verify': 1,
        archived: 1,
      },
      artifactReadiness: [
        { id: 'proposal', done: 1, declared: 2 },
        { id: 'custom', done: 1, declared: 2 },
        { id: 'design', done: 1, declared: 1 },
      ],
    });
    expect(summary.activeTaskCompletionRate).toBeCloseTo(4 / 6);
  });

  it('uses bounded lastModified ordering and an explicit zero-task value', () => {
    const summary = deriveProjectDashboardSummary(data, 2);

    expect(summary.recentUpdates.map((item) => item.name)).toEqual([
      'verify-change',
      'applying-change',
    ]);
    expect(deriveProjectDashboardSummary({
      ...data,
      changes: [change('empty-change', 'planning', 0, 0, '2026-08-23T00:00:00.000Z')],
    }).activeTaskCompletionRate).toBeNull();
  });
});

describe('ProjectDashboard surface', () => {
  it('renders accessible summary labels, dynamic artifacts, and recent updates', () => {
    const html = renderToStaticMarkup(
      <AppProvider initialState={{
        data: null,
        projectSidebar: data,
        page: 'dashboard',
        projectFirst: true,
        loading: false,
        activity: { kind: 'idle' },
        stale: false,
        error: null,
        selectedChange: null,
        debug: false,
        cliDiagnostic: null,
      } as AppState}>
        <ProjectDashboard />
      </AppProvider>,
    );

    expect(html).toContain('data-page="projectDashboard"');
    expect(html).toContain('Total Changes');
    expect(html).toContain('Active Task Completion Rate');
    expect(html).toContain('Ready to Verify');
    expect(html).toContain('custom');
    expect(html.indexOf('verify-change')).toBeLessThan(html.indexOf('applying-change'));
    expect(html).not.toContain('NaN');
  });

  it('keeps cached metrics visible while exposing a recoverable refresh error', () => {
    const html = renderToStaticMarkup(
      <AppProvider initialState={{
        data: null,
        projectSidebar: data,
        page: 'dashboard',
        projectFirst: true,
        loading: false,
        activity: { kind: 'warning', message: 'Refresh failed' },
        stale: true,
        error: 'Refresh failed',
        selectedChange: null,
        debug: false,
        cliDiagnostic: null,
      } as AppState}>
        <ProjectDashboard />
      </AppProvider>,
    );

    expect(html).toContain('role="alert"');
    expect(html).toContain('Refresh failed');
    expect(html).toContain('Total Changes');
  });
});
