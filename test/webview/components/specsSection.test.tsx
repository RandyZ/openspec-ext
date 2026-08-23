import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SpecsSection } from '../../../src/webview/components/SpecsSection';

describe('SpecsSection root-scoped empty states', () => {
  it('keeps same-id Project and Store Specs visibly bound to separate groups', () => {
    const html = renderToStaticMarkup(
      <div>
        <SpecsSection
          specs={[{ id: 'same-id', requirementCount: 1 }]}
          heading="Project Specs"
          sourceLabel="Project"
          readOnly
        />
        <SpecsSection
          specs={[{ id: 'same-id', requirementCount: 2 }]}
          heading="Referenced Store Specs: team-plans"
          sourceLabel="team-plans"
          readOnly
        />
      </div>,
    );

    expect(html).toContain('data-source="Project"');
    expect(html).toContain('data-source="team-plans"');
    expect(html).toContain('aria-label="Project: same-id"');
    expect(html).toContain('aria-label="team-plans: same-id"');
  });

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
