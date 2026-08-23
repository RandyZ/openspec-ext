import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { Header } from '../../../src/webview/components/Header';

describe('Project-first Header', () => {
  it('renders the four actions in a narrow, non-tablist launcher', () => {
    const html = renderToStaticMarkup(
      <Header
        onRefresh={vi.fn()}
        onNewChange={vi.fn()}
        loading={false}
        project={{ id: '/projects/current', label: 'Current Project', projectPath: '/projects/current' }}
        onOpenChanges={vi.fn()}
        onOpenSpecs={vi.fn()}
        onOpenWorksets={vi.fn()}
        activeProjectTab="changes"
      />
    );

    expect(html).toContain('data-project-action-grid');
    expect(html).not.toContain('role="tablist"');
    expect(html).toContain('aria-pressed="true"');
    expect(html.indexOf('data-project-action="changes"')).toBeLessThan(
      html.indexOf('data-project-action="specs"'),
    );
    expect(html.indexOf('data-project-action="specs"')).toBeLessThan(
      html.indexOf('data-project-action="worksets"'),
    );
    expect(html.indexOf('data-project-action="worksets"')).toBeLessThan(
      html.indexOf('data-project-action="dashboard"'),
    );
  });

  it('keeps the Worksets cell visible and disabled when navigation is unavailable', () => {
    const html = renderToStaticMarkup(
      <Header
        onRefresh={vi.fn()}
        onNewChange={vi.fn()}
        loading={false}
        project={{ id: '/projects/current', label: 'Current Project', projectPath: '/projects/current' }}
        onOpenChanges={vi.fn()}
        onOpenSpecs={vi.fn()}
        activeProjectTab="changes"
      />
    );

    expect(html).toMatch(/data-project-action="worksets"[^>]*disabled/);
    expect(html).toMatch(/No trusted Workset membership|Worksets unavailable/i);
  });

  it('keeps project identity and explorer navigation in separate vertical regions', () => {
    const html = renderToStaticMarkup(
      <Header
        onRefresh={vi.fn()}
        onNewChange={vi.fn()}
        loading={false}
        project={{ id: '/projects/long-project', label: 'long-project', projectPath: '/projects/long-project' }}
        binding={{
          projectId: '/projects/long-project',
          commandCwd: '/projects/long-project',
          rootPath: '/projects/long-project',
          rootSource: 'nearest',
        }}
        onOpenChanges={vi.fn()}
        onOpenSpecs={vi.fn()}
      />
    );

    expect(html).toContain('aria-label="Current Project"');
    expect(html).toContain('data-project-identity');
    expect(html).toContain('data-project-navigation');
    expect(html).toContain('Current Project');
    expect(html.indexOf('data-project-identity')).toBeLessThan(html.indexOf('data-project-navigation'));
    expect(html).toContain('data-project-navigation="true"');
    expect(html).toContain('class="flex flex-col gap-1"');
  });

  it('exposes a separate Worksets navigation action without moving Project identity', () => {
    const html = renderToStaticMarkup(
      <Header
        onRefresh={vi.fn()}
        onNewChange={vi.fn()}
        loading={false}
        project={{ id: '/projects/current', label: 'Current Project', projectPath: '/projects/current' }}
        onOpenWorksets={vi.fn()}
      />
    );

    expect(html).toContain('Browse Workset Projects');
    expect(html).toContain('data-project-action="worksets"');
    expect(html).toContain('aria-label="Browse Workset Projects"');
    expect(html).toContain('title="Browse Workset Projects"');
    expect(html.indexOf('data-project-identity')).toBeLessThan(html.indexOf('Browse Workset Projects'));
  });
});
