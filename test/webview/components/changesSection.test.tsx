import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ChangesSection } from '../../../src/webview/components/ChangesSection';

describe('ChangesSection root-scoped empty states', () => {
  it('names the selected root when no changes exist', () => {
    const html = renderToStaticMarkup(
      <ChangesSection
        changes={[]}
        rootLabel="Store: team-plans"
        onRequestNewChange={vi.fn()}
      />,
    );

    expect(html).toContain('No active changes in Store: team-plans');
  });

  it('names the selected root when archives are empty', () => {
    const html = renderToStaticMarkup(
      <ChangesSection
        changes={[]}
        rootLabel="Store: team-plans"
        archivedExpanded
        archivedItems={[]}
        archivedLoading={false}
        onArchivedToggle={vi.fn()}
      />,
    );

    expect(html).toContain('No archived changes in Store: team-plans');
  });
});
