import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ChangesExplorer } from '../../../src/webview/components/ChangesExplorer';
import type {
  ArchivedChangeInfo,
  ChangeInfo,
  ProjectChangesExplorerData,
} from '../../../src/webview/types/messages';

vi.mock('../../../src/webview/hooks/useVscode', () => ({
  useVscode: () => ({
    postMessage: vi.fn(),
    onMessage: vi.fn(() => vi.fn()),
    getState: () => undefined,
    setState: vi.fn(),
  }),
}));

const project = {
  id: 'project-a',
  label: 'Project A',
  projectPath: '/workspace/project-a',
} as const;

const binding = {
  projectId: project.id,
  commandCwd: project.projectPath,
  rootPath: '/workspace/project-a/openspec',
  rootSource: 'nearest',
} as const;

function active(name: string, overrides: Partial<ChangeInfo> = {}): ChangeInfo {
  return {
    name,
    completedTasks: 1,
    totalTasks: 2,
    lastModified: '2026-08-19T10:00:00.000Z',
    createdAt: '2026-08-18T10:00:00.000Z',
    status: 'in-progress',
    lifecycleStatus: 'applying',
    ...overrides,
  };
}

function archive(name: string, directoryName: string): ArchivedChangeInfo {
  return { name, directoryName, archiveDate: '2026-08-17T10:00:00.000Z' };
}

const data: ProjectChangesExplorerData = {
  project,
  binding,
  changes: [active('shared-name'), active('current-only')],
  archivedChanges: [archive('shared-name', '2026-08-17-shared-name')],
};

describe('ChangesExplorer', () => {
  it('renders one project-bound list containing active and archived Changes', () => {
    const html = renderToStaticMarkup(<ChangesExplorer data={data} />);

    expect(html).toContain('Project A');
    expect(html).toContain('/workspace/project-a/openspec');
    expect(html).toContain('current-only');
    expect(html).toContain('data-archived-card');
    expect(html).toContain('2026-08-17T10:00:00.000Z');
    expect(html).toContain('data-project-id="project-a"');
  });

  it('keeps an empty project result distinct from a search-empty result', () => {
    const emptyHtml = renderToStaticMarkup(
      <ChangesExplorer data={{ ...data, changes: [], archivedChanges: [] }} />
    );
    const searchEmptyHtml = renderToStaticMarkup(
      <ChangesExplorer data={{ ...data, changes: [active('visible')], archivedChanges: [] }} />
    );

    expect(emptyHtml).toContain('No changes in Project A');
    expect(searchEmptyHtml).not.toContain('No changes in Project A');
  });
});
