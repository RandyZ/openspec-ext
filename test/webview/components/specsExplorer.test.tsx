import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { SpecsExplorer } from '../../../src/webview/components/SpecsExplorer';
import type { ProjectSpecsExplorerData } from '../../../src/webview/types/messages';

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

const data: ProjectSpecsExplorerData = {
  project,
  binding,
  projectSpecs: [{ id: 'shared-spec', requirementCount: 2 }],
  referencedStoreSpecs: [
    {
      storeId: 'team-plans',
      specs: [{ id: 'shared-spec', requirementCount: 4 }],
    },
    {
      storeId: 'broken-store',
      specs: [],
      error: 'Referenced Store could not be resolved',
    },
  ],
};

describe('SpecsExplorer', () => {
  it('keeps Project and CLI-confirmed referenced Store Specs in separate groups', () => {
    const html = renderToStaticMarkup(<SpecsExplorer data={data} />);

    expect(html).toContain('Project Specs');
    expect(html).toContain('Referenced Store Specs');
    expect(html).toContain('team-plans');
    expect(html).toContain('data-readonly="true"');
    expect(html).toContain('data-source="Project A"');
    expect(html).toContain('data-source="team-plans"');
    expect(html).not.toContain('unreferenced-store');
    expect(html).toContain('data-project-id="project-a"');
  });

  it('distinguishes valid empty groups from a referenced Store load error', () => {
    const html = renderToStaticMarkup(
      <SpecsExplorer
        data={{
          ...data,
          projectSpecs: [],
          referencedStoreSpecs: [
            { storeId: 'empty-store', specs: [] },
            { storeId: 'failed-store', specs: [], error: 'CLI reference failed' },
          ],
        }}
      />
    );

    expect(html).toContain('No project specs');
    expect(html).toContain('No specs in referenced Store empty-store');
    expect(html).toContain('CLI reference failed');
    expect(html).toContain('role="alert"');
  });
});
