import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { WorksetProjectPicker } from '../../../src/webview/components/WorksetProjectPicker';
import type { ProjectWorksetNavigationData } from '../../../src/webview/types/messages';

const current = {
  id: '/projects/current',
  label: 'Current Project',
  projectPath: '/projects/current',
};

const navigation: ProjectWorksetNavigationData = {
  project: current,
  worksets: [
    {
      name: 'planning',
      tool: 'vscode',
      members: [
        {
          name: current.label,
          path: current.projectPath,
          role: 'project',
          selectable: true,
          project: current,
        },
        {
          name: 'Docs Worktree',
          path: '/repos/docs-worktree',
          role: 'project',
          selectable: true,
          project: {
            id: '/repos/docs-worktree',
            label: 'Docs Worktree',
            projectPath: '/repos/docs-worktree',
          },
          git: { repository: '/repos/docs', branch: 'feature/docs' },
        },
        {
          name: 'team-plans',
          path: '/stores/team-plans',
          role: 'store',
          selectable: false,
          storeId: 'team-plans',
        },
      ],
    },
  ],
};

describe('WorksetProjectPicker', () => {
  it('renders Project-only selection rows and read-only Planning Store rows', () => {
    const html = renderToStaticMarkup(
      <WorksetProjectPicker
        navigation={navigation}
        onSelectProject={vi.fn()}
        onBackToCurrentProject={vi.fn()}
      />,
    );

    expect(html).toContain('planning');
    expect(html).toContain('vscode');
    expect(html).toContain('Docs Worktree');
    expect(html).toContain('feature/docs');
    expect(html).toContain('Planning Store');
    expect(html).toContain('data-workset-project="/repos/docs-worktree"');
    expect(html).toContain('title="/repos/docs-worktree"');
    expect(html).toContain('aria-label="Open Docs Worktree project"');
    expect(html).not.toContain('data-workset-project="/stores/team-plans"');
    expect(html).toContain('data-workset-store="team-plans"');
  });

  it('keeps the picker separate from the Project content scene and exposes a keyboard-safe return', () => {
    const html = renderToStaticMarkup(
      <WorksetProjectPicker
        navigation={navigation}
        onSelectProject={vi.fn()}
        onBackToCurrentProject={vi.fn()}
      />,
    );

    expect(html).toContain('data-workset-project-picker');
    expect(html).toContain('data-workset-picker-scene');
    expect(html).toContain('type="button"');
    expect(html).toContain('aria-label="Return to Current Project"');
    expect(html).toContain('title="Return to Current Project"');
    expect(html).toContain('min-w-0');
    expect(html).toContain('truncate');
  });

  it('shows a concise empty state when no selectable Project member exists', () => {
    const emptyNavigation: ProjectWorksetNavigationData = {
      project: current,
      worksets: [{
        name: 'stores-only',
        members: [{
          name: 'team-plans',
          path: '/stores/team-plans',
          role: 'store',
          selectable: false,
          storeId: 'team-plans',
        }],
      }],
    };

    const html = renderToStaticMarkup(
      <WorksetProjectPicker
        navigation={emptyNavigation}
        onSelectProject={vi.fn()}
        onBackToCurrentProject={vi.fn()}
      />,
    );

    expect(html).toContain('No selectable Projects');
    expect(html).not.toContain('data-workset-project=');
    expect(html).toContain('Planning Store');
  });
});
