import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { IconButton } from '../../../src/webview/components/ui/IconButton';

describe('IconButton', () => {
  it('renders an accessible SVG button without codicon font classes', () => {
    const html = renderToStaticMarkup(
      <IconButton icon="copy" label="Copy change name" onClick={vi.fn()} />
    );

    expect(html).toContain('aria-label="Copy change name"');
    expect(html).toContain('<svg');
    expect(html).not.toContain('codicon');
  });

  it('renders a visible success icon', () => {
    const html = renderToStaticMarkup(<IconButton icon="check" label="Copied" onClick={vi.fn()} />);

    expect(html).toContain('aria-label="Copied"');
    expect(html).toContain('<svg');
  });
});
