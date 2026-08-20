import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { Header } from '../../../src/webview/components/Header';

describe('Project-first Header', () => {
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
});
