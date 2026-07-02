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
});
