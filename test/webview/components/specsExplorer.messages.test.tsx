import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { SpecsExplorer } from '../../../src/webview/components/SpecsExplorer';
import type { OpenSpecRootBinding } from '../../../src/extension/services/types';
import type { ProjectSpecsExplorerData } from '../../../src/webview/types/messages';

const mockPostMessage = vi.hoisted(() => vi.fn());

vi.mock('../../../src/webview/hooks/useVscode', () => ({
  useVscode: () => ({ postMessage: mockPostMessage }),
}));

vi.mock('../../../src/webview/components/SpecsSection', () => ({
  SpecsSection: ({
    heading,
    sourceLabel,
    specs,
    onOpenSpec,
  }: {
    heading?: string;
    sourceLabel?: string;
    specs: Array<{ id: string; requirementCount: number }>;
    onOpenSpec?: (spec: { id: string; requirementCount: number }) => void;
  }) => {
    if (sourceLabel === 'team-store' && specs[0]) {
      onOpenSpec?.(specs[0]);
    }
    return <section data-source={sourceLabel}>{heading}</section>;
  },
}));

describe('SpecsExplorer messages', () => {
  it('opens a referenced duplicate Spec with the host-created Store binding', () => {
    mockPostMessage.mockReset();
    const project = {
      id: 'project-a',
      label: 'Project A',
      projectPath: '/workspace/project-a',
    } as const;
    const projectBinding: OpenSpecRootBinding = {
      projectId: project.id,
      commandCwd: project.projectPath,
      rootPath: '/workspace/project-a',
      rootSource: 'nearest',
    };
    const storeBinding: OpenSpecRootBinding = {
      projectId: project.id,
      commandCwd: project.projectPath,
      rootPath: '/stores/team-store',
      rootSource: 'store',
      storeId: 'team-store',
    };
    const data = {
      project,
      binding: projectBinding,
      projectSpecs: [{ id: 'shared', requirementCount: 1 }],
      referencedStoreSpecs: [{
        storeId: 'team-store',
        binding: storeBinding,
        specs: [{ id: 'shared', requirementCount: 2 }],
      }],
    } as ProjectSpecsExplorerData;

    renderToStaticMarkup(<SpecsExplorer data={data} />);

    expect(mockPostMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: 'openSpecInEditor',
      specId: 'shared',
      project,
      binding: storeBinding,
    }));
  });
});
