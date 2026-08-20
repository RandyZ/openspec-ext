import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SpecsSection } from '../../../src/webview/components/SpecsSection';

describe('SpecsSection root-scoped empty states', () => {
  it('names the selected root when no specs exist', () => {
    const html = renderToStaticMarkup(
      <SpecsSection specs={[]} rootLabel="Store: team-plans" />,
    );

    expect(html).toContain('No specs defined in Store: team-plans');
  });

  it('supports explicit group headings and load errors', () => {
    const emptyHtml = renderToStaticMarkup(
      <SpecsSection
        specs={[]}
        heading="Project Specs"
        emptyMessage="No project specs"
      />
    );
    const errorHtml = renderToStaticMarkup(
      <SpecsSection specs={[]} heading="Referenced Store Specs" loadError="Referenced Store failed" />
    );

    expect(emptyHtml).toContain('Project Specs');
    expect(emptyHtml).toContain('No project specs');
    expect(errorHtml).toContain('Referenced Store failed');
  });
});
