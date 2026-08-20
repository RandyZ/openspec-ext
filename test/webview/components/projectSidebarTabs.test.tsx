import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SpecsSection } from '../../../src/webview/components/SpecsSection';

describe('Project-first Sidebar tab content', () => {
  it('keeps duplicate Spec ids distinguishable by source and bounds narrow labels', () => {
    const project = renderToStaticMarkup(
      <SpecsSection
        specs={[{ id: 'same-spec', requirementCount: 1 }]}
        heading="Project Specs"
        sourceLabel="Project: a very long project path"
        readOnly
      />,
    );
    const store = renderToStaticMarkup(
      <SpecsSection
        specs={[{ id: 'same-spec', requirementCount: 2 }]}
        heading="Referenced Store Specs: aihelp-workspace"
        sourceLabel="aihelp-workspace"
        readOnly
      />,
    );

    expect(project).toContain('Project Specs');
    expect(project).toContain('data-source="Project: a very long project path"');
    expect(project).toContain('same-spec');
    expect(store).toContain('Referenced Store Specs: aihelp-workspace');
    expect(store).toContain('data-source="aihelp-workspace"');
    expect(store).toContain('same-spec');
    expect(project).toContain('data-readonly="true"');
    expect(store).toContain('data-readonly="true"');
  });

  it('renders a Store failure without hiding the Project group', () => {
    const html = renderToStaticMarkup(
      <div>
        <SpecsSection specs={[{ id: 'project-spec', requirementCount: 1 }]} heading="Project Specs" />
        <SpecsSection
          specs={[]}
          heading="Referenced Store Specs: unavailable-store"
          loadError="Store Specs unavailable"
          sourceLabel="unavailable-store"
          readOnly
        />
      </div>,
    );

    expect(html).toContain('project-spec');
    expect(html).toContain('Store Specs unavailable');
  });
});
