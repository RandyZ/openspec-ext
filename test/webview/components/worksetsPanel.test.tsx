import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { WorksetsPanel } from '../../../src/webview/components/WorksetsPanel';

describe('WorksetsPanel', () => {
  it('renders worksets as local personal views', () => {
    const html = renderToStaticMarkup(
      <WorksetsPanel
        worksets={[
          {
            name: 'platform',
            tool: 'code',
            members: [{ name: 'team-plans', path: '/stores/team-plans' }],
          },
        ]}
        onOpenWorkset={vi.fn()}
      />,
    );

    expect(html).toContain('platform');
    expect(html).toContain('Local personal');
    expect(html).toContain('code');
    expect(html).not.toContain('shared');
  });

  it('returns null when worksets array is empty', () => {
    const html = renderToStaticMarkup(
      <WorksetsPanel worksets={[]} onOpenWorkset={vi.fn()} />,
    );
    expect(html).toBe('');
  });

  it('renders without tool label when tool is missing', () => {
    const html = renderToStaticMarkup(
      <WorksetsPanel
        worksets={[
          {
            name: 'simple',
            members: [],
          },
        ]}
        onOpenWorkset={vi.fn()}
      />,
    );

    expect(html).toContain('simple');
  });
});
