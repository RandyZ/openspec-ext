import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ReferencesPanel } from '../../../src/webview/components/ReferencesPanel';

describe('ReferencesPanel', () => {
  it('renders resolved and unresolved referenced stores without write actions', () => {
    const html = renderToStaticMarkup(
      <ReferencesPanel
        references={[
          {
            store_id: 'platform-reqs',
            specs: [{ id: 'billing', summary: 'Billing requirements' }],
            fetch: 'openspec show billing --type spec --store platform-reqs',
            status: [],
          },
          {
            store_id: 'design-system',
            status: [
              {
                severity: 'warning',
                code: 'reference_unresolved',
                message: 'not registered',
                fix: 'Clone or register this store before using it as a reference',
              },
            ],
          },
        ]}
        onCopyFetch={vi.fn()}
      />,
    );

    expect(html).toContain('platform-reqs');
    expect(html).toContain('billing');
    expect(html).toContain('design-system');
    expect(html).toContain('Copy fetch command');
    expect(html).not.toContain('Apply');
    expect(html).not.toContain('Archive');
    expect(html).not.toContain('Verify');
  });

  it('returns null when references array is empty', () => {
    const html = renderToStaticMarkup(
      <ReferencesPanel references={[]} onCopyFetch={vi.fn()} />,
    );
    expect(html).toBe('');
  });

  it('returns null when references is undefined', () => {
    const html = renderToStaticMarkup(
      <ReferencesPanel references={undefined} onCopyFetch={vi.fn()} />,
    );
    expect(html).toBe('');
  });
});
